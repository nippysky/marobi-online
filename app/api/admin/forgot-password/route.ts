import { NextResponse } from "next/server";
import prisma, { prismaReady } from "@/lib/db";
import { randomBytes } from "crypto";
import { sendResetPasswordEmail } from "@/lib/mail";

/** Ensure this runs on the Node runtime (needed for crypto + mailing) */
export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    await prismaReady;

    const { email } = await req.json().catch(() => ({} as { email?: unknown }));
    if (typeof email !== "string" || email.trim() === "") {
      return NextResponse.json({ error: "Valid email required" }, { status: 400 });
    }

    // 1) Check staff existence
    const staff = await prisma.staff.findUnique({ where: { email } });
    if (!staff) {
      return NextResponse.json({ error: "Email not found" }, { status: 404 });
    }

    // 2) Generate token + expiry
    const token = randomBytes(32).toString("hex");
    const expiresISO = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // +1h

    // 3) Persist token & expiry (both strings in your schema)
    await prisma.staff.update({
      where: { id: staff.id },
      data: {
        resetToken: token,
        resetTokenExpiry: expiresISO,
      },
    });

    // 4) Send reset email
    const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
    const resetUrl = `${baseUrl}/admin/reset-password?token=${encodeURIComponent(token)}`;
    await sendResetPasswordEmail(email, { resetUrl });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err: any) {
    console.error("[POST /api/admin/password/reset/request] Error:", err);
    return NextResponse.json(
      { error: "Failed to create reset request" },
      { status: 500 }
    );
  }
}
