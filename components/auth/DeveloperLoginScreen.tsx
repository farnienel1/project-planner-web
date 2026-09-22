'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline'
import { useAuthStore } from '@/lib/stores/authStore'
import { AppLogoMark } from '@/components/ui/AppLogoMark'
import { formatLoginError } from '@/lib/auth/formatLoginError'
import { PLATFORM_OWNER_EMAIL, isPlatformOwnerEmail } from '@/lib/platform/owner'
import { LoadingSpinner } from '@/components/dashboard/PageShell'

const MIN_PASSWORD = 10

function codeOf(error: unknown): string {
  if (error && typeof error === 'object' && 'code' in error && typeof (error as { code: unknown }).code === 'string') {
    return (error as { code: string }).code
  }
  return ''
}

export function DeveloperLoginScreen() {
  const router = useRouter()
  const { signIn, signUpOwner, resetPassword, signOut, error, user, firebaseUser, loading } = useAuthStore()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [mode, setMode] = useState<'sign-in' | 'create' | 'reset'>('sign-in')
  const [localError, setLocalError] = useState('')
  const [notice, setNotice] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const signedInOwner = isPlatformOwnerEmail(firebaseUser?.email || user?.email)

  useEffect(() => {
    if (loading) return
    if (signedInOwner) router.replace('/developer')
  }, [loading, router, signedInOwner])

  if (signedInOwner || (loading && Boolean(firebaseUser || user))) {
    return <LoadingSpinner label="Opening the owner console…" />
  }

  const displayError = localError || error
  const canSubmit = password.length >= MIN_PASSWORD && !submitting

  const rejectIfNotOwner = async () => {
    const state = useAuthStore.getState()
    if (isPlatformOwnerEmail(state.firebaseUser?.email || state.user?.email)) return
    await signOut()
    throw new Error('This login is only for the Project Planner owner. Organisation accounts use the main Sign in page.')
  }

  const handleSignIn = async () => {
    await signIn(PLATFORM_OWNER_EMAIL, password)
    await rejectIfNotOwner()
    router.push('/developer')
  }

  const handleCreate = async () => {
    if (password !== confirm) {
      setLocalError('Passwords do not match.')
      return
    }
    try {
      await signUpOwner(password)
    } catch (err) {
      const code = codeOf(err)
      if (code === 'auth/email-already-in-use') {
        await handleSignIn()
        return
      }
      throw err
    }
    await rejectIfNotOwner()
    router.push('/developer/account?first=1')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLocalError('')
    setNotice('')
    if (password.length < MIN_PASSWORD) {
      setLocalError(`Use at least ${MIN_PASSWORD} characters.`)
      return
    }
    try {
      setSubmitting(true)
      if (mode === 'create') await handleCreate()
      else await handleSignIn()
    } catch (err) {
      const code = codeOf(err)
      if (code === 'auth/user-not-found' || code === 'auth/invalid-credential') {
        setLocalError('No owner login yet, or the password is wrong. Use Create owner password the first time, or Reset password if the account already exists.')
        return
      }
      setLocalError(formatLoginError(err))
    } finally {
      setSubmitting(false)
    }
  }

  const handleReset = async () => {
    setLocalError('')
    setNotice('')
    try {
      setSubmitting(true)
      await resetPassword(PLATFORM_OWNER_EMAIL)
      setNotice(`If the owner account exists, a reset link has been emailed to ${PLATFORM_OWNER_EMAIL}. Open it on this site to choose a new password. Check spam if it is not in the inbox.`)
      setMode('sign-in')
    } catch (err) {
      setLocalError(formatLoginError(err))
    } finally {
      setSubmitting(false)
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
            Owner console
          </div>
          <p style={{ opacity: 0.85, fontSize: 17, maxWidth: 460, marginTop: 12 }}>
            Private login for the app owner. This is not an organisation dashboard — it shows every tenant using Project Planner.
          </p>
        </div>
        <div className="relative z-[1] xs" style={{ opacity: 0.7 }}>
          © Projectplanner Systems Ltd
        </div>
      </div>

      <div className="form-side">
        <div style={{ width: 'min(420px, 100%)' }}>
          <h1 className="text-[28px] font-extrabold">Developer login</h1>
          <p className="muted mt-1.5">Signed in as the platform owner only.</p>

          {notice ? (
            <p className="banner mt-4" data-hue="green">
              {notice}
            </p>
          ) : null}
          {displayError ? (
            <p className="banner mt-4" data-hue="red">
              {displayError}
            </p>
          ) : null}

          <form onSubmit={mode === 'reset' ? (e) => { e.preventDefault(); void handleReset() } : handleSubmit} className="form mt-6" style={{ gridTemplateColumns: '1fr' }}>
            <label className="f">
              Email
              <input type="email" value={PLATFORM_OWNER_EMAIL} readOnly className="pp-in bg-[var(--soft)]" autoComplete="username" />
            </label>
            {mode !== 'reset' ? (
              <label className="f">
                Password
                <span className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    autoComplete={mode === 'create' ? 'new-password' : 'current-password'}
                    placeholder={mode === 'create' ? 'Choose a password' : 'Enter your password'}
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
              </label>
            ) : null}
            {mode === 'create' ? (
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
            ) : null}
            <button type="submit" disabled={mode === 'reset' ? submitting : !canSubmit} className="btn primary block" style={{ height: 52, marginTop: 4 }}>
              {submitting
                ? 'Please wait…'
                : mode === 'create'
                  ? 'Create owner password'
                  : mode === 'reset'
                    ? 'Email reset link'
                    : 'Sign in'}
            </button>
          </form>

          <div className="muted small mt-[18px] space-y-2 text-center">
            {mode !== 'create' ? (
              <p>
                First time?{' '}
                <button type="button" className="link" onClick={() => { setMode('create'); setLocalError('') }}>
                  Create the owner password
                </button>
              </p>
            ) : (
              <p>
                Already created?{' '}
                <button type="button" className="link" onClick={() => { setMode('sign-in'); setLocalError('') }}>
                  Sign in
                </button>
              </p>
            )}
            <p>
              <button type="button" className="link" onClick={() => { setMode('reset'); setLocalError('') }}>
                Reset password
              </button>
            </p>
            <p>
              Organisation user?{' '}
              <Link href="/login" className="link">
                Company sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
