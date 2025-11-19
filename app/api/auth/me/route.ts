import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import prisma, { prismaReady } from "@/lib/db";
import { authOptions } from "@/lib/authOptions";

/** Ensure Node runtime (safe for server-only libs, sessions, etc.) */
export const runtime = "nodejs";

export async function GET(_req: Request) {
  try {
    await prismaReady;

    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const user = await prisma.customer.findUnique({
      where: { email: session.user.email },
      select: {
        // basic profile
        id:              true,
        firstName:       true,
        lastName:        true,
        email:           true,
        phone:           true,
        deliveryAddress: true,
        billingAddress:  true,
        country:         true,
        state:           true,
        registeredAt:    true,
        lastLogin:       true,

        // include all their orders (newest first)
        orders: {
          orderBy: { createdAt: "desc" },
          select: {
            id:            true,
            status:        true,
            currency:      true,
            totalAmount:   true,
            totalNGN:      true,
            paymentMethod: true,
            createdAt:     true,
            items: {
              select: {
                id:        true,
                name:      true,
                image:     true,
                category:  true,
                quantity:  true,
                lineTotal: true,
                color:     true,
                size:      true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json(user);
  } catch (err) {
    console.error("[GET /api/account] error:", err);
    return NextResponse.json(
      { error: "Unable to load account right now." },
      { status: 500 }
    );
  }
}
