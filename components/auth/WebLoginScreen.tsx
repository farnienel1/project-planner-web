/**
 * Desktop/web sign-in. The public site is not a phone clone of iOS LoginBrand.
 * Narrow viewports still use LoginBrandScreen.
 */

'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline'
import { useAuthStore } from '@/lib/stores/authStore'
import { MarketingFooter, MarketingHeader } from '@/components/marketing/MarketingChrome'

export function WebLoginScreen() {
  const router = useRouter()
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
    } catch {
      setLocalError('Sign in failed. Please check your email/password and try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#f6f8fb] text-[#0b1220]">
      <MarketingHeader active="login" />
      <main className="mx-auto grid w-full max-w-[1160px] gap-12 px-6 py-16 lg:grid-cols-2 lg:items-center lg:py-24">
        <section>
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#185FA5]">Web app</p>
          <h1 className="mt-3 text-4xl font-extrabold tracking-tight lg:text-5xl">Sign in on the website</h1>
          <p className="mt-4 max-w-lg text-lg text-slate-600">
            This is the desktop product — projects, scheduling, timesheets and settings in a browser. It uses
            the same organisation as the iOS app. It is not a copy of the phone login screen.
          </p>
          <ul className="mt-8 space-y-3 text-sm text-slate-700">
            <li className="flex gap-2">
              <span className="font-semibold text-[#185FA5]">1.</span>
              Open the marketing site, then sign in here when you already have an organisation.
            </li>
            <li className="flex gap-2">
              <span className="font-semibold text-[#185FA5]">2.</span>
              New company? Set up on the web first — Stripe checkout lives on this site, not on iPhone.
            </li>
            <li className="flex gap-2">
              <span className="font-semibold text-[#185FA5]">3.</span>
              On a phone browser, sign-in still matches the iOS LoginBrand screen.
            </li>
          </ul>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/" className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-900 shadow-sm hover:border-slate-300">
              ← Back to website
            </Link>
            <Link href="/setup" className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700">
              Set up organisation
            </Link>
          </div>
        </section>

        <section className="rounded-[28px] border border-slate-200 bg-white p-8 shadow-[0_2px_30px_rgba(15,23,42,0.08)] lg:p-10">
          <h2 className="text-2xl font-extrabold tracking-tight">Sign in</h2>
          <p className="mt-1 text-sm text-slate-500">Use the email and password for your organisation.</p>
          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            {displayError ? (
              <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{displayError}</p>
            ) : null}
            <label className="block text-sm font-semibold text-slate-700">
              Email
              <input
                type="email"
                autoComplete="username"
                inputMode="email"
                placeholder="name@company.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value)
                  setLocalError('')
                }}
                className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-slate-900 outline-none transition focus:border-[#185FA5] focus:ring-2 focus:ring-[#185FA5]/20"
              />
            </label>
            <label className="block text-sm font-semibold text-slate-700">
              Password
              <span className="mt-2 flex rounded-xl border border-slate-300 focus-within:border-[#185FA5] focus-within:ring-2 focus-within:ring-[#185FA5]/20">
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="Enter password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value)
                    setLocalError('')
                  }}
                  className="w-full rounded-xl bg-transparent px-3 py-2.5 outline-none"
                />
                <button
                  type="button"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  onClick={() => setShowPassword((v) => !v)}
                  className="px-3 text-slate-400"
                >
                  {showPassword ? <EyeIcon className="h-5 w-5 text-[#185FA5]" /> : <EyeSlashIcon className="h-5 w-5" />}
                </button>
              </span>
            </label>
            <div className="flex justify-end">
              <Link href="/reset-password" className="text-sm font-semibold text-[#185FA5]">
                Forgot password?
              </Link>
            </div>
            <button
              type="submit"
              disabled={submitting || !isFormValid}
              className="h-12 w-full rounded-xl bg-[#185FA5] text-sm font-semibold text-white disabled:opacity-40 hover:bg-[#154e88]"
            >
              {submitting ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </section>
      </main>
      <MarketingFooter />
    </div>
  )
}
