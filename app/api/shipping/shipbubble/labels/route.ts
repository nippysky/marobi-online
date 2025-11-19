// app/api/shipping/shipbubble/labels/route.ts
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createShipmentLabelExact } from "@/lib/shipping/shipbubble";

/**
 * IMPORTANT:
 * - This is the ONLY place in the codebase that should call Shipbubble's label API.
 * - /api/orders/online no longer calls createShipmentLabelExact directly.
 * - That ensures we don't accidentally consume the same request_token twice.
 */

/**
 * We keep an in-memory set of tokens we've already attempted.
 * - On SUCCESS, we mark the token as used.
 * - If Shipbubble replies "Invalid request token", we also mark it as used,
 *   so subsequent attempts short-circuit on our side with a clearer error.
 *
 * This doesn't survive server restarts, but it prevents accidental double-hits
 * in the same process (e.g. user double-clicking / retrying too quickly).
 */
const usedRequestTokens = new Set<string>();

/**
 * POST /api/shipping/shipbubble/labels
 * Body:
 * {
 *   requestToken: string; // from /api/shipping/shipbubble/rates (data.request_token)
 *   serviceCode: string;  // from selected rate
 *   courierId: string;    // from selected rate (courier_id)
 *   insuranceCode?: string;
 *   isCodLabel?: boolean;
 * }
 */
export async function POST(req: Request) {
  let trimmedToken: string | null = null;

  try {
    const body = await req.json();

    trimmedToken = body?.requestToken ? String(body.requestToken).trim() : "";
    const serviceCode = body?.serviceCode ? String(body.serviceCode).trim() : "";
    const courierId = body?.courierId ? String(body.courierId).trim() : "";
    const insuranceCode = body?.insuranceCode
      ? String(body.insuranceCode).trim()
      : undefined;
    const isCodLabel =
      typeof body?.isCodLabel === "boolean" ? body.isCodLabel : undefined;

    console.log("[ShipbubbleLabel] Incoming label request:", {
      requestTokenPreview: trimmedToken
        ? `${trimmedToken.slice(0, 12)}…`
        : "(none)",
      serviceCode,
      courierId,
      hasInsuranceCode: !!insuranceCode,
      isCodLabel,
    });

    // Basic required-field validation
    if (!trimmedToken) {
      return NextResponse.json(
        { status: "error", message: "requestToken is required" },
        { status: 400 }
      );
    }
    if (trimmedToken.length < 10) {
      return NextResponse.json(
        {
          status: "error",
          message: "requestToken looks invalid (too short)",
        },
        { status: 400 }
      );
    }
    if (!serviceCode) {
      return NextResponse.json(
        { status: "error", message: "serviceCode is required" },
        { status: 400 }
      );
    }
    if (!courierId) {
      return NextResponse.json(
        { status: "error", message: "courierId is required" },
        { status: 400 }
      );
    }

    // Guard: don't let the same request_token hammer Shipbubble repeatedly
    if (usedRequestTokens.has(trimmedToken)) {
      console.warn(
        "[ShipbubbleLabel] Blocked reuse of requestToken in this process:",
        trimmedToken.slice(0, 12) + "…"
      );
      return NextResponse.json(
        {
          status: "error",
          message:
            "This shipping quote has already been used for label creation. Please fetch a new rate.",
        },
        { status: 400 }
      );
    }

    console.log("[ShipbubbleLabel] Calling Shipbubble /shipping/labels with:", {
      request_token_preview: trimmedToken.slice(0, 12) + "…",
      service_code: serviceCode,
      courier_id: courierId,
      hasInsuranceCode: !!insuranceCode,
      isCodLabel,
    });

    const resp = await createShipmentLabelExact({
      requestToken: trimmedToken,
      serviceCode,
      courierId,
      insuranceCode,
      isCodLabel,
    });

    // If we got here, Shipbubble said "success".
    usedRequestTokens.add(trimmedToken);

    console.log("[ShipbubbleLabel] Shipbubble label SUCCESS:", {
      status: resp?.status,
      message: resp?.message,
      order_id: resp?.data?.order_id,
      tracking_url: resp?.data?.tracking_url,
      courier: resp?.data?.courier?.name || resp?.data?.courier || null,
    });

    // Pass Shipbubble's success envelope through untouched.
    return NextResponse.json(resp, { status: 200 });
  } catch (err: any) {
    // If Shipbubble explicitly complains about "Invalid request token",
    // we also mark this token as "used" in our guard set.
    const msg = err?.message ? String(err.message) : "Label creation failed";

    if (
      trimmedToken &&
      msg.toLowerCase().includes("invalid request token")
    ) {
      usedRequestTokens.add(trimmedToken);
      console.warn(
        "[ShipbubbleLabel] Marking token as invalid/used due to Shipbubble response:",
        trimmedToken.slice(0, 12) + "…"
      );
    }

    console.error("[ShipbubbleLabel] Shipbubble label ERROR:", {
      message: msg,
      raw: err,
    });

    return NextResponse.json(
      {
        status: "error",
        message: msg || "Label creation failed",
      },
      { status: 400 }
    );
  }
}
