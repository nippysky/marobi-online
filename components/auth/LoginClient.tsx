// components/LoginClient.tsx
"use client";
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Toaster, toast } from "react-hot-toast";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useAuthSession } from "@/lib/hooks/useAuthSession";

export default function LoginClient() {
  const router = useRouter();
  const { signInCustomer } = useAuthSession();

  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [showPw,   setShowPw]   = useState(false);
  const [loading,  setLoading]  = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    const toastId = toast.loading("Signing in…");

    const res = await signInCustomer(
      email.trim().toLowerCase(),
      password,
      "/account"
    );

    if (res?.error) {
      toast.error(res.error, { id: toastId });
      setLoading(false);
    } else {
      toast.success("Logged in!", { id: toastId });
      router.push(res?.url || "/");
    }
  };

  return (
    <>
      <Toaster position="top-right" />

      <div className="w-full sm:w-3/4 lg:w-1/2 mx-auto py-16 space-y-6">
        {/* Back to home */}
        <div className="flex justify-start">
          <Link href="/" className="text-gray-600 hover:text-gray-900">
            ← Back to Home
          </Link>
        </div>

        <h2 className="text-2xl font-semibold text-center">Customer Login</h2>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              className="mt-1 w-full"
            />
          </div>

          <div>
            <Label htmlFor="password">Password</Label>
            <div className="relative mt-1">
              <Input
                id="password"
                type={showPw ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                className="pr-10 w-full"
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                className="absolute inset-y-0 right-2 flex items-center text-gray-500"
                aria-label={showPw ? "Hide password" : "Show password"}
              >
                {showPw ? "🙈" : "👁️"}
              </button>
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Signing in…" : "Login"}
          </Button>
        </form>

        <p className="text-center text-sm">
          <Link
            href="/auth/forgot-password"
            className="underline text-gray-600 hover:text-gray-800"
          >
            Forgot password?
          </Link>
        </p>

             <p className="md:col-span-2 text-center text-sm">
            Already have an account?{" "}
            <Link href="/auth/register" className="font-semibold hover:underline">
              Register
            </Link>
          </p>
      </div>
    </>
  );
}
