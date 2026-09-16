/**
 * Desktop sign-in look. Same actions and wording as iOS LoginBrand; website chrome instead of the phone screen.
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
      <main className="mx-auto grid w-full max-w-[1160px] gap-10 px-6 py-16 lg:grid-cols-2 lg:items-center lg:py-20">
        <section>
          <h1 className="text-4xl font-extrabold tracking-tight lg:text-5xl">Welcome back</h1>
          <p className="mt-4 max-w-lg text-lg text-slate-600">
            Sign in to your organisation to manage projects, people, scheduling and reports.
          </p>
          <div className="mt-8 grid grid-cols-2 gap-3">
            {['Projects', 'Small Works', 'Operatives', 'Managers', 'Schedule', 'Settings'].map((item) => (
              <div key={item} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700">
                {item}
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-[28px] border border-slate-200 bg-white p-8 shadow-[0_2px_30px_rgba(15,23,42,0.08)] lg:p-10">
          <h2 className="text-2xl font-extrabold tracking-tight">Sign In</h2>
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
                placeholder="your@email.com"
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
                  placeholder="Enter your password"
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
              className="h-12 w-full rounded-xl bg-[#185FA5] text-[16px] font-bold text-white disabled:opacity-40 hover:bg-[#154e88]"
            >
              {submitting ? 'Signing in…' : 'Sign In'}
            </button>
            <p className="text-center text-sm text-slate-600">
              New to Project Planner?{' '}
              <Link href="/setup" className="font-semibold text-[#185FA5]">
                Set up your organisation on the web
              </Link>
            </p>
          </form>
        </section>
      </main>
      <MarketingFooter />
    </div>
  )
}
