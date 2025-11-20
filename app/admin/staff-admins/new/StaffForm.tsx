"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { JobRole, UserRole } from "@/lib/generated/prisma-client/client";
import { Clipboard, RefreshCw } from "lucide-react";
import clsx from "clsx";

/* ---------- Constants ---------- */
const JOB_ROLE_OPTIONS: JobRole[] = [
  "SystemAdministrator",
  "DispatchCoordinator",
  "OrderProcessingSpecialist",
  "ProductCatalogManager",
  "CustomerSupportRep",
];

const USER_ROLE_OPTIONS: UserRole[] = [
  "SuperAdmin",
  "ProductAdmin",
  "OrderAdmin",
  "DispatchUser",
  "SupportUser",
];

interface EditInitial {
  id: string;
  firstName: string;
  middleName: string;
  lastName: string;
  email: string;
  emailPersonal: string;
  phone: string;
  address: string;
  jobRoles: JobRole[];
  access: UserRole;
  dateOfBirth: string;
  dateOfEmployment: string;
  dateOfResignation: string;
  guarantorName: string;
  guarantorAddress: string;
  guarantorPhone: string;
}

interface Props {
  mode?: "create" | "edit";
  staffId?: string;
  initialData?: Partial<EditInitial>;
}

/* ---------- Helpers ---------- */
function genPassword(len = 12) {
  const chars =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
  return Array.from({ length: len }, () =>
    chars[Math.floor(Math.random() * chars.length)]
  ).join("");
}

interface Strength {
  score: number; // 0-4
  label: string;
  percent: number; // 0-100
  color: string;
}

function calcStrength(pw: string): Strength {
  if (!pw) return { score: 0, label: "Empty", percent: 0, color: "bg-gray-300" };
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;

  // Normalize to 0–4
  if (score > 4) score = 4;

  const labels = ["Very Weak", "Weak", "Fair", "Strong", "Very Strong"];
  const colors = [
    "bg-red-500",
    "bg-orange-500",
    "bg-yellow-500",
    "bg-green-500",
    "bg-emerald-600",
  ];
  return {
    score,
    label: labels[score],
    percent: ((score + 1) / 5) * 100,
    color: colors[score],
  };
}

export default function StaffForm({
  mode = "create",
  staffId,
  initialData = {},
}: Props) {
  const router = useRouter();
  const isEdit = mode === "edit";

  /* ---------- Form State ---------- */
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    firstName: initialData.firstName || "",
    middleName: initialData.middleName || "",
    lastName: initialData.lastName || "",
    email: initialData.email || "",
    emailPersonal: initialData.emailPersonal || "",
    phone: initialData.phone || "",
    address: initialData.address || "",
    jobRoles: (initialData.jobRoles as JobRole[]) || [],
    access: (initialData.access as UserRole) || ("" as any),
    dateOfBirth: initialData.dateOfBirth || "",
    dateOfEmployment: initialData.dateOfEmployment || "",
    dateOfResignation: initialData.dateOfResignation || "",
    guarantorName: initialData.guarantorName || "",
    guarantorAddress: initialData.guarantorAddress || "",
    guarantorPhone: initialData.guarantorPhone || "",

    // Password handling:
    // "none" (keep existing, edit mode only), "manual", "auto"
    passwordMode: isEdit ? ("none" as "none" | "manual" | "auto") : "auto",
    password: "",
    confirmPassword: "",
  });

  function update<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm(f => ({ ...f, [k]: v }));
  }

  function toggleJobRole(role: JobRole) {
    setForm(f => ({
      ...f,
      jobRoles: f.jobRoles.includes(role)
        ? f.jobRoles.filter(r => r !== role)
        : [...f.jobRoles, role],
    }));
  }

  /* ---------- Password Actions ---------- */
  function ensureAutoPassword() {
    if (form.passwordMode === "auto" && !form.password) {
      const pw = genPassword();
      update("password", pw);
      update("confirmPassword", pw);
    }
  }

  function regeneratePassword() {
    const pw = genPassword();
    update("password", pw);
    update("confirmPassword", pw);
  }

  function copyPassword() {
    if (form.password) {
      navigator.clipboard.writeText(form.password);
      toast.success("Password copied");
    }
  }

  const strength = useMemo(
    () => calcStrength(form.passwordMode !== "none" ? form.password : ""),
    [form.password, form.passwordMode]
  );

  /* ---------- Validation ---------- */
  function validate(): string | null {
    if (!form.firstName.trim()) return "First name required";
    if (!form.lastName.trim()) return "Last name required";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      return "Valid official email required";
    if (!form.phone.trim()) return "Phone required";
    if (!form.access) return "User role required";
    if (form.jobRoles.length === 0) return "Select at least one job role";

    if (form.passwordMode !== "none") {
      if (!form.password)
        return "Password required (or choose 'Keep Existing Password').";
      if (form.password.length < 8)
        return "Password must be at least 8 characters.";
      if (form.password !== form.confirmPassword)
        return "Passwords do not match.";
    } else {
      // edit mode, keeping existing: nothing
    }

    return null;
  }

  /* ---------- Submit ---------- */
  async function handleSubmit() {
    const err = validate();
    if (err) {
      toast.error(err);
      return;
    }

    if (form.passwordMode === "auto") ensureAutoPassword();

    setSubmitting(true);
    try {
      const payload: any = {
        firstName: form.firstName.trim(),
        middleName: form.middleName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim().toLowerCase(),
        emailPersonal: form.emailPersonal.trim() || null,
        phone: form.phone.trim(),
        address: form.address.trim() || null,
        jobRoles: form.jobRoles,
        access: form.access,
        dateOfBirth: form.dateOfBirth || null,
        dateOfEmployment: form.dateOfEmployment || null,
        dateOfResignation: form.dateOfResignation || null,
        guarantorName: form.guarantorName.trim() || null,
        guarantorAddress: form.guarantorAddress.trim() || null,
        guarantorPhone: form.guarantorPhone.trim() || null,
      };

      if (form.passwordMode !== "none") {
        payload.generatePassword = form.passwordMode === "auto";
        payload.password =
          form.passwordMode === "auto" ? form.password : form.password;
      }

      const url = isEdit ? `/api/staff/${staffId}` : "/api/staff";
      const method = isEdit ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Request failed");

      if (!isEdit && json.generatedPassword) {
        toast.success("Staff created. Password visible – copy it now.");
      } else if (isEdit && form.passwordMode !== "none") {
        toast.success("Staff updated (password changed).");
      } else {
        toast.success("Staff updated.");
      }

      router.push("/admin/staff-admins");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  /* ---------- Password Mode Controls (Edit) ---------- */
  function renderPasswordModeSelector() {
    if (!isEdit) return null;

    return (
      <div className="flex flex-wrap gap-2">
        {[
          { key: "none", label: "Keep Existing Password" },
          { key: "manual", label: "Set Manually" },
          { key: "auto", label: "Auto Generate" },
        ].map(opt => {
          const active = form.passwordMode === opt.key;
            return (
              <button
                key={opt.key}
                type="button"
                onClick={() => {
                  update("passwordMode", opt.key as any);
                  if (opt.key === "auto") {
                    const p = genPassword();
                    update("password", p);
                    update("confirmPassword", p);
                  } else if (opt.key === "none") {
                    update("password", "");
                    update("confirmPassword", "");
                  } else {
                    // manual
                    update("password", "");
                    update("confirmPassword", "");
                  }
                }}
                className={clsx(
                  "px-3 py-1 rounded text-sm border transition",
                  active
                    ? "bg-indigo-600 text-white border-indigo-600"
                    : "hover:bg-gray-50"
                )}
              >
                {opt.label}
              </button>
            );
        })}
      </div>
    );
  }

  return (
    <Card>
      <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6">
        {/* Basic Identity */}
        <div className="flex flex-col space-y-2">
          <Label>First Name *</Label>
          <Input
            value={form.firstName}
            onChange={e => update("firstName", e.target.value)}
          />
        </div>
        <div className="flex flex-col space-y-2">
          <Label>Middle Name</Label>
          <Input
            value={form.middleName}
            onChange={e => update("middleName", e.target.value)}
          />
        </div>
        <div className="flex flex-col space-y-2">
          <Label>Last Name *</Label>
          <Input
            value={form.lastName}
            onChange={e => update("lastName", e.target.value)}
          />
        </div>

        {/* Emails & Phone */}
        <div className="flex flex-col space-y-2">
          <Label>Official Email *</Label>
          <Input
            type="email"
            value={form.email}
            onChange={e => update("email", e.target.value)}
          />
        </div>
        <div className="flex flex-col space-y-2">
          <Label>Personal Email</Label>
          <Input
            type="email"
            value={form.emailPersonal}
            onChange={e => update("emailPersonal", e.target.value)}
          />
        </div>
        <div className="flex flex-col space-y-2">
          <Label>Phone *</Label>
          <Input
            value={form.phone}
            onChange={e => update("phone", e.target.value)}
          />
        </div>

        {/* Address */}
        <div className="flex flex-col space-y-2">
          <Label>Address</Label>
          <Input
            value={form.address}
            onChange={e => update("address", e.target.value)}
          />
        </div>

        {/* Dates */}
        <div className="flex flex-col space-y-2">
          <Label>Date of Birth</Label>
          <Input
            type="date"
            value={form.dateOfBirth}
            onChange={e => update("dateOfBirth", e.target.value)}
          />
        </div>
        <div className="flex flex-col space-y-2">
          <Label>Date of Employment</Label>
          <Input
            type="date"
            value={form.dateOfEmployment}
            onChange={e => update("dateOfEmployment", e.target.value)}
          />
        </div>
        <div className="flex flex-col space-y-2">
          <Label>Date of Resignation</Label>
          <Input
            type="date"
            value={form.dateOfResignation}
            onChange={e => update("dateOfResignation", e.target.value)}
          />
        </div>

        {/* User Role */}
        <div className="flex flex-col space-y-2">
          <Label>User Role *</Label>
          <Select
            value={form.access}
            onValueChange={v => update("access", v as UserRole)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select role" />
            </SelectTrigger>
            <SelectContent>
              {USER_ROLE_OPTIONS.map(r => (
                <SelectItem key={r} value={r}>
                  {r}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Job Roles Multi-select */}
        <div className="md:col-span-2 flex flex-col space-y-2">
          <Label>Job Roles *</Label>
          <div className="flex flex-wrap gap-2">
            {JOB_ROLE_OPTIONS.map(r => {
              const active = form.jobRoles.includes(r);
              return (
                <button
                  key={r}
                  type="button"
                  onClick={() => toggleJobRole(r)}
                  className={clsx(
                    "px-3 py-1 text-sm rounded border transition",
                    active
                      ? "bg-indigo-600 text-white border-indigo-600"
                      : "hover:bg-gray-50"
                  )}
                >
                  {r}
                </button>
              );
            })}
          </div>
          {form.jobRoles.length === 0 && (
            <p className="text-xs text-red-500">Select at least one job role.</p>
          )}
        </div>

        {/* Guarantor Section */}
        <div className="md:col-span-3 border-t pt-4">
          <p className="font-medium mb-2">Guarantor Information</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="flex flex-col space-y-2">
              <Label>Guarantor Name</Label>
              <Input
                value={form.guarantorName}
                onChange={e => update("guarantorName", e.target.value)}
              />
            </div>
            <div className="flex flex-col space-y-2">
              <Label>Guarantor Address</Label>
              <Input
                value={form.guarantorAddress}
                onChange={e => update("guarantorAddress", e.target.value)}
              />
            </div>
            <div className="flex flex-col space-y-2">
              <Label>Guarantor Phone</Label>
              <Input
                value={form.guarantorPhone}
                onChange={e => update("guarantorPhone", e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Password Section */}
        <div className="md:col-span-3 border-t pt-4 space-y-6">
          <div className="flex flex-col gap-2">
            <Label className="font-medium">
              {isEdit ? "Password Options" : "Password"}
            </Label>
            {isEdit ? (
              renderPasswordModeSelector()
            ) : (
              <div className="flex flex-wrap gap-2">
                {/* For create: default auto / optional manual */}
                <button
                  type="button"
                  onClick={() => {
                    update("passwordMode", "auto");
                    const p = genPassword();
                    update("password", p);
                    update("confirmPassword", p);
                  }}
                  className={clsx(
                    "px-3 py-1 rounded border text-sm transition",
                    form.passwordMode === "auto"
                      ? "bg-indigo-600 text-white border-indigo-600"
                      : "hover:bg-gray-50"
                  )}
                >
                  Auto Generate
                </button>
                <button
                  type="button"
                  onClick={() =>
                    update("passwordMode", "manual")
                  }
                  className={clsx(
                    "px-3 py-1 rounded border text-sm transition",
                    form.passwordMode === "manual"
                      ? "bg-indigo-600 text-white border-indigo-600"
                      : "hover:bg-gray-50"
                  )}
                >
                  Enter Manually
                </button>
              </div>
            )}
          </div>

            {form.passwordMode !== "none" && (
            <div className="space-y-4">
              {form.passwordMode === "auto" && (
                <div className="flex items-center gap-2">
                  <Input
                    value={form.password}
                    readOnly
                    className="font-mono"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={regeneratePassword}
                    title="Regenerate"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={copyPassword}
                    title="Copy"
                  >
                    <Clipboard className="h-4 w-4" />
                  </Button>
                </div>
              )}

              {form.passwordMode === "manual" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="flex flex-col space-y-2">
                    <Label>
                      Password {isEdit ? "(leave blank to cancel)" : "*"}
                    </Label>
                    <Input
                      type="password"
                      value={form.password}
                      onChange={e => update("password", e.target.value)}
                      placeholder="At least 8 chars"
                    />
                  </div>
                  <div className="flex flex-col space-y-2">
                    <Label>Confirm Password</Label>
                    <Input
                      type="password"
                      value={form.confirmPassword}
                      onChange={e => update("confirmPassword", e.target.value)}
                    />
                  </div>
                </div>
              )}

              {/* Strength Meter */}
              {form.password && (
                <div className="space-y-1">
                  <div className="flex justify-between text-xs font-medium">
                    <span>Password Strength: {strength.label}</span>
                    <span>{Math.round(strength.percent)}%</span>
                  </div>
                  <div className="h-2 w-full bg-gray-200 rounded overflow-hidden">
                    <div
                      className={`h-full ${strength.color} transition-all`}
                      style={{ width: `${strength.percent}%` }}
                    />
                  </div>
                  <p className="text-[11px] text-gray-500">
                    Use a mix of upper, lower, numbers & symbols. Minimum 8
                    characters.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>

      <CardFooter className="flex justify-end space-x-4">
        <Button
          variant="destructive"
          type="button"
          disabled={submitting}
          onClick={() => history.back()}
        >
          Cancel
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={submitting}
          onClick={handleSubmit}
        >
          {submitting
            ? isEdit
              ? "Updating..."
              : "Creating..."
            : isEdit
            ? "Save Changes"
            : "Create Staff"}
        </Button>
      </CardFooter>
    </Card>
  );
}
