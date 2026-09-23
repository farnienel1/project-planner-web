'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { activateOrganizationSubscription } from '@/lib/orgSetup/activateSubscription'
import { switchActiveOrganization } from '@/lib/orgMembership/membershipService'
import { persistGuidedSetupDraftIfNeeded } from '@/lib/orgSetup/persistGuidedSetup'
import { getFirebaseAuth, getFirebaseDb } from '@/lib/firebase/ensureFirebase'
import { doc, getDoc } from 'firebase/firestore'
import { requestFounderConfirmEmail } from '@/lib/orgSetup/requestFounderConfirmEmail'
import { saveFounderConfirmEmailPayload } from '@/lib/orgSetup/founderConfirmEmail'
import { grantMfaSkip } from '@/lib/auth/mfa/mfaClient'

type VerifiedSession = {
  organizationId: string
  planKey: string
  stripeCustomerId?: string
  stripeSubscriptionId?: string
  stripePriceId?: string
  currentPeriodEnd?: string | null
  status: 'active' | 'trialing'
}

type AdditionalChoice = {
  newOrganizationId: string
  newOrganizationName: string
  currentOrganizationName: string
}

export default function SetupSuccessClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const sessionId = searchParams.get('session_id')
  const [status, setStatus] = useState<'loading' | 'success' | 'choose' | 'error'>('loading')
  const [message, setMessage] = useState('Confirming your subscription…')
  const [choice, setChoice] = useState<AdditionalChoice | null>(null)
  const [switching, setSwitching] = useState(false)

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
          status: data.status === 'trialing' ? 'trialing' : 'active',
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
          const db = getFirebaseDb()
          const userSnap = await getDoc(doc(db, 'users', adminUserId))
          const userData = userSnap.data()
          const alreadyConfirmed = userData?.accountConfirmed !== false
          const token = String(userData?.accountConfirmToken || '')
          const firstName = String(userData?.firstName || 'there')
          const to = String(userData?.email || getFirebaseAuth().currentUser?.email || '')
          const orgSnap = await getDoc(doc(db, 'organizations', data.organizationId))
          const organizationName = String(orgSnap.data()?.name || 'your organisation')
          const currentOrgId = String(userData?.organizationId || '')
          const isAdditionalOrg = Boolean(alreadyConfirmed && currentOrgId && currentOrgId !== data.organizationId)

          if (!alreadyConfirmed) {
            if (token && to) {
              const payload = {
                confirmationToken: token,
                organizationName,
                firstName,
                to,
              }
              try {
                await requestFounderConfirmEmail(payload)
              } catch (emailError) {
                saveFounderConfirmEmailPayload({
                  ...payload,
                  lastError: emailError instanceof Error ? emailError.message : 'Could not send confirmation email',
                })
              }
            }
            if (!cancelled) {
              setStatus('success')
              setMessage('Payment confirmed. Check your email for a link to open your account, then sign in.')
              window.setTimeout(() => router.push('/setup/check-email'), 1200)
            }
            return
          }

          if (isAdditionalOrg) {
            let currentName = 'your current organisation'
            try {
              const currentSnap = await getDoc(doc(db, 'organizations', currentOrgId))
              currentName = String(currentSnap.data()?.name || currentName)
            } catch {
              // Names are display-only.
            }
            if (!cancelled) {
              setChoice({
                newOrganizationId: data.organizationId,
                newOrganizationName: organizationName,
                currentOrganizationName: currentName,
              })
              setStatus('choose')
              setMessage('Payment confirmed. You can switch to the new organisation now, or stay where you are.')
            }
            return
          }
        }

        if (!cancelled) {
          setStatus('success')
          setMessage('Payment confirmed. Opening your new organisation…')
          window.setTimeout(() => {
            void grantMfaSkip()
              .catch(() => undefined)
              .finally(() => {
                window.location.href = '/dashboard'
              })
          }, 900)
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

  async function goToDashboard() {
    await grantMfaSkip().catch(() => undefined)
    window.location.href = '/dashboard'
  }

  async function switchToNewOrganisation() {
    const adminUserId = getFirebaseAuth().currentUser?.uid
    if (!adminUserId || !choice) {
      await goToDashboard()
      return
    }
    setSwitching(true)
    try {
      await switchActiveOrganization(adminUserId, choice.newOrganizationId)
      await goToDashboard()
    } catch (error) {
      setSwitching(false)
      setStatus('error')
      setMessage(
        error instanceof Error
          ? error.message
          : 'The organisation is ready. Open Switch organisation to move into it.'
      )
    }
  }

  const heading =
    status === 'error'
      ? 'Setup issue'
      : status === 'choose'
        ? 'Organisation ready'
        : status === 'success'
          ? 'Payment confirmed'
          : 'Finishing setup'

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f4f6f9] px-5">
      <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-[0_2px_30px_rgba(15,23,42,0.08)]">
        {status === 'loading' && (
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600" />
        )}
        {(status === 'success' || status === 'choose') && (
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-2xl text-emerald-700">
            ✓
          </div>
        )}
        {status === 'error' && (
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-2xl text-red-700">
            !
          </div>
        )}
        <h1 className="text-2xl font-extrabold text-slate-900">{heading}</h1>
        <p className="mt-3 text-sm text-slate-600">{message}</p>
        {status === 'choose' && choice ? (
          <div className="mt-6 grid gap-3">
            <p className="text-sm text-slate-500">
              You stay in whichever organisation you last switched to. Switching now makes {choice.newOrganizationName}{' '}
              the one you are working in.
            </p>
            <button
              type="button"
              className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
              onClick={() => void switchToNewOrganisation()}
              disabled={switching}
            >
              {switching ? 'Switching…' : `Switch to ${choice.newOrganizationName} now`}
            </button>
            <button
              type="button"
              className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              onClick={() => void goToDashboard()}
              disabled={switching}
            >
              Stay in {choice.currentOrganizationName}
            </button>
            <Link href="/dashboard/change-organisation" className="text-sm font-semibold text-blue-700 hover:underline">
              Open Switch organisation
            </Link>
          </div>
        ) : null}
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
