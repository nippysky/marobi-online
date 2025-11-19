// app/admin/layout.tsx
import AdminShell from "@/components/admin/AdminShell";
import { getAdminSession } from "@/lib/getAdminSession";
import { redirect } from "next/navigation";
import { ReactNode } from "react";

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await getAdminSession();
  if (!session || !session.user?.role || session.user.role === "customer") {
    redirect("/admin-login");
  }
  return <AdminShell>{children}</AdminShell>;
}
