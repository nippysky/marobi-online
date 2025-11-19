import React from "react";
import { prisma } from "@/lib/db";
import Header from "@/components/shared/header";
import Footer from "@/components/shared/footer";
import CheckoutContent from "./CheckOutContent";
import { getCustomerSession } from "@/lib/getCustomerSession";

export interface CheckoutUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  country?: string;
  state?: string;
  deliveryAddress?: string;
  billingAddress?: string;
}

export default async function CheckoutPage() {
  const session = await getCustomerSession();
  let user: CheckoutUser | null = null;

  if (session?.user?.email && session.user.role === "customer") {
    const cust = await prisma.customer.findUnique({
      where: { email: session.user.email },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        country: true,
        state: true,
        deliveryAddress: true,
        billingAddress: true,
      },
    });

    if (cust) {
      user = {
        id: cust.id,
        firstName: cust.firstName,
        lastName: cust.lastName,
        email: cust.email,
        phone: cust.phone ?? "",
        country: cust.country ?? "",
        state: cust.state ?? "",
        deliveryAddress: cust.deliveryAddress ?? "",
        billingAddress: cust.billingAddress ?? "",
      };
    }
  }

  return (
    <section className="min-h-screen flex flex-col bg-background">
      <Header />
      <CheckoutContent user={user} />
      <Footer />
    </section>
  );
}
