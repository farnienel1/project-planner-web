'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'
import { useAuthStore } from '@/lib/stores/authStore'
import { useAnalyticsStore } from '@/lib/analytics/analyticsStore'
import { AppLogoMark } from '@/components/ui/AppLogoMark'
import { useFeedbackStore } from '@/lib/feedback/feedbackStore'
import { cn } from '@/lib/ui/cn'
import { ErrorBanner } from '@/components/dashboard/PageShell'
import { hasCustomerOrganisation } from '@/lib/platform/owner'

const LINKS = [
  { href: '/developer', label: 'Overview' },
  { href: '/developer/organisations', label: 'Organisations' },
  { href: '/developer/users', label: 'Users' },
  { href: '/developer/analytics', label: 'Analytics' },
  { href: '/developer/usage', label: 'Feature usage' },
  { href: '/developer/feedback', label: 'Feedback' },
  { href: '/developer/roadmap', label: 'Roadmap' },
  { href: '/developer/account', label: 'Account' },
]

export function DeveloperAppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() || ''
  const { user, organization, signOut } = useAuthStore()
  const orgCount = useAnalyticsStore((state) => state.organisations.length)
  const userCount = useAnalyticsStore((state) => state.users.length)
  const ideaCount = useFeedbackStore((state) => state.suggestions.filter((row) => !row.hidden && !row.mergedIntoId).length)
  const orgApp = hasCustomerOrganisation(user?.organizationId)

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--navy)] bg-[var(--navy)] px-4 py-3 text-white">
        <div className="flex items-center gap-3">
          <AppLogoMark size={36} radius={10} />
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/70">Owner console</p>
            <p className="text-sm font-bold">{user?.email || 'info@projectplanner.us'}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className="hidden sm:inline text-white/80">
            {orgCount} organisations · {userCount} users · {ideaCount} feedback
          </span>
          {orgApp ? (
            <Link href="/dashboard" className="btn sm ghost" style={{ color: 'white', borderColor: 'rgba(255,255,255,.25)' }}>
              Organisation app
            </Link>
          ) : null}
          <Link href="/developer/account" className="btn sm ghost" style={{ color: 'white', borderColor: 'rgba(255,255,255,.25)' }}>
            Account
          </Link>
          <button type="button" className="btn sm ghost" style={{ color: 'white', borderColor: 'rgba(255,255,255,.25)' }} onClick={() => void signOut()}>
            Sign out
          </button>
        </div>
      </header>
      <nav className="overflow-x-auto border-b border-[var(--line)] bg-[#e7ebf1] px-3 py-2">
        <div className="flex gap-1">
          {LINKS.map((link) => {
            const on =
              pathname === link.href || (link.href !== '/developer' && pathname.startsWith(link.href))
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  'whitespace-nowrap rounded-[10px] px-3 py-2 text-center text-xs font-bold',
                  on ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
                )}
              >
                {link.label}
              </Link>
            )
          })}
        </div>
      </nav>
      <main className="mx-auto w-full max-w-6xl px-4 py-5">{children}</main>
      {organization && orgApp ? (
        <p className="px-4 pb-4 text-center text-xs text-[var(--ink3)]">
          Signed in with a profile that also belongs to {organization.name}. The pages above still show every organisation.
        </p>
      ) : null}
    </div>
  )
}

export function DeveloperShell({
  title,
  children,
  actions,
  back,
}: {
  title: string
  children: ReactNode
  actions?: ReactNode
  back?: { href: string; label: string }
}) {
  return (
    <div className="space-y-4">
      {back ? (
        <Link href={back.href} className="btn sm ghost w-fit">
          {back.label}
        </Link>
      ) : null}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h1 className="text-xl font-extrabold text-[var(--ink)]">{title}</h1>
        {actions}
      </div>
      {children}
    </div>
  )
}

export function DeveloperStatus({
  error,
  loading,
}: {
  error?: string | null
  loading?: boolean
}) {
  return (
    <>
      {error ? <ErrorBanner message={error} /> : null}
      {loading ? <p className="text-xs text-[var(--ink3)]">Refreshing live directory…</p> : null}
    </>
  )
}

export function MetricCard({
  label,
  value,
  hint,
  href,
  definition,
}: {
  label: string
  value: string | number
  hint?: ReactNode
  href?: string
  definition?: string
}) {
  const inner = (
    <>
      <p className="eyebrow flex items-center gap-1">
        {label}
        {definition ? (
          <span title={definition} className="cursor-help text-[11px] font-bold text-[var(--ink3)]">
            ⓘ
          </span>
        ) : null}
      </p>
      <p className="mt-1 text-2xl font-extrabold">{value}</p>
      {hint ? <p className="mt-1 text-xs text-[var(--ink3)]">{hint}</p> : null}
    </>
  )
  if (href) {
    return (
      <Link href={href} className="card pad block">
        {inner}
      </Link>
    )
  }
  return <div className="card pad">{inner}</div>
}

export function MiniBars({ points, hue = 'blue' }: { points: { day: string; value: number }[]; hue?: string }) {
  const max = Math.max(1, ...points.map((point) => point.value))
  return (
    <div className="flex h-24 items-end gap-1" data-hue={hue}>
      {points.map((point) => (
        <i
          key={point.day}
          title={`${point.day}: ${point.value}`}
          className="flex-1 rounded-sm bg-[var(--h)]"
          style={{ height: `${Math.max(4, (point.value / max) * 100)}%`, opacity: point.value ? 1 : 0.2 }}
        />
      ))}
    </div>
  )
}

export function ChangeHint({ current, previous }: { current: number; previous: number }) {
  if (previous === 0 && current === 0) return <span className="text-[var(--ink3)]">No change</span>
  if (previous === 0) return <span className="text-[var(--ink3)]">No previous-period data</span>
  const pct = Math.round(((current - previous) / previous) * 1000) / 10
  const up = pct >= 0
  return (
    <span className={up ? 'text-[var(--hs)]' : 'text-[var(--red)]'}>
      {up ? '+' : ''}
      {pct}% vs previous period
    </span>
  )
}
