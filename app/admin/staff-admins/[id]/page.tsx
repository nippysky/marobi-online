import { prisma } from "@/lib/db";
import BackButton from "@/components/BackButton";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import StaffDetail from "../StaffDetail";

export const dynamic = "force-dynamic";

async function fetchStaff(id: string) {
  return prisma.staff.findUnique({
    where: { id },
    select: {
      id: true,
      firstName: true,
      middleName: true,
      lastName: true,
      email: true,
      emailPersonal: true,
      phone: true,
      address: true,
      jobRoles: true,
      access: true,
      dateOfBirth: true,
      dateOfEmployment: true,
      dateOfResignation: true,
      guarantorName: true,
      guarantorAddress: true,
      guarantorPhone: true,
      createdAt: true,
    },
  });
}

export default async function StaffDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const staff = await fetchStaff(id);
  if (!staff) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <BackButton />
        <p className="mt-6 text-gray-600">Staff not found.</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <BackButton />
        <Button asChild variant="outline">
          <Link href={`/admin/staff-admins/${staff.id}/edit`}>
            Edit Staff
          </Link>
        </Button>
      </div>
      <StaffDetail staff={staff} />
    </div>
  );
}
