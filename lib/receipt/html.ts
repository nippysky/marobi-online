// lib/receipt/html.ts
//
// Shared HTML renderer for:
//  - Receipt emails
//  - Printable order receipt in the admin
//
// This version:
//  - Uses Montserrat font stack
//  - Shows brand logo from /Marobi_Logo.svg (dark green on white)
//  - Correctly surfaces courier name for Shipbubble AND normal delivery options.

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
  /**
   * Optional asset base URL for absolute paths in emails.
   * E.g. https://marobionline.com
   */
  assetBaseUrl?: string;
}

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

/**
 * Some DB drivers / ORMs may store JSON as a string.
 * This helper makes sure we always get an object.
 */
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

/**
 * Extract courier name from:
 *  - deliveryDetails.shipbubble.courierName
 *  - deliveryDetails.shipbubble.courier_name
 *  - deliveryDetails.courierName / courier_name
 *  - order.deliveryOption.name
 */
function getCourierName(order: AnyOrder): string | null {
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

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }

  return null;
}

export function renderReceiptHTML({
  order,
  recipient,
  currency,
  deliveryFee,
  assetBaseUrl,
}: RenderReceiptArgs): string {
  const name = `${recipient.firstName || ""} ${recipient.lastName || ""}`.trim();
  const subtotal = Number(order.totalAmount ?? 0);
  const shipping = Number(deliveryFee ?? order.deliveryFee ?? 0);
  const total = +(subtotal + shipping).toFixed(2);

  const courierName = getCourierName(order);
  const courierDisplay = courierName || "—";

  const symbolTotal = moneyLabel(currency, total);
  const symbolSubtotal = moneyLabel(currency, subtotal);
  const symbolShipping = moneyLabel(currency, shipping);

  const orderDate = safeDate(order.createdAt);
  const orderId = order.id || "";
  const paymentMethod = order.paymentMethod || "—";

  const items = Array.isArray(order.items) ? order.items : [];

  // Absolute URL for emails when assetBaseUrl is provided
  const logoSrc = assetBaseUrl
    ? `${assetBaseUrl}/Marobi_Logo.svg`
    : "/Marobi_Logo.svg";

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

    .wrapper {
      width: 100%;
      background: ${BG};
      padding: 32px 12px;
    }

    .card {
      max-width: 640px;
      margin: 0 auto;
      background: ${CARD_BG};
      border-radius: 12px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.06);
      overflow: hidden;
      border: 1px solid #e5e7eb;
    }

    .card-header {
      padding: 20px 32px 16px;
      border-bottom: 1px solid ${BORDER};
      text-align: left;
    }

    .brand-row {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 12px;
    }

    .brand-logo {
      display: inline-block;
      height: 32px;
    }

    .brand-text {
      font-weight: 600;
      font-size: 18px;
      letter-spacing: .06em;
      text-transform: uppercase;
      color: ${BRAND_COLOR};
    }

    .muted {
      color: ${MUTED};
      font-size: 13px;
    }

    .section-title {
      font-size: 14px;
      font-weight: 600;
      margin: 0 0 6px;
      color: #111827;
    }

    .pill {
      display: inline-block;
      padding: 6px 10px;
      border-radius: 999px;
      background: #f3f4f6;
      font-size: 11px;
      color: ${MUTED};
    }

    .order-meta {
      font-size: 12px;
      color: ${MUTED};
      margin-top: 4px;
    }

    .card-body {
      padding: 8px 32px 24px;
    }

    .items-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 12px;
      border-radius: 8px;
      overflow: hidden;
      border: 1px solid ${BORDER};
    }

    .items-table thead {
      background: #f9fafb;
    }

    .items-table th,
    .items-table td {
      padding: 10px 12px;
      font-size: 13px;
      text-align: left;
    }

    .items-table th {
      font-weight: 600;
      color: #111827;
      border-bottom: 1px solid ${BORDER};
    }

    .items-table td {
      border-bottom: 1px solid #f3f4f6;
      vertical-align: top;
    }

    .items-table tr:last-child td {
      border-bottom: none;
    }

    .item-name {
      font-weight: 500;
      color: #111827;
    }

    .item-sub {
      font-size: 11px;
      color: ${MUTED};
    }

    .totals {
      margin-top: 16px;
      width: 100%;
      font-size: 13px;
    }

    .totals-row {
      display: flex;
      justify-content: space-between;
      margin-top: 4px;
    }

    .totals-row strong {
      font-weight: 600;
    }

    .total-amount {
      font-size: 15px;
      font-weight: 700;
      color: #111827;
    }

    .info-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit,minmax(220px,1fr));
      gap: 12px;
      margin-top: 20px;
    }

    .info-box {
      border-radius: 8px;
      border: 1px solid ${BORDER};
      padding: 10px 12px;
    }

    .info-label {
      font-size: 11px;
      font-weight: 600;
      color: ${MUTED};
      text-transform: uppercase;
      letter-spacing: .06em;
      margin-bottom: 4px;
    }

    .info-value {
      font-size: 13px;
      color: #111827;
    }

    .footer {
      text-align: center;
      padding: 14px 20px 18px;
      font-size: 11px;
      color: ${MUTED};
      border-top: 1px solid ${BORDER};
      background: #f9fafb;
    }

    @media (max-width: 600px) {
      .card {
        border-radius: 0;
      }
      .card-header,
      .card-body {
        padding-left: 16px;
        padding-right: 16px;
      }
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="card">
      <div class="card-header">
        <div class="brand-row">
          <img src="${logoSrc}" alt="${BRAND_NAME} logo" class="brand-logo" />
          <span class="brand-text">${BRAND_NAME}</span>
        </div>
        <div>
          <p class="section-title">Thanks for your order</p>
          <p class="muted">
            Your order has been packed and will be picked up by a courier soon.
          </p>
          <div style="margin-top:10px;">
            <span class="pill">ORDER ${orderId || ""} (${orderDate || ""})</span>
          </div>
          <div class="order-meta">
            <span>Payment method: ${paymentMethod}</span>
          </div>
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
          <div class="totals-row">
            <span>Subtotal</span>
            <span>${symbolSubtotal}</span>
          </div>
          <div class="totals-row">
            <span>Shipping</span>
            <span>${symbolShipping}</span>
          </div>
          <div class="totals-row" style="margin-top:6px;">
            <span><strong>Total</strong></span>
            <span class="total-amount">${symbolTotal}</span>
          </div>
        </div>

        <div class="info-grid">
          <div class="info-box">
            <div class="info-label">Delivery</div>
            <div class="info-value">
              <div>Courier</div>
              <div style="margin-top:2px;color:${MUTED};font-size:12px;">
                ${courierDisplay}
              </div>
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
              <div style="margin-top:2px;color:${MUTED};font-size:12px;">
                ${recipient.email || ""}
              </div>
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
              <div style="margin-top:2px;color:${MUTED};font-size:12px;">
                ${recipient.email || ""}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="footer">
        Thanks for shopping with ${BRAND_NAME}.
      </div>
    </div>
  </div>
</body>
</html>`;
}
