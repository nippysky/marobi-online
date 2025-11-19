import crypto from "crypto";
import { prisma } from "@/lib/db";

/* -------------------------------------------------------------------------- */
/*                             Environment helpers                            */
/* -------------------------------------------------------------------------- */
const PAYSTACK_BASE = "https://api.paystack.co";

// Use same secret for API and webhook signature (Paystack 2024+)
const getSecretKey = () => {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret) throw new Error("Missing PAYSTACK_SECRET_KEY in environment");
  return secret;
};

/* -------------------------------------------------------------------------- */
/*                           Paystack types & errors                          */
/* -------------------------------------------------------------------------- */
export interface PaystackTransactionData {
  domain: string;
  status: "success" | "failed" | string;
  reference: string;
  amount: number; // in lowest denomination (e.g., kobo)
  currency: string;
  metadata: any;
  gateway_response: string;
  paid_at: string | null;
  channel: string;
  customer: {
    email: string;
    phone: string;
    first_name?: string;
    last_name?: string;
  };
  plan?: any;
  id: number;
}

interface VerifyTransactionResponse {
  status: boolean;
  message: string;
  data: PaystackTransactionData;
}

export interface PaystackRefundData {
  id: number;
  amount: number;
  currency: string;
  reason?: string;
  status: string;
  domain: string;
  transaction: number;
  created_at: string;
  failed_at?: string;
  success_at?: string;
  reference: string;
}

interface RefundResponse {
  status: boolean;
  message: string;
  data: PaystackRefundData;
}

export class PaystackError extends Error {
  public statusCode?: number;
  public details?: any;
  constructor(message: string, statusCode?: number, details?: any) {
    super(message);
    this.name = "PaystackError";
    this.statusCode = statusCode;
    this.details = details;
  }
}

/* -------------------------------------------------------------------------- */
/*                  Transaction Verification / Refund helpers                 */
/* -------------------------------------------------------------------------- */

/**
 * Verifies a Paystack transaction reference.
 * Throws PaystackError on fail (with details).
 * Handles non-JSON Paystack responses (HTML, downtime, etc).
 */
export async function verifyTransaction(
  reference: string
): Promise<PaystackTransactionData> {
  const secret = getSecretKey();
  const url = `${PAYSTACK_BASE}/transaction/verify/${encodeURIComponent(reference)}`;
  const res = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json",
    },
  });

  const text = await res.text();
  let json: VerifyTransactionResponse;
  try {
    json = JSON.parse(text);
  } catch (err) {
    // Paystack returned HTML or other unexpected response (often a bad secret or network issue)
    console.error("Paystack non-JSON response for verification:", {
      url,
      responseSnippet: text?.slice?.(0, 500),
      status: res.status,
    });
    throw new PaystackError(
      "Paystack returned an unexpected response during verification. Check your PAYSTACK_SECRET_KEY, network, or Paystack status.",
      res.status,
      { rawResponse: text, url }
    );
  }

  if (!res.ok || !json.status) {
    throw new PaystackError(
      `Failed to verify transaction: ${json.message}`,
      res.status,
      json
    );
  }

  const tx = json.data;
  if (tx.status !== "success") {
    throw new PaystackError(
      `Transaction not successful (status=${tx.status})`,
      undefined,
      tx
    );
  }

  return tx;
}

/**
 * Refunds a Paystack transaction by transaction ID or reference.
 */
export async function refundTransaction(opts: {
  transaction: number | string;
  amount?: number;
  reason?: string;
  metadata?: Record<string, any>;
}): Promise<PaystackRefundData> {
  const secret = getSecretKey();
  const body: any = { transaction: opts.transaction };
  if (typeof opts.amount === "number") body.amount = opts.amount;
  if (opts.metadata) body.metadata = opts.metadata;

  const res = await fetch(`${PAYSTACK_BASE}/refund`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  let json: RefundResponse;
  try {
    json = JSON.parse(text);
  } catch (err) {
    console.error("Paystack non-JSON response for refund:", {
      responseSnippet: text?.slice?.(0, 500),
      status: res.status,
    });
    throw new PaystackError(
      "Paystack returned an unexpected response during refund. Check your PAYSTACK_SECRET_KEY or Paystack status.",
      res.status,
      { rawResponse: text }
    );
  }

  if (!res.ok || !json.status) {
    throw new PaystackError(
      `Failed to initiate refund: ${json.message}`,
      res.status,
      json
    );
  }

  return json.data;
}

/* -------------------------------------------------------------------------- */
/*                         Webhook / Deduplication                            */
/* -------------------------------------------------------------------------- */

/**
 * Validates a Paystack webhook signature.
 * As of 2025, Paystack uses your API secret key as the webhook secret.
 */
export function validateWebhookSignature(
  rawBody: string | Buffer,
  signatureHeader: string
): boolean {
  const secret = getSecretKey();
  const hash = crypto.createHmac("sha512", secret).update(rawBody).digest("hex");
  try {
    return crypto.timingSafeEqual(
      Buffer.from(hash, "utf8"),
      Buffer.from(signatureHeader, "utf8")
    );
  } catch {
    return false;
  }
}

/**
 * Persistent dedupe: attempts to record the incoming webhook event.
 * Returns true if this is the first time seeing it (i.e., new), false if duplicate.
 */
export async function markAndCheckEventId(
  provider: string,
  eventId: string,
  payload: any
): Promise<boolean> {
  try {
    await prisma.webhookEvent.create({
      data: { provider, eventId, payload },
    });
    return true; // newly recorded
  } catch (err: any) {
    // Unique constraint violation -> already seen
    if (
      err.code === "P2002" &&
      Array.isArray(err.meta?.target) &&
      err.meta.target.includes("eventId")
    ) {
      return false;
    }
    // Defensive fallback for schema/ORM differences
    if (
      err.message?.includes?.("Unique constraint failed") &&
      err.message?.includes?.("eventId")
    ) {
      return false;
    }
    throw err;
  }
}

/**
 * Reconcile a single orphan payment (stubs for order or refund hooks).
 */
export async function reconcileOrphanPayment(opts: {
  reference: string;
  expectedAmount: number;
  expectedCurrency: string;
  onCreateOrder: (tx: PaystackTransactionData) => Promise<void>;
  onRefund: (tx: PaystackTransactionData) => Promise<void>;
}): Promise<void> {
  let tx: PaystackTransactionData;
  try {
    tx = await verifyTransaction(opts.reference);
  } catch (err) {
    throw err;
  }

  if (
    tx.amount !== opts.expectedAmount ||
    tx.currency.toUpperCase() !== opts.expectedCurrency.toUpperCase()
  ) {
    await opts.onRefund(tx);
    return;
  }

  await opts.onCreateOrder(tx);
}

/* -------------------------------------------------------------------------- */
/*                           Utility helpers                                  */
/* -------------------------------------------------------------------------- */
export function toLowestDenomination(amount: number): number {
  return Math.round(amount * 100);
}

export function assertAmountMatches(
  expected: number,
  actual: number,
  tolerance = 0
): boolean {
  return Math.abs(expected - actual) <= tolerance;
}
