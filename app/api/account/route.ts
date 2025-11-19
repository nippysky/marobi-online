// app/api/account/route.ts
import { getServerSession } from "next-auth/next";
import prisma, { prismaReady } from "@/lib/db";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/authOptions";

/** Prisma needs the Node.js runtime */
export const runtime = "nodejs";

export async function PUT(request: Request) {
  // Ensure a single, ready Prisma engine (safe for dev/prod)
  await prismaReady;

  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Read incoming JSON safely
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const {
    firstName,
    lastName,
    email,
    phone,
    address,        // maps to deliveryAddress
    billingAddress,
    country,
    state,
  } = body ?? {};

  // Only include fields that were actually provided (so we don't overwrite with undefined)
  const data: Record<string, unknown> = {};
  if (typeof firstName === "string") data.firstName = firstName;
  if (typeof lastName === "string") data.lastName = lastName;
  if (typeof email === "string") data.email = email;
  if (typeof phone === "string") data.phone = phone;
  if (typeof address === "string") data.deliveryAddress = address;
  if (typeof billingAddress === "string") data.billingAddress = billingAddress;
  if (typeof country === "string") data.country = country;
  if (typeof state === "string") data.state = state;

  try {
    await prisma.customer.update({
      where: { email: session.user.email },
      data,
    });
    return NextResponse.json({ message: "Profile updated" });
  } catch (err) {
    console.error("[api/account] update failed:", err);
    return NextResponse.json(
      { error: "Could not update profile" },
      { status: 500 }
    );
  }
}
