'use client'

import { FormEvent, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuthStore } from '@/lib/stores/authStore'
import { AppLogoMark } from '@/components/ui/AppLogoMark'
import { maskEmail } from '@/lib/auth/maskEmail'
import { extractMfaCode } from '@/lib/auth/mfa/mfaCode'
import {
  clearMfaGate,
  isMfaGateOpen,
  readMfaGate,
  readMfaStatus,
  resendEmailMfa,
  safePostMfaPath,
  startEmailMfa,
  verifyEmailMfa,
} from '@/lib/auth/mfa/mfaClient'

export function MfaVerifyScreen() {
  const router = useRouter()
  const search = useSearchParams()
  const { user, firebaseUser, signOut, loading, mfaPending, mfaNext, markMfaVerified } = useAuthStore()
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('Sending a verification code to your email…')
  const [submitting, setSubmitting] = useState(false)
  const [resending, setResending] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const startedFor = useRef('')
  const submittingRef = useRef(false)
  const email = firebaseUser?.email || user?.email || ''
  const uid = firebaseUser?.uid || user?.id || ''
  const requestedNext = search.get('next') || mfaNext
  const fallback = safePostMfaPath(
    requestedNext,
    (requestedNext || '').startsWith('/developer') ? '/developer' : '/dashboard'
  )
  const loginHref = fallback === '/developer' ? '/developer-login' : '/login'

  useEffect(() => {
    if (loading || mfaPending || isMfaGateOpen(uid) || readMfaGate()) return
    if (firebaseUser || user) return
    router.replace(loginHref)
  }, [firebaseUser, loading, loginHref, mfaPending, router, uid, user])

  function goToApp(nextPath?: string) {
    clearMfaGate()
    markMfaVerified()
    window.location.assign(safePostMfaPath(nextPath || requestedNext, fallback))
  }

  useEffect(() => {
    const readyUid = firebaseUser?.uid
    if (!readyUid) return
    if (startedFor.current === readyUid) return
    startedFor.current = readyUid
    let cancelled = false
    void (async () => {
      try {
        const status = await readMfaStatus()
        if (cancelled) return
        if (status.verified) {
          goToApp(status.next || fallback)
          return
        }
        if (status.pending) {
          setNotice('Enter the 6-digit code from your email.')
          return
        }
        const result = await startEmailMfa(fallback)
        if (cancelled) return
        if (result.skipped) {
          goToApp(fallback)
          return
        }
        setNotice('An email with your verification code has been sent.')
        if (result.retryAfterSec) setCooldown(result.retryAfterSec)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not send a verification code.')
      }
    })()
    return () => {
      cancelled = true
    }
    // goToApp reads latest next from search params; mount once per uid
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fallback, firebaseUser?.uid])

  useEffect(() => {
    if (cooldown <= 0) return
    const timer = window.setTimeout(() => setCooldown((value) => Math.max(0, value - 1)), 1000)
    return () => window.clearTimeout(timer)
  }, [cooldown])

  const submit = async (event?: FormEvent, raw?: string) => {
    event?.preventDefault()
    const digits = extractMfaCode(raw ?? code)
    if (digits.length !== 6 || submittingRef.current) return
    submittingRef.current = true
    setCode(digits)
    setError('')
    setSubmitting(true)
    try {
      const result = await verifyEmailMfa(digits)
      goToApp(result.next || fallback)
    } catch (err) {
      submittingRef.current = false
      setSubmitting(false)
      setError(err instanceof Error ? err.message : 'That code was not accepted.')
    }
  }

  const applyCode = (raw: string) => {
    const digits = extractMfaCode(raw)
    setCode(digits)
    if (digits.length === 6) {
      void submit(undefined, digits)
    }
  }

  const resend = async () => {
    setError('')
    try {
      setResending(true)
      const result = await resendEmailMfa()
      setNotice('A new verification code has been emailed to you.')
      setCooldown(result.retryAfterSec && result.retryAfterSec > 0 ? result.retryAfterSec : 8)
    } catch (err) {
      const retry = err && typeof err === 'object' && 'retryAfterSec' in err ? Number((err as { retryAfterSec?: number }).retryAfterSec) : 0
      if (retry > 0) {
        setCooldown(retry)
        setNotice(`Please wait ${retry} seconds before requesting another code.`)
      } else {
        setError(err instanceof Error ? err.message : 'Could not resend the code yet.')
      }
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
            Enter the 6-digit code before opening the app. This page is required on every sign-in.
          </p>
        </div>
      </div>
      <div className="form-side">
        <div style={{ width: 'min(420px, 100%)' }}>
          <h1 className="text-[28px] font-extrabold">Enter verification code</h1>
          <p className="muted mt-1.5">
            {notice} {email ? `Sent to ${maskEmail(email)}.` : 'Stay on this page while the code is sent.'}
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
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                className="pp-in tracking-[0.4em] text-center text-lg font-extrabold"
                value={code}
                onChange={(event) => applyCode(event.target.value)}
                onPaste={(event) => {
                  const pasted = event.clipboardData.getData('text')
                  if (!pasted) return
                  event.preventDefault()
                  applyCode(pasted)
                }}
              />
            </label>
            <button type="submit" className="btn primary block" style={{ height: 52 }} disabled={submitting || extractMfaCode(code).length !== 6}>
              {submitting ? 'Checking…' : 'Verify and continue'}
            </button>
          </form>
          <p className="muted small mt-[18px] text-center">
            <button type="button" className="link" onClick={() => void resend()} disabled={resending || cooldown > 0 || !uid}>
              {resending ? 'Sending…' : cooldown > 0 ? `Resend available in ${cooldown}s` : 'Click here to resend'}
            </button>
          </p>
          <p className="muted small mt-3 text-center">
            <button
              type="button"
              className="link"
              onClick={() => {
                clearMfaGate()
                void signOut()
                router.replace(loginHref)
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
