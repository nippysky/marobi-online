// app/admin-login/page.tsx
import { redirect } from "next/navigation";
import AdminSignInClient from "@/components/admin/AdminSignInClient";
import { getAdminSession } from "@/lib/getAdminSession";

export default async function AdminLoginPage() {
  const session = await getAdminSession();
  if (session) {
    redirect("/admin");
  }
  return <AdminSignInClient />;
}
