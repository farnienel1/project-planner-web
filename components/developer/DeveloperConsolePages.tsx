'use client'

import { DeveloperShell } from '@/components/developer/DeveloperShell'
import { useAnalyticsStore } from '@/lib/analytics/analyticsStore'
import { useEffect } from 'react'

export function DeveloperPlaceholderScreen({
  title,
  body,
}: {
  title: string
  body: string
}) {
  const { load } = useAnalyticsStore()
  useEffect(() => {
    void load()
  }, [load])
  return (
    <DeveloperShell title={title}>
      <p className="text-sm text-[var(--ink2)]">{body}</p>
    </DeveloperShell>
  )
}

export function DeveloperGrowthScreen() {
  return (
    <DeveloperPlaceholderScreen
      title="Growth"
      body="Activation funnel, onboarding drop-off and cohort retention. Counts come from product events (account, org set up, first project, first booking, first timesheet signed). Historic funnels are not invented — they fill in as those events fire."
    />
  )
}

export function DeveloperRevenueScreen() {
  return (
    <DeveloperPlaceholderScreen
      title="Revenue"
      body="Stripe plan, trial, failed payments and seats are mirrored onto each organisation when the billing webhook writes organizations/{id}.billing. MRR/ARR charts stay empty until that mirror exists so the console never fakes money."
    />
  )
}

export function DeveloperPagesErrorsScreen() {
  return (
    <DeveloperPlaceholderScreen
      title="Pages & errors"
      body="page_viewed and client_error events. Names, emails and free text are stripped from event metadata before they are stored."
    />
  )
}

export function DeveloperWebsiteStatsScreen() {
  return (
    <DeveloperPlaceholderScreen
      title="Website stats"
      body="Public totals are rounded down (money to £100k, timesheets to 100, hours to 10k, bookings to 1k, organisations to 10) and never identify a customer. GET /api/public-stats returns those figures with a 1-hour cache. Values stay null until at least five real organisations exist."
    />
  )
}
