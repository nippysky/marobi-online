// app/api/auth/request-password-reset/route.ts
import { NextResponse } from "next/server";
import prisma, { prismaReady } from "@/lib/db";
import { randomBytes } from "crypto";
import { sendResetPasswordEmail } from "@/lib/mail";

/** Ensure we run on Node (needed for crypto) */
export const runtime = "nodejs";

function normalizeEmail(raw: string) {
  return raw.trim().toLowerCase();
}

export async function POST(req: Request) {
  try {
    await prismaReady;

    const body = await req.json().catch(() => null);
    const emailRaw = body?.email as string | undefined;

    if (!emailRaw || typeof emailRaw !== "string") {
      return NextResponse.json({ error: "Email is required." }, { status: 400 });
    }

    const emailNorm = normalizeEmail(emailRaw);

    // 1) Try exact (normalized) match
    let user = await prisma.customer.findUnique({ where: { email: emailNorm } });

    // 2) If not found, do a legacy case-insensitive match, then normalize it
    if (!user) {
      const legacy = await prisma.customer.findFirst({
        where: { email: { equals: emailNorm, mode: "insensitive" } },
      });
      if (legacy) {
        user = await prisma.customer.update({
          where: { id: legacy.id },
          data: { email: emailNorm },
        });
      }
    }

    if (!user) {
      return NextResponse.json(
        { error: "We don't have that email on record. You may want to sign up." },
        { status: 404 }
      );
    }

    // 3) Generate reset token & 1-hour expiry
    const resetToken = randomBytes(32).toString("hex");
    const expiry = new Date(Date.now() + 60 * 60 * 1000);

    await prisma.customer.update({
      where: { email: emailNorm },
      data: {
        resetToken,
        resetTokenExpiry: expiry, // Customer schema uses DateTime? — storing as Date is correct
      },
    });

    // 4) Build URL & send email
    const base =
      process.env.NEXTAUTH_URL ??
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

    const resetUrl = `${base}/auth/reset-password?token=${resetToken}&email=${encodeURIComponent(
      emailNorm
    )}`;

    await sendResetPasswordEmail(emailNorm, { resetUrl });

    return NextResponse.json({
      message: `Password reset link sent to ${emailNorm}.`,
    });
  } catch (err) {
    console.error("[POST /api/auth/request-password-reset] error:", err);
    return NextResponse.json(
      { error: "Unable to process password reset right now." },
      { status: 500 }
    );
  }
}
