import { ReactNode } from "react";
import { redirect } from "next/navigation";
import { Header } from "@/components/shared/header";
import AccountSidebar from "./AccountSidebar";
import { getCustomerSession } from "@/lib/getCustomerSession";

export default async function AccountLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await getCustomerSession();
  if (!session || session.user?.role !== "customer") {
    redirect("/(USER-END)/auth/login");
  }

  return (
    <section className="min-h-screen bg-gradient-to-b from-gray-100 to-white">
      <Header />
      <div className="max-w-7xl mx-auto px-4 py-12 flex flex-col lg:flex-row gap-8">
        <aside className="w-full lg:w-1/4 sticky top-24 self-start">
          <AccountSidebar />
        </aside>
        <main className="w-full lg:w-3/4 space-y-8">{children}</main>
      </div>
    </section>
  );
}
