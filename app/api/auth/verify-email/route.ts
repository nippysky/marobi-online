// app/api/auth/verify-email/route.ts
import { NextResponse } from "next/server";
import prisma, { prismaReady } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    await prismaReady;

    const url = new URL(request.url);
    const token = url.searchParams.get("token");

    if (!token) {
      return NextResponse.json({ error: "Missing token." }, { status: 400 });
    }

    const user = await prisma.customer.findFirst({
      where: {
        verificationToken: token,
        verificationTokenExpiry: { gt: new Date() },
      },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Invalid or expired token." },
        { status: 400 }
      );
    }

    await prisma.customer.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        verificationToken: null,
        verificationTokenExpiry: null,
      },
    });

    return NextResponse.json({ message: "Email verified." });
  } catch (err) {
    console.error("[verify-email] error:", err);
    return NextResponse.json(
      { error: "Server error. Please try again later." },
      { status: 500 }
    );
  }
}
