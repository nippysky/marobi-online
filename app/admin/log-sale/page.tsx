// app/admin/log-sale/page.tsx
import React from "react";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import OfflineSaleForm from "./OfflineSaleForm";
import { getAdminSession } from "@/lib/getAdminSession";

export default async function LogOfflineSalePage() {
  // 1) Check admin/staff session
  const session = await getAdminSession();
  if (!session || !session.user?.email || session.user.role === "customer") {
    const cb = encodeURIComponent("/admin/log-sale");
    return redirect(`/admin-login?callbackUrl=${cb}`);
  }

  // 2) Lookup staff
  const staff = await prisma.staff.findUnique({
    where: { email: session.user.email },
  });
  if (!staff) {
    return redirect("/admin");
  }

  // 3) Render form
  return (
    <div className="p-8 max-w-6xl mx-auto">
      <h1 className="text-4xl font-extrabold mb-8">Log Offline Sale</h1>
      <OfflineSaleForm staffId={staff.id} />
    </div>
  );
}
