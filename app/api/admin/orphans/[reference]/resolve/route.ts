// app/api/admin/orphans/[reference]/resolve/route.ts
export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/getAdminSession";
import prisma, { prismaReady } from "@/lib/db";

export async function POST(
  _req: Request,
  context: { params: Promise<{ reference: string }> }
) {
  try {
    await prismaReady;

        const { reference } = await context.params;

    const session = await getAdminSession();
    if (!session?.user || session.user.role === "customer") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await prisma.orphanPayment.update({
      where: { reference: reference },
      data: {
        reconciled: true,
        reconciledAt: new Date(),
        resolutionNote: "Marked resolved by admin",
      },
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    console.error("[ResolveOrphan]", err);
    return NextResponse.json(
      { error: "Failed to resolve orphan payment" },
      { status: 500 }
    );
  }
}
