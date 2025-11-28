// lib/pdf/invoice.ts
//
// Marobi invoice PDF as Buffer.
// Mirrors the email-style layout and includes:
//  - Size-mod fee
//  - Custom measurements
//  - Courier name (Shipbubble or legacy delivery options)
//  - Transaction / Paystack fee in the totals
// Uses Montserrat from /public/fonts if available, with sensible fallbacks.

import PDFDocument from "pdfkit/js/pdfkit.standalone.js";
import QRCode from "qrcode";
import fs from "fs";
import path from "path";

/** Ensure deliveryDetails is always an object (handle JSON string). */
function parseDeliveryDetails(raw: any): any {
  if (!raw) return {};
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }
  return raw;
}

/** Extract courier name in the same way as the HTML receipt. */
function getCourierNameFromOrder(order: any): string | null {
  const details = parseDeliveryDetails(order?.deliveryDetails);

  const shipbubble =
    details?.shipbubble ||
    details?.shipping?.shipbubble ||
    {};

  const candidates: any[] = [
    shipbubble.courierName,
    shipbubble.courier_name,
    shipbubble.courier,
    order?.deliveryOption?.name,
    details.courierName,
    details.courier_name,
  ];

  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) {
      return c.trim();
    }
  }
  return null;
}

/**
 * Generate the invoice PDF.
 */
export async function generateInvoicePDF({
  order,
  recipient,
  currency,
  deliveryFee,
  transactionFee,
}: {
  order: {
    id: string;
    createdAt: string | Date;
    items: Array<{
      name: string;
      image?: string | null;
      quantity: number;
      lineTotal: number;
      color?: string | null;
      size?: string | null;
      hasSizeMod?: boolean;
      sizeModFee?: number;
      customSize?: any;
    }>;
    paymentMethod: string;
    totalAmount?: number; // items subtotal
    deliveryDetails?: any;
    deliveryOption?: { name?: string | null } | null;
  };
  recipient: {
    firstName: string;
    lastName: string;
    email: string;
    deliveryAddress?: string;
    billingAddress?: string;
  };
  currency: "NGN" | "USD" | "EUR" | "GBP" | string;
  deliveryFee: number;
  /** Optional gateway / Paystack transaction fee (in the same currency). */
  transactionFee?: number;
}): Promise<Buffer> {
  // Courier name (for header).
  const courierName = getCourierNameFromOrder(order) || "—";

  // 1) Choose fonts (prefer Montserrat, then Noto/Inter/Roboto, else Helvetica)
  const fontPairs: [string, string][] = [
    ["Montserrat-Regular.ttf", "Montserrat-Bold.ttf"],
    ["NotoSans-Regular.ttf", "NotoSans-Bold.ttf"],
    ["Inter-Regular.ttf", "Inter-Bold.ttf"],
    ["Roboto-Regular.ttf", "Roboto-Bold.ttf"],
  ];

  const roots = [
    path.join(process.cwd(), "public", "fonts"),
    path.join(process.cwd(), "lib", "pdf", "fonts"),
  ];

  const doc = new PDFDocument({ size: "A4", margin: 36, bufferPages: true });

  let bodyFont = "Helvetica";
  let boldFont = "Helvetica-Bold";

  // Try to register a custom font pair
  try {
    let registered = false;
    for (const [reg, bold] of fontPairs) {
      if (registered) break;
      for (const root of roots) {
        const regPath = path.join(root, reg);
        const boldPath = path.join(root, bold);
        if (fs.existsSync(regPath) && fs.existsSync(boldPath)) {
          const regBytes = fs.readFileSync(regPath);
          const boldBytes = fs.readFileSync(boldPath);

          doc.registerFont("Body", regBytes);
          doc.registerFont("Bold", boldBytes);

          bodyFont = "Body";
          boldFont = "Bold";
          registered = true;
          break;
        }
      }
    }
  } catch {
    // If anything explodes here, just fall back to Helvetica
    bodyFont = "Helvetica";
    boldFont = "Helvetica-Bold";
  }

  const symbol =
    currency === "NGN"
      ? "₦"
      : currency === "USD"
      ? "$"
      : currency === "EUR"
      ? "€"
      : "£";

  // If we're stuck on Helvetica, show "NGN 12,000" instead of "₦"
  const currencyLabel =
    bodyFont === "Helvetica" && symbol === "₦" ? "NGN " : symbol;
  const money = (n: number) =>
    `${currencyLabel}${Number(n).toLocaleString()}`;

  const subtotal = Number(order.totalAmount ?? 0);
  const shipping = Number(deliveryFee ?? 0);

  // Transaction / gateway fee – prefer explicit param, fall back to order fields.
  const gatewayFee = Number(
    transactionFee ??
      (order as any).transactionFee ??
      (order as any).paystackFeeInNaira ??
      0
  );

  const total = +(subtotal + shipping + gatewayFee).toFixed(2);

  const chunks: Buffer[] = [];
  const bufferPromise = new Promise<Buffer>((resolve, reject) => {
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  const margin = doc.page.margins.left;

  /* ---------- Header (text logo + meta) ---------- */

  doc
    .font(boldFont)
    .fontSize(22)
    .fillColor("#043927")
    .text("Marobi", margin, margin);

  const rightBoxWidth = 220;
  const rightX = doc.page.width - margin - rightBoxWidth;

  doc
    .font(bodyFont)
    .fontSize(10)
    .fillColor("#111")
    .text(`Invoice Number:  ${order.id}`, rightX, margin, {
      width: rightBoxWidth,
      align: "right",
    })
    .text(
      `Order Date:     ${new Date(order.createdAt).toLocaleDateString()}`,
      rightX,
      margin + 14,
      { width: rightBoxWidth, align: "right" }
    )
    .text(
      `Payment Method: ${order.paymentMethod || "—"}`,
      rightX,
      margin + 28,
      { width: rightBoxWidth, align: "right" }
    )
    .text(
      `Courier:        ${courierName}`,
      rightX,
      margin + 42,
      { width: rightBoxWidth, align: "right" }
    );

  // QR code for the order id (nice-to-have)
  try {
    const qrDataURL = await QRCode.toDataURL(order.id, { margin: 0, width: 72 });
    const buf = Buffer.from(qrDataURL.split(",")[1], "base64");
    doc.image(buf, rightX + rightBoxWidth - 72, margin - 6, { width: 72 });
  } catch {
    // ignore QR failures
  }

  doc
    .moveDown(2.2)
    .font(boldFont)
    .fontSize(18)
    .fillColor("#111")
    .text("INVOICE", margin, 110);

  const name = `${recipient.firstName} ${recipient.lastName}`.trim();

  doc
    .font(bodyFont)
    .fontSize(11)
    .fillColor("#111")
    .text("Bill To:", margin, 140)
    .font(boldFont)
    .text(name, margin, 154)
    .font(bodyFont)
    .text(recipient.email || "", { width: 260 });

  if (recipient.billingAddress) {
    doc.moveDown(0.4).text(recipient.billingAddress, { width: 260 });
  }

  doc
    .font(bodyFont)
    .fontSize(11)
    .fillColor("#111")
    .text("Ship To:", margin + 300, 140)
    .font(boldFont)
    .text(name, margin + 300, 154)
    .font(bodyFont);

  if (recipient.deliveryAddress) {
    doc.moveDown(0.4).text(recipient.deliveryAddress, { width: 260 });
  }

  /* ---------- Items table ---------- */

  const priceBoxWidth = 120;
  const priceX = doc.page.width - margin - priceBoxWidth;
  const qtyX = priceX - 80;
  const productX = margin;
  let y = 260;

  const drawHeader = () => {
    doc
      .font(boldFont)
      .fontSize(11)
      .fillColor("#111")
      .text("Product", productX, y)
      .text("Quantity", qtyX, y)
      .text("Price", priceX, y, {
        width: priceBoxWidth,
        align: "right",
      })
      .font(bodyFont);

    y += 18;

    doc
      .moveTo(margin, y)
      .lineTo(doc.page.width - margin, y)
      .lineWidth(0.5)
      .stroke("#e5e7eb");

    y += 8;
  };

  const ensureSpace = (needed = 40) => {
    if (y + needed > doc.page.height - margin - 120) {
      doc.addPage();
      y = 260;
      drawHeader();
    }
  };

  drawHeader();

  order.items.forEach((it, idx) => {
    const rowBG = idx % 2 === 0 ? "#fafafa" : "#ffffff";
    const rowHeight = 44;

    ensureSpace(rowHeight + 18);

    doc
      .rect(margin, y - 6, doc.page.width - margin * 2, rowHeight)
      .fillAndStroke(rowBG, rowBG);

    doc
      .fillColor("#111")
      .font(bodyFont)
      .fontSize(10)
      .text(it.name, productX, y - 2, {
        width: qtyX - productX - 12,
      });

    const subParts: string[] = [];
    if (it.color) subParts.push(`Color: ${it.color}`);
    subParts.push(`Size: ${it.hasSizeMod ? "Custom" : it.size ?? "—"}`);

    doc
      .fillColor("#6b7280")
      .fontSize(9)
      .text(subParts.join(" • "), productX, y + 12);

    if (it.hasSizeMod && it.sizeModFee) {
      doc
        .fillColor("#92400e")
        .fontSize(9)
        .text(
          `+5% size-mod fee: ${money(
            (it.sizeModFee || 0) * it.quantity
          )}`,
          productX,
          y + 22
        );
    }

    if (it.hasSizeMod && it.customSize && Object.keys(it.customSize).length) {
      const readable = Object.entries(it.customSize)
        .filter(
          ([_, v]) =>
            v !== null && v !== undefined && String(v).trim() !== ""
        )
        .map(([k, v]) => `${k}: ${v}`)
        .join(" • ");

      if (readable) {
        doc
          .fillColor("#374151")
          .fontSize(9)
          .text(`Custom measurements: ${readable}`, productX, y + 32, {
            width: qtyX - productX - 12,
          });
      }
    }

    doc
      .fillColor("#111")
      .fontSize(10)
      .font(bodyFont)
      .text(String(it.quantity), qtyX, y - 2, { width: 50 });

    doc
      .font(boldFont)
      .text(money(it.lineTotal), priceX, y - 2, {
        width: priceBoxWidth,
        align: "right",
      })
      .font(bodyFont);

    y += rowHeight + 6;
  });

  /* ---------- Totals ---------- */

  ensureSpace(110);
  y += 8;

  doc
    .moveTo(margin, y)
    .lineTo(doc.page.width - margin, y)
    .lineWidth(0.5)
    .stroke("#e5e7eb");

  y += 10;

  const labelX = qtyX - 40;
  const row = (label: string, value: number | string, isBold = false) => {
    doc
      .font(isBold ? boldFont : bodyFont)
      .fontSize(11)
      .fillColor("#111")
      .text(label, labelX, y, {
        width: priceX - labelX - 10,
        align: "right",
      })
      .text(
        typeof value === "number" ? money(value) : value,
        priceX,
        y,
        { width: priceBoxWidth, align: "right" }
      );

    y += 18;
  };

  row("Subtotal:", subtotal);
  row("Shipping:", shipping);
  row("Transaction Fee:", gatewayFee);
  row("Total:", total, true);

  doc
    .font(bodyFont)
    .fontSize(9)
    .fillColor("#6b7280")
    .text(
      "Thanks for shopping with Marobi.",
      margin,
      doc.page.height - margin - 20
    );

  doc.end();
  return bufferPromise;
}
