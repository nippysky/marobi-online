import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import prisma, { prismaReady } from "@/lib/db";
import { authOptions } from "@/lib/authOptions";

/** Ensure the Node runtime for Prisma */
export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  await prismaReady;

  const { id } = await context.params;
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    // not signed in → treat as “not wishlisted”
    return NextResponse.json({ wishlisted: false }, { status: 200 });
  }

  const existing = await prisma.wishlistItem.findFirst({
    where: {
      productId: id,
      customer: { email: session.user.email },
    },
    select: { id: true },
  });

  return NextResponse.json({ wishlisted: Boolean(existing) }, { status: 200 });
}

export async function POST(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  await prismaReady;

  const { id } = await context.params;
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    // Upsert for idempotence (avoids P2002 race on existing wishlist entry)
    const customer = await prisma.customer.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });
    if (!customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    await prisma.wishlistItem.upsert({
      where: {
        // relies on @@unique([customerId, productId]) in your Prisma schema
        customerId_productId: {
          customerId: customer.id,
          productId: id,
        },
      },
      update: {},
      create: {
        customer: { connect: { id: customer.id } },
        product: { connect: { id } },
      },
    });

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (err) {
    console.error("[api/account/wishlist/:id] POST error:", err);
    return NextResponse.json(
      { error: "Failed to add to wishlist" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  await prismaReady;

  const { id } = await context.params;
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    // Accept either the wishlist row id OR the product id
    await prisma.wishlistItem.deleteMany({
      where: {
        customer: { email: session.user.email },
        OR: [
          { id },          // wishlist item id
          { productId: id } // product id
        ],
      },
    });
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    console.error("[api/account/wishlist/:id] DELETE error:", err);
    return NextResponse.json(
      { error: "Failed to remove from wishlist" },
      { status: 500 }
    );
  }
}
