"use client";

import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";

// Local mirrors of Prisma enums (schema-safe but client-only)
type JobRole =
  | "SystemAdministrator"
  | "DispatchCoordinator"
  | "OrderProcessingSpecialist"
  | "ProductCatalogManager"
  | "CustomerSupportRep";

type UserRole =
  | "SuperAdmin"
  | "ProductAdmin"
  | "OrderAdmin"
  | "DispatchUser"
  | "SupportUser";

interface StaffDetailProps {
  staff: {
    id: string;
    firstName: string;
    middleName: string | null;
    lastName: string;
    email: string;
    emailPersonal: string | null;
    phone: string;
    address: string | null;
    jobRoles: JobRole[];
    access: UserRole;
    dateOfBirth: Date | string | null;
    dateOfEmployment: Date | string | null;
    dateOfResignation: Date | string | null;
    guarantorName: string | null;
    guarantorAddress: string | null;
    guarantorPhone: string | null;
    createdAt: Date | string;
  };
}

function fmt(d: Date | string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString();
}

export default function StaffDetail({ staff }: StaffDetailProps) {
  const fullName = [staff.firstName, staff.middleName, staff.lastName]
    .filter(Boolean)
    .join(" ");

  return (
    <Card className="rounded-2xl shadow-xl">
      <CardHeader className="pb-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            {/* Avatar circle */}
            <div className="h-12 w-12 bg-gradient-to-br from-purple-500 to-indigo-500 rounded-full flex items-center justify-center text-white text-lg font-bold">
              {staff.firstName[0]}
              {staff.lastName[0]}
            </div>
            <div>
              <CardTitle className="text-2xl">{fullName}</CardTitle>
              <span className="mt-1 inline-block px-2 py-1 rounded-full bg-blue-100 text-blue-800 text-xs font-medium">
                {staff.access}
              </span>
            </div>
          </div>
          <div className="text-xs text-gray-500">
            Joined {fmt(staff.createdAt)}
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-4 grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Left column */}
        <dl className="space-y-4">
          {[
            { label: "First Name", value: staff.firstName },
            { label: "Middle Name", value: staff.middleName || "—" },
            { label: "Last Name", value: staff.lastName },
            { label: "Official Email", value: staff.email },
            { label: "Personal Email", value: staff.emailPersonal || "—" },
            { label: "Phone", value: staff.phone },
            { label: "Address", value: staff.address || "—" },
            {
              label: "Date of Birth",
              value: fmt(staff.dateOfBirth),
            },
          ].map((item) => (
            <div key={item.label}>
              <dt className="text-xs uppercase text-gray-400">
                {item.label}
              </dt>
              <dd className="text-base font-semibold text-gray-900">
                {item.value}
              </dd>
            </div>
          ))}
        </dl>

        {/* Right column */}
        <dl className="space-y-4">
          <div>
            <dt className="text-xs uppercase text-gray-400">Job Role(s)</dt>
            <dd className="text-base font-semibold text-gray-900">
              {staff.jobRoles.length ? staff.jobRoles.join(", ") : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-gray-400">
              Date of Employment
            </dt>
            <dd className="text-base font-semibold text-gray-900">
              {fmt(staff.dateOfEmployment)}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-gray-400">
              Date of Resignation
            </dt>
            <dd className="text-base font-semibold text-gray-900">
              {staff.dateOfResignation ? fmt(staff.dateOfResignation) : "Active"}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-gray-400">
              Guarantor Name
            </dt>
            <dd className="text-base font-semibold text-gray-900">
              {staff.guarantorName || "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-gray-400">
              Guarantor Address
            </dt>
            <dd className="text-base font-semibold text-gray-900">
              {staff.guarantorAddress || "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-gray-400">
              Guarantor Phone
            </dt>
            <dd className="text-base font-semibold text-gray-900">
              {staff.guarantorPhone || "—"}
            </dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  );
}
