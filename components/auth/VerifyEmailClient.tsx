"use client"

import React, { useEffect, useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Toaster, toast } from "react-hot-toast"

type Status = "pending" | "verifying" | "error"

export default function VerifyEmailClient() {
  const params = useSearchParams()
  const router = useRouter()

  const email     = params.get("email") || ""
  const linkToken = params.get("token") || ""

  const [status, setStatus]         = useState<Status>(linkToken ? "verifying" : "pending")
  const [manualToken, setManualToken] = useState<string>("")
  const [resending, setResending]   = useState<boolean>(false)
  const [timer, setTimer]           = useState<number>(60)

  // 1) If they clicked the link, auto-run verification
  useEffect(() => {
    if (linkToken) verifyToken(linkToken)
  }, [linkToken])

  // 2) Countdown to enabling resend
  useEffect(() => {
    if (timer <= 0) return
    const id = setInterval(() => setTimer((t) => t - 1), 1000)
    return () => clearInterval(id)
  }, [timer])

  // call verify-email API
  async function verifyToken(token: string) {
    setStatus("verifying")
    try {
      const res  = await fetch(`/api/auth/verify-email?token=${token}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Verification failed")
      toast.success("Email verified! Redirecting to login…")
      setTimeout(() => router.push("/auth/login"), 1500)
    } catch (err: any) {
      toast.error(err.message)
      setStatus("error")
    }
  }

  // manual code submit
  function handleManualVerify() {
    if (manualToken.trim()) {
      verifyToken(manualToken.trim())
    }
  }

  // resend email
  async function handleResend() {
    if (timer > 0) return
    if (!email) {
      toast.error("Missing email address.")
      return
    }
    setResending(true)
    try {
      const res  = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })
      const data = await res.json()
      if (res.ok && data.message === "Email already verified") {
        toast.success("Email already verified! Redirecting…")
        return setTimeout(() => router.push("/auth/login"), 1500)
      }
      if (!res.ok) throw new Error(data.error || "Failed to resend")
      toast.success(data.message)
      setStatus("pending")
      setTimer(60)
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setResending(false)
    }
  }

  return (
    <>
      <Toaster position="top-right" />

      <div className="max-w-md mx-auto py-16 px-6 text-center space-y-6">
        {status === "pending" && (
          <>
            <p className="text-lg">Thanks for registering!</p>
            <p>
              We’ve sent a verification link to <strong>{email}</strong>. Check
              your inbox (and spam).
            </p>

            {/* manual entry */}
            <div className="space-y-4">
              <p>Or enter your code here:</p>
              <Input
                type="text"
                placeholder="Verification code"
                value={manualToken}
                onChange={(e) => setManualToken(e.target.value)}
                disabled={status !== "pending"}
              />
              <Button
                onClick={handleManualVerify}
                disabled={!manualToken}
                className="w-full"
              >
                Verify code
              </Button>
            </div>

            {/* resend */}
            <Button
            variant={"link"}
              onClick={handleResend}
              disabled={timer > 0 || resending}
              className="w-full"
            >
              {resending
                ? "Resending…"
                : timer > 0
                ? `Resend in ${timer}s`
                : "Resend verification email"}
            </Button>
          </>
        )}

        {status === "verifying" && (
          <p className="text-lg">Verifying your email…</p>
        )}

        {status === "error" && (
          <>
            <p className="text-lg text-red-600">
              That link or code is invalid or expired.
            </p>

            <div className="space-y-4">
              <Input
                type="text"
                placeholder="Verification code"
                value={manualToken}
                onChange={(e) => setManualToken(e.target.value)}
                disabled={status !== "error"}
              />
              <Button
                onClick={handleManualVerify}
                disabled={!manualToken}
                className="w-full"
              >
                Verify code
              </Button>
            </div>

            <Button
            variant={"link"}
              onClick={handleResend}
              disabled={timer > 0 || resending}
              className="w-full"
            >
              {resending
                ? "Resending…"
                : timer > 0
                ? `Resend in ${timer}s`
                : "Resend verification email"}
            </Button>
          </>
        )}
      </div>
    </>
  )
}
