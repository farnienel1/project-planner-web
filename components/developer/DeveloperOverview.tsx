'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'
import { DeveloperShell } from '@/components/developer/DeveloperShell'
import { Card, Chip, EmptyState, Note, type PuTone } from '@/components/ui/page'
import { LoadingSpinner } from '@/components/dashboard/PageShell'
import { deltaCopy, formatCount, formatGbpFromPence, type ConsolePeriodId } from '@/lib/analytics/consolePeriod'
import type { DateRangePreset } from '@/lib/analytics/events'
import { useConsolePrefs } from '@/lib/analytics/consolePrefs'
import { LONDON_TIME_ZONE } from '@/lib/orgTime/zoneTime'
import { useOwnerOverview, type OwnerOverviewResponse } from '@/lib/owner/client/ownerApi'
import type { AttentionReason, LiveFeedItem } from '@/lib/owner/commandCentre'
import {
  ATTENTION_REASON_DEFINITIONS,
  COMMAND_CENTRE_METRICS,
  LIVE_FEED_DEFINITION,
  type AttentionReasonKind,
  type CommandCentreMetricKey,
} from '@/lib/owner/metricContracts'

const PRESETS: { id: DateRangePreset; label: string }[] = [
  { id: 'all_time', label: 'All time' },
  { id: 'today', label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: 'last_7', label: 'Last 7 days' },
  { id: 'last_30', label: 'Last 30 days' },
  { id: 'last_90', label: 'Last 90 days' },
  { id: 'this_month', label: 'This month' },
  { id: 'last_month', label: 'Last month' },
]

/** The date chips of the older console pages (Organisations, People, Analytics, an organisation's page). */
export function DateRangePicker({
  preset,
  onChange,
}: {
  preset: DateRangePreset
  onChange: (preset: DateRangePreset) => void
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {PRESETS.map((item) => (
        <button
          key={item.id}
          type="button"
          className={`chip ${preset === item.id ? 'on' : ''}`}
          onClick={() => onChange(item.id)}
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}

/** The platform is shown in Europe/London (PLAN §2). */
function formatWhen(iso: string | number): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: LONDON_TIME_ZONE,
  }).format(new Date(iso))
}

/** The ⓘ: the metric contract, opened by tap or keyboard (a hover title does not work on a phone). */
function Definition({ text, label }: { text: string; label: string }) {
  return (
    <details className="text-[12px] text-(--dash-muted)">
      <summary className="inline cursor-pointer list-none font-bold" aria-label={`What ${label} counts`}>
        ⓘ
      </summary>
      <p className="mt-1 max-w-prose leading-snug">{text}</p>
    </details>
  )
}

function Headline({
  metric,
  value,
  lines,
  href,
  linkLabel,
}: {
  metric: CommandCentreMetricKey
  value: ReactNode
  lines: ReactNode[]
  href: string
  linkLabel: string
}) {
  const contract = COMMAND_CENTRE_METRICS[metric]
  return (
    <div className="pu-card" data-testid={`overview-${metric}`}>
      <div className="pu-card-b" style={{ gap: 6 }}>
        <div className="flex items-start justify-between gap-2">
          <p className="text-[12.5px] font-semibold uppercase tracking-[0.08em] text-(--dash-muted)">{contract.label}</p>
          <Definition text={`${contract.definition} ${contract.refresh}`} label={contract.label} />
        </div>
        <Link href={href} className="w-fit text-[30px] font-bold leading-tight text-(--dash-ink) underline-offset-4 hover:underline">
          {value}
        </Link>
        {lines.map((line, index) => (
          <p key={index} className="text-[12.5px] text-(--dash-muted)">
            {line}
          </p>
        ))}
        <Link href={href} className="pu-link w-fit text-[12.5px]">
          {linkLabel} <span aria-hidden="true">→</span>
        </Link>
      </div>
    </div>
  )
}

const REASON_TONE: Record<AttentionReasonKind, PuTone> = {
  scheduled: 'red',
  paymentFailed: 'red',
  lapsed: 'red',
  trialEnding: 'amber',
  cancelling: 'amber',
  unfinished: 'slate',
  quiet: 'slate',
}

function ReasonChip({ reason }: { reason: AttentionReason }) {
  return (
    <Chip tone={REASON_TONE[reason.kind]} title={ATTENTION_REASON_DEFINITIONS[reason.kind]}>
      {reason.label}
    </Chip>
  )
}

const FEED_TONE: Record<LiveFeedItem['kind'], { tone: PuTone; label: string }> = {
  person: { tone: 'blue', label: 'Person' },
  organisation: { tone: 'green', label: 'Organisation' },
  ownerAction: { tone: 'purple', label: 'Owner' },
}

function FeedRow({ item, onOpenPerson }: { item: LiveFeedItem; onOpenPerson: (query: string) => void }) {
  const inner = (
    <>
      <Chip tone={FEED_TONE[item.kind].tone}>{FEED_TONE[item.kind].label}</Chip>
      <span className="grow">
        <b>{item.title}</b>
        <span className="block text-[12.5px] text-(--dash-muted)">{item.detail}</span>
      </span>
      <time dateTime={new Date(item.atMs).toISOString()} className="shrink-0 text-[12px] text-(--dash-muted)">
        {formatWhen(item.atMs)}
      </time>
    </>
  )
  if (item.orgId) {
    return (
      <Link href={`/developer/organisations/${encodeURIComponent(item.orgId)}`} className="pu-item">
        {inner}
      </Link>
    )
  }
  if (item.personQuery) {
    const query = item.personQuery
    return (
      <Link href="/developer/users" className="pu-item" onClick={() => onOpenPerson(query)}>
        {inner}
      </Link>
    )
  }
  return <div className="pu-item">{inner}</div>
}

function comparisonLine(current: number, previous: number, period: ConsolePeriodId): string {
  if (period === 'to_date') return 'Since records began'
  return deltaCopy(current, previous).text.replace('vs comparison', 'vs the same stretch of the previous period')
}

function OverviewBody({ overview, period, onOpenPerson }: { overview: OwnerOverviewResponse; period: ConsolePeriodId; onOpenPerson: (query: string) => void }) {
  const { headline, attention, feed } = overview
  const label = overview.range.label.toLowerCase()
  return (
    <>
      {overview.truncated ? (
        <Note tone="amber" role="alert">
          The platform has more organisations or people than one read covers, so these figures may be short.
        </Note>
      ) : null}
      <div className="pu-gridAuto" data-testid="overview-headline">
        <Headline
          metric="activeOrganisations"
          value={formatCount(headline.activeOrganisations.value)}
          lines={[`Seen ${label}`, COMMAND_CENTRE_METRICS.activeOrganisations.comparison.split(':')[0]]}
          href="/developer/organisations"
          linkLabel="Open organisations"
        />
        <Headline
          metric="activePeople"
          value={formatCount(headline.activePeople.value)}
          lines={[`Seen ${label}`, COMMAND_CENTRE_METRICS.activePeople.comparison.split(':')[0]]}
          href="/developer/users"
          linkLabel="Open people"
        />
        <Headline
          metric="mrr"
          value={formatGbpFromPence(headline.mrr.pence)}
          lines={[
            `${headline.mrr.payingOrganisations} paying · ${headline.mrr.trials} on trial (not counted)`,
            COMMAND_CENTRE_METRICS.mrr.comparison.split(':')[0],
          ]}
          href="/developer/revenue"
          linkLabel="Open revenue"
        />
        <Headline
          metric="newPeople"
          value={formatCount(headline.newPeople.value)}
          lines={[`Created ${label}`, comparisonLine(headline.newPeople.value, headline.newPeople.previous, period)]}
          href="/developer/users"
          linkLabel="Open people"
        />
        <Headline
          metric="newOrganisations"
          value={formatCount(headline.newOrganisations.value)}
          lines={[`Created ${label}`, comparisonLine(headline.newOrganisations.value, headline.newOrganisations.previous, period)]}
          href="/developer/organisations"
          linkLabel="Open organisations"
        />
      </div>
      {headline.mrr.missing.length ? (
        <Note tone="amber">
          <p>
            {headline.mrr.missing.length} paying organisation{headline.mrr.missing.length === 1 ? ' has' : 's have'} no MRR stored, so MRR
            above is short (it is never filled in from the list price):{' '}
            {headline.mrr.missing.map((org, index) => (
              <span key={org.id}>
                {index ? ', ' : ''}
                <Link className="pu-link" href={`/developer/organisations/${encodeURIComponent(org.id)}`}>
                  {org.name}
                </Link>
              </span>
            ))}
            .
          </p>
        </Note>
      ) : null}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card
          title="Organisations needing attention"
          subtitle="Scheduled for deletion, payment failed, trial ending, cancelling, setup unfinished, quiet for 14 days or more"
          count={attention.length}
        >
          <div className="px-[18px] pt-2">
            <Definition text={Object.values(ATTENTION_REASON_DEFINITIONS).join(' ')} label="Organisations needing attention" />
          </div>
          {attention.length === 0 ? (
            <EmptyState title="Nothing needs attention" description="No organisation is scheduled for deletion, behind on payment, ending a trial, unfinished or quiet." />
          ) : (
            <ul className="pu-list" data-testid="overview-attention">
              {attention.map((row) => (
                <li key={row.orgId}>
                  <Link href={`/developer/organisations/${encodeURIComponent(row.orgId)}`} className="pu-item">
                    <span className="grow">
                      <b>{row.name}</b>
                      <span className="mt-1 flex flex-wrap gap-1.5">
                        {row.reasons.map((reason) => (
                          <ReasonChip key={reason.kind} reason={reason} />
                        ))}
                      </span>
                    </span>
                    <span aria-hidden="true" className="text-(--dash-muted)">
                      ›
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Live feed" subtitle="New people, new organisations and owner actions, newest first" count={feed.length}>
          <div className="px-[18px] pt-2">
            <Definition text={LIVE_FEED_DEFINITION} label="the live feed" />
          </div>
          {overview.auditError ? (
            <div className="px-[18px] pt-2">
              <Note tone="amber">{overview.auditError} New people and organisations are still listed.</Note>
            </div>
          ) : null}
          {feed.length === 0 ? (
            <EmptyState title="Nothing yet" description="New people, organisations and owner actions appear here as they happen." />
          ) : (
            <ul className="pu-list" data-testid="overview-feed">
              {feed.map((item) => (
                <li key={item.id}>
                  <FeedRow item={item} onOpenPerson={onOpenPerson} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
      <p className="text-[12.5px] text-(--dash-muted)" data-testid="overview-coming">
        Signed timesheet value and its 12-month chart arrive with the Timesheet value page (PR 6); people per day with the web / iPhone
        split with the daily record (PR 6); Waiting on you with Needs you (PR 3). Until then the old figures, including the old timesheet
        value, are on{' '}
        <Link href="/developer/growth" className="pu-link">
          Growth
        </Link>
        .
      </p>
    </>
  )
}

/** Owner console Overview (spec §4.1, PLAN §8 PR 2). Read-only; every figure links to its list. */
export function DeveloperOverviewScreen() {
  const period = useConsolePrefs((state) => state.period)
  const includeTestData = useConsolePrefs((state) => state.includeTestData)
  const setJumpQuery = useConsolePrefs((state) => state.setJumpQuery)
  const { overview, error, loading, refresh } = useOwnerOverview(period, includeTestData)
  // The last answer stays while a new period loads; it is only shown once it matches the chosen period.
  const current = overview && overview.period === period ? overview : null

  return (
    <DeveloperShell
      title="Overview"
      actions={
        <div className="flex flex-wrap items-center gap-2">
          {current ? <p className="text-xs text-(--dash-muted)">Updated {formatWhen(current.countedAt)}</p> : null}
          <button type="button" className="btn sm ghost" onClick={refresh} disabled={loading}>
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      }
    >
      {error ? (
        <Note tone="red" role="alert">
          {error}
        </Note>
      ) : null}
      {current ? (
        <OverviewBody overview={current} period={period} onOpenPerson={setJumpQuery} />
      ) : error ? null : (
        <LoadingSpinner label="Loading the overview…" />
      )}
    </DeveloperShell>
  )
}
