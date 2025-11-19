// app/api/staff/change-password/route.ts
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import bcrypt from "bcrypt";
import prisma, { prismaReady } from "@/lib/db";
import { authOptions } from "@/lib/authOptions";

export async function POST(req: Request) {
  await prismaReady;

  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role === "customer") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { currentPassword, newPassword } = body;

  if (
    !currentPassword ||
    !newPassword ||
    typeof currentPassword !== "string" ||
    typeof newPassword !== "string"
  ) {
    return NextResponse.json(
      { error: "Both passwords are required" },
      { status: 400 }
    );
  }

  // Optional: enforce a minimum length
  if (newPassword.length < 6) {
    return NextResponse.json(
      { error: "New password must be at least 6 characters" },
      { status: 400 }
    );
  }

  const staff = await prisma.staff.findUnique({
    where: { id: String(session.user.id) },
    select: { id: true, passwordHash: true },
  });

  if (!staff) {
    return NextResponse.json({ error: "Staff not found" }, { status: 404 });
  }

  const valid = await bcrypt.compare(currentPassword, staff.passwordHash);
  if (!valid) {
    return NextResponse.json(
      { error: "Current password is incorrect" },
      { status: 403 }
    );
  }

  const hash = await bcrypt.hash(newPassword, 10);
  await prisma.staff.update({
    where: { id: staff.id },
    data: { passwordHash: hash },
  });

  return NextResponse.json({ success: true });
}
