// app/api/shipping/shipbubble/validate/route.ts
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { validateAddressExact } from "@/lib/shipping/shipbubble";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const required = ["phone", "email", "name", "address"] as const;
    for (const k of required) {
      if (!body?.[k] || String(body[k]).trim() === "") {
        return NextResponse.json({ error: `${k} is required` }, { status: 400 });
      }
    }

    const data = await validateAddressExact({
      phone: String(body.phone),
      email: String(body.email),
      name: String(body.name),
      address: String(body.address),
    });

    // Wrap into Shipbubble-style envelope
    return NextResponse.json(
      { status: "success", message: "Validation successful", data },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("Shipbubble validate error:", err);
    return NextResponse.json(
      { status: "error", message: err?.message || "Validation failed" },
      { status: 400 }
    );
  }
}
