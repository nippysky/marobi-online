export const dynamic = "force-dynamic";

import { prisma } from "@/lib/db";
import BackButton from "@/components/BackButton";
import { notFound } from "next/navigation";
import {
  AdminCustomerOrder,
  AdminCustomerOrderProduct,
} from "@/types/admin";
import CustomerSummary from "../CustomerSummary";
import CustomerOrdersTable from "./CustomerOrdersTable";



async function fetchCustomer(customerId: string) {
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      deliveryAddress: true,
      billingAddress: true,
      registeredAt: true,
      lastLogin: true,
      orders: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          status: true,
          currency: true,
          totalAmount: true,
          totalNGN: true,
          createdAt: true,
          paymentMethod: true,
          items: {
            select: {
              id: true,
              name: true,
              image: true,
              category: true,
              quantity: true,
              color: true,
              size: true,
              lineTotal: true,
            },
          },
        },
      },
    },
  });
  return customer;
}

export default async function CustomerDetailsPage({ params }: { params: Promise<{ customerId: string }> }) {
  const { customerId } = await params;
  const c = await fetchCustomer(customerId);
  if (!c) return notFound();

  // Aggregate breakdown by category:
  const breakdown: Record<string, number> = {};
  c.orders.forEach(o =>
    o.items.forEach(it => {
      breakdown[it.category] = (breakdown[it.category] || 0) + it.quantity;
    })
  );

  // Totals
  const totalOrders = c.orders.length;
  const totalSpent = c.orders.reduce((sum, o) => sum + o.totalNGN, 0);

  // Addresses (fallback)
  const billingAddress = c.billingAddress || c.deliveryAddress || "N/A";
  const shippingAddress = c.deliveryAddress || c.billingAddress || "N/A";

  // Pack into summary customer object expected by your existing <CustomerSummary />
  const summaryCustomer = {
    id: c.id,
    firstName: c.firstName,
    lastName: c.lastName,
    email: c.email,
    phone: c.phone,
    totalOrders,
    totalSpent,
    registeredAt: c.registeredAt.toISOString(),
    lastLogin: c.lastLogin ? c.lastLogin.toISOString() : null,
  };

  // Convert orders to AdminCustomerOrder[]
  const orders: AdminCustomerOrder[] = c.orders.map(o => ({
    id: o.id,
    status: o.status,
    currency: o.currency,
    totalAmount: o.totalAmount,
    totalNGN: o.totalNGN,
    createdAt: o.createdAt.toISOString(),
    paymentMethod: o.paymentMethod,
    customer: {
      id: c.id,
      name: `${c.firstName} ${c.lastName}`.trim(),
      email: c.email,
      phone: c.phone,
      address: shippingAddress,
    },
    products: o.items.map<AdminCustomerOrderProduct>(it => ({
      id: it.id,
      name: it.name,
      image: it.image || "",
      category: it.category,
      color: it.color,
      size: it.size,
      quantity: it.quantity,
      lineTotal: it.lineTotal,
    })),
  }));

  return (
    <div className="space-y-6 p-6">
      <BackButton />
      <CustomerSummary
        customer={summaryCustomer}
        breakdown={breakdown}
        billingAddress={billingAddress}
        shippingAddress={shippingAddress}
      />
      <CustomerOrdersTable initialData={orders} />
    </div>
  );
}
