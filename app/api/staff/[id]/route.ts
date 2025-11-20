// app/api/staff/[id]/route.ts
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import prisma, { prismaReady } from "@/lib/db";
import { JobRole, UserRole } from "@/lib/generated/prisma-client/client";

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  await prismaReady;
  const { id } = await context.params;

  // Parse body
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const {
    firstName,
    middleName,
    lastName,
    email,
    emailPersonal,
    phone,
    address,
    jobRoles,
    access,
    dateOfBirth,
    dateOfEmployment,
    dateOfResignation,
    guarantorName,
    guarantorAddress,
    guarantorPhone,
    password, // optional new password
  } = body || {};

  const requiredString = (v: any) => typeof v === "string" && v.trim().length > 0;

  // Basic validation
  if (!requiredString(firstName) || !requiredString(lastName) || !requiredString(email) || !requiredString(phone)) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }
  if (!Array.isArray(jobRoles) || jobRoles.length === 0 || !jobRoles.every((r) => typeof r === "string")) {
    return NextResponse.json(
      { error: "jobRoles must be non-empty string array" },
      { status: 400 }
    );
  }
  if (!requiredString(access)) {
    return NextResponse.json({ error: "access required" }, { status: 400 });
  }

  // Enum safety (runtime)
  const validJobRoles = jobRoles.filter((r: unknown) =>
    typeof r === "string" && Object.values(JobRole).includes(r as JobRole)
  ) as JobRole[];
  if (validJobRoles.length === 0) {
    return NextResponse.json({ error: "jobRoles contains no valid roles" }, { status: 400 });
  }
  if (!Object.values(UserRole).includes(access as UserRole)) {
    return NextResponse.json({ error: "access must be a valid UserRole" }, { status: 400 });
  }

  // Optional password
  let passwordHash: string | undefined;
  if (password != null && String(password).length > 0) {
    if (String(password).length < 6) {
      return NextResponse.json(
        { error: "Password must be >= 6 characters" },
        { status: 400 }
      );
    }
    passwordHash = await bcrypt.hash(String(password), 10);
  }

  try {
    const updated = await prisma.staff.update({
      where: { id },
      data: {
        firstName: String(firstName).trim(),
        middleName: middleName?.toString().trim() || "",
        lastName: String(lastName).trim(),
        email: String(email).trim().toLowerCase(),
        emailPersonal: emailPersonal ? String(emailPersonal).trim() : null,
        phone: String(phone).trim(),
        address: address ? String(address).trim() : null,
        jobRoles: validJobRoles,
        access: access as UserRole,
        // Dates: set to null if explicit falsy provided, otherwise let undefined skip update
        dateOfBirth:
          dateOfBirth === undefined
            ? undefined
            : dateOfBirth
            ? new Date(dateOfBirth)
            : null,
        dateOfEmployment:
          dateOfEmployment === undefined
            ? undefined
            : dateOfEmployment
            ? new Date(dateOfEmployment)
            : null,
        dateOfResignation:
          dateOfResignation === undefined
            ? undefined
            : dateOfResignation
            ? new Date(dateOfResignation)
            : null,
        guarantorName: guarantorName ? String(guarantorName).trim() : null,
        guarantorAddress: guarantorAddress ? String(guarantorAddress).trim() : null,
        guarantorPhone: guarantorPhone ? String(guarantorPhone).trim() : null,
        ...(passwordHash ? { passwordHash } : {}),
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        jobRoles: true,
        access: true,
        email: true,
        phone: true,
      },
    });

    return NextResponse.json({ success: true, staff: updated });
  } catch (e: any) {
    console.error("Update staff error:", e);
    if (e?.code === "P2002") {
      return NextResponse.json({ error: "Email already exists" }, { status: 409 });
    }
    if (e?.code === "P2025") {
      return NextResponse.json({ error: "Staff not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Failed to update staff" }, { status: 500 });
  }
}
