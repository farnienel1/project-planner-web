'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useAuthStore } from '@/lib/stores/authStore'
import { AppLogoMark } from '@/components/ui/AppLogoMark'

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
    <div className="login" style={{ gridTemplateColumns: '1fr' }}>
      <div className="form-side">
        <div style={{ width: 'min(420px, 100%)' }}>
          <div className="mb-6 flex items-center gap-3">
            <AppLogoMark size={40} radius={12} />
            <b className="font-[family-name:var(--head)] text-lg">Project Planner</b>
          </div>
          {success ? (
            <>
              <div className="ico-chip lg" data-hue="green">
                ✓
              </div>
              <h1 className="mt-4 text-[28px] font-extrabold">Check your email</h1>
              <p className="muted mt-2">
                If an account exists for {trimmed}, you&apos;ll receive a password reset link shortly.
              </p>
              <Link href="/login" className="btn primary block mt-6">
                Done
              </Link>
            </>
          ) : (
            <>
              <h1 className="text-[28px] font-extrabold">Reset password</h1>
              <p className="muted mt-1.5">
                Enter your email and we&apos;ll send a link from Firebase to reset your password. Check spam if you
                don&apos;t see it.
              </p>
              {(error || localError) ? (
                <p className="banner mt-4" data-hue="red">
                  {error || localError}
                </p>
              ) : null}
              <form className="form mt-6" style={{ gridTemplateColumns: '1fr' }} onSubmit={handleSubmit}>
                <label className="f">
                  Email
                  <input
                    type="email"
                    autoComplete="email"
                    inputMode="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pp-in"
                    placeholder="your@email.com"
                  />
                </label>
                <button type="submit" disabled={!canSend} className="btn primary block">
                  {sending ? 'Sending…' : 'Send reset link'}
                </button>
              </form>
              <p className="muted small mt-[18px] text-center">
                <Link href="/login" className="link">
                  Back to sign in
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
