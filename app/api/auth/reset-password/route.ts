// app/api/auth/reset-password/route.ts
import { NextResponse } from "next/server";
import prisma, { prismaReady } from "@/lib/db";
import bcrypt from "bcrypt";

export const runtime = "nodejs"; // ensure Node APIs (bcrypt) are available

function normalizeEmail(e: string) {
  return e.trim().toLowerCase();
}

export async function POST(req: Request) {
  try {
    await prismaReady;

    const body = await req.json().catch(() => ({}));
    const { email, token, password } = body as {
      email?: string;
      token?: string;
      password?: string;
    };

    if (!email || !token || !password) {
      return NextResponse.json(
        { error: "Email, token and password are required." },
        { status: 400 }
      );
    }
    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters." },
        { status: 400 }
      );
    }

    const emailNorm = normalizeEmail(email);

    // Case-insensitive lookup (handles legacy rows)
    let user = await prisma.customer.findFirst({
      where: { email: { equals: emailNorm, mode: "insensitive" } },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Invalid or expired reset token." },
        { status: 400 }
      );
    }

    // Normalize stored email if needed (optional consistency step)
    if (user.email !== emailNorm) {
      user = await prisma.customer.update({
        where: { id: user.id },
        data: { email: emailNorm },
      });
    }

    // Validate token & expiry (customer.resetTokenExpiry is a Date)
    if (
      !user.resetToken ||
      user.resetToken !== token ||
      !user.resetTokenExpiry ||
      user.resetTokenExpiry < new Date()
    ) {
      return NextResponse.json(
        { error: "Invalid or expired reset token." },
        { status: 400 }
      );
    }

    const hash = await bcrypt.hash(password, 10);

    await prisma.customer.update({
      where: { id: user.id },
      data: {
        passwordHash: hash,
        resetToken: null,
        resetTokenExpiry: null,
      },
    });

    return NextResponse.json({ message: "Password reset successful." });
  } catch (err) {
    console.error("[reset-password] error:", err);
    return NextResponse.json(
      { error: "Server error. Please try again later." },
      { status: 500 }
    );
  }
}
