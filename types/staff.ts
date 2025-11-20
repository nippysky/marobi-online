// types/staff-form.ts (or wherever this lives)

// Local enum mirrors – keep this file client-safe
export type JobRole =
  | "SystemAdministrator"
  | "DispatchCoordinator"
  | "OrderProcessingSpecialist"
  | "ProductCatalogManager"
  | "CustomerSupportRep";

export type UserRole =
  | "SuperAdmin"
  | "ProductAdmin"
  | "OrderAdmin"
  | "DispatchUser"
  | "SupportUser";

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
