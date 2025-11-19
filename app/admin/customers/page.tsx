import { prisma } from "@/lib/db";
import EmptyState from "@/components/admin/EmptyState";
import { AdminCustomerRow } from "@/types/admin";
import CustomersTable from "./CustomersTable";

export const dynamic = "force-dynamic";

async function fetchCustomers(): Promise<AdminCustomerRow[]> {
  // Pull customers + minimal order info for counts & last order time
  const customers = await prisma.customer.findMany({
    orderBy: { registeredAt: "desc" },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      registeredAt: true,
      lastLogin: true,
      orders: { select: { id: true, createdAt: true }, orderBy: { createdAt: "desc" } },
    },
  });

  return customers.map(c => ({
    id: c.id,
    name: `${c.firstName} ${c.lastName}`.trim(),
    email: c.email,
    phone: c.phone,
    totalOrders: c.orders.length,
    lastLogin: c.lastLogin ? c.lastLogin.toISOString() : null,
    registeredAt: c.registeredAt.toISOString(),
  }));
}

export default async function CustomersPage() {
  const rows = await fetchCustomers();

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Customers</h1>

      {rows.length === 0 ? (
        <EmptyState
          iconName="Users"
          title="No customers yet"
          message="Customer accounts will appear here once users register or place orders."
        />
      ) : (
        <CustomersTable initialData={rows} />
      )}
    </div>
  );
}
