'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { activateOrganizationSubscription } from '@/lib/orgSetup/activateSubscription'
import { persistGuidedSetupDraftIfNeeded } from '@/lib/orgSetup/persistGuidedSetup'
import { getFirebaseAuth } from '@/lib/firebase/ensureFirebase'

type VerifiedSession = {
  organizationId: string
  planKey: string
  stripeCustomerId?: string
  stripeSubscriptionId?: string
  stripePriceId?: string
  currentPeriodEnd?: string | null
  status: 'active'
}

export default function SetupSuccessClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const sessionId = searchParams.get('session_id')
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('Confirming your subscription…')

  useEffect(() => {
    if (!sessionId) {
      setStatus('error')
      setMessage('Missing Stripe session. Please contact support if you were charged.')
      return
    }

    let cancelled = false

    const verifiedSessionId = sessionId

    async function verifyAndActivate() {
      try {
        const response = await fetch(
          `/api/stripe/verify-session?session_id=${encodeURIComponent(verifiedSessionId)}`
        )
        const data = (await response.json()) as VerifiedSession & { error?: string }

        if (!response.ok) {
          throw new Error(data.error || 'Could not verify payment')
        }

        await activateOrganizationSubscription(data.organizationId, {
          status: 'active',
          planKey: data.planKey,
          stripeCustomerId: data.stripeCustomerId,
          stripeSubscriptionId: data.stripeSubscriptionId,
          stripePriceId: data.stripePriceId,
          currentPeriodEnd: data.currentPeriodEnd ? new Date(data.currentPeriodEnd) : undefined,
          activatedAt: new Date(),
        })

        const adminUserId = getFirebaseAuth().currentUser?.uid
        if (adminUserId) {
          await persistGuidedSetupDraftIfNeeded(data.organizationId, adminUserId)
        }

        if (!cancelled) {
          setStatus('success')
          setMessage('Your organisation is active. Redirecting to your dashboard…')
          window.setTimeout(() => router.push('/dashboard'), 1800)
        }
      } catch (error) {
        if (!cancelled) {
          setStatus('error')
          setMessage(error instanceof Error ? error.message : 'Could not activate your subscription')
        }
      }
    }

    void verifyAndActivate()
    return () => {
      cancelled = true
    }
  }, [sessionId, router])

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f4f6f9] px-5">
      <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-[0_2px_30px_rgba(15,23,42,0.08)]">
        {status === 'loading' && (
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600" />
        )}
        {status === 'success' && (
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-2xl text-emerald-700">
            ✓
          </div>
        )}
        {status === 'error' && (
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-2xl text-red-700">
            !
          </div>
        )}
        <h1 className="text-2xl font-extrabold text-slate-900">
          {status === 'success' ? 'Welcome to Project Planner' : status === 'error' ? 'Setup issue' : 'Finishing setup'}
        </h1>
        <p className="mt-3 text-sm text-slate-600">{message}</p>
        {status === 'error' && (
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link href="/setup" className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
              Try again
            </Link>
            <a href="mailto:support@projectplanner.app" className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              Contact support
            </a>
          </div>
        )}
      </div>
    </div>
  )
}
