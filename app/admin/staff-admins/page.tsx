export const dynamic = "force-dynamic";

import { prisma } from "@/lib/db";
import EmptyState from "@/components/admin/EmptyState";
import AddNewStaffButton from "@/components/admin/AddNewStaffButton";
import StaffsTable, { StaffRow } from "./StaffsTable";



async function fetchStaff(): Promise<StaffRow[]> {
  const staff = await prisma.staff.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      jobRoles: true,
      access: true,
      createdAt: true,
    },
  });

  return staff.map((s) => ({
    id:            s.id,
    firstName:     s.firstName,
    lastName:      s.lastName,
    emailOfficial: s.email,
    phone:         s.phone,
    jobRoles:      s.jobRoles,                    // <–– now an array
    userRole:      s.access,
    createdAt:     s.createdAt.toISOString(),
  }));
}

export default async function StaffAdminsPage() {
  const rows = await fetchStaff();

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Staff &amp; Admins</h1>
        <AddNewStaffButton />
      </div>

      {rows.length === 0 ? (
        <EmptyState
          iconName="User"
          title="No staff members yet"
          message="Add your first staff/admin record to start managing internal access."
          action={<AddNewStaffButton />}
        />
      ) : (
        <StaffsTable initialData={rows} />
      )}
    </div>
  );
}
