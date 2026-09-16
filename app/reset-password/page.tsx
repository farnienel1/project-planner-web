'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useAuthStore } from '@/lib/stores/authStore'
import { MarketingFooter, MarketingHeader } from '@/components/marketing/MarketingChrome'

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
    <div className="min-h-screen bg-[#f6f8fb] text-[#0b1220]">
      <MarketingHeader active="login" />
      <main className="mx-auto w-full max-w-[560px] px-6 py-16">
        <div className="rounded-[28px] border border-slate-200 bg-white p-8 shadow-[0_2px_30px_rgba(15,23,42,0.08)]">
          {success ? (
            <div className="text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-3xl text-emerald-700">
                ✓
              </div>
              <h1 className="mt-6 text-2xl font-bold text-emerald-700">Check your email</h1>
              <p className="mt-3 text-sm text-slate-600">
                If an account exists for {trimmed}, you&apos;ll receive a password reset link shortly.
              </p>
              <Link
                href="/login"
                className="mt-8 inline-flex h-12 w-full items-center justify-center rounded-xl bg-[#185FA5] text-sm font-semibold text-white"
              >
                Back to sign in
              </Link>
            </div>
          ) : (
            <>
              <h1 className="text-3xl font-extrabold tracking-tight">Reset password</h1>
              <p className="mt-3 text-sm text-slate-600">
                Enter your email and we&apos;ll send a link from Firebase to reset your password. Check spam if you
                don&apos;t see it.
              </p>
              <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
                {(error || localError) && (
                  <p className="text-sm text-red-700">{error || localError}</p>
                )}
                <label className="block text-sm font-semibold text-slate-700">
                  Email address
                  <input
                    type="email"
                    autoComplete="email"
                    inputMode="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-[#185FA5] focus:ring-2 focus:ring-[#185FA5]/20"
                    placeholder="name@company.com"
                  />
                </label>
                <button
                  type="submit"
                  disabled={!canSend}
                  className="h-12 w-full rounded-xl bg-[#185FA5] text-sm font-semibold text-white disabled:opacity-40"
                >
                  {sending ? 'Sending…' : 'Send reset link'}
                </button>
                <div className="flex justify-between text-sm font-semibold text-[#185FA5]">
                  <Link href="/login">Back to sign in</Link>
                  <Link href="/">Website home</Link>
                </div>
              </form>
            </>
          )}
        </div>
      </main>
      <MarketingFooter />
    </div>
  )
}
