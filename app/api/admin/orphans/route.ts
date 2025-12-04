// app/api/admin/orphans/route.ts
export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/getAdminSession";
import prisma, { prismaReady } from "@/lib/db";

export async function GET() {
  try {
    await prismaReady;
    const session = await getAdminSession();

    if (!session?.user || session.user.role === "customer") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const orphans = await prisma.orphanPayment.findMany({
      where: {
        reconciled: false,
      },
      orderBy: {
        firstSeenAt: "desc",
      },
    });

    return NextResponse.json({ data: orphans }, { status: 200 });
  } catch (err) {
    console.error("[GET /api/admin/orphans]", err);
    return NextResponse.json(
      { error: "Failed to load orphan payments" },
      { status: 500 }
    );
  }
}
