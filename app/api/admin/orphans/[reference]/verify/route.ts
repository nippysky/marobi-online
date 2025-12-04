// app/api/admin/orphans/[reference]/verify/route.ts
export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/getAdminSession";
import { verifyTransaction } from "@/lib/paystack";

export async function GET(
  _req: Request,
  context: { params: Promise<{ reference: string }> }
) {

        const { reference } = await context.params;
  try {
    const session = await getAdminSession();
    if (!session?.user || session.user.role === "customer") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tx = await verifyTransaction(reference);

    return NextResponse.json({ data: tx }, { status: 200 });
  } catch (err: any) {
    console.error("[VerifyOrphan]", err);
    return NextResponse.json(
      { error: err?.message || "Failed to verify" },
      { status: 400 }
    );
  }
}
