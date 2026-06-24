'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { sendEmailVerification } from 'firebase/auth'
import { getFirebaseAuth } from '@/lib/firebase/ensureFirebase'

export default function VerifyEmailClient() {
  const router = useRouter()
  const [checking, setChecking] = useState(false)
  const [resending, setResending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resent, setResent] = useState(false)

  const auth = getFirebaseAuth()
  const user = auth.currentUser
  const email = user?.email || 'your email address'

  async function handleResend() {
    if (!user) {
      setError('You are not signed in. Return to setup and try again.')
      return
    }
    setResending(true)
    setError(null)
    setResent(false)
    try {
      await sendEmailVerification(user)
      setResent(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not resend verification email')
    } finally {
      setResending(false)
    }
  }

  async function handleVerified() {
    if (!user) {
      setError('You are not signed in. Return to setup and try again.')
      return
    }
    setChecking(true)
    setError(null)
    try {
      await user.reload()
      if (!user.emailVerified) {
        setError(
          'Your email is not verified yet. Open the link in the email we sent, then click this button again.'
        )
        return
      }
      router.push('/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not check verification status')
    } finally {
      setChecking(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f4f6f9] px-5 py-10">
      <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-8 shadow-[0_2px_30px_rgba(15,23,42,0.08)]">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
          <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2Z" />
          </svg>
        </div>

        <h1 className="text-center text-2xl font-extrabold text-slate-900">Verify your account</h1>
        <p className="mt-3 text-center text-sm text-slate-600">
          We sent a verification link to <strong className="text-slate-900">{email}</strong>. Open that email and
          click the link to confirm your account before entering Project Planner.
        </p>

        <div className="mt-6 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-900">
          Check your inbox and spam folder. The email comes from Firebase / your project&apos;s auth sender.
        </div>

        {error && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {resent && (
          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            Verification email sent again. Please check your inbox.
          </div>
        )}

        <div className="mt-8 flex flex-col gap-3">
          <button
            type="button"
            onClick={() => void handleVerified()}
            disabled={checking}
            className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {checking ? 'Checking…' : 'I have verified my account'}
          </button>
          <button
            type="button"
            onClick={() => void handleResend()}
            disabled={resending}
            className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            {resending ? 'Sending…' : 'Resend verification email'}
          </button>
        </div>

        <p className="mt-6 text-center text-xs text-slate-500">
          Wrong email?{' '}
          <Link href="/setup" className="font-semibold text-blue-600 hover:underline">
            Start setup again
          </Link>
        </p>
      </div>
    </div>
  )
}
