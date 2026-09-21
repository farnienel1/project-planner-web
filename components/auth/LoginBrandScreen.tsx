/**
 * Sign-in screen. Visuals match the v2 prototype split layout.
 * Auth handlers are unchanged.
 */

'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline'
import { useAuthStore } from '@/lib/stores/authStore'
import { AppLogoMark } from '@/components/ui/AppLogoMark'
import { formatLoginError } from '@/lib/auth/formatLoginError'
import { consumeWebIdleExpiredFlag } from '@/lib/auth/webIdleSession'

export function LoginBrandScreen() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const justConfirmed = searchParams.get('confirmed') === '1'
  const { signIn, error } = useAuthStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [localError, setLocalError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [idleNotice] = useState(() => consumeWebIdleExpiredFlag())

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
      await signIn(trimmedEmail, password)
      router.push('/dashboard')
    } catch (err) {
      setLocalError(formatLoginError(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="login">
      <div className="hero art" style={{ borderRadius: 0 }}>
        <div className="relative z-[1] flex items-center gap-3">
          <div className="overflow-hidden rounded-xl" style={{ background: 'rgba(255,255,255,.15)' }}>
            <AppLogoMark size={40} radius={12} />
          </div>
          <b className="font-[family-name:var(--head)] text-lg">Project Planner</b>
        </div>
        <div className="relative z-[1]">
          <div className="big" style={{ fontSize: 44, maxWidth: 520 }}>
            Every job, every operative, every hour.
          </div>
          <p style={{ opacity: 0.85, fontSize: 17, maxWidth: 460, marginTop: 12 }}>
            Scheduling, timesheets, materials and H&amp;S for MEP contractors.
          </p>
        </div>
        <div className="relative z-[1] xs" style={{ opacity: 0.7 }}>
          © Projectplanner Systems Ltd
        </div>
      </div>

      <div className="form-side">
        <div style={{ width: 'min(420px, 100%)' }}>
          <h1 className="text-[28px] font-extrabold">Sign in</h1>
          <p className="muted mt-1.5">Welcome back</p>

          {justConfirmed ? (
            <p className="banner mt-4" data-hue="green">
              Account confirmed. Sign in with the email and password you set during setup.
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
        </div>
      </div>
    </div>
  )
}
