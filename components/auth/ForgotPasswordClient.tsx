"use client";

import React, { useState, FormEvent } from "react";
import Link from "next/link";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast, Toaster } from "react-hot-toast";
import { FaArrowLeftLong } from "react-icons/fa6";

export default function ForgotPasswordClient() {
  const [email, setEmail]       = useState("");
  const [loading, setLoading]   = useState(false);
  const [sent, setSent]         = useState(false);
  const [serverMsg, setServerMsg] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    const emailTrimmed = email.trim();

    try {
      const res  = await fetch("/api/auth/forgot-password", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ email: emailTrimmed }),
      });
      const data = await res.json();

      if (res.ok) {
        toast.success("Reset link sent.");
        setServerMsg(data.message || `Reset link sent to ${emailTrimmed}.`);
        setSent(true);
      } else if (res.status === 404) {
        toast.error(data.error || "No account found with that email.");
      } else {
        toast.error(data.error || "Something went wrong.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-md mx-auto py-16 px-6">
      <Toaster position="top-right" />

      {!sent && (
        <>
          <Link
            href="/auth/login"
            className="inline-flex items-center text-gray-600 hover:text-gray-900 mb-6 text-sm"
          >
            <FaArrowLeftLong className="mr-2" /> Back to Login
          </Link>

            <h1 className="text-2xl font-semibold mb-6">
              Forgot Password
            </h1>

            <p className="text-sm text-gray-600 mb-6">
              Enter the email you used to create your account and we’ll send you a secure link
              to reset your password.
            </p>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  disabled={loading}
                  className="mt-2 w-full"
                />
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={loading || !email}
              >
                {loading ? "Sending…" : "Send reset link"}
              </Button>

              <p className="text-center text-sm text-gray-500">
                Remembered your password?{" "}
                <Link
                  href="/auth/login"
                  className="font-medium text-primary hover:underline"
                >
                  Log in
                </Link>
              </p>
            </form>
        </>
      )}

      {sent && (
        <div className="animate-fade-in">
          <div className="mb-8">
            <Link
              href="/auth/login"
              className="inline-flex items-center text-gray-600 hover:text-gray-900 text-sm"
            >
              <FaArrowLeftLong className="mr-2" /> Back to Login
            </Link>
          </div>

          <div className="bg-white border rounded-xl p-8 shadow-sm text-center">
            <div className="mx-auto w-16 h-16 mb-6 rounded-full bg-primary/10 flex items-center justify-center">
              {/* Simple envelope icon (SVG) */}
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="w-8 h-8 text-primary"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.012 1.889l-7.5 4.875a2.25 2.25 0 01-2.476 0l-7.5-4.875A2.25 2.25 0 012.25 6.993V6.75"
                />
              </svg>
            </div>
            <h2 className="text-xl font-semibold mb-3">
              Check your email
            </h2>
            <p className="text-sm text-gray-600 leading-relaxed">
              {serverMsg || (
                <>
                  We’ve sent a password reset link to{" "}
                  <span className="font-semibold">{email}</span>. Open it and follow
                  the instructions to choose a new password.
                </>
              )}
            </p>
            <div className="mt-6 space-y-3">
              <p className="text-xs text-gray-500">
                Didn’t get anything? Check your spam folder or try again.
              </p>
              <Button
                type="button"
                variant="outline"
                disabled={loading}
                onClick={() => {
                  // allow immediate re-send if you want; you could add a cooldown timer here
                  setSent(false);
                  setServerMsg(null);
                }}
              >
                Send another link
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
