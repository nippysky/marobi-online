// lib/pdf/invoice.ts
import PDFDocument from "pdfkit/js/pdfkit.standalone.js";
import QRCode from "qrcode";
import fs from "fs";
import path from "path";

/**
 * Teeka-style invoice PDF as Buffer.
 * Mirrors the email design and includes size-mod fee + custom measurements.
 */
export async function generateInvoicePDF({
  order,
  recipient,
  currency,
  deliveryFee,
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
}): Promise<Buffer> {
  // Try to load a font with ₦ support (drop inside public/fonts)
  const fontPairs = [
    ["NotoSans-Regular.ttf", "NotoSans-Bold.ttf"],
    ["Inter-Regular.ttf", "Inter-Bold.ttf"],
    ["Roboto-Regular.ttf", "Roboto-Bold.ttf"],
  ];
  const roots = [
    path.join(process.cwd(), "public", "fonts"),
    path.join(process.cwd(), "lib", "pdf", "fonts"),
  ];
  let bodyFont = "Helvetica";
  let boldFont = "Helvetica-Bold";

  for (const [reg, bold] of fontPairs) {
    for (const root of roots) {
      const r = path.join(root, reg);
      const b = path.join(root, bold);
      if (fs.existsSync(r) && fs.existsSync(b)) {
        const docTest = fs.readFileSync(r); // just to assert existence
        void docTest;
        bodyFont = "Body";
        boldFont = "Bold";
        break;
      }
    }
  }

  const doc = new PDFDocument({ size: "A4", margin: 36, bufferPages: true });

  // Register if found
  try {
    for (const [reg, bold] of fontPairs) {
      for (const root of roots) {
        const r = path.join(root, reg);
        const b = path.join(root, bold);
        if (fs.existsSync(r) && fs.existsSync(b)) {
          doc.registerFont("Body", fs.readFileSync(r));
          doc.registerFont("Bold", fs.readFileSync(b));
          bodyFont = "Body";
          boldFont = "Bold";
          throw new Error("__break"); // quick exit
        }
      }
    }
  } catch (e: any) {
    if (e?.message !== "__break") {
      // ignore real errors, continue with Helvetica
    }
  }

  const symbol =
    currency === "NGN" ? "₦" : currency === "USD" ? "$" : currency === "EUR" ? "€" : "£";
  const currencyLabel =
    bodyFont === "Helvetica" && symbol === "₦" ? "NGN " : symbol;
  const money = (n: number) => `${currencyLabel}${Number(n).toLocaleString()}`;

  const subtotal = Number(order.totalAmount ?? 0);
  const shipping = Number(deliveryFee ?? 0);
  const total = +(subtotal + shipping).toFixed(2);

  const chunks: Buffer[] = [];
  const bufferPromise = new Promise<Buffer>((resolve, reject) => {
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  const margin = doc.page.margins.left;

  /* Header */
  doc.font(boldFont).fontSize(22).fillColor("#043927").text("Marobi", margin, margin);
  const rightBoxWidth = 200;
  const rightX = doc.page.width - margin - rightBoxWidth;

  doc.font("Helvetica").fontSize(10).fillColor("#111")
    .text(`Invoice Number:  ${order.id}`, rightX, margin, { width: rightBoxWidth, align: "right" })
    .text(`Order Date:     ${new Date(order.createdAt).toLocaleDateString()}`, rightX, margin + 14, { width: rightBoxWidth, align: "right" })
    .text(`Payment Method: ${order.paymentMethod || "—"}`, rightX, margin + 28, { width: rightBoxWidth, align: "right" });

  try {
    const qrDataURL = await QRCode.toDataURL(order.id, { margin: 0, width: 72 });
    const buf = Buffer.from(qrDataURL.split(",")[1], "base64");
    doc.image(buf, rightX + rightBoxWidth - 72, margin - 6, { width: 72 });
  } catch {}

  doc.moveDown(2.2).font(boldFont).fontSize(18).fillColor("#111").text("INVOICE", margin, 110);

  const name = `${recipient.firstName} ${recipient.lastName}`.trim();
  doc.font("Helvetica").fontSize(11).fillColor("#111")
    .text("Bill To:", margin, 140)
    .font(boldFont).text(name, margin, 154)
    .font("Helvetica").text(recipient.email || "", { width: 260 });
  if (recipient.billingAddress) doc.moveDown(0.4).text(recipient.billingAddress, { width: 260 });

  doc.font("Helvetica").fontSize(11).fillColor("#111")
    .text("Ship To:", margin + 300, 140)
    .font(boldFont).text(name, margin + 300, 154)
    .font("Helvetica");
  if (recipient.deliveryAddress) doc.moveDown(0.4).text(recipient.deliveryAddress, { width: 260 });

  /* Table */
  const priceBoxWidth = 120;
  const priceX = doc.page.width - margin - priceBoxWidth;
  const qtyX = priceX - 80;
  const productX = margin;
  let y = 260;

  const drawHeader = () => {
    doc.font(boldFont).fontSize(11).fillColor("#111")
      .text("Product", productX, y)
      .text("Quantity", qtyX, y)
      .text("Price", priceX, y, { width: priceBoxWidth, align: "right" })
      .font("Helvetica");
    y += 18;
    doc.moveTo(margin, y).lineTo(doc.page.width - margin, y).lineWidth(0.5).stroke("#e5e7eb");
    y += 8;
  };
  const ensureSpace = (needed = 40) => {
    if (y + needed > doc.page.height - margin - 120) {
      doc.addPage(); y = 260; drawHeader();
    }
  };
  drawHeader();

  order.items.forEach((it, idx) => {
    const rowBG = idx % 2 === 0 ? "#fafafa" : "#ffffff";
    const rowHeight = 44;

    ensureSpace(rowHeight + 18);
    doc.rect(margin, y - 6, doc.page.width - margin * 2, rowHeight).fillAndStroke(rowBG, rowBG);

    doc.fillColor("#111").font("Helvetica").fontSize(10)
      .text(it.name, productX, y - 2, { width: qtyX - productX - 12 });

    const subParts: string[] = [];
    if (it.color) subParts.push(`Color: ${it.color}`);
    subParts.push(`Size: ${it.hasSizeMod ? "Custom" : (it.size ?? "—")}`);
    doc.fillColor("#6b7280").fontSize(9).text(subParts.join(" • "), productX, y + 12);

    if (it.hasSizeMod && it.sizeModFee) {
      doc.fillColor("#92400e").fontSize(9)
        .text(`+5% size-mod fee: ${money((it.sizeModFee || 0) * it.quantity)}`, productX, y + 22);
    }

    if (it.hasSizeMod && it.customSize && Object.keys(it.customSize).length) {
      const readable = Object.entries(it.customSize)
        .filter(([_, v]) => v !== null && v !== undefined && String(v).trim() !== "")
        .map(([k, v]) => `${k}: ${v}`)
        .join(" • ");
      if (readable) {
        doc.fillColor("#374151").fontSize(9)
          .text(`Custom measurements: ${readable}`, productX, y + 32, { width: qtyX - productX - 12 });
      }
    }

    doc.fillColor("#111").fontSize(10).text(String(it.quantity), qtyX, y - 2, { width: 50 });
    doc.font(boldFont)
      .text(money(it.lineTotal), priceX, y - 2, { width: priceBoxWidth, align: "right" })
      .font("Helvetica");

    y += rowHeight + 6;
  });

  /* Totals */
  ensureSpace(110);
  y += 8;
  doc.moveTo(margin, y).lineTo(doc.page.width - margin, y).lineWidth(0.5).stroke("#e5e7eb");
  y += 10;

  const labelX = qtyX - 40;
  const row = (label: string, value: number | string, bold = false) => {
    doc.font(bold ? boldFont : "Helvetica").fontSize(11).fillColor("#111")
      .text(label, labelX, y, { width: priceX - labelX - 10, align: "right" })
      .text(typeof value === "number" ? money(value) : value, priceX, y, { width: priceBoxWidth, align: "right" });
    y += 18;
  };
  row("Subtotal:", subtotal);
  row("Shipping:", shipping);
  row("Total:", total, true);

  doc.font("Helvetica").fontSize(9).fillColor("#6b7280")
    .text("Thanks for shopping with Marobi.", margin, doc.page.height - margin - 20);

  doc.end();
  return bufferPromise;
}
