'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, type ReactNode } from 'react'
import { ArrowRightOnRectangleIcon, Bars3Icon } from '@heroicons/react/24/outline'
import { useAuthStore } from '@/lib/stores/authStore'
import { AppLogoMark } from '@/components/ui/AppLogoMark'
import { useFeedbackStore } from '@/lib/feedback/feedbackStore'
import { useNewInterestCount } from '@/lib/interest/interestStore'
import { cn } from '@/lib/ui/cn'
import { ErrorBanner } from '@/components/dashboard/PageShell'
import { hasCustomerOrganisation } from '@/lib/platform/owner'
import { useConsolePrefs } from '@/lib/analytics/consolePrefs'
import { CONSOLE_PERIODS } from '@/lib/analytics/consolePeriod'
import { activeConsoleHref, consolePageUsesPeriod, visibleConsoleNav } from '@/lib/owner/consoleNav'
import { useOwnerCounts } from '@/lib/owner/client/ownerApi'
import { ConsoleSearch } from '@/components/developer/ConsoleSearch'

/**
 * The console frame: the app's own sidebar and top bar (`app-frame`, `sb`, `tb` in app/brand-shell.css, owner answer
 * 16 Nov: no separate design file). The menu is CONSOLE_NAV (spec §4 groups, useful-only rule); the visual layer is
 * only class names, so it restyles in one place.
 */
export function DeveloperAppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() || ''
  const { user, organization, signOut } = useAuthStore()
  const orgApp = hasCustomerOrganisation(user?.organizationId)
  const { includeTestData, setIncludeTestData, period, setPeriod } = useConsolePrefs()
  const newInterestCount = useNewInterestCount()
  const triageCount = useFeedbackStore(
    (state) => state.suggestions.filter((row) => !row.hidden && !row.mergedIntoId && row.productDecision === 'none').length
  )
  const { counts, error: countsError } = useOwnerCounts(includeTestData)
  const [menuOpen, setMenuOpen] = useState(false)
  const activeHref = activeConsoleHref(pathname)
  const showPeriod = consolePageUsesPeriod(pathname)
  const groups = visibleConsoleNav()

  const badgeFor = (badge?: string) => {
    if (badge === 'feedbackTriage' && triageCount > 0) return { count: triageCount, label: `${triageCount} feedback to triage` }
    if (badge === 'interestNew' && newInterestCount > 0) return { count: newInterestCount, label: `${newInterestCount} new` }
    return null
  }

  const sidebar = (
    <>
      <div className="sb-brand">
        <span className="sb-logo">
          <AppLogoMark size={30} radius={8} />
        </span>
        <div className="min-w-0">
          <p className="sb-title truncate">Owner console</p>
          <p className="sb-org truncate">{user?.email || 'info@projectplanner.us'}</p>
        </div>
      </div>
      <nav className="sb-nav flex-1 overflow-y-auto" aria-label="Owner console" onClick={() => setMenuOpen(false)}>
        {groups
          .filter((group) => group.id !== 'bottom')
          .map((group) => (
            <div key={group.id} className="sb-group" data-testid={`console-group-${group.id}`}>
              <div className="sb-label-row">
                <p className="sb-label">{group.label}</p>
              </div>
              <div className="sb-items">
                {group.items.map((item) => {
                  const badge = badgeFor(item.badge)
                  const on = activeHref === item.href
                  return (
                    <Link
                      key={item.href}
                      href={item.href as string}
                      className={cn('sb-item', on && 'on')}
                      aria-current={on ? 'page' : undefined}
                      title={item.note}
                    >
                      <span className="min-w-0 flex-1 truncate">{item.label}</span>
                      {badge ? (
                        <span className="tb-badge rounded-full px-1.5 text-[10.5px] font-semibold text-white" aria-label={badge.label}>
                          {badge.count}
                        </span>
                      ) : null}
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
      </nav>
      <div className="sb-foot">
        <div className="sb-items sb-foot-links">
          {groups
            .filter((group) => group.id === 'bottom')
            .flatMap((group) => group.items)
            .map((item) => (
              <Link
                key={item.href}
                href={item.href as string}
                className={cn('sb-item', activeHref === item.href && 'on')}
                aria-current={activeHref === item.href ? 'page' : undefined}
              >
                {item.label}
              </Link>
            ))}
          {orgApp ? (
            <Link href="/dashboard" className="sb-item">
              Organisation app
            </Link>
          ) : null}
        </div>
        <div className="sb-user">
          <div className="min-w-0">
            <p className="sb-user-name truncate">{user?.email || 'info@projectplanner.us'}</p>
            <p className="sb-org truncate">Platform owner</p>
          </div>
          <button type="button" onClick={() => void signOut()} className="sb-signout" aria-label="Sign out" title="Sign out">
            <ArrowRightOnRectangleIcon className="h-4 w-4" />
          </button>
        </div>
      </div>
    </>
  )

  return (
    <div className="app-frame min-h-screen text-[var(--ink)]" data-testid="owner-console">
      {menuOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-[60] bg-[rgba(10,20,40,.4)] lg:hidden"
          aria-label="Close menu"
          onClick={() => setMenuOpen(false)}
        />
      ) : null}
      <div className="flex min-h-screen">
        <aside
          className={cn(
            'sb flex min-h-0 flex-col',
            'max-[1023px]:fixed max-[1023px]:inset-y-0 max-[1023px]:left-0 max-[1023px]:z-[70] max-[1023px]:w-[290px] max-[1023px]:transition-transform',
            menuOpen ? 'max-[1023px]:translate-x-0' : 'max-[1023px]:-translate-x-full max-[1023px]:invisible',
            'lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-[244px] lg:shrink-0'
          )}
          aria-label="Owner console menu"
        >
          <div className="flex h-full flex-col">{sidebar}</div>
        </aside>
        <div className="app-panel flex min-w-0 flex-1 flex-col">
          <header className="tb sticky top-0 z-20 flex min-h-[54px] min-w-0 flex-wrap items-center gap-2 px-5 py-2 max-[760px]:px-3.5">
            <button
              type="button"
              className="tb-control grid h-9 w-9 shrink-0 place-items-center lg:hidden"
              aria-label="Open menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen(true)}
            >
              <Bars3Icon className="h-5 w-5" />
            </button>
            <ConsoleSearch />
            <div className="ml-auto flex flex-wrap items-center gap-3 text-[12.5px] text-[var(--dash-ink-2)]">
              <button
                type="button"
                role="switch"
                aria-checked={includeTestData}
                onClick={() => setIncludeTestData(!includeTestData)}
                className="flex items-center gap-2"
                data-testid="include-test-data"
              >
                Include test data
                <span className={`relative h-5 w-9 rounded-full ${includeTestData ? 'bg-[var(--dash-blue-solid)]' : 'bg-[var(--dash-track)]'}`}>
                  <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition ${includeTestData ? 'left-4' : 'left-0.5'}`} />
                </span>
              </button>
              {/* Useful-only rule: each count opens the list it counts. */}
              {counts ? (
                <span className="flex flex-wrap items-center gap-2" data-testid="console-counts">
                  <Link href="/developer/organisations" className="underline-offset-2 hover:underline" title={OWNER_COUNT_HINTS.organisations}>
                    <b className="font-semibold text-[var(--dash-ink)]">{counts.organisations}</b> organisations
                  </Link>
                  <span aria-hidden>·</span>
                  <Link href="/developer/users" className="underline-offset-2 hover:underline" title={OWNER_COUNT_HINTS.accounts}>
                    <b className="font-semibold text-[var(--dash-ink)]">{counts.accounts}</b> accounts
                  </Link>
                </span>
              ) : countsError ? (
                <span className="text-[var(--dash-warn-ink)]" title={countsError}>
                  Counts unavailable
                </span>
              ) : null}
            </div>
          </header>
          {showPeriod ? (
            <div className="flex flex-wrap items-center gap-2 border-b border-[var(--dash-line)] bg-[var(--dash-panel)] px-5 py-2 max-[760px]:px-3.5">
              <span className="text-[12px] text-[var(--dash-muted)]" id="console-period-label">
                Period
              </span>
              <div className="flex flex-wrap gap-1" role="group" aria-labelledby="console-period-label">
                {CONSOLE_PERIODS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    aria-pressed={period === item.id}
                    onClick={() => setPeriod(item.id)}
                    className={cn(
                      'rounded-[8px] px-3 py-1.5 text-[12.5px] font-medium',
                      period === item.id ? 'bg-[var(--dash-primary-bg)] text-[var(--dash-primary-ink)]' : 'tb-control'
                    )}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          <main className="mx-auto w-full max-w-[1400px] min-w-0 px-4 py-5">{children}</main>
          {organization && orgApp ? (
            <p className="px-4 pb-4 text-center text-xs text-[var(--dash-muted)]">
              Signed in with a profile that also belongs to {organization.name}. The pages above still show every organisation.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  )
}

/** The hover text of the header counts (their metric contracts). */
export const OWNER_COUNT_HINTS = {
  organisations:
    'Organisation documents (count() on the server), without the platform-owner profile. Test companies (isInternal / isTest) are left out unless Include test data is on. Refreshed every 60 seconds.',
  accounts:
    'Users documents (accounts), not folded people: one person with two documents counts twice here. Accounts flagged internal or in test companies are left out unless Include test data is on.',
} as const

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
