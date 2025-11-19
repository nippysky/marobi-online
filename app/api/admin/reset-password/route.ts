// app/api/admin/reset-password/route.ts
import { NextResponse } from "next/server";
import prisma, { prismaReady } from "@/lib/db";
import bcrypt from "bcryptjs";

/** Ensure Node runtime for consistent server APIs */
export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    await prismaReady;

    const { token, password } = await req.json().catch(() => ({}));
    if (!token || typeof password !== "string") {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    // Compare expiry as ISO-string (resetTokenExpiry is stored as string in DB)
    const staff = await prisma.staff.findFirst({
      where: {
        resetToken: token,
        resetTokenExpiry: { gt: new Date().toISOString() },
      },
    });

    if (!staff) {
      return NextResponse.json(
        { error: "Link expired or invalid" },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters" },
        { status: 400 }
      );
    }

    const hash = await bcrypt.hash(password, 10);

    await prisma.staff.update({
      where: { id: staff.id },
      data: {
        passwordHash: hash,
        resetToken: null,
        resetTokenExpiry: null, // clear token on success
      },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[POST /api/admin/reset-password] Error:", err);
    return NextResponse.json(
      { error: "Failed to reset password" },
      { status: 500 }
    );
  }
}
