/**
 * Sign-in screen. Visuals match the v2 prototype split layout.
 * Auth handlers are unchanged.
 */

'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline'
import { useAuthStore } from '@/lib/stores/authStore'
import { AppLogoMark } from '@/components/ui/AppLogoMark'
import { formatLoginError } from '@/lib/auth/formatLoginError'
import { consumeWebIdleExpiredFlag } from '@/lib/auth/webIdleSession'
import { hasCustomerOrganisation, isPlatformOwnerEmail } from '@/lib/platform/owner'
import { LoadingSpinner } from '@/components/dashboard/PageShell'
import { isMfaGateOpen, isMfaRequiredError, mfaVerifyHref, safePostMfaPath } from '@/lib/auth/mfa/mfaClient'

export function LoginBrandScreen() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const justConfirmed = searchParams.get('confirmed') === '1'
  const nextPath = safePostMfaPath(searchParams.get('next'), '/dashboard')
  const { signIn, error, user, firebaseUser, mfaPending, mfaVerified, mfaStatusKnown, loading } = useAuthStore()
  const [email, setEmail] = useState(() => searchParams.get('email') || '')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [localError, setLocalError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [idleNotice] = useState(() => consumeWebIdleExpiredFlag())

  useEffect(() => {
    const uid = user?.id || firebaseUser?.uid
    if ((mfaPending && uid) || (uid && isMfaGateOpen(uid))) {
      router.replace(mfaVerifyHref(nextPath))
      return
    }
    if (loading || !user) return
    if (!mfaStatusKnown) return
    if (!mfaVerified) {
      router.replace(mfaVerifyHref(nextPath))
      return
    }
    if (isPlatformOwnerEmail(user.email) && !hasCustomerOrganisation(user.organizationId)) {
      router.replace('/developer')
      return
    }
    router.replace(nextPath)
  }, [firebaseUser?.uid, loading, mfaPending, mfaStatusKnown, mfaVerified, nextPath, router, user])

  const uid = user?.id || firebaseUser?.uid
  if (mfaPending || (uid && isMfaGateOpen(uid)) || (user && mfaStatusKnown && !mfaVerified)) {
    return <LoadingSpinner label="Opening verification…" />
  }

  const trimmedEmail = email.trim()
  const isFormValid = trimmedEmail.length > 0 && password.length > 0
  const displayError = localError || error

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLocalError('')
    if (!trimmedEmail) {
      setLocalError('Please enter your email address.')
      return
    }
    if (!password.trim()) {
      setLocalError('Please enter your password.')
      return
    }
    try {
      setSubmitting(true)
      await signIn(trimmedEmail, password, { next: nextPath })
    } catch (err) {
      if (isMfaRequiredError(err)) {
        router.replace(mfaVerifyHref(nextPath))
        return
      }
      setLocalError(formatLoginError(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="login">
      <div className="hero art" style={{ borderRadius: 0 }}>
        <Link
          href="/"
          className="relative z-[1] flex items-center gap-3.5 text-white no-underline"
          aria-label="Project Planner home"
        >
          <div className="overflow-hidden rounded-[14px]" style={{ background: 'rgba(255,255,255,.15)' }}>
            <AppLogoMark size={52} radius={14} />
          </div>
          <b className="font-[family-name:var(--head)] text-[22px] font-extrabold tracking-tight">Project Planner</b>
        </Link>
        <div className="relative z-[1]">
          <div className="big" style={{ fontSize: 44, maxWidth: 520 }}>
            Every job, every operative, every hour.
          </div>
          <p style={{ opacity: 0.85, fontSize: 17, maxWidth: 460, marginTop: 12 }}>
            Scheduling, timesheets, materials and H&amp;S for contractors.
          </p>
        </div>
        <div className="relative z-[1] xs" style={{ opacity: 0.7 }}>
          © Projectplanner Systems Ltd
        </div>
      </div>

      <div className="form-side">
        <div style={{ width: 'min(420px, 100%)' }}>
          <Link
            href="/"
            className="login-form-home mb-7 flex items-center gap-3 text-[var(--ink)] no-underline"
            aria-label="Project Planner home"
          >
            <div className="overflow-hidden rounded-[14px] shadow-[var(--sh)]">
              <AppLogoMark size={48} radius={14} />
            </div>
            <b className="font-[family-name:var(--head)] text-[22px] font-extrabold tracking-tight">Project Planner</b>
          </Link>
          <h1 className="text-[28px] font-extrabold">Sign in</h1>
          <p className="muted mt-1.5">Welcome back</p>

          {justConfirmed ? (
            <p className="banner mt-4" data-hue="green">
              Account confirmed. Sign in with the email and password you set during setup.
            </p>
          ) : null}
          {nextPath === '/dashboard/change-organisation' ? (
            <p className="banner mt-4" data-hue="blue">
              Sign in, then use Switch organisation to set up and pay for another firm. You stay in whichever
              organisation you last switched to.
            </p>
          ) : null}
          {idleNotice ? (
            <p className="banner mt-4" data-hue="warn">
              Signed out after 30 minutes idle. Sign in to continue.
            </p>
          ) : null}
          {displayError ? (
            <p className="banner mt-4" data-hue="red">
              {displayError}
            </p>
          ) : null}

          <form onSubmit={handleSubmit} className="form mt-6" style={{ gridTemplateColumns: '1fr' }}>
            <label className="f">
              Email
              <input
                type="email"
                autoComplete="username"
                inputMode="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value)
                  setLocalError('')
                }}
                className="pp-in"
              />
            </label>
            <label className="f">
              Password
              <span className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value)
                    setLocalError('')
                  }}
                  className="pp-in pr-12"
                />
                <button
                  type="button"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--ink3)]"
                >
                  {showPassword ? <EyeIcon className="h-5 w-5" /> : <EyeSlashIcon className="h-5 w-5" />}
                </button>
              </span>
              <Link href="/reset-password" className="link small self-end">
                Forgot password?
              </Link>
            </label>
            <button
              type="submit"
              disabled={submitting || !isFormValid}
              className="btn primary block"
              style={{ height: 52, marginTop: 4 }}
            >
              {submitting ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <p className="muted small mt-[18px] text-center">
            New company?{' '}
            <Link href="/setup" className="link">
              Set up an organisation
            </Link>
          </p>
          <Link href="/developer-login" className="btn sm ghost mt-4 block text-center" style={{ height: 44 }}>
            Developer login
          </Link>
          <p className="muted small mt-2 text-center">App owner only — not an organisation dashboard.</p>
        </div>
      </div>
    </div>
  )
}
