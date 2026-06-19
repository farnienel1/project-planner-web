'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/stores/authStore'
import Link from 'next/link'

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
    <div className="min-h-screen bg-[#f4f6f9] px-5 py-10">
      <div className="mx-auto grid w-full max-w-[1160px] overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_2px_30px_rgba(15,23,42,0.08)] lg:grid-cols-2">
        <section className="hidden bg-slate-900 px-10 py-12 text-white lg:flex lg:flex-col">
          <div className="mb-8 flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-sm font-bold">PP</span>
            <div>
              <p className="text-sm font-semibold">Project Planner</p>
              <p className="text-xs text-slate-300">iOS parity web portal</p>
            </div>
          </div>
          <h1 className="text-4xl font-extrabold leading-tight">Welcome back</h1>
          <p className="mt-4 max-w-md text-sm text-slate-300">
            The web app mirrors the iOS app visual language and navigation so your team can switch screens without changing workflow.
          </p>
          <div className="mt-10 grid grid-cols-2 gap-3">
            {['Projects', 'Small Works', 'Operatives', 'Managers', 'Schedule', 'Settings'].map((item) => (
              <div key={item} className="rounded-xl border border-slate-700 bg-slate-800/70 px-3 py-2 text-sm">
                {item}
              </div>
            ))}
          </div>
        </section>

        <section className="px-7 py-10 sm:px-12">
          <h2 className="text-3xl font-extrabold text-slate-900">Sign in to Project Planner</h2>
          <p className="mt-2 text-sm text-slate-500">Access your organization dashboard and schedules.</p>

          <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
            {(error || localError) && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                <p className="text-sm text-red-700">{error || localError}</p>
              </div>
            )}

            <div>
              <label htmlFor="email" className="mb-1 block text-sm font-semibold text-slate-700">Email</label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="block w-full rounded-xl border border-slate-300 px-3 py-2.5 text-slate-900 placeholder-slate-400 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                placeholder="name@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="password" className="mb-1 block text-sm font-semibold text-slate-700">Password</label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="block w-full rounded-xl border border-slate-300 px-3 py-2.5 text-slate-900 placeholder-slate-400 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <div className="flex items-center justify-between">
              <Link
                href="/reset-password"
                className="text-sm font-semibold text-blue-600 hover:text-blue-700"
              >
                Forgot your password?
              </Link>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>

            <p className="text-center text-sm text-slate-600">
              New organisation?{' '}
              <Link href="/setup" className="font-semibold text-blue-600 hover:text-blue-700">
                Set up on desktop
              </Link>
            </p>
          </form>
        </section>
      </div>
    </div>
  )
}




