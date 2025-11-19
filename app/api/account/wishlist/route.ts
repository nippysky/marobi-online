// app/api/wishlist/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import prisma, { prismaReady } from "@/lib/db";
import { authOptions } from "@/lib/authOptions";

/** Prisma requires the Node.js runtime */
export const runtime = "nodejs";

export async function GET() {
  // Ensure Prisma is connected (safe for dev/prod, avoids HMR multi-clients)
  await prismaReady;

  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const items = await prisma.wishlistItem.findMany({
      where: {
        customer: { email: session.user.email },
      },
      orderBy: { addedAt: "desc" },
      select: {
        id: true,
        addedAt: true,
        product: {
          select: {
            id: true,
            name: true,
            images: true,
            // If you prefer just slug or name from the relation, adjust here:
            // category: { select: { slug: true, name: true } },
            category: true,
            priceNGN: true,
            priceUSD: true,
            priceEUR: true,
            priceGBP: true,
          },
        },
      },
    });

    return NextResponse.json(items);
  } catch (err) {
    console.error("[api/wishlist] load failed:", err);
    return NextResponse.json(
      { error: "Failed to load wishlist items" },
      { status: 500 }
    );
  }
}
