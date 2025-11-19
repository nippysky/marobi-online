// app/admin/profile/page.tsx
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import PasswordChangeForm from "@/components/admin/PasswordChangeForm";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import { getAdminSession } from "@/lib/getAdminSession";

export default async function ProfilePage() {
  const session = await getAdminSession();
  if (!session || session.user?.role === "customer") {
    redirect("/admin-login");
  }

  const staff = await prisma.staff.findUnique({
    where: { id: session.user.id },
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
    },
  });

  if (!staff) {
    return <p className="text-center text-red-600 py-16">Profile not found.</p>;
  }

  const fullName = [staff.firstName, staff.middleName, staff.lastName]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-4xl mx-auto space-y-8">
        <h1 className="text-3xl font-bold text-gray-800">My Profile</h1>

        <div className="grid gap-8 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Profile Details</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
                <div>
                  <dt className="text-sm font-medium text-gray-500">ID</dt>
                  <dd className="mt-1 text-sm text-gray-900">{staff.id}</dd>
                </div>

                <div>
                  <dt className="text-sm font-medium text-gray-500">Name</dt>
                  <dd className="mt-1 text-sm text-gray-900">{fullName}</dd>
                </div>

                <div>
                  <dt className="text-sm font-medium text-gray-500">Official Email</dt>
                  <dd className="mt-1 text-sm text-gray-900">{staff.email}</dd>
                </div>

                <div>
                  <dt className="text-sm font-medium text-gray-500">Personal Email</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {staff.emailPersonal || "—"}
                  </dd>
                </div>

                <div>
                  <dt className="text-sm font-medium text-gray-500">Phone</dt>
                  <dd className="mt-1 text-sm text-gray-900">{staff.phone}</dd>
                </div>

                <div>
                  <dt className="text-sm font-medium text-gray-500">Address</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {staff.address || "—"}
                  </dd>
                </div>

                <div>
                  <dt className="text-sm font-medium text-gray-500">Role</dt>
                  <dd className="mt-1 text-sm text-gray-900">{staff.access}</dd>
                </div>

                <div>
                  <dt className="text-sm font-medium text-gray-500">Job Roles</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {(staff.jobRoles || []).join(", ")}
                  </dd>
                </div>

                <div>
                  <dt className="text-sm font-medium text-gray-500">Employed Since</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {staff.dateOfEmployment
                      ? staff.dateOfEmployment.toLocaleDateString()
                      : "—"}
                  </dd>
                </div>

                <div>
                  <dt className="text-sm font-medium text-gray-500">Date of Birth</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {staff.dateOfBirth
                      ? staff.dateOfBirth.toLocaleDateString()
                      : "—"}
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          <PasswordChangeForm />
        </div>
      </div>
    </div>
  );
}
