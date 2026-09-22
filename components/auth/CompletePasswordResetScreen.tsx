'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { confirmPasswordReset, verifyPasswordResetCode } from 'firebase/auth'
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline'
import { AppLogoMark } from '@/components/ui/AppLogoMark'
import { getFirebaseAuth } from '@/lib/firebase/ensureFirebase'
import {
  formatPasswordResetError,
  isPasswordResetAction,
  loginPathForResetEmail,
  minPasswordLengthForEmail,
  parseEmailActionSearch,
} from '@/lib/auth/emailAction'

export function CompletePasswordResetScreen() {
  const searchParams = useSearchParams()
  const action = useMemo(() => parseEmailActionSearch(searchParams), [searchParams])
  const [email, setEmail] = useState('')
  const [checking, setChecking] = useState(isPasswordResetAction(action))
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (!isPasswordResetAction(action)) {
      setChecking(false)
      setError('This reset link is missing its code. Request a new password reset from the sign-in page.')
      return
    }
    let cancelled = false
    setChecking(true)
    verifyPasswordResetCode(getFirebaseAuth(), action.oobCode)
      .then((resolvedEmail) => {
        if (!cancelled) {
          setEmail(resolvedEmail)
          setChecking(false)
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(formatPasswordResetError(err))
          setChecking(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [action])

  const loginHref = loginPathForResetEmail(email)
  const minLength = minPasswordLengthForEmail(email)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (password.length < minLength) {
      setError(`Use at least ${minLength} characters.`)
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    try {
      setSaving(true)
      await confirmPasswordReset(getFirebaseAuth(), action.oobCode, password)
      setDone(true)
    } catch (err) {
      setError(formatPasswordResetError(err))
    } finally {
      setSaving(false)
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
          {checking ? (
            <p className="muted">Checking this reset link…</p>
          ) : done ? (
            <>
              <div className="ico-chip lg" data-hue="green">
                ✓
              </div>
              <h1 className="mt-4 text-[28px] font-extrabold">Password updated</h1>
              <p className="muted mt-2">Sign in with your new password.</p>
              <Link href={loginHref} className="btn primary block mt-6">
                {loginHref === '/developer-login' ? 'Developer login' : 'Sign in'}
              </Link>
            </>
          ) : (
            <>
              <h1 className="text-[28px] font-extrabold">Choose a new password</h1>
              <p className="muted mt-1.5">
                {email ? `For ${email}.` : 'Enter a new password for this account.'}
              </p>
              {error ? (
                <p className="banner mt-4" data-hue="red">
                  {error}
                </p>
              ) : null}
              {email ? (
                <form className="form mt-6" style={{ gridTemplateColumns: '1fr' }} onSubmit={(e) => void submit(e)}>
                  <label className="f">
                    New password
                    <span className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        autoComplete="new-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
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
                  </label>
                  <label className="f">
                    Confirm password
                    <input
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      className="pp-in"
                    />
                  </label>
                  <button type="submit" disabled={saving || !password} className="btn primary block">
                    {saving ? 'Saving…' : 'Save password'}
                  </button>
                </form>
              ) : (
                <Link href="/reset-password" className="btn primary block mt-6">
                  Request a new reset link
                </Link>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
