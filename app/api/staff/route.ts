// app/api/staff/route.ts
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import prisma, { prismaReady } from "@/lib/db";
import { JobRole, UserRole } from "@/lib/generated/prisma-client/client";

/** Generate a readable/strong password if requested */
function randomPassword(len = 12) {
  const chars =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
  return Array.from({ length: len }, () =>
    chars[Math.floor(Math.random() * chars.length)]
  ).join("");
}

export async function POST(req: Request) {
  await prismaReady;

  // Parse JSON
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const requiredString = (v: any) => typeof v === "string" && v.trim().length > 0;

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
    password,
    generatePassword,
  } = body || {};

  // Basic validation
  if (!requiredString(firstName))
    return NextResponse.json({ error: "firstName required" }, { status: 400 });
  if (!requiredString(lastName))
    return NextResponse.json({ error: "lastName required" }, { status: 400 });
  if (!requiredString(email))
    return NextResponse.json({ error: "email required" }, { status: 400 });
  if (!requiredString(phone))
    return NextResponse.json({ error: "phone required" }, { status: 400 });
  if (!Array.isArray(jobRoles) || jobRoles.length === 0)
    return NextResponse.json(
      { error: "jobRoles must be a non-empty array" },
      { status: 400 }
    );
  if (!requiredString(access))
    return NextResponse.json({ error: "access required" }, { status: 400 });

  // Runtime enum checks (prevents invalid values hitting the DB)
  const validJobRoles = jobRoles.filter((r: unknown) =>
    typeof r === "string" && Object.values(JobRole).includes(r as JobRole)
  ) as JobRole[];

  if (validJobRoles.length === 0) {
    return NextResponse.json(
      { error: "jobRoles contains no valid roles" },
      { status: 400 }
    );
  }

  if (!Object.values(UserRole).includes(access as UserRole)) {
    return NextResponse.json(
      { error: "access must be a valid UserRole" },
      { status: 400 }
    );
  }

  // Password handling
  const chosenPassword: string =
    generatePassword ? randomPassword() : (password as string);

  if (!chosenPassword || chosenPassword.length < 6) {
    return NextResponse.json(
      { error: "Password must be at least 6 characters." },
      { status: 400 }
    );
  }

  const passwordHash = await bcrypt.hash(chosenPassword, 10);

  // Coerce/normalize inputs
  const data = {
    firstName: String(firstName).trim(),
    middleName: (middleName ?? "").toString().trim() || "",
    lastName: String(lastName).trim(),
    email: String(email).trim().toLowerCase(),
    emailPersonal: emailPersonal ? String(emailPersonal).trim() : null,
    phone: String(phone).trim(),
    address: address ? String(address).trim() : null,
    jobRoles: validJobRoles,
    access: access as UserRole,
    dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
    // Let default(now()) apply if omitted
    dateOfEmployment: dateOfEmployment ? new Date(dateOfEmployment) : undefined,
    dateOfResignation: dateOfResignation ? new Date(dateOfResignation) : null,
    guarantorName: guarantorName ? String(guarantorName).trim() : null,
    guarantorAddress: guarantorAddress ? String(guarantorAddress).trim() : null,
    guarantorPhone: guarantorPhone ? String(guarantorPhone).trim() : null,
    passwordHash,
  } as const;

  try {
    const created = await prisma.staff.create({
      data,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        jobRoles: true,
        access: true,
        email: true,
        phone: true,
        createdAt: true,
      },
    });

    return NextResponse.json(
      {
        success: true,
        staff: created,
        // Only return the raw password if it was auto-generated
        generatedPassword: generatePassword ? chosenPassword : undefined,
      },
      { status: 201 }
    );
  } catch (e: any) {
    console.error("Create staff error:", e);
    if (e?.code === "P2002") {
      return NextResponse.json({ error: "Email already exists" }, { status: 409 });
    }
    return NextResponse.json(
      { error: "Failed to create staff" },
      { status: 500 }
    );
  }
}
