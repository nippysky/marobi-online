// lib/receipt/html.ts
// Single-source, brand-consistent receipt HTML used by:
// 1) customer receipt emails
// 2) admin "View All" modal
// 3) admin "Print" action
//
// Keep this the one place you tweak visuals going forward.

export type ReceiptCurrency = "NGN" | "USD" | "EUR" | "GBP" | (string & {});
export interface ReceiptOrderForRender {
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
    customSize?: Record<string, any> | null | undefined;
  }>;
  totalAmount: number; // items subtotal (no shipping)
  paymentMethod: string;
}
export interface ReceiptRecipient {
  firstName: string;
  lastName: string;
  email: string;
  deliveryAddress?: string;
  billingAddress?: string;
}

/** Optional shipping meta passed from admin table */
export interface ReceiptShippingMeta {
  courierName?: string;
  /** Humanized "Courier • Weight: X • ETA: Y" (we’ll parse ETA/Weight defensively) */
  summary?: string;
}

/* --------- Brand tokens / font plumbing --------- */

const BRAND_NAME = "Marobi";
const BRAND_PRIMARY = "#043927";
const BRAND_BG = "#f3f4f6";
const BRAND_CARD_BG = "#ffffff";
const BRAND_BORDER = "#e5e7eb";
const BRAND_TEXT = "#111827";
const BRAND_MUTED = "#6b7280";

const PUBLIC_BASE_URL =
  process.env.NEXT_PUBLIC_APP_URL ??
  process.env.NEXTAUTH_URL ??
  "https://marobionline.com";

const BRAND_FONT_STACK =
  "'MarobiMontserrat', 'Montserrat', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif";

const FONT_FACE_CSS = `
@font-face {
  font-family: 'MarobiMontserrat';
  src: url('${PUBLIC_BASE_URL}/fonts/Montserrat-Regular.ttf') format('truetype');
  font-weight: 400;
  font-style: normal;
}
@font-face {
  font-family: 'MarobiMontserrat';
  src: url('${PUBLIC_BASE_URL}/fonts/Montserrat-Bold.ttf') format('truetype');
  font-weight: 700;
  font-style: normal;
}
`;

function currencySymbol(c: ReceiptCurrency) {
  const up = String(c).toUpperCase();
  if (up === "NGN") return "₦";
  if (up === "USD") return "$";
  if (up === "EUR") return "€";
  return "£";
}

/** Pull "ETA: ..." and "Weight: ..." out of a humanized string if present */
function parseEtaAndWeight(summary?: string) {
  let eta = "";
  let weight = "";
  if (summary && summary.includes("•")) {
    const parts = summary
      .split("•")
      .map((p) => p.trim())
      .filter(Boolean);
    const etaPart = parts.find((p) => /^ETA\s*:/.test(p));
    const wPart = parts.find((p) => /^Weight\s*:/.test(p));
    if (etaPart) eta = etaPart.replace(/^ETA\s*:\s*/i, "").trim();
    if (wPart) weight = wPart.replace(/^Weight\s*:\s*/i, "").trim();
  } else if (summary) {
    // very short summary; attempt simple matches
    const mEta = summary.match(/ETA\s*:\s*([^•]+)/i);
    const mW = summary.match(/Weight\s*:\s*([^•]+)/i);
    if (mEta) eta = mEta[1].trim();
    if (mW) weight = mW[1].trim();
  }
  return { eta, weight };
}

export function renderReceiptHTML({
  order,
  recipient,
  currency,
  deliveryFee,
  shipping, // NEW: includes courierName + humanized summary
}: {
  order: ReceiptOrderForRender;
  recipient: ReceiptRecipient;
  currency: ReceiptCurrency;
  deliveryFee: number;
  shipping?: ReceiptShippingMeta;
}) {
  const sym = currencySymbol(currency);
  const subtotal = Number(order.totalAmount ?? 0);
  const shippingFee = Number(deliveryFee ?? 0);
  const total = +(subtotal + shippingFee).toFixed(2);
  const name = `${recipient.firstName} ${recipient.lastName}`.trim();
  const orderDate = new Date(order.createdAt).toLocaleDateString();

  const { eta, weight } = parseEtaAndWeight(shipping?.summary);

  const rows = order.items
    .map((p, i) => {
      const alt = i % 2 === 0 ? "background:#fafafa;" : "";
      const parts: string[] = [];
      if (p.color) parts.push(`Color: ${p.color}`);
      parts.push(`Size: ${p.hasSizeMod ? "Custom" : p.size ?? "—"}`);

      const sizeMod =
        p.hasSizeMod && p.sizeModFee
          ? `<div style="font-size:12px;color:#92400e">+5% size-mod fee: ${sym}${(
              p.sizeModFee * p.quantity
            ).toLocaleString()}</div>`
          : "";

      let custom = "";
      if (p.hasSizeMod && p.customSize && Object.keys(p.customSize).length) {
        const readable = Object.entries(p.customSize)
          .filter(
            ([_, v]) =>
              v !== null && v !== undefined && String(v).trim() !== ""
          )
          .map(([k, v]) => `${k}: ${v}`)
          .join(" • ");
        if (readable) {
          custom = `<div style="font-size:12px;color:#374151">Custom measurements: ${readable}</div>`;
        }
      }

      return `
      <tr style="${alt}">
        <td style="padding:10px 12px;">
          <div style="display:flex;gap:20px;align-items:flex-start">
            ${
              p.image
                ? `<img src="${
                    p.image
                  }" width="44" height="44" style="object-fit:cover;border-radius:6px;border:1px solid #e5e7eb" />`
                : ""
            }
            <div style="margin-left: 30px;">
              <div style="font-weight:600;color:#111827">${p.name}</div>
              <div style="font-size:12px;color:#6b7280;">${parts.join(
                " • "
              )}</div>
              ${sizeMod}
              ${custom}
            </div>
          </div>
        </td>
        <td style="padding:10px 12px;white-space:nowrap;text-align:center;color:#111827">${p.quantity}</td>
        <td style="padding:10px 12px;white-space:nowrap;text-align:right;color:#111827;font-weight:600">${sym}${p.lineTotal.toLocaleString()}</td>
      </tr>`;
    })
    .join("");

  const logoWhiteUrl = `${PUBLIC_BASE_URL}/Marobi_Logo_White.svg`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <style type="text/css">
    ${FONT_FACE_CSS}

    body {
      margin: 0;
      background: ${BRAND_BG};
      font-family: ${BRAND_FONT_STACK};
    }

    table {
      border-collapse: collapse;
    }
  </style>
</head>
<body>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${BRAND_BG};font-family:${BRAND_FONT_STACK};">
    <tr>
      <td align="center" style="padding:24px 12px;">
        <table role="presentation" width="640" cellspacing="0" cellpadding="0" style="max-width:640px;background:${BRAND_CARD_BG};border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.05);">
          <!-- Header -->
          <tr>
            <td style="padding:18px 22px;background:${BRAND_PRIMARY};color:#fff;text-align:left;">
              <img
                src="${logoWhiteUrl}"
                alt="${BRAND_NAME}"
                height="26"
                style="display:block;max-width:180px;height:auto;"
              />
            </td>
          </tr>

          <!-- Intro + Order -->
          <tr>
            <td style="padding:16px 22px 0;font-family:${BRAND_FONT_STACK};">
              <div style="font-size:16px;font-weight:700;color:${BRAND_TEXT};margin-bottom:6px;">
                Thanks for your order
              </div>
              <div style="font-size:13px;color:#374151;line-height:1.6;">
                Your order has been packed and will be picked up by a courier soon.
              </div>
              <div style="margin-top:14px;padding:10px 12px;background:#f9fafb;border:1px solid ${BRAND_BORDER};border-radius:6px;font-size:12px;color:#374151">
                <strong>ORDER ${order.id}</strong> (${orderDate})
              </div>
            </td>
          </tr>

          <!-- Items -->
          <tr>
            <td style="padding:12px 22px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid ${BRAND_BORDER};border-radius:8px;overflow:hidden;">
                <thead>
                  <tr style="background:#f9fafb;">
                    <th align="left"  style="font-size:12px;color:#6b7280;padding:10px 12px;">Product</th>
                    <th align="center" style="font-size:12px;color:#6b7280;padding:10px 12px;">Quantity</th>
                    <th align="right" style="font-size:12px;color:#6b7280;padding:10px 12px;">Price</th>
                  </tr>
                </thead>
                <tbody>${rows}</tbody>
              </table>
            </td>
          </tr>

          <!-- Totals -->
          <tr>
            <td style="padding:6px 22px 0;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid ${BRAND_BORDER};border-radius:8px;">
                <tr>
                  <td style="padding:10px 12px;font-size:13px;color:${BRAND_TEXT};">Subtotal</td>
                  <td align="right" style="padding:10px 12px;font-size:13px;color:${BRAND_TEXT};">${sym}${subtotal.toLocaleString()}</td>
                </tr>
                <tr style="background:#fafafa">
                  <td style="padding:10px 12px;font-size:13px;color:${BRAND_TEXT};">Shipping</td>
                  <td align="right" style="padding:10px 12px;font-size:13px;color:${BRAND_TEXT};">${sym}${shippingFee.toLocaleString()}</td>
                </tr>
                <tr>
                  <td style="padding:12px 12px;font-size:14px;font-weight:700;color:${BRAND_TEXT};border-top:1px solid ${BRAND_BORDER};">Total</td>
                  <td align="right" style="padding:12px 12px;font-size:14px;font-weight:700;color:${BRAND_TEXT};border-top:1px solid ${BRAND_BORDER};">${sym}${total.toLocaleString()}</td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Delivery meta (Courier • ETA • Weight) -->
          <tr>
            <td style="padding:10px 22px 0;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid ${BRAND_BORDER};border-radius:8px;">
                <tr style="background:#f9fafb">
                  <td colspan="2" style="padding:10px 12px;font-size:12px;font-weight:700;color:#374151;">DELIVERY</td>
                </tr>
                <tr>
                  <td style="padding:10px 12px;font-size:13px;color:${BRAND_TEXT};">Courier</td>
                  <td align="right" style="padding:10px 12px;font-size:13px;color:${BRAND_TEXT};">${
                    shipping?.courierName ?? "—"
                  }</td>
                </tr>
                ${
                  eta
                    ? `<tr style="background:#fafafa">
                         <td style="padding:10px 12px;font-size:13px;color:${BRAND_TEXT};">ETA</td>
                         <td align="right" style="padding:10px 12px;font-size:13px;color:${BRAND_TEXT};">${eta}</td>
                       </tr>`
                    : ""
                }
                ${
                  weight
                    ? `<tr>
                         <td style="padding:10px 12px;font-size:13px;color:${BRAND_TEXT};">Weight</td>
                         <td align="right" style="padding:10px 12px;font-size:13px;color:${BRAND_TEXT};">${weight}</td>
                       </tr>`
                    : ""
                }
              </table>
            </td>
          </tr>

          <!-- Addresses -->
          <tr>
            <td style="padding:16px 22px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td valign="top" style="width:50%;padding-right:10px;">
                    <div style="background:#f9fafb;border:1px solid ${BRAND_BORDER};border-radius:8px;padding:12px;">
                      <div style="font-size:12px;font-weight:700;color:#374151;margin-bottom:6px;">BILLING ADDRESS</div>
                      <div style="font-size:12px;color:${BRAND_TEXT};white-space:pre-line;">
                        ${name}
                        ${
                          recipient.billingAddress
                            ? `\n${recipient.billingAddress}`
                            : ""
                        }
                        ${recipient.email ? `\n${recipient.email}` : ""}
                      </div>
                    </div>
                  </td>
                  <td valign="top" style="width:50%;padding-left:10px;">
                    <div style="background:#f9fafb;border:1px solid ${BRAND_BORDER};border-radius:8px;padding:12px;">
                      <div style="font-size:12px;font-weight:700;color:#374151;margin-bottom:6px;">SHIPPING ADDRESS</div>
                      <div style="font-size:12px;color:${BRAND_TEXT};white-space:pre-line;">
                        ${name}
                        ${
                          recipient.deliveryAddress
                            ? `\n${recipient.deliveryAddress}`
                            : ""
                        }
                        ${recipient.email ? `\n${recipient.email}` : ""}
                      </div>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:16px 22px;border-top:1px solid ${BRAND_BORDER};background:#fafafa;font-size:12px;color:${BRAND_MUTED};text-align:center;">
              Thanks for shopping with ${BRAND_NAME}.
            </td>
          </tr>
        </table>
        <div style="height:20px">&nbsp;</div>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
