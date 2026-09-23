'use client'

import { DeveloperShell } from '@/components/developer/DeveloperShell'
import { useAnalyticsStore } from '@/lib/analytics/analyticsStore'
import { useEffect, useMemo } from 'react'
import { billingLabel } from '@/lib/stripe/billing'
import { formatGbpFromPence } from '@/lib/analytics/consolePeriod'
import { ANNUAL_PENCE, MONTHLY_PENCE } from '@/lib/stripe/plans'
import { inRange } from '@/lib/analytics/aggregations'
import { resolveConsolePeriod } from '@/lib/analytics/consolePeriod'
import { MetricCard } from '@/components/developer/DeveloperShell'

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
  const { events, users, organisations, load } = useAnalyticsStore()
  useEffect(() => {
    void load()
  }, [load])
  const year = resolveConsolePeriod('year')
  const counts = useMemo(() => {
    const signedUp = events.filter((event) => event.eventName === 'user_signed_up' && inRange(event.createdAt, year.start, year.end)).length
    const orgSetup = events.filter((event) => event.eventName === 'org_setup_completed' && inRange(event.createdAt, year.start, year.end)).length
    const firstProject = events.filter((event) => event.eventName === 'project_created' && inRange(event.createdAt, year.start, year.end)).length
    const firstTimesheet = events.filter((event) => (event.eventName === 'timesheet_signed' || event.eventName === 'timesheet_approved') && inRange(event.createdAt, year.start, year.end)).length
    return { signedUp, orgSetup, firstProject, firstTimesheet }
  }, [events, year.start, year.end])
  return (
    <DeveloperShell title="Growth">
      <p className="text-sm text-[var(--ink2)]">
        Activation steps from product events this year. Historic funnels are not invented — they fill in as those events fire.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Accounts" value={counts.signedUp || users.length} hint="user_signed_up events, else directory count" />
        <MetricCard label="Org set up" value={counts.orgSetup || organisations.length} hint="org_setup_completed events, else directory" />
        <MetricCard label="First project" value={counts.firstProject} hint="project_created events" />
        <MetricCard label="Timesheet signed" value={counts.firstTimesheet} hint="timesheet_signed / approved events" />
      </div>
    </DeveloperShell>
  )
}

export function DeveloperRevenueScreen() {
  const { organisations, load } = useAnalyticsStore()
  useEffect(() => {
    void load()
  }, [load])
  const stats = useMemo(() => {
    let mrr = 0
    let monthly = 0
    let annual = 0
    let trial = 0
    let pastDue = 0
    let cancelling = 0
    let none = 0
    for (const org of organisations) {
      const billing = org.billing
      if (!billing || billing.status === 'none' || billing.status === 'pending') {
        none += 1
        continue
      }
      if (billing.status === 'trialing') trial += 1
      if (billing.status === 'past_due') pastDue += 1
      if (billing.cancelAtPeriodEnd) cancelling += 1
      if (billing.status === 'active' || billing.status === 'trialing') {
        mrr += billing.mrrPence || (billing.billingInterval === 'year' ? Math.round(ANNUAL_PENCE / 12) : MONTHLY_PENCE)
        if (billing.billingInterval === 'year') annual += 1
        else if (billing.billingInterval === 'month') monthly += 1
      }
    }
    return { mrr, monthly, annual, trial, pastDue, cancelling, none }
  }, [organisations])
  return (
    <DeveloperShell title="Revenue">
      <p className="text-sm text-[var(--ink2)]">
        MRR is read from organizations/{'{id}'}.billing.mrrPence written by the Stripe webhook. Empty until a sandbox checkout completes.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="MRR" value={formatGbpFromPence(stats.mrr)} />
        <MetricCard label="ARR" value={formatGbpFromPence(stats.mrr * 12)} />
        <MetricCard label="Monthly / annual" value={`${stats.monthly} / ${stats.annual}`} />
        <MetricCard label="Trials" value={stats.trial} />
        <MetricCard label="Past due" value={stats.pastDue} />
        <MetricCard label="Cancelling" value={stats.cancelling} />
        <MetricCard label="No billing yet" value={stats.none} />
      </div>
      <ul className="mt-4 space-y-2">
        {organisations.map((org) => (
          <li key={org.id} className="flex justify-between rounded-xl bg-[var(--soft)] px-3 py-2 text-sm">
            <span className="font-semibold">{org.name}</span>
            <span className="text-[var(--ink3)]">{billingLabel(org.billing)}</span>
          </li>
        ))}
      </ul>
    </DeveloperShell>
  )
}

export function DeveloperPagesErrorsScreen() {
  const { events, load } = useAnalyticsStore()
  useEffect(() => {
    void load()
  }, [load])
  const pages = events.filter((event) => event.eventName === 'page_viewed').length
  const errors = events.filter((event) => event.eventName === 'client_error').length
  return (
    <DeveloperShell title="Pages & errors">
      <p className="text-sm text-[var(--ink2)]">
        page_viewed and client_error events. Names, emails and free text are stripped from event metadata before they are stored.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <MetricCard label="page_viewed" value={pages} />
        <MetricCard label="client_error" value={errors} />
      </div>
    </DeveloperShell>
  )
}

export function DeveloperWebsiteStatsScreen() {
  const { organisations, users, load } = useAnalyticsStore()
  useEffect(() => {
    void load()
  }, [load])
  return (
    <DeveloperShell title="Website stats">
      <p className="text-sm text-[var(--ink2)]">
        Public totals are rounded down (money to £100k, timesheets to 100, hours to 10k, bookings to 1k, organisations to 10) and never identify a customer. GET /api/public-stats returns those figures with a 1-hour cache. Values stay null until at least five real organisations exist.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <MetricCard label="Live organisations (unrounded)" value={organisations.length} />
        <MetricCard label="Live users (unrounded)" value={users.length} />
      </div>
      <p className="mt-4 text-xs text-[var(--ink3)]">
        Rounded public figures are published to publicStats/platform. They are not shown here until that doc exists, so we never invent a marketing number.
      </p>
    </DeveloperShell>
  )
}
