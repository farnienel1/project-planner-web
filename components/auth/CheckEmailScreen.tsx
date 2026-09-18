'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuthStore } from '@/lib/stores/authStore'
import { requestFounderConfirmEmail } from '@/lib/orgSetup/requestFounderConfirmEmail'
import {
  loadFounderConfirmEmailPayload,
  saveFounderConfirmEmailPayload,
  type FounderConfirmEmailPayload,
} from '@/lib/orgSetup/founderConfirmEmail'
import { formatSetupError } from '@/lib/orgSetup/formatSetupError'

export function CheckEmailScreen({ email }: { email?: string | null }) {
  const { user, organization, signOut } = useAuthStore()
  const [stored, setStored] = useState<FounderConfirmEmailPayload | null>(null)
  const [sending, setSending] = useState(false)
  const [status, setStatus] = useState<'idle' | 'sent' | 'error'>('idle')
  const [message, setMessage] = useState('')

  useEffect(() => {
    const payload = loadFounderConfirmEmailPayload()
    setStored(payload)
    if (payload?.lastError) {
      setStatus('error')
      setMessage(payload.lastError)
    }
  }, [])

  const displayEmail = stored?.to || email || user?.email || 'the address you used at setup'
  const canResend = Boolean(
    (stored?.confirmationToken || user?.accountConfirmToken) && (stored?.to || user?.email)
  )

  async function handleResend() {
    const confirmationToken = stored?.confirmationToken || user?.accountConfirmToken || ''
    const to = (stored?.to || user?.email || '').trim().toLowerCase()
    const payload = {
      confirmationToken,
      organizationName: stored?.organizationName || organization?.name || 'your organisation',
      firstName: stored?.firstName || user?.firstName || 'there',
      to,
    }
    if (!payload.confirmationToken || !payload.to) {
      setStatus('error')
      setMessage('We do not have a confirmation link to resend. Stay signed in and try Activate again.')
      return
    }
    setSending(true)
    setStatus('idle')
    setMessage('')
    try {
      await requestFounderConfirmEmail(payload)
      saveFounderConfirmEmailPayload(payload)
      setStored(payload)
      setStatus('sent')
    } catch (error) {
      const formatted = formatSetupError(error)
      const failed = { ...payload, lastError: formatted }
      saveFounderConfirmEmailPayload(failed)
      setStored(failed)
      setStatus('error')
      setMessage(formatted)
    } finally {
      setSending(false)
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
        <h1 className="text-center text-2xl font-extrabold text-slate-900">Check your email</h1>
        <p className="mt-3 text-center text-sm text-slate-600">
          We send a confirmation link to <strong className="text-slate-900">{displayEmail}</strong> from the
          same Outlook mailbox as the iOS app. Open that email and click the link to open your account. Then
          sign in with the password you chose during setup.
        </p>
        <p className="mt-4 text-center text-sm text-slate-600">
          Until you click that link, your email and password will not work on the web or the iOS / Android apps.
        </p>
        {status === 'sent' ? (
          <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            Another confirmation email is on its way. It should sit at the top of your inbox (check spam too).
          </div>
        ) : status === 'error' ? (
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {message || 'The confirmation email did not send. Tap Resend below.'}
          </div>
        ) : (
          <div className="mt-6 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-900">
            Check your inbox and spam folder. If you cannot see it, tap Resend confirmation email to send
            another copy to the top of your inbox.
          </div>
        )}
        <div className="mt-8 flex flex-col gap-3">
          {canResend ? (
            <button
              type="button"
              onClick={() => void handleResend()}
              disabled={sending}
              className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {sending ? 'Sending…' : 'Resend confirmation email'}
            </button>
          ) : null}
          <Link
            href="/login"
            className={
              canResend
                ? 'rounded-xl border border-slate-300 px-5 py-3 text-center text-sm font-semibold text-slate-700 hover:bg-slate-50'
                : 'rounded-xl bg-blue-600 px-5 py-3 text-center text-sm font-semibold text-white hover:bg-blue-700'
            }
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
