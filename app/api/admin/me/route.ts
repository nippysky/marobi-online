// app/api/admin/me/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import prisma, { prismaReady } from "@/lib/db";
import { authOptions } from "@/lib/authOptions";

/** Ensure Node runtime for consistent server APIs */
export const runtime = "nodejs";

export async function GET(_req: Request) {
  try {
    await prismaReady;

    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const staff = await prisma.staff.findUnique({
      where: { email: session.user.email },
      select: {
        id: true,
        firstName: true,
        middleName: true,
        lastName: true,
        email: true,
        emailPersonal: true,
        phone: true,
        address: true,
        jobRoles: true,
        access: true,
        dateOfBirth: true,
        dateOfEmployment: true,
      },
    });

    if (!staff) {
      return NextResponse.json({ error: "Staff not found" }, { status: 404 });
    }

    return NextResponse.json(staff, { status: 200 });
  } catch (err) {
    console.error("[GET /api/admin/me] Error:", err);
    return NextResponse.json(
      { error: "Failed to load staff profile" },
      { status: 500 }
    );
  }
}
