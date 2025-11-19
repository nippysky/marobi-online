import React from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";

interface Customer {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  totalOrders: number;
  totalSpent: number;
  registeredAt: string;
  lastLogin: string | null;
}

interface Props {
  customer: Customer;
  breakdown: Record<string, number>;
  billingAddress: string;
  shippingAddress: string;
}

export default function CustomerSummary({
  customer,
  breakdown,
  billingAddress,
  shippingAddress,
}: Props) {
  const hasBreakdown = Object.keys(breakdown).length > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Customer Details</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div><strong>ID:</strong> {customer.id}</div>
          <div><strong>First Name:</strong> {customer.firstName}</div>
          <div><strong>Last Name:</strong> {customer.lastName}</div>
          <div><strong>Email:</strong> {customer.email}</div>
          <div><strong>Phone:</strong> {customer.phone}</div>
          <div>
            <strong>Registered On:</strong>{" "}
            {new Date(customer.registeredAt).toLocaleDateString()}
          </div>
          <div>
            <strong>Last Login:</strong>{" "}
            {customer.lastLogin
              ? new Date(customer.lastLogin).toLocaleString()
              : "—"}
          </div>
          <div><strong>Total Orders:</strong> {customer.totalOrders}</div>
          <div>
            <strong>Total Spent:</strong>{" "}
            ₦{customer.totalSpent.toLocaleString()}
          </div>
          <div><strong>Billing Address:</strong> {billingAddress}</div>
          <div><strong>Shipping Address:</strong> {shippingAddress}</div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Orders by Category</CardTitle>
          </CardHeader>
          <CardContent>
            {hasBreakdown ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    {Object.keys(breakdown).map(cat => (
                      <TableHead key={cat}>{cat}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    {Object.values(breakdown).map((count, i) => (
                      <TableCell key={i}>{count}</TableCell>
                    ))}
                  </TableRow>
                </TableBody>
              </Table>
            ) : (
              <div className="text-sm text-gray-500">
                No order category data yet.
              </div>
            )}
          </CardContent>
        </Card>
      </CardContent>
    </Card>
  );
}
