'use client'

import { FormEvent, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  completeInvitationPasswordSetup,
  fetchInvitationSummary,
  type InvitationSummary,
} from '@/lib/invites/completeInviteSetup'

export default function SetupPasswordClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const invitationId = searchParams.get('invitation')?.trim() || ''

  const [invitation, setInvitation] = useState<InvitationSummary | null>(null)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!invitationId) {
      setError('Missing invitation link. Open the link from your invite email.')
      setLoading(false)
      return
    }

    let cancelled = false
    void fetchInvitationSummary(invitationId)
      .then((data) => {
        if (!cancelled) setInvitation(data)
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Invitation not found')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [invitationId])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)

    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setSubmitting(true)
    try {
      await completeInvitationPasswordSetup({ invitationId, password })
      router.push('/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not set up your password')
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f4f6f9] px-5 py-10">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-[0_2px_30px_rgba(15,23,42,0.08)]">
        <p className="text-xs font-bold uppercase tracking-widest text-blue-600">Project Planner</p>
        <h1 className="mt-2 text-2xl font-extrabold text-slate-900">Set your password</h1>
        <p className="mt-2 text-sm text-slate-600">
          {invitation
            ? `Create a password for ${invitation.firstName} (${invitation.email})`
            : 'Create a password to finish joining your organisation.'}
        </p>

        {loading ? (
          <div className="mt-8 flex justify-center">
            <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-blue-600" />
          </div>
        ) : (
          <form onSubmit={(e) => void handleSubmit(e)} className="mt-8 space-y-4">
            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-700">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
                autoComplete="new-password"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-700">Confirm password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
                autoComplete="new-password"
                required
              />
            </div>

            <button
              type="submit"
              disabled={submitting || !invitation}
              className="w-full rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? 'Saving…' : 'Activate account'}
            </button>
          </form>
        )}

        <p className="mt-6 text-center text-sm text-slate-500">
          Already set up?{' '}
          <Link href="/login" className="font-semibold text-blue-600 hover:text-blue-700">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
