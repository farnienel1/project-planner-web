'use client'

import Link from 'next/link'
import { useAuthStore } from '@/lib/stores/authStore'

export function CheckEmailScreen({ email }: { email?: string | null }) {
  const { user, signOut } = useAuthStore()
  const displayEmail = email || user?.email || 'the address you used at setup'

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f4f6f9] px-5 py-10">
      <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-8 shadow-[0_2px_30px_rgba(15,23,42,0.08)]">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
          <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2Z" />
          </svg>
        </div>
        <h1 className="text-center text-2xl font-extrabold text-slate-900">Check your email</h1>
        <p className="mt-3 text-center text-sm text-slate-600">
          We sent a confirmation link to <strong className="text-slate-900">{displayEmail}</strong>. Open that
          email and click the link to open your account. Then sign in with the password you chose during setup.
        </p>
        <p className="mt-4 text-center text-sm text-slate-600">
          Until you click that link, your email and password will not work on the web or the iOS / Android apps.
        </p>
        <div className="mt-6 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-900">
          Check your inbox and spam folder. After you confirm, you will land on the Project Planner login page.
        </div>
        <div className="mt-8 flex flex-col gap-3">
          <Link
            href="/login"
            className="rounded-xl bg-blue-600 px-5 py-3 text-center text-sm font-semibold text-white hover:bg-blue-700"
          >
            Go to login
          </Link>
          {user ? (
            <button
              type="button"
              onClick={() => void signOut()}
              className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Sign out
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}
