// app/auth/register/RegisterClient.tsx
"use client";

import React, { useState, useEffect, useMemo, ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { FaArrowLeftLong, FaEye, FaEyeSlash } from "react-icons/fa6";
import { Toaster, toast } from "react-hot-toast";

interface CountryData {
  name: string;
  iso2: string;
  callingCodes: string[];
}

const FormField = ({
  label,
  htmlFor,
  children,
  span2 = false,
}: {
  label: string;
  htmlFor: string;
  children: ReactNode;
  span2?: boolean;
}) => (
  <div className={`${span2 ? "md:col-span-2" : ""} flex flex-col gap-2`}>
    <Label htmlFor={htmlFor}>{label}</Label>
    {children}
  </div>
);

// ISO2 → flag emoji
const flagEmoji = (iso2: string) =>
  iso2
    .toUpperCase()
    .replace(/./g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0)));

// Always return a dial code with exactly one leading '+'
const normalizeDial = (code: string | number) =>
  `+${String(code).replace(/\D/g, "")}`;

export default function RegisterClient() {
  const router = useRouter();

  // ── Personal fields ─────────────────────────────────────────────────
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");

  // ── Country & state ─────────────────────────────────────────────────
  const [countryList, setCountryList] = useState<CountryData[]>([]);
  const [country, setCountry] = useState<CountryData | null>(null);
  const [stateList, setStateList] = useState<string[]>([]);
  const [stateVal, setStateVal] = useState("");

  // ── Phone ───────────────────────────────────────────────────────────
  const [phoneCode, setPhoneCode] = useState("+234");
  const [phoneNumber, setPhoneNumber] = useState("");

  // ── Address ────────────────────────────────────────────────────────
  const [address, setAddress] = useState("");

  // ── Passwords ─────────────────────────────────────────────────────
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // ── Loading ────────────────────────────────────────────────────────
  const [loading, setLoading] = useState(false);

  // ── Load countries on mount ───────────────────────────────────────
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/utils/countries");
        if (!res.ok) throw new Error();
        const data: CountryData[] = await res.json();
        setCountryList(data);

        // default to Nigeria if available
        const ng =
          data.find((c) => c.name.toLowerCase() === "nigeria") ?? data[0] ?? null;
        setCountry(ng || null);

        // set default dial (normalize in case API includes '+')
        if (ng?.callingCodes?.length) {
          setPhoneCode(normalizeDial(ng.callingCodes[0]));
        }
      } catch {
        toast.error("Could not load country list.");
      }
    }
    load();
  }, []);

  // ── When country changes: fetch states + reset phoneCode & state ───
  useEffect(() => {
    if (!country) {
      setStateList([]);
      setStateVal("");
      return;
    }

    // clear any previously selected state
    setStateVal("");

    (async () => {
      try {
        const res = await fetch("/api/utils/states", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            countryIso2: country.iso2, // use ISO2 for precise mapping
            country: country.name,     // optional, for logging/fallback
          }),
        });
        if (!res.ok) throw new Error();
        const { states } = await res.json();
        setStateList(states);
      } catch {
        setStateList([]);
        toast.error("Could not load states.");
      }
    })();

    // reset phone code (normalize to avoid '++')
    if (country.callingCodes.length) {
      setPhoneCode(normalizeDial(country.callingCodes[0]));
    }
  }, [country]);

  // ── Build phone-code options ────────────────────────────────────────
  const phoneOptions = useMemo(
    () =>
      countryList
        .flatMap((c) =>
          c.callingCodes.map((code) => ({
            dial: normalizeDial(code),
            iso2: c.iso2,
          }))
        )
        // dedupe same dial
        .reduce<{ dial: string; iso2: string }[]>((acc, cur) => {
          if (!acc.find((o) => o.dial === cur.dial)) acc.push(cur);
          return acc;
        }, []),
    [countryList]
  );

  const countryLoading = countryList.length === 0;

  // ── Submit ─────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      toast.error("Passwords must match");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `${firstName} ${lastName}`.trim(),
          email,
          phone: `${phoneCode}${phoneNumber}`,
          country: country?.name ?? "",
          state: stateVal,
          address,
          password,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Registration failed");
      } else {
        toast.success("Registration successful! Check your email.");
        setTimeout(
          () =>
            router.push(
              `/auth/verify-email?email=${encodeURIComponent(email)}`
            ),
          1200
        );
      }
    } catch {
      toast.error("Server error. Try again later.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Toaster position="top-right" />
      <div className="w-full max-w-3xl mx-auto py-16 px-6">
        <Link
          href="/auth/login"
          className="inline-flex items-center text-gray-600 hover:text-gray-900 mb-6"
        >
          <FaArrowLeftLong className="mr-2" /> Back to Login
        </Link>

        <h1 className="text-2xl font-semibold mb-8">Register</h1>
        <form
          onSubmit={handleSubmit}
          className="grid grid-cols-1 md:grid-cols-2 gap-6"
        >
          {/* First + Last */}
          <FormField label="First Name" htmlFor="firstName">
            <Input
              id="firstName"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required
              disabled={loading}
            />
          </FormField>
          <FormField label="Last Name" htmlFor="lastName">
            <Input
              id="lastName"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              required
              disabled={loading}
            />
          </FormField>

          {/* Country */}
          <FormField label="Country" htmlFor="country">
            {countryLoading ? (
              <Skeleton className="h-10 w-full" />
            ) : (
              <Select
                value={country?.name ?? undefined}
                onValueChange={(val) =>
                  setCountry(countryList.find((c) => c.name === val) ?? null)
                }
                disabled={loading}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select country" />
                </SelectTrigger>
                <SelectContent>
                  {countryList.map((c) => (
                    <SelectItem key={c.iso2} value={c.name}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </FormField>

          {/* State */}
          <FormField label="State / Region" htmlFor="state">
            {countryLoading ? (
              <Skeleton className="h-10 w-full" />
            ) : (
              <Select
                value={stateVal || undefined}
                onValueChange={setStateVal}
                disabled={loading || stateList.length === 0}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select state" />
                </SelectTrigger>
                <SelectContent>
                  {stateList.map((st) => (
                    <SelectItem key={st} value={st}>
                      {st}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </FormField>

          {/* Email */}
          <FormField label="Email Address" htmlFor="email">
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
            />
          </FormField>

          {/* Phone */}
          <FormField label="Phone Number" htmlFor="phone">
            <div className="flex">
              <Select
                value={phoneCode}
                onValueChange={setPhoneCode}
                disabled={loading}
              >
                <SelectTrigger className="min-w-[6rem] w-auto mr-2">
                  <SelectValue>{phoneCode}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {phoneOptions.map(({ dial, iso2 }) => (
                    <SelectItem key={dial} value={dial}>
                      <span className="mr-1">{flagEmoji(iso2)}</span>
                      {dial}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                id="phone"
                type="tel"
                placeholder="8012345678"
                value={phoneNumber}
                onChange={(e) =>
                  setPhoneNumber(e.target.value.replace(/[^\d]/g, ""))
                }
                required
                disabled={loading}
              />
            </div>
          </FormField>

          {/* Address */}
          <FormField label="Delivery Address" htmlFor="address" span2>
            <Textarea
              id="address"
              rows={3}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              required
              disabled={loading}
            />
          </FormField>

          {/* Password */}
          <FormField label="Password" htmlFor="password">
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute inset-y-0 right-3 flex items-center text-gray-500 hover:text-gray-700"
              >
                {showPassword ? <FaEyeSlash /> : <FaEye />}
              </button>
            </div>
          </FormField>

          {/* Confirm */}
          <FormField label="Confirm Password" htmlFor="confirm">
            <div className="relative">
              <Input
                id="confirm"
                type={showConfirm ? "text" : "password"}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowConfirm((v) => !v)}
                aria-label={
                  showConfirm
                    ? "Hide confirm password"
                    : "Show confirm password"
                }
                className="absolute inset-y-0 right-3 flex items-center text-gray-500 hover:text-gray-700"
              >
                {showConfirm ? <FaEyeSlash /> : <FaEye />}
              </button>
            </div>
          </FormField>

          {/* Submit */}
          <div className="md:col-span-2">
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Registering…" : "Register"}
            </Button>
          </div>

          <p className="md:col-span-2 text-center text-sm">
            Already have an account?{" "}
            <Link href="/auth/login" className="font-semibold hover:underline">
              Login
            </Link>
          </p>
        </form>
      </div>
    </>
  );
}
