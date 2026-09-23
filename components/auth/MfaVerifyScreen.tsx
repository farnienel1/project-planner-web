'use client'

import { FormEvent, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuthStore } from '@/lib/stores/authStore'
import { AppLogoMark } from '@/components/ui/AppLogoMark'
import { maskEmail } from '@/lib/auth/maskEmail'
import { clearMfaGate, isMfaGateOpen, readMfaGate, resendEmailMfa, verifyEmailMfa } from '@/lib/auth/mfa/mfaClient'
import { hasCustomerOrganisation, isPlatformOwnerEmail } from '@/lib/platform/owner'

export function MfaVerifyScreen() {
  const router = useRouter()
  const search = useSearchParams()
  const { user, firebaseUser, signOut } = useAuthStore()
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('An email with your verification code has been sent.')
  const [submitting, setSubmitting] = useState(false)
  const [resending, setResending] = useState(false)
  const email = firebaseUser?.email || user?.email || ''

  useEffect(() => {
    if (!isMfaGateOpen(firebaseUser?.uid || user?.id) && firebaseUser) {
      const next = search.get('next') || readMfaGate()?.next || ''
      if (isPlatformOwnerEmail(email) && !hasCustomerOrganisation(user?.organizationId)) {
        router.replace(next.startsWith('/developer') ? next : '/developer')
      } else {
        router.replace(next.startsWith('/dashboard') ? next : '/dashboard')
      }
    }
  }, [email, firebaseUser, router, search, user?.id, user?.organizationId])

  const finish = (nextPath?: string) => {
    clearMfaGate()
    const next = nextPath || search.get('next') || readMfaGate()?.next || ''
    if (isPlatformOwnerEmail(email) && !hasCustomerOrganisation(user?.organizationId)) {
      router.replace(next.startsWith('/developer') ? next : '/developer')
      return
    }
    router.replace(next.startsWith('/dashboard') ? next : '/dashboard')
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    try {
      setSubmitting(true)
      await verifyEmailMfa(code)
      finish()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That code was not accepted.')
    } finally {
      setSubmitting(false)
    }
  }

  const resend = async () => {
    setError('')
    try {
      setResending(true)
      await resendEmailMfa()
      setNotice('A new verification code has been emailed to you.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not resend the code yet.')
    } finally {
      setResending(false)
    }
  }

  return (
    <div className="login">
      <div className="hero art" style={{ borderRadius: 0 }}>
        <Link href="/" className="relative z-[1] flex items-center gap-3.5 text-white no-underline" aria-label="Project Planner home">
          <div className="overflow-hidden rounded-[14px]" style={{ background: 'rgba(255,255,255,.15)' }}>
            <AppLogoMark size={52} radius={14} />
          </div>
          <b className="font-[family-name:var(--head)] text-[22px] font-extrabold tracking-tight">Project Planner</b>
        </Link>
        <div className="relative z-[1]">
          <div className="big" style={{ fontSize: 44, maxWidth: 520 }}>
            Check your email
          </div>
          <p style={{ opacity: 0.85, fontSize: 17, maxWidth: 460, marginTop: 12 }}>
            Two-step verification keeps your account safe after you have set your password from an invitation.
          </p>
        </div>
      </div>
      <div className="form-side">
        <div style={{ width: 'min(420px, 100%)' }}>
          <h1 className="text-[28px] font-extrabold">Enter verification code</h1>
          <p className="muted mt-1.5">
            {notice} {email ? `Sent to ${maskEmail(email)}.` : ''}
          </p>
          {error ? (
            <p className="banner mt-4" data-hue="red">
              {error}
            </p>
          ) : null}
          <form onSubmit={(event) => void submit(event)} className="form mt-6" style={{ gridTemplateColumns: '1fr' }}>
            <label className="f">
              6-digit code
              <input
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]*"
                maxLength={6}
                className="pp-in tracking-[0.4em] text-center text-lg font-extrabold"
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
              />
            </label>
            <button type="submit" className="btn primary block" style={{ height: 52 }} disabled={submitting || code.length !== 6}>
              {submitting ? 'Checking…' : 'Verify and continue'}
            </button>
          </form>
          <p className="muted small mt-[18px] text-center">
            <button type="button" className="link" onClick={() => void resend()} disabled={resending}>
              {resending ? 'Sending…' : 'Click here to resend'}
            </button>
          </p>
          <p className="muted small mt-3 text-center">
            <button
              type="button"
              className="link"
              onClick={() => {
                clearMfaGate()
                void signOut()
                router.replace('/login')
              }}
            >
              Use a different account
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}
