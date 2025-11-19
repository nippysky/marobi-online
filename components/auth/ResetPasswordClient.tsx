// components/auth/ResetPasswordClient.tsx
"use client";

import React, { useState, FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FaArrowLeftLong, FaEye, FaEyeSlash } from "react-icons/fa6";
import { toast, Toaster } from "react-hot-toast";

export default function ResetPasswordClient() {
  const router  = useRouter();
  const params  = useSearchParams();
  const email   = (params.get("email") || "").trim().toLowerCase();
  const token   = params.get("token") || "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm]   = useState("");
  const [showPwd, setShowPwd]   = useState(false);
  const [showConf, setShowConf] = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");

  const missing = !email || !token;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");

    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    setLoading(true);
    try {
      const res  = await fetch("/api/auth/reset-password", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ email, token, password }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || "Reset failed");
      }

      toast.success("Password reset! Redirecting to login…");
      setTimeout(() => router.push("/auth/login"), 1400);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (missing) {
    return (
      <div className="w-full max-w-md mx-auto py-20 px-6">
        <Toaster position="top-right" />
        <div className="text-center bg-white border rounded-xl p-10 shadow-sm">
          <div className="mx-auto w-16 h-16 mb-6 rounded-full bg-red-100 flex items-center justify-center">
            <span className="text-red-600 text-2xl font-bold">!</span>
          </div>
          <h1 className="text-xl font-semibold mb-3">
            Invalid or expired link
          </h1>
          <p className="text-sm text-gray-600 mb-6">
            The password reset link is missing or no longer valid. Please
            request a new one.
          </p>
          <Button asChild>
            <Link href="/auth/forgot-password">Request new link</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md mx-auto py-16 px-6">
      <Toaster position="top-right" />

      <Link
        href="/auth/login"
        className="inline-flex items-center text-gray-600 hover:text-gray-900 mb-8 text-sm"
      >
        <FaArrowLeftLong className="mr-2" /> Back to Login
      </Link>

      <h1 className="text-2xl font-semibold mb-2">Set a new password</h1>
      <p className="text-sm text-gray-600 mb-8">
        You’re resetting the password for <strong>{email}</strong>
      </p>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && <p className="text-sm text-red-600">{error}</p>}

        <div>
          <Label htmlFor="password">New Password</Label>
          <div className="relative mt-2">
            <Input
              id="password"
              type={showPwd ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
              placeholder="••••••••"
              autoComplete="new-password"
            />
            <button
              type="button"
              onClick={() => setShowPwd((v) => !v)}
              className="absolute inset-y-0 right-3 flex items-center text-gray-500 hover:text-gray-700"
              aria-label={showPwd ? "Hide password" : "Show password"}
            >
              {showPwd ? <FaEyeSlash /> : <FaEye />}
            </button>
          </div>
        </div>

        <div>
          <Label htmlFor="confirm">Confirm Password</Label>
          <div className="relative mt-2">
            <Input
              id="confirm"
              type={showConf ? "text" : "password"}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              disabled={loading}
              placeholder="••••••••"
              autoComplete="new-password"
            />
            <button
              type="button"
              onClick={() => setShowConf((v) => !v)}
              className="absolute inset-y-0 right-3 flex items-center text-gray-500 hover:text-gray-700"
              aria-label={showConf ? "Hide confirm password" : "Show confirm password"}
            >
              {showConf ? <FaEyeSlash /> : <FaEye />}
            </button>
          </div>
        </div>

        <Button
          type="submit"
          className="w-full"
          disabled={loading || !password || !confirm}
        >
          {loading ? "Updating…" : "Reset Password"}
        </Button>
      </form>
    </div>
  );
}
