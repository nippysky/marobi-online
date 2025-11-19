
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/authOptions";
import LoginClient from "@/components/auth/LoginClient";


export default async function CustomerLoginPage() {
  const session = await getServerSession(authOptions);
  if (session?.user?.role === "customer") redirect("/");
  return <LoginClient />;
}
