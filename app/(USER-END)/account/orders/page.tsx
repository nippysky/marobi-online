import Link from "next/link";
import { getServerSession } from "next-auth/next";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import OrdersTable from "./OrdersTable";
import { authOptions } from "@/lib/authOptions";

export default async function OrdersPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/auth/login");

  const userWithOrders = await prisma.customer.findUnique({
    where: { email: session.user.email },
    select: {
      orders: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          status: true,
          currency: true,
          totalAmount: true,
          createdAt: true,
        },
      },
    },
  });
  if (!userWithOrders) redirect("/auth/login");

  const ordersForTable = userWithOrders.orders.map((o) => ({
    ...o,
    createdAt: o.createdAt.toISOString(),
  }));

  return (
    <>
      <nav className="text-sm text-gray-600 mb-6 flex items-center gap-2">
        <Link href="/" className="hover:underline">Home</Link>
        <span>/</span>
        <Link href="/account" className="hover:underline">Account</Link>
        <span>/</span>
        <span className="font-medium">Orders</span>
      </nav>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Your Orders</h2>
        {ordersForTable.length ? (
          <OrdersTable orders={ordersForTable} />
        ) : (
          <div className="text-center py-12 space-y-4">
            <p className="text-gray-500">You haven’t placed any orders yet.</p>
            <Link href="/all-products">
              <Button>Start Shopping</Button>
            </Link>
          </div>
        )}
      </section>
    </>
  );
}
