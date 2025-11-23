// lib/mail.ts
//
// Centralised email utilities for Marobi with strong recipient validation.
// Now upgraded to use brand logo assets + Montserrat everywhere.
//
// REQUIRED ENV:
//   EMAIL_HOST=smtp.hostinger.com
//   EMAIL_PORT=465
//   EMAIL_USER=info@marobionline.com
//   EMAIL_PASS=***********
//   EMAIL_NO_REPLY=no-reply@marobionline.com
//   EMAIL_SHIPPING=shipping@marobionline.com
//   EMAIL_INFO=info@marobionline.com
//
// OPTIONAL ENV (pretty From headers):
//   EMAIL_FROM_NO_REPLY="Marobi <no-reply@marobionline.com>"
//   EMAIL_FROM_SHIPPING="Marobi Shipping <shipping@marobionline.com>"
//   EMAIL_FROM_INFO="Marobi <info@marobionline.com>"
//
// OPTIONAL (SMTP envelope sender override; defaults to EMAIL_INFO):
//   EMAIL_ENVELOPE_FROM=info@marobionline.com
//
// OPTIONAL (base URL used for logo URLs in emails):
//   NEXT_PUBLIC_APP_URL=https://marobionline.com
//   or fallback to NEXTAUTH_URL / https://marobionline.com

import nodemailer from "nodemailer";
import { prisma } from "@/lib/db";
import { generateInvoicePDF } from "@/lib/pdf/invoice";
import { renderReceiptHTML } from "@/lib/receipt/html";

/* ---------- Brand Tokens ---------- */

const BRAND_NAME = "Marobi";
const BRAND_COLOR = "#043927";
const BRAND_ACCENT = "#FFC300";
const BG_OUTER = "#f3f4f6";
const CARD_BG = "#ffffff";
const TEXT_COLOR = "#111827";
const MUTED_COLOR = "#6b7280";
const BORDER_RADIUS = "8px";

// Email-safe font stack (Montserrat first, then system fallbacks)
const BRAND_FONT_STACK =
  "'Montserrat', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

// Where to host assets for emails (logos, etc.)
function getAppBaseUrl(): string {
  const explicit =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXTAUTH_URL ||
    "https://marobionline.com";

  // strip trailing slashes so we can safely append paths
  return explicit.replace(/\/+$/, "");
}

const APP_BASE_URL = getAppBaseUrl();

// Green logo for light backgrounds
const BRAND_LOGO_DARK_BG = `${APP_BASE_URL}/Marobi_Logo_White.svg`;
// Green logo (optional) for light email bodies or sections if you need it later
const BRAND_LOGO_LIGHT_BG = `${APP_BASE_URL}/Marobi_Logo.svg`;

/* ---------- SMTP Transporter ---------- */

const smtpHost = process.env.EMAIL_HOST || "smtp.hostinger.com";
const smtpPort = process.env.EMAIL_PORT ? Number(process.env.EMAIL_PORT) : 465;
const smtpUser = process.env.EMAIL_USER; // e.g. info@marobionline.com
const smtpPass = process.env.EMAIL_PASS;

if (!smtpUser || !smtpPass) {
  console.warn(
    "[mail] WARNING: EMAIL_USER or EMAIL_PASS not set. Outbound emails will fail until configured."
  );
}

export const transporter = nodemailer.createTransport({
  host: smtpHost,
  port: smtpPort,
  secure: smtpPort === 465, // SSL on 465; STARTTLS if 587
  auth: smtpUser && smtpPass ? { user: smtpUser, pass: smtpPass } : undefined,

  pool: true,
  maxConnections: 1,
  maxMessages: 50,

  connectionTimeout: 20_000,
  greetingTimeout: 20_000,
  socketTimeout: 20_000,

  tls: { minVersion: "TLSv1.2" },
});

transporter
  .verify()
  .then(() => console.info("[mail] SMTP transporter verified and ready."))
  .catch((err) =>
    console.warn("⚠️ [mail] Email transporter verification failed:", err)
  );

/* ---------- Personas & Defaults ---------- */

const EMAIL_NO_REPLY =
  process.env.EMAIL_NO_REPLY || "no-reply@marobionline.com";
const EMAIL_SHIPPING =
  process.env.EMAIL_SHIPPING || "shipping@marobionline.com";
const EMAIL_INFO = process.env.EMAIL_INFO || "info@marobionline.com";

const FROM_NO_REPLY =
  process.env.EMAIL_FROM_NO_REPLY || `Marobi <${EMAIL_NO_REPLY}>`;
const FROM_SHIPPING =
  process.env.EMAIL_FROM_SHIPPING || `Marobi Shipping <${EMAIL_SHIPPING}>`;
const FROM_INFO =
  process.env.EMAIL_FROM_INFO || `Marobi <${EMAIL_INFO}>`;

const ENVELOPE_FROM = (
  process.env.EMAIL_ENVELOPE_FROM?.trim() || EMAIL_INFO
).toLowerCase();

// default place for replies
const REPLY_TO_INFO = FROM_INFO;

/* ---------- Email address utils ---------- */

const EMAIL_RX =
  /<?\s*([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})\s*>?/i;

function extractAddress(s: string): string | null {
  const m = s?.match(EMAIL_RX);
  return m ? m[1].trim() : null;
}

function toArray<T>(v?: T | T[]): T[] {
  if (v === undefined || v === null) return [];
  return Array.isArray(v) ? v : [v];
}

function normalizeRecipients(
  who: string | string[] | undefined,
  label: "to" | "cc" | "bcc"
): string[] {
  const raw = toArray(who);
  const cleaned = raw
    .map((r) => (r || "").toString().trim())
    .filter(Boolean)
    .map((r) => {
      const addr = extractAddress(r) || r;
      return EMAIL_RX.test(addr) ? r : "";
    })
    .filter(Boolean);

  if (label === "to" && cleaned.length === 0) {
    throw new Error(
      "[mail] No recipients defined: 'to' was empty or invalid. Ensure you pass a real email."
    );
  }
  return cleaned;
}

function addressesForEnvelope(list: string[]): string[] {
  return list
    .map((r) => extractAddress(r) || "")
    .filter(Boolean);
}

function withEnvelope(
  msg: nodemailer.SendMailOptions
): nodemailer.SendMailOptions {
  const toList = normalizeRecipients(msg.to as any, "to");
  const ccList = normalizeRecipients(msg.cc as any, "cc");
  const bccList = normalizeRecipients(msg.bcc as any, "bcc");

  const envTo = [
    ...addressesForEnvelope(toList),
    ...addressesForEnvelope(ccList),
    ...addressesForEnvelope(bccList),
  ];

  if (envTo.length === 0) {
    throw new Error(
      "[mail] No recipients defined after normalization (to/cc/bcc)."
    );
  }

  return {
    ...msg,
    to: toList,
    cc: ccList.length ? ccList : undefined,
    bcc: bccList.length ? bccList : undefined,
    envelope: {
      from: ENVELOPE_FROM,
      to: envTo,
    },
  };
}

/* ---------- Templated HTML (brand shell) ---------- */

interface RenderEmailOptions {
  title: string;
  intro?: string;
  bodyHtml?: string;
  highlightCode?: string;
  note?: string;
  button?: { label: string; url: string; color?: string };
  footerNote?: string;
  headerColor?: string;
  preheader?: string;
}

export function renderEmail(opts: RenderEmailOptions): string {
  const {
    title,
    intro,
    bodyHtml,
    highlightCode,
    note,
    button,
    footerNote,
    headerColor,
    preheader,
  } = opts;

  const year = new Date().getFullYear();
  const headerBg = headerColor || BRAND_COLOR;

  const buttonHtml = button
    ? `
      <p style="text-align:center;margin:28px 0 4px;">
        <a
          href="${button.url}"
          style="
            display:inline-block;
            background:${button.color || BRAND_COLOR};
            color:#ffffff;
            text-decoration:none;
            font-size:16px;
            font-weight:600;
            padding:12px 28px;
            border-radius:6px;
            letter-spacing:.3px;
            font-family:${BRAND_FONT_STACK};
          "
          target="_blank"
        >${button.label}</a>
      </p>`
    : "";

  const highlightHtml = highlightCode
    ? `
      <p style="
        font-size:30px;
        font-weight:700;
        letter-spacing:4px;
        text-align:center;
        margin:24px 0 12px;
        color:${BRAND_COLOR};
        font-family:${BRAND_FONT_STACK};
      ">
        ${highlightCode}
      </p>`
    : "";

  const preheaderHtml = preheader
    ? `<span style="display:none!important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden;mso-hide:all;">${preheader}</span>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>${title} - ${BRAND_NAME}</title>
<meta name="viewport" content="width=device-width,initial-scale=1" />
<style type="text/css">
  /* Montserrat brand font – supported in most modern clients */
  @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700&display=swap');
</style>
</head>
<body style="margin:0;padding:0;background:${BG_OUTER};font-family:${BRAND_FONT_STACK};">
  ${preheaderHtml}
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" bgcolor="${BG_OUTER}">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="600" border="0" cellspacing="0" cellpadding="0" style="max-width:600px;background:${CARD_BG};border-collapse:separate;border-radius:${BORDER_RADIUS};overflow:hidden;box-shadow:0 2px 6px rgba(0,0,0,0.05);">
          <tr>
            <td style="background:${headerBg};padding:20px 24px;text-align:center;">
              <img
                src="${BRAND_LOGO_DARK_BG}"
                alt="${BRAND_NAME} logo"
                width="140"
                style="display:inline-block;max-width:180px;height:auto;border:0;line-height:100%;outline:none;text-decoration:none;"
              />
            </td>
          </tr>
          <tr>
            <td style="padding:32px 32px 28px;color:${TEXT_COLOR};font-size:15px;line-height:1.55;font-family:${BRAND_FONT_STACK};">
              <h1 style="font-size:20px;margin:0 0 16px;color:${TEXT_COLOR};font-weight:600;letter-spacing:.5px;font-family:${BRAND_FONT_STACK};">
                ${title}
              </h1>
              ${
                intro
                  ? `<p style="margin:0 0 18px;color:${TEXT_COLOR};font-family:${BRAND_FONT_STACK};">${intro}</p>`
                  : ""
              }
              ${highlightHtml}
              ${
                bodyHtml
                  ? `<div style="margin:0 0 4px;font-family:${BRAND_FONT_STACK};">${bodyHtml}</div>`
                  : ""
              }
              ${
                note
                  ? `<p style="margin:24px 0 0;font-size:13px;color:${MUTED_COLOR};font-family:${BRAND_FONT_STACK};">${note}</p>`
                  : ""
              }
              ${buttonHtml}
            </td>
          </tr>
          ${
            footerNote
              ? `<tr><td style="padding:0 32px 8px;font-size:12px;color:${MUTED_COLOR};font-family:${BRAND_FONT_STACK};">${footerNote}</td></tr>`
              : ""
          }
          <tr>
            <td style="background:#f9fafb;padding:20px 24px;text-align:center;font-size:12px;color:#9ca3af;font-family:${BRAND_FONT_STACK};">
              &copy; ${year} ${BRAND_NAME}. All rights reserved.<br/>
              <span style="color:#9ca3af;">You are receiving this message because you interacted with ${BRAND_NAME}.</span>
            </td>
          </tr>
        </table>
        <div style="height:20px;">&nbsp;</div>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/* ---------- Specific emails ---------- */

// Account — verification uses no-reply
export async function sendVerificationEmail(email: string, token: string) {
  const e = (email || "").trim();
  if (!e || !extractAddress(e)) {
    throw new Error("[sendVerificationEmail] invalid recipient email");
  }

  const base = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const verifyUrl = `${base}/auth/verify-email?token=${token}&email=${encodeURIComponent(
    e
  )}`;

  const html = renderEmail({
    title: "Verify Your Email",
    intro: `Welcome to <strong>${BRAND_NAME}</strong>! Use the code below or click the button to verify your account.`,
    highlightCode: token,
    bodyHtml: `
      <p style="margin:18px 0 0;font-family:${BRAND_FONT_STACK};">If the button does not work, copy and paste this URL into your browser:</p>
      <p style="margin:8px 0 0;word-break:break-all;font-size:13px;color:${MUTED_COLOR};font-family:${BRAND_FONT_STACK};">${verifyUrl}</p>
    `,
    note: "This code & link expire in 1 hour.",
    button: { label: "Verify My Email", url: verifyUrl },
    preheader: "Verify your email to finish setting up your Marobi account.",
  });

  await transporter.sendMail(
    withEnvelope({
      from: FROM_NO_REPLY,
      to: e,
      subject: `Verify your ${BRAND_NAME} account`,
      html,
      replyTo: REPLY_TO_INFO,
    })
  );
}

// Account — reset password uses no-reply
export async function sendResetPasswordEmail(
  email: string,
  opts: { resetUrl: string }
) {
  const e = (email || "").trim();
  if (!e || !extractAddress(e)) {
    throw new Error("[sendResetPasswordEmail] invalid recipient email");
  }

  const { resetUrl } = opts;
  const html = renderEmail({
    title: "Reset Your Password",
    intro: `We received a request to reset the password for <strong>${e}</strong>.`,
    bodyHtml: `
      <p style="margin:0 0 20px;font-family:${BRAND_FONT_STACK};">
        Click the button below to choose a new password. If you did not request this, you can safely ignore this email.
      </p>
      <p style="margin:0 0 6px;font-size:13px;color:${MUTED_COLOR};font-family:${BRAND_FONT_STACK};">
        If the button does not work, copy this link:
      </p>
      <p style="margin:0;word-break:break-all;font-size:12px;color:${MUTED_COLOR};font-family:${BRAND_FONT_STACK};">${resetUrl}</p>
    `,
    note: "This link expires in 1 hour.",
    button: { label: "Reset Password", url: resetUrl, color: BRAND_ACCENT },
    preheader: "Reset your Marobi password securely.",
  });

  await transporter.sendMail(
    withEnvelope({
      from: FROM_NO_REPLY,
      to: e,
      subject: `Reset your ${BRAND_NAME} password`,
      html,
      replyTo: REPLY_TO_INFO,
    })
  );
}

/**
 * Generic email with optional "from" override.
 * Default persona is no-reply (safe).
 *
 * Set `from` to:
 *  - "no-reply" | "shipping" | "info"
 *  - or a full mailbox string like 'Support <support@marobionline.com>'
 */
export async function sendGenericEmail(args: {
  to: string | string[];
  subject: string;
  title: string;
  intro?: string;
  bodyHtml?: string;
  button?: { label: string; url: string; color?: string };
  footerNote?: string;
  preheader?: string;
  from?: "no-reply" | "shipping" | "info" | string;
  cc?: string | string[];
  bcc?: string | string[];
}) {
  const {
    to,
    subject,
    title,
    intro,
    bodyHtml,
    button,
    footerNote,
    preheader,
    from,
    cc,
    bcc,
  } = args;

  const toList = normalizeRecipients(to, "to"); // throws if empty
  const ccList = normalizeRecipients(cc, "cc");
  const bccList = normalizeRecipients(bcc, "bcc");

  const html = renderEmail({
    title,
    intro,
    bodyHtml,
    button,
    footerNote,
    preheader,
  });

  const resolvedFrom =
    from === "shipping"
      ? FROM_SHIPPING
      : from === "info"
      ? FROM_INFO
      : typeof from === "string" && from.includes("@")
      ? from
      : FROM_NO_REPLY;

  const replyTo = resolvedFrom === FROM_INFO ? FROM_INFO : REPLY_TO_INFO;

  await transporter.sendMail(
    withEnvelope({
      from: resolvedFrom,
      to: toList,
      cc: ccList.length ? ccList : undefined,
      bcc: bccList.length ? bccList : undefined,
      subject,
      html,
      replyTo,
    })
  );
}

// Shipping / delivery status — use shipping@
export async function sendStatusEmail(params: {
  to: string;
  name: string;
  orderId: string;
  status: string;
}) {
  const e = (params.to || "").trim();
  if (!e || !extractAddress(e)) {
    throw new Error("[sendStatusEmail] invalid recipient email");
  }

  const { name, orderId, status } = params;
  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";

  await sendGenericEmail({
    from: "shipping",
    to: e,
    subject: `Your order ${orderId} Status: ${status}`,
    title: `Order ${orderId} — ${status}`,
    intro: `Hi ${name},`,
    bodyHtml: `<p style="margin:0;font-family:${BRAND_FONT_STACK};">Your order <strong>${orderId}</strong> has been <strong>${status}</strong>.</p>`,
    button: { label: "View Your Orders", url: `${baseUrl}/account` },
    preheader: `Your order has been ${status}`,
    footerNote:
      "Questions about your order? Visit your Marobi account or contact our support team from the website.",
  });
}

/* ---------- Receipt sending (shared renderer + PDF) ---------- */

function computeBackoffSeconds(attempts: number) {
  const base = 60,
    max = 3600;
  return Math.min(base * Math.pow(2, attempts - 1), max);
}

// Invoice / receipt — shipping@ with reply routed to info@
export async function sendReceiptEmailWithRetry({
  order,
  recipient,
  currency,
  deliveryFee,
}: {
  order: any;
  recipient: {
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    deliveryAddress?: string;
    billingAddress?: string;
  };
  currency: string;
  deliveryFee: number;
}) {
  const e = (recipient.email || "").trim();
  if (!e || !extractAddress(e)) {
    throw new Error("[sendReceiptEmailWithRetry] invalid recipient email");
  }

  // NOTE: renderReceiptHTML is a shared renderer used on web + email.
  // It should already (or can be updated to) use Montserrat + the logo
  // inside its own template. We keep that logic in its own module.
  const html = renderReceiptHTML({
    order,
    recipient,
    currency: (currency as any) || "NGN",
    deliveryFee,
  });

  const pdfBuffer = await generateInvoicePDF({
    order,
    recipient,
    currency: (currency as any) || "NGN",
    deliveryFee,
  });

  try {
    await transporter.sendMail(
      withEnvelope({
        from: FROM_SHIPPING,
        to: e,
        subject: `Invoice for order ${order.id}`,
        html,
        replyTo: REPLY_TO_INFO,
        attachments: [
          {
            filename: `invoice-${order.id}.pdf`,
            content: pdfBuffer,
            contentType: "application/pdf",
          },
        ],
      })
    );

    await prisma.receiptEmailStatus.upsert({
      where: { orderId: order.id },
      create: {
        orderId: order.id,
        attempts: 1,
        sent: true,
        deliveryFee,
      },
      update: {
        attempts: { increment: 1 },
        sent: true,
        lastError: null,
        nextRetryAt: null,
        deliveryFee,
      },
    });
  } catch (err: any) {
    const msg = (err?.message || String(err)).slice(0, 1000);
    const existing = await prisma.receiptEmailStatus.findUnique({
      where: { orderId: order.id },
    });
    const attempts = (existing?.attempts ?? 0) + 1;
    const backoff = computeBackoffSeconds(attempts);
    const nextRetry = new Date(Date.now() + backoff * 1000);

    await prisma.receiptEmailStatus.upsert({
      where: { orderId: order.id },
      create: {
        orderId: order.id,
        attempts,
        lastError: msg,
        nextRetryAt: nextRetry,
        sent: false,
        deliveryFee,
      },
      update: {
        attempts,
        lastError: msg,
        nextRetryAt: nextRetry,
        sent: false,
        deliveryFee,
      },
    });

    console.warn(
      `Receipt email send failed for order ${order.id}, retry at ${nextRetry.toISOString()}`,
      err
    );
    throw err;
  }
}
