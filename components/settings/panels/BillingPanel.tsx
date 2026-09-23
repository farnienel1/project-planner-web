'use client'

import { useState } from 'react'
import { getAuth } from 'firebase/auth'
import { useAuthStore } from '@/lib/stores/authStore'
import { billingStatusLabel, formatTrialChargeCopy, hasAccess } from '@/lib/stripe/billing'
import { ANNUAL_PENCE, MONTHLY_PENCE } from '@/lib/stripe/plans'
import { PanelHeader, SettingsCard, ErrorBanner, SuccessBanner } from '@/components/settings/primitives'

export function BillingPanel({ onBack }: { onBack: () => void }) {
  const { organization, user } = useAuthStore()
  const billing = organization?.billing
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const interval = billing?.billingInterval === 'year' ? 'annual' : 'monthly'
  const amount = billing?.billingInterval === 'year' ? ANNUAL_PENCE : MONTHLY_PENCE
  const open = hasAccess(billing)

  async function openPortal() {
    if (!organization?.id) return
    setBusy(true)
    setError('')
    try {
      const token = await getAuth().currentUser?.getIdToken()
      const response = await fetch('/api/stripe/create-portal-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token || ''}` },
        body: JSON.stringify({ organizationId: organization.id }),
      })
      const data = (await response.json()) as { url?: string; error?: string }
      if (!response.ok || !data.url) throw new Error(data.error || 'Could not open billing.')
      window.location.href = data.url
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not open billing.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <PanelHeader title="Billing" onBack={onBack} />
      {notice ? <SuccessBanner message={notice} /> : null}
      {error ? <ErrorBanner message={error} /> : null}
      {!open ? (
        <p className="banner" data-hue="warn">
          This organisation is read-only until billing is restarted. You can still view and export data.
        </p>
      ) : null}
      <SettingsCard>
        <div className="space-y-3 p-1">
          <p className="text-sm font-semibold text-slate-800">
            ProjectPlanner, {interval}
          </p>
          <p className="text-sm text-slate-600">{billingStatusLabel(billing)}</p>
          <p className="text-sm text-slate-600">
            Next charge {amount === ANNUAL_PENCE ? '£1,490 a year' : '£149 a month'}
            {billing?.currentPeriodEnd ? ` on ${billing.currentPeriodEnd.toLocaleDateString('en-GB')}` : ''}. VAT is not charged.
          </p>
          {billing?.status === 'trialing' || billing?.status === 'pending' ? (
            <p className="text-xs text-slate-500">{formatTrialChargeCopy(billing?.trialStart || undefined)}</p>
          ) : null}
          <button type="button" className="btn sm primary" disabled={busy || !user} onClick={() => void openPortal()}>
            {busy ? 'Opening…' : 'Manage billing'}
          </button>
          <p className="text-xs text-slate-400">Cards, invoices and cancellation are handled in the Stripe customer portal.</p>
          <button type="button" className="text-xs text-[var(--ink3)]" onClick={() => setNotice('Portal opens in Stripe. Invoices stay there.')}>
            Need a receipt? Use Manage billing → Invoice history.
          </button>
        </div>
      </SettingsCard>
    </div>
  )
}
