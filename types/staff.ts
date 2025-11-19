import { JobRole, UserRole } from "@/lib/generated/prisma-client";

export interface StaffFormValues {
  firstName: string;
  middleName: string;
  lastName: string;
  email: string;
  emailPersonal: string;
  phone: string;
  address: string;
  dateOfBirth: string;          // ISO (input type="date")
  dateOfEmployment: string;
  dateOfResignation: string;
  jobRoles: JobRole[];
  access: UserRole | "";
  guarantorName: string;
  guarantorAddress: string;
  guarantorPhone: string;
  password: string;
  confirmPassword: string;
  generatePassword: boolean;
}
