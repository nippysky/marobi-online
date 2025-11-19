// app/api/customers/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import prisma, { prismaReady } from "@/lib/db";

/** Ensure Prisma runs on the Node runtime */
export const runtime = "nodejs";

export async function DELETE(
  _req: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
  await prismaReady;

  const { id } = await context.params;

  try {
    // Optional: quick existence check to return 404 early
    const exists = await prisma.customer.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!exists) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    await prisma.$transaction(async (tx) => {
      // 1) Remove wishlist items (no cascade on this relation)
      await tx.wishlistItem.deleteMany({ where: { customerId: id } });

      // 2) Detach orders (customerId is optional, so set to null)
      await tx.order.updateMany({
        where: { customerId: id },
        data: { customerId: null },
      });

      // 3) Delete the customer (Reviews are ON DELETE CASCADE in your schema)
      await tx.customer.delete({ where: { id } });
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: any) {
    // Handle record-not-found from delete (race conditions)
    if (error?.code === "P2025") {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    console.error("[DELETE /api/customers/:id] Error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to delete customer" },
      { status: 500 }
    );
  }
}
