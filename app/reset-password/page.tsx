'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useAuthStore } from '@/lib/stores/authStore'

const EMAIL_RE = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,64}$/i

export default function ResetPasswordPage() {
  const { resetPassword, error } = useAuthStore()
  const [email, setEmail] = useState('')
  const [localError, setLocalError] = useState('')
  const [success, setSuccess] = useState(false)
  const [sending, setSending] = useState(false)

  const trimmed = email.trim()
  const canSend = EMAIL_RE.test(trimmed) && !sending

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLocalError('')
    if (!EMAIL_RE.test(trimmed)) {
      setLocalError('Please enter a valid email address.')
      return
    }
    try {
      setSending(true)
      await resetPassword(trimmed)
      setSuccess(true)
    } catch {
      setLocalError('Failed to send reset email')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="min-h-screen bg-ios-canvas px-5 py-10 font-ios text-ios-ink">
      <div className="mx-auto w-full max-w-md rounded-[20px] border border-ios-border bg-ios-card px-6 py-10 shadow-ios-toast">
        {success ? (
          <div className="text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-ios-chip-green text-3xl text-ios-icon-green">
              ✓
            </div>
            <h1 className="mt-6 text-[22px] font-bold text-ios-icon-green">Check your email</h1>
            <p className="mt-3 text-sm text-ios-muted">
              If an account exists for {trimmed}, you&apos;ll receive a password reset link shortly.
            </p>
            <Link href="/login" className="mt-8 inline-flex h-12 w-full items-center justify-center rounded-2xl bg-[#185FA5] text-sm font-semibold text-white">
              Done
            </Link>
          </div>
        ) : (
          <>
            <h1 className="text-center text-[28px] font-bold tracking-tight">Reset Password</h1>
            <p className="mt-3 text-center text-sm text-ios-muted">
              Enter your email and we&apos;ll send a link from Firebase to reset your password. Check spam if you
              don&apos;t see it.
            </p>
            <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
              {(error || localError) && (
                <p className="text-center text-sm text-ios-icon-red">{error || localError}</p>
              )}
              <label className="block text-sm font-medium">
                Email Address
                <input
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-ios-border px-3 py-2.5 outline-none focus:border-[#185FA5] focus:ring-2 focus:ring-[#185FA5]/20"
                  placeholder="Email Address"
                />
              </label>
              <button
                type="submit"
                disabled={!canSend}
                className="h-12 w-full rounded-2xl bg-[#185FA5] text-sm font-semibold text-white disabled:opacity-40"
              >
                {sending ? 'Sending…' : 'Send Reset Link'}
              </button>
              <div className="text-center">
                <Link href="/login" className="text-sm font-semibold text-[#185FA5]">
                  Cancel
                </Link>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
