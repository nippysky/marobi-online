import { NextResponse } from "next/server";
import prisma, { prismaReady } from "@/lib/db";
import { randomUUID } from "crypto";
import { sendVerificationEmail } from "@/lib/mail";

export const runtime = "nodejs"; // ensure Node APIs are available

type SimpleUser = { id: string; email: string; emailVerified: boolean };

function normalizeEmail(e: string) {
  return e.trim().toLowerCase();
}

export async function POST(request: Request) {
  try {
    await prismaReady;

    const { email } = await request.json().catch(() => ({}));
    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const emailNorm = normalizeEmail(email);

    // Case-insensitive lookup (select a consistent shape)
    let user: SimpleUser | null = await prisma.customer.findFirst({
      where: { email: { equals: emailNorm, mode: "insensitive" } },
      select: { id: true, email: true, emailVerified: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Normalize stored email if needed (keep the same selection shape)
    if (user.email !== emailNorm) {
      user = await prisma.customer.update({
        where: { id: user.id },
        data: { email: emailNorm },
        select: { id: true, email: true, emailVerified: true },
      });
    }

    if (user.emailVerified) {
      return NextResponse.json({ message: "Email already verified" }, { status: 200 });
    }

    const token = randomUUID();
    const expiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await prisma.customer.update({
      where: { id: user.id },
      data: {
        verificationToken: token,
        verificationTokenExpiry: expiry,
      },
    });

    await sendVerificationEmail(emailNorm, token);

    return NextResponse.json({ message: "Verification email sent" }, { status: 200 });
  } catch (err) {
    console.error("[resend-verification] error:", err);
    return NextResponse.json(
      { error: "Server error. Please try again later." },
      { status: 500 }
    );
  }
}
