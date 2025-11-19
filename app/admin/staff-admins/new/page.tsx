export const dynamic = "force-dynamic";

import BackButton from "@/components/BackButton";
import NewStaffForm from "./StaffForm";




export default function NewStaffPage() {
  return (
    <div className="p-6 space-y-6">
      <BackButton />
      <h1 className="text-2xl font-bold">Add New Staff</h1>
      <NewStaffForm />
    </div>
  );
}
