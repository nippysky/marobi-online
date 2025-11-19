"use client";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { UserPlus } from "lucide-react";

export default function AddNewStaffButton() {
  const router = useRouter();
  return (
    <Button
      onClick={() => router.push("/admin/staff-admins/new")}
      className="flex items-center"
    >
      <UserPlus className="h-4 w-4 mr-2" />
      Add New Staff
    </Button>
  );
}
