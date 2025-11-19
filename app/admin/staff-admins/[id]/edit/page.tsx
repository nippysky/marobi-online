import { prisma } from "@/lib/db";
import BackButton from "@/components/BackButton";
import StaffForm from "../../new/StaffForm";

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
    },
  });
}

export default async function EditStaffPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const staff = await fetchStaff(id);
  if (!staff) {
    return (
      <div className="p-6">
        <BackButton />
        <p className="mt-4 text-gray-600">Staff not found.</p>
      </div>
    );
  }

  const initial = {
    id: staff.id,
    firstName: staff.firstName,
    middleName: staff.middleName || "",
    lastName: staff.lastName,
    email: staff.email,
    emailPersonal: staff.emailPersonal || "",
    phone: staff.phone,
    address: staff.address || "",
    jobRoles: staff.jobRoles,
    access: staff.access,
    dateOfBirth: staff.dateOfBirth
      ? staff.dateOfBirth.toISOString().slice(0, 10)
      : "",
    dateOfEmployment: staff.dateOfEmployment
      ? staff.dateOfEmployment.toISOString().slice(0, 10)
      : "",
    dateOfResignation: staff.dateOfResignation
      ? staff.dateOfResignation.toISOString().slice(0, 10)
      : "",
    guarantorName: staff.guarantorName || "",
    guarantorAddress: staff.guarantorAddress || "",
    guarantorPhone: staff.guarantorPhone || "",
  };

  return (
    <div className="p-6 space-y-6">
      <BackButton />
      <h1 className="text-2xl font-bold">Edit Staff</h1>
      <StaffForm mode="edit" staffId={id} initialData={initial} />
    </div>
  );
}
