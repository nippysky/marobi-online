"use client"

import React, { useState } from 'react'
import Link from 'next/link'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Mail, ArrowLeft } from 'lucide-react'
import { toast, Toaster } from 'react-hot-toast'

export default function AdminForgotPasswordClient() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch('/api/admin/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })

      if (res.status === 404) {
        toast.error('Email not found', { duration: 4000 })
      } else if (!res.ok) {
        const { error } = await res.json()
        toast.error(error || 'Something went wrong')
      } else {
        toast.success('Check your inbox for the reset link', { duration: 4000 })
        setSent(true)
      }
    } catch (err: any) {
      toast.error(err.message || 'Network error')
    } finally {
      setLoading(false)
    }
  }

  // — success screen —
  if (sent) {
    return (
      <div className="w-full max-w-lg mx-auto p-8 bg-white rounded-lg shadow text-center space-y-6">
        <Mail className="mx-auto h-12 w-12 text-blue-500" />
        <h2 className="text-2xl font-semibold">Email Sent</h2>
        <p className="text-gray-600">
          A password reset link has been sent to <strong>{email}</strong>.<br/>
          Please check your inbox to continue.
        </p>
        <Link href="/admin/login">
          <Button variant="secondary">Back to Login</Button>
        </Link>
      </div>
    )
  }

  // — form screen —
  return (
    <>
      <Toaster position="top-right" />
      <div className="w-full max-w-lg mx-auto p-8 bg-white rounded-lg shadow space-y-6">
        <Link
          href="/admin/login"
          className="inline-flex items-center text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="mr-2" /> Back to Login
        </Link>

        <h1 className="text-3xl font-bold">Forgot Password</h1>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="flex flex-col space-y-1">
            <Label htmlFor="admin-forgot-email">Official Email</Label>
            <Input
              id="admin-forgot-email"
              type="email"
              placeholder="you@company.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              disabled={loading}
            />
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Sending…' : 'Send Reset Link'}
          </Button>
        </form>
      </div>
    </>
  )
}
