// lib/receipt/html.ts
//
// Shared HTML renderer for:
//  - Receipt emails
//  - Printable order receipt in the admin
//
// Updates:
//  • Cleaner header with compact logo and NO extra “Marobi” text beside it.
//  • Always show courier name. You can override via args.shipping.courierName.
//    Otherwise we fall back to order.shipment, deliveryDetails, then deliveryOption.
//  • Tighter table + spacing so it looks polished in Gmail/Yahoo/Outlook.
//  • Uses inline width attribute on <img> for better email-client consistency.

const BRAND_NAME = "Marobi";
const BRAND_COLOR = "#043927";
const MUTED = "#6b7280";
const BORDER = "#e5e7eb";
const CARD_BG = "#ffffff";
const BG = "#f3f4f6";

type AnyOrder = any;

interface Recipient {
  firstName: string;
  lastName: string;
  email: string;
  deliveryAddress?: string | null;
  billingAddress?: string | null;
}

interface RenderReceiptArgs {
  order: AnyOrder;
  recipient: Recipient;
  currency: string; // "NGN" | "USD" | ...
  deliveryFee: number;
  /** Optional asset base URL for absolute paths in emails (e.g., https://marobionline.com). */
  assetBaseUrl?: string;
  /** Optional shipping override to guarantee courier name display. */
  shipping?: {
    courierName?: string;
    summary?: string;
  };
  /** Optional gateway / Paystack transaction fee (in the same currency). */
  transactionFee?: number;
}

/** Format money with symbol and thousands separators. */
function moneyLabel(currency: string, amount: number): string {
  const c = (currency || "NGN").toUpperCase();
  const symbol =
    c === "NGN"
      ? "₦"
      : c === "USD"
      ? "$"
      : c === "EUR"
      ? "€"
      : c === "GBP"
      ? "£"
      : "";
  const formatted = Number(amount || 0).toLocaleString();
  if (!symbol && c === "NGN") return `NGN ${formatted}`;
  if (!symbol) return `${c} ${formatted}`;
  return `${symbol}${formatted}`;
}

function safeDate(d: string | Date): string {
  try {
    return new Date(d).toLocaleDateString();
  } catch {
    return "";
  }
}

/** Be liberal: some DBs store JSON as strings. */
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

/** Best-effort courier name extraction. */
function getCourierNameFromOrder(order: AnyOrder): string | null {
  // 1) Shipment row (new schema)
  const s = order?.shipment || {};
  const shipCandidates = [
    s.courierName,
    s.courier_name, // defensive alias
    s.provider === "SHIPBUBBLE" ? s.serviceCode : undefined, // last-ditch
  ];
  for (const c of shipCandidates)
    if (typeof c === "string" && c.trim()) return c.trim();

  // 2/3) Legacy snapshot JSON from checkout
  const details = parseDeliveryDetails(order?.deliveryDetails);
  const sb = details?.shipbubble || details?.shipping?.shipbubble || {};
  const detCandidates = [
    sb.courierName,
    sb.courier_name,
    sb.courier,
    details.courierName,
    details.courier_name,
  ];
  for (const c of detCandidates)
    if (typeof c === "string" && c.trim()) return c.trim();

  // 4) Manual delivery option row
  const optName = order?.deliveryOption?.name;
  if (typeof optName === "string" && optName.trim()) return optName.trim();

  return null;
}

export function renderReceiptHTML({
  order,
  recipient,
  currency,
  deliveryFee,
  assetBaseUrl,
  shipping,
  transactionFee,
}: RenderReceiptArgs): string {
  const name = `${recipient.firstName || ""} ${
    recipient.lastName || ""
  }`.trim();
  const subtotal = Number(order.totalAmount ?? 0);
  const shipFee = Number(deliveryFee ?? order.deliveryFee ?? 0);

  // Transaction / gateway fee – prefer explicit param, fall back to order fields if present.
  const txFee = Number(
    transactionFee ??
      (order as any).transactionFee ??
      (order as any).paystackFeeInNaira ??
      0
  );

  const total = +(subtotal + shipFee + txFee).toFixed(2);

  // Priority: explicit shipping override -> order-derived
  const courierName =
    (shipping?.courierName && String(shipping.courierName).trim()) ||
    getCourierNameFromOrder(order) ||
    "—";

  const symbolTotal = moneyLabel(currency, total);
  const symbolSubtotal = moneyLabel(currency, subtotal);
  const symbolShipping = moneyLabel(currency, shipFee);
  const symbolTx = moneyLabel(currency, txFee);

  const orderDate = safeDate(order.createdAt);
  const orderId = order.id || "";
  const paymentMethod = order.paymentMethod || "—";
  const items = Array.isArray(order.items) ? order.items : [];

  // Absolute URL for emails when assetBaseUrl is provided
  const logoSrc = assetBaseUrl
    ? `${assetBaseUrl}/Marobi_Logo.png`
    : "/Marobi_Logo.png";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Invoice for order ${orderId} - ${BRAND_NAME}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style type="text/css">
    /* Email-safe Montserrat import */
    @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700&display=swap');

    body {
      margin: 0;
      padding: 0;
      background: ${BG};
      font-family: 'Montserrat', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }

    .wrapper { width: 100%; background: ${BG}; padding: 28px 12px; }
    .card {
      max-width: 640px; margin: 0 auto; background: ${CARD_BG};
      border-radius: 12px; box-shadow: 0 3px 14px rgba(0,0,0,0.06);
      overflow: hidden; border: 1px solid #e5e7eb;
    }

    .card-header { padding: 18px 24px 14px; border-bottom: 1px solid ${BORDER}; }
    .brand { display: flex; align-items: center; gap: 12px; }
    .muted { color: ${MUTED}; font-size: 13px; }
    .section-title { font-size: 14px; font-weight: 600; margin: 10px 0 4px; color: #111827; }

    .pill {
      display: inline-block; padding: 6px 10px; border-radius: 999px;
      background: #f3f4f6; font-size: 11px; color: ${MUTED};
    }

    .order-meta { font-size: 12px; color: ${MUTED}; margin-top: 4px; }

    .card-body { padding: 12px 24px 22px; }

    .items-table { width: 100%; border-collapse: collapse; margin-top: 8px; border: 1px solid ${BORDER}; }
    .items-table thead { background: #f9fafb; }
    .items-table th, .items-table td { padding: 10px 12px; font-size: 13px; text-align: left; }
    .items-table th { font-weight: 600; color: #111827; border-bottom: 1px solid ${BORDER}; }
    .items-table td { border-bottom: 1px solid #f3f4f6; vertical-align: top; }
    .items-table tr:last-child td { border-bottom: none; }
    .item-name { font-weight: 500; color: #111827; }
    .item-sub { font-size: 11px; color: ${MUTED}; }

    .totals { margin-top: 14px; width: 100%; font-size: 13px; }
    .totals-row { display: flex; justify-content: space-between; margin-top: 4px; }
    .total-amount { font-size: 15px; font-weight: 700; color: #111827; }

    .info-grid { display: grid; grid-template-columns: repeat(auto-fit,minmax(220px,1fr)); gap: 12px; margin-top: 18px; }
    .info-box { border-radius: 8px; border: 1px solid ${BORDER}; padding: 10px 12px; }
    .info-label { font-size: 11px; font-weight: 600; color: ${MUTED}; text-transform: uppercase; letter-spacing: .06em; margin-bottom: 4px; }
    .info-value { font-size: 13px; color: #111827; }

    .footer { text-align: center; padding: 12px 18px 16px; font-size: 11px; color: ${MUTED}; border-top: 1px solid ${BORDER}; background: #f9fafb; }

    @media (max-width: 600px) {
      .card { border-radius: 0; }
      .card-header, .card-body { padding-left: 16px; padding-right: 16px; }
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="card">
      <div class="card-header">
        <div class="brand">
          <!-- Smaller, controlled width for email clients; no brand text beside it -->
          <img src="${logoSrc}" alt="${BRAND_NAME} logo" width="120" style="display:block;height:auto;border:0;outline:none;text-decoration:none;" />
        </div>
        <div>
          <p class="section-title">Thanks for your order</p>
          <p class="muted">Your order has been packed and will be picked up by a courier soon.</p>
          <div style="margin-top:8px;"><span class="pill">ORDER ${orderId || ""} (${orderDate || ""})</span></div>
          <div class="order-meta"><span>Payment method: ${paymentMethod}</span></div>
        </div>
      </div>

      <div class="card-body">
        <table class="items-table" role="presentation">
          <thead>
            <tr>
              <th style="width: 55%;">Product</th>
              <th style="width: 15%;">Quantity</th>
              <th style="width: 30%; text-align:right;">Price</th>
            </tr>
          </thead>
          <tbody>
            ${items
              .map((it: any) => {
                const parts: string[] = [];
                if (it?.color) parts.push(`Color: ${it.color}`);
                if (it?.size) parts.push(`Size: ${it.size}`);
                const sub = parts.join(" • ");
                const lineTotal = moneyLabel(currency, it?.lineTotal ?? 0);
                const sizeModLine =
                  it?.hasSizeMod && it?.sizeModFee
                    ? `<div class="item-sub" style="color:#92400e;">+5% size-mod fee included</div>`
                    : "";
                return `
                <tr>
                  <td>
                    <div class="item-name">${it?.name || ""}</div>
                    ${sub ? `<div class="item-sub">${sub}</div>` : ""}
                    ${sizeModLine}
                  </td>
                  <td>${it?.quantity ?? ""}</td>
                  <td style="text-align:right;">${lineTotal}</td>
                </tr>
              `;
              })
              .join("")}
          </tbody>
        </table>

        <div class="totals">
          <div class="totals-row"><span>Subtotal</span><span>${symbolSubtotal}</span></div>
          <div class="totals-row"><span>Shipping</span><span>${symbolShipping}</span></div>
          <div class="totals-row"><span>Paystack Transaction Fee</span><span>${symbolTx}</span></div>
          <div class="totals-row" style="margin-top:6px;"><span><strong>Total</strong></span><span class="total-amount">${symbolTotal}</span></div>
        </div>

        <div class="info-grid">
          <div class="info-box">
            <div class="info-label">Delivery</div>
            <div class="info-value">
              <div>Courier</div>
              <div style="margin-top:2px;color:${MUTED};font-size:12px;">${courierName}</div>
            </div>
          </div>

          <div class="info-box">
            <div class="info-label">Billing Address</div>
            <div class="info-value">
              <div>${name || ""}</div>
              ${
                recipient.billingAddress
                  ? `<div style="margin-top:2px;">${recipient.billingAddress}</div>`
                  : ""
              }
              <div style="margin-top:2px;color:${MUTED};font-size:12px;">${
                recipient.email || ""
              }</div>
            </div>
          </div>

          <div class="info-box">
            <div class="info-label">Shipping Address</div>
            <div class="info-value">
              <div>${name || ""}</div>
              ${
                recipient.deliveryAddress
                  ? `<div style="margin-top:2px;">${recipient.deliveryAddress}</div>`
                  : ""
              }
              <div style="margin-top:2px;color:${MUTED};font-size:12px;">${
                recipient.email || ""
              }</div>
            </div>
          </div>
        </div>
      </div>

      <div class="footer">Thanks for shopping with ${BRAND_NAME}.</div>
    </div>
  </div>
</body>
</html>`;
}
