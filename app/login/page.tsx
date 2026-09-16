'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/stores/authStore'
import Link from 'next/link'
import { ProjectPlannerLogo } from '@/components/ui/ProjectPlannerLogo'

export default function LoginPage() {
  const router = useRouter()
  const { signIn, loading, error } = useAuthStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [localError, setLocalError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLocalError('')

    try {
      await signIn(email, password)
      router.push('/dashboard')
    } catch (err: any) {
      setLocalError(err.message || 'Failed to sign in')
    }
  }

  return (
    <div className="min-h-screen bg-[#f6f7f9]">
      <header className="mx-auto flex h-16 w-full max-w-[1120px] items-center justify-between px-6">
        <ProjectPlannerLogo href="/" size="sm" />
        <Link href="/setup" className="text-[13px] font-medium text-slate-500 hover:text-slate-900">
          Set up organisation
        </Link>
      </header>

      <main className="mx-auto grid w-full max-w-[1120px] gap-10 px-6 pb-16 pt-8 lg:grid-cols-[1fr_420px] lg:items-start lg:pt-16">
        <section className="hidden pt-4 lg:block">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Web portal</p>
          <h1 className="mt-4 max-w-md text-4xl font-semibold tracking-[-0.035em] text-slate-900">
            Sign in to the same organisation as iOS.
          </h1>
          <p className="mt-4 max-w-md text-[15px] leading-7 text-slate-500">
            Projects, people, and schedules stay in sync. Use your existing account — nothing new to set up.
          </p>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-8 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <div className="mb-6 lg:hidden">
            <ProjectPlannerLogo href="/" size="md" />
          </div>
          <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Sign in</h2>
          <p className="mt-1 text-[13px] text-slate-500">Access your organisation dashboard.</p>

          <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
            {(error || localError) && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
                <p className="text-[13px] text-red-700">{error || localError}</p>
              </div>
            )}

            <div>
              <label htmlFor="email" className="mb-1.5 block text-[13px] font-medium text-slate-700">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="block h-11 w-full rounded-lg border border-slate-200 px-3 text-[14px] text-slate-900 placeholder-slate-400 outline-none transition focus:border-slate-400"
                placeholder="name@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="password" className="mb-1.5 block text-[13px] font-medium text-slate-700">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="block h-11 w-full rounded-lg border border-slate-200 px-3 text-[14px] text-slate-900 placeholder-slate-400 outline-none transition focus:border-slate-400"
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <div className="flex items-center justify-between">
              <Link href="/reset-password" className="text-[13px] font-medium text-slate-500 hover:text-slate-900">
                Forgot password?
              </Link>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="h-11 w-full rounded-lg bg-slate-900 text-[13px] font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>

            <p className="text-center text-[13px] text-slate-500">
              New organisation?{' '}
              <Link href="/setup" className="font-medium text-slate-900 hover:underline">
                Set up on desktop
              </Link>
            </p>
          </form>
        </section>
      </main>
    </div>
  )
}
