import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import ProfileSection from "./ProfileSection";
import { getCustomerSession } from "@/lib/getCustomerSession";

type Profile = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  billingAddress: string;
  country: string;
  state: string;
  registeredAt: string;
  lastLogin: string | null;
};

export default async function AccountPage() {
  const session = await getCustomerSession();
  if (!session || session.user?.role !== "customer" || !session.user?.email) {
    redirect("/(USER-END)/auth/login");
  }

  const user = await prisma.customer.findUnique({
    where: { email: session.user.email },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      deliveryAddress: true,
      billingAddress: true,
      country: true,
      state: true,
      registeredAt: true,
      lastLogin: true,
    },
  });
  if (!user) {
    redirect("/(USER-END)/auth/login");
  }

  const profile: Profile = {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    phone: user.phone,
    address: user.deliveryAddress ?? "",
    billingAddress: user.billingAddress ?? "",
    country: user.country ?? "",
    state: user.state ?? "",
    registeredAt: user.registeredAt.toISOString(),
    lastLogin: user.lastLogin?.toISOString() ?? null,
  };

  return (
    <>
      <nav className="text-sm text-gray-600 mb-6 flex items-center gap-2">
        <Link href="/" className="hover:underline">
          Home
        </Link>
        <span>/</span>
        <span className="font-medium">Account</span>
      </nav>
      <ProfileSection user={profile} />
    </>
  );
}
