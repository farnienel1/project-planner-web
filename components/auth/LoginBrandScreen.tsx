/**
 * iOS parity source: AuthenticationView.swift LoginBrand
 * Spec: docs/ios-parity/03-design-system.md §2 Login tokens
 */

'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline'
import { useAuthStore } from '@/lib/stores/authStore'
import { AppLogoMark } from '@/components/ui/AppLogoMark'
import { ACCOUNT_UNCONFIRMED_MESSAGE } from '@/lib/orgSetup/accountConfirmation'

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
      const message = err instanceof Error ? err.message : ''
      setLocalError(
        message === ACCOUNT_UNCONFIRMED_MESSAGE
          ? ACCOUNT_UNCONFIRMED_MESSAGE
          : 'Sign in failed. Please check your email/password and try again.'
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#060E1A] text-white">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#060E1A] via-[#0B1828] to-[#071422]" />
      <div className="pointer-events-none absolute left-1/2 top-[-110px] h-[300px] w-[300px] -translate-x-1/2 rounded-full bg-[#22E5FF]/[0.12] blur-[60px]" />
      <div className="pointer-events-none absolute bottom-10 right-[-40px] h-[220px] w-[220px] rounded-full bg-[#1A6BF5]/[0.15] blur-[50px]" />
      <div
        className="pointer-events-none absolute inset-0 opacity-50"
        style={{
          backgroundImage:
            'linear-gradient(rgba(0,180,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(0,180,255,0.04) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      <div className="relative mx-auto flex min-h-screen max-w-md flex-col px-7 pb-10 pt-14">
        <div className="mb-11 flex flex-col items-center">
          <div
            className="mb-7 flex h-[88px] w-[88px] items-center justify-center overflow-hidden rounded-[22px]"
            style={{
              boxShadow: '0 0 18px rgba(34,229,255,0.18)',
              border: '1px solid rgba(0,212,255,0.25)',
            }}
          >
            <AppLogoMark size={88} radius={22} />
          </div>
          <p className="text-[30px] font-black tracking-tight text-white lg:text-[36px]">PROJECT</p>
          <p className="text-[30px] font-black tracking-tight text-[#22E5FF] lg:text-[36px]">PLANNER</p>
          <p className="mt-4 text-[12px] font-medium uppercase tracking-[0.15em] text-white/50">
            Built for construction teams
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {justConfirmed ? (
            <p className="rounded-[10px] border border-emerald-400/20 bg-emerald-500/10 px-3 py-3 text-center text-[13px] font-medium text-emerald-200">
              Account confirmed. Sign in with the email and password you set during setup.
            </p>
          ) : null}
          {displayError ? (
            <p className="rounded-[10px] border border-red-400/20 bg-red-500/10 px-3 py-3 text-center text-[13px] font-medium text-red-300">
              {displayError}
            </p>
          ) : null}

          <label className="block text-[13px] font-medium text-white/50">
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
              className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-[14px] text-white placeholder:text-white/25 outline-none focus:border-[#22E5FF]/50 focus:bg-white/[0.08] focus:shadow-[0_0_0_4px_rgba(34,229,255,0.12)]"
            />
          </label>

          <label className="block text-[13px] font-medium text-white/50">
            Password
            <span className="mt-2 flex rounded-2xl border border-white/10 bg-white/5 focus-within:border-[#22E5FF]/50 focus-within:bg-white/[0.08]">
              <input
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value)
                  setLocalError('')
                }}
                className="w-full bg-transparent px-4 py-[14px] text-white placeholder:text-white/25 outline-none"
              />
              <button
                type="button"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                onClick={() => setShowPassword((v) => !v)}
                className="px-3 text-white/25"
              >
                {showPassword ? <EyeIcon className="h-5 w-5 text-[#22E5FF]" /> : <EyeSlashIcon className="h-5 w-5" />}
              </button>
            </span>
          </label>

          <div className="flex justify-end">
            <Link href="/reset-password" className="text-[13px] font-medium text-[#22E5FF]/80">
              Forgot password?
            </Link>
          </div>

          <button
            type="submit"
            disabled={submitting || !isFormValid}
            className="h-14 w-full rounded-2xl text-[16px] font-bold tracking-wide text-white disabled:opacity-40"
            style={{
              background: isFormValid
                ? 'linear-gradient(90deg, #1A6BF5, #0E4FD8, #0A3EC4)'
                : 'linear-gradient(90deg, rgba(26,107,245,0.4), rgba(10,62,196,0.4))',
              boxShadow: isFormValid ? '0 4px 16px rgba(26,107,245,0.45)' : undefined,
            }}
          >
            {submitting ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <div className="my-6 flex items-center gap-3">
          <div className="h-px flex-1 bg-white/[0.08]" />
          <p className="text-[12px] font-medium text-white/25">New to Project Planner?</p>
          <div className="h-px flex-1 bg-white/[0.08]" />
        </div>

        <Link
          href="/setup"
          className="flex h-[52px] items-center justify-center gap-2 rounded-2xl border border-[#22E5FF]/30 text-[14px] font-semibold text-[#22E5FF]"
        >
          Set up your organisation on the web
        </Link>

        <p className="mt-auto pt-10 text-center text-[12px] text-white/25">v1.0.0 · Project Planner</p>
      </div>
    </div>
  )
}
