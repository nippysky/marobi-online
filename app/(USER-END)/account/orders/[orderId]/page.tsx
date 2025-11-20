export const dynamic = "force-dynamic"; // Next.js 15 expects this for dynamic pages

import Link from "next/link";
import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/db";
import OrderDetail from "./OrderDetail";
import { authOptions } from "@/lib/authOptions";
import type {
  OrderStatus,
  OrderChannel,
  Currency,
} from "@/lib/generated/prisma-client/client";

export default async function OrderPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/auth/login");

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: {
        select: {
          id: true,
          name: true,
          image: true,
          category: true,
          color: true,
          size: true,
          quantity: true,
          lineTotal: true,
          hasSizeMod: true,
          sizeModFee: true,
        },
      },
      customer: {
        select: { deliveryAddress: true, billingAddress: true, email: true, id: true },
      },
    },
  });
  if (!order) redirect("/account/orders");

  // only let them view their own orders
  if (order.customer && session.user.email) {
    const cust = await prisma.customer.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });
    if (order.customerId !== cust?.id) redirect("/account/orders");
  }

  const detail = {
    id: order.id,
    createdAt: order.createdAt.toISOString(),
    status: order.status as OrderStatus,
    channel: order.channel as OrderChannel,
    currency: order.currency as Currency,
    paymentMethod: order.paymentMethod,
    deliveryAddress: order.customer?.deliveryAddress ?? "—",
    billingAddress: order.customer?.billingAddress ?? "—",
    items: order.items.map((i) => ({
      ...i,
      image: i.image ?? "",
    })),
    deliveryFee: 500, // TODO: wire actual delivery fee if needed
  };

  return (
    <section className="px-4 py-8 max-w-4xl mx-auto space-y-6">
      <nav className="text-sm text-gray-600 mb-4 flex items-center gap-2">
        <Link href="/" className="hover:underline">
          Home
        </Link>
        <span>/</span>
        <Link href="/account" className="hover:underline">
          Account
        </Link>
        <span>/</span>
        <Link href="/account/orders" className="hover:underline">
          Orders
        </Link>
        <span>/</span>
        <span className="font-medium">#{detail.id}</span>
      </nav>
      <OrderDetail order={detail} />
    </section>
  );
}
