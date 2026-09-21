'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { format } from 'date-fns/format'
import type { OperativeBookingClashWarning } from '@/lib/scheduling/bookingClashUtils'
import type { ManagerBookingClashWarning } from '@/lib/warnings/managerClashWarnings'
import type { MissedMaterialOrderWarning } from '@/lib/warnings/materialOrderWarnings'
import { groupUnbookedWarningsByDay, type UnbookedLabourWarning } from '@/lib/warnings/unbookedLabourWarnings'
import { formatWarningHours } from '@/lib/warnings/clashIntervals'
import type { QualificationExpiryWarning, UnverifiedOperativeWarning } from '@/lib/warnings/generateOrgWarnings'
import { projectMaterialsPath } from '@/lib/navigation/projectSchedulePaths'
import { ClashWarningCard } from '@/components/warnings/ClashWarningCard'
import { displayTitle, type ClashTimelineEntry } from '@/lib/warnings/clashTimeline'
import { hasAdminAccess } from '@/lib/permissions'
import type { Operative, User } from '@/types'
import { initialsFrom } from '@/lib/daily-overview/buildDailyOverview'
import { dayKey } from '@/lib/ios-parity/londonTime'

type FilterChip = 'all' | 'clashes' | 'unbooked' | 'materials'

const AVATAR_COLORS = ['#2C5BBF', '#4B7A5C', '#7A4B8C', '#B35614', '#2563EB', '#9E2A2A']

function avatarColor(name: string): string {
  const hash = [...name].reduce((sum, ch) => sum + ch.charCodeAt(0), 0)
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

function parseUnbookedPerson(raw: string): { name: string; badge: string | null } {
  const match = raw.match(/^(.*) \(missing (.+)\)$/)
  if (!match) return { name: raw, badge: null }
  let hours = match[2].replace(/\.0h$/, 'h')
  if (!hours.endsWith('h')) hours += 'h'
  return { name: match[1], badge: `−${hours}` }
}

function formatLongDay(date: Date): string {
  return format(date, 'd MMM yyyy')
}

function Avatar({ name, size = 32 }: { name: string; size?: number }) {
  return (
    <span
      className="grid shrink-0 place-items-center rounded-full font-bold text-white"
      style={{ width: size, height: size, fontSize: size < 30 ? 10 : 11, background: avatarColor(name) }}
    >
      {initialsFrom(name)}
    </span>
  )
}

function UnbookedDayCard({
  date,
  people,
  canBook,
}: {
  date: Date
  people: UnbookedLabourWarning[]
  canBook: boolean
}) {
  const parsed = people.map((person) => ({
    ...parseUnbookedPerson(`${person.operativeName} (missing ${formatWarningHours(person.missingHours)}h)`),
    id: person.id,
    message: person.message,
  }))
  return (
    <section className="card" data-hue="warn">
      <div className="card-h">
        <div className="ico-chip sm">
          <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
        </div>
        <h2 className="h2 grow">Unbooked labour</h2>
        <span className="pill" data-hue="red">HIGH</span>
      </div>
      <div className="card-b rows">
        <p className="small" style={{ marginBottom: 4 }}>
          {people.length} {people.length === 1 ? 'person is' : 'people are'} missing hours on{' '}
          <b>{formatLongDay(date)}</b> and are below the standard paid day.
        </p>
        {parsed.map((person) => (
          <div key={person.id} className="ritem accent" data-hue="warn" style={{ cursor: 'default' }}>
            <Avatar name={person.name} />
            <span className="grow">
              <span className="t">{person.name}</span>
              <span className="s">Unbooked labour</span>
            </span>
            {person.badge ? (
              <span className="pill solid" data-hue="red">
                {person.badge}
              </span>
            ) : null}
          </div>
        ))}
        <div className="row wrap" style={{ paddingTop: 4 }}>
          {canBook ? (
            <Link
              href={`/dashboard/book-labour?date=${dayKey(date)}&from=warnings`}
              className="btn primary"
            >
              Book labour for this day
            </Link>
          ) : null}
          <Link href={`/dashboard/daily-overview?date=${dayKey(date)}`} className="btn">
            Open daily overview
          </Link>
        </div>
      </div>
    </section>
  )
}

function MaterialsCard({
  warning,
  smallWorkIds,
}: {
  warning: MissedMaterialOrderWarning
  smallWorkIds: ReadonlySet<string>
}) {
  return (
    <section className="card" data-hue="sw">
      <div className="card-h">
        <div className="ico-chip sm">
          <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 7.5l-9-4.5L3 7.5m18 0-9 4.5m9-4.5v9l-9 4.5M3 7.5l9 4.5M3 7.5v9l9 4.5m0-9v9" />
          </svg>
        </div>
        <h2 className="h2 grow">Missed material order</h2>
        <span className="pill" data-hue="lib">LOW</span>
      </div>
      <div className="card-b stack" style={{ gap: 10 }}>
        <p className="small">{warning.message}</p>
        <p><b>{warning.projectLabel}</b></p>
        <p className="muted small">Managers should confirm material lists with site teams.</p>
        <Link href={projectMaterialsPath(warning.projectId, smallWorkIds)} className="btn primary">
          Open materials
        </Link>
      </div>
    </section>
  )
}

function LegacyCard({
  title,
  message,
  severity,
}: {
  title: string
  message: string
  severity: 'high' | 'medium' | 'low'
}) {
  const hue = severity === 'high' ? 'red' : severity === 'medium' ? 'warn' : 'lib'
  return (
    <section className="card" data-hue={hue}>
      <div className="card-h">
        <div className="ico-chip sm">
          <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
        </div>
        <h2 className="h2 grow">{title}</h2>
        <span className="pill" data-hue={hue}>
          {severity.toUpperCase()}
        </span>
      </div>
      <div className="card-b">
        <p>{message}</p>
      </div>
    </section>
  )
}

export function WarningsScreen({
  organizationName,
  clashWarnings,
  managerClashWarnings,
  unbookedWarnings,
  materialWarnings,
  qualificationWarnings = [],
  unverifiedWarnings = [],
  loading,
  user,
  operatives: _operatives,
  smallWorkIds,
  onAcceptClash,
  onDeleteBooking,
  onDeleteManagerBooking,
}: {
  organizationName: string
  clashWarnings: OperativeBookingClashWarning[]
  managerClashWarnings: ManagerBookingClashWarning[]
  unbookedWarnings: UnbookedLabourWarning[]
  materialWarnings: MissedMaterialOrderWarning[]
  qualificationWarnings?: QualificationExpiryWarning[]
  unverifiedWarnings?: UnverifiedOperativeWarning[]
  loading?: boolean
  user: User | null
  operatives: Operative[]
  smallWorkIds: ReadonlySet<string>
  onAcceptClash: (clash: { id: string; bookingAId: string; bookingBId: string }) => Promise<void>
  onDeleteBooking: (bookingId: string) => Promise<void>
  onDeleteManagerBooking: (bookingId: string) => Promise<void>
}) {
  const [filter, setFilter] = useState<FilterChip>('all')
  const [busyId, setBusyId] = useState<string | null>(null)
  const canBook = Boolean(user && (hasAdminAccess(user) || user.permissions?.manager))
  const isAdmin = Boolean(user && hasAdminAccess(user))

  const unbookedGroups = useMemo(() => groupUnbookedWarningsByDay(unbookedWarnings), [unbookedWarnings])
  const clashCount = clashWarnings.length + managerClashWarnings.length
  const highCount = clashCount + unbookedWarnings.length
  const lowCount = materialWarnings.length
  const coreCount = highCount + lowCount
  const allCount = coreCount + qualificationWarnings.length + unverifiedWarnings.length

  const chips: { value: FilterChip; label: string; count: number }[] = [
    { value: 'all', label: 'All', count: allCount },
    { value: 'clashes', label: 'Clashes', count: clashCount },
    { value: 'unbooked', label: 'Unbooked', count: unbookedWarnings.length },
    { value: 'materials', label: 'Materials', count: lowCount },
  ]

  const showClashes = filter === 'all' || filter === 'clashes'
  const showUnbooked = filter === 'all' || filter === 'unbooked'
  const showMaterials = filter === 'all' || filter === 'materials'

  const handleAccept = async (clash: { id: string; bookingAId: string; bookingBId: string }) => {
    setBusyId(clash.id)
    try {
      await onAcceptClash(clash)
    } finally {
      setBusyId(null)
    }
  }

  const handleRemoveEntry = async (entry: ClashTimelineEntry) => {
    const label = displayTitle(entry)
    if (!window.confirm(`Delete the booking for ${label}?`)) return
    const id = entry.managerBookingId || entry.bookingId
    setBusyId(id)
    try {
      if (entry.managerBookingId) await onDeleteManagerBooking(entry.managerBookingId)
      else await onDeleteBooking(entry.bookingId)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="stack" data-hue="warn">
      <div className="phead" data-hue="warn">
        <div className="badge-ico">
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
        </div>
        <div>
          <h1>Warnings</h1>
          <div className="sub">
            {organizationName} · Live issues from today forward. Separate from the weekly report.
          </div>
        </div>
        <div className="acts">
          {isAdmin ? (
            <Link href="/dashboard/settings/warnings" className="btn">
              Warning settings
            </Link>
          ) : null}
        </div>
      </div>

      {coreCount > 0 ? (
        <section className="hero" data-hue="red" style={{ padding: '22px 26px' }}>
          <div className="relative z-[1]">
            <div className="row" style={{ alignItems: 'flex-start' }}>
              <div className="grow">
                <p className="eb">Active issues</p>
                <div className="big" style={{ fontSize: 28 }}>{coreCount} need attention</div>
              </div>
              {canBook ? (
                <Link href="/dashboard/book-labour?from=warnings" className="btn hbtn solid">
                  Book labour
                </Link>
              ) : null}
            </div>
            <div className="stats">
              <button type="button" className="st" onClick={() => setFilter('all')}>
                <b>{highCount}</b>
                <span>High</span>
                <div className="xs" style={{ opacity: 0.75, marginTop: 2 }}>Booking clashes & unbooked labour</div>
              </button>
              <div className="st">
                <b>0</b>
                <span>Medium</span>
              </div>
              <button type="button" className="st" onClick={() => setFilter('materials')}>
                <b>{lowCount}</b>
                <span>Low</span>
                <div className="xs" style={{ opacity: 0.75, marginTop: 2 }}>Materials not ordered by cut-off</div>
              </button>
            </div>
          </div>
        </section>
      ) : null}

      {allCount > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {chips.map((chip) => (
            <button
              key={chip.value}
              type="button"
              onClick={() => setFilter(chip.value)}
              className={`chip ${filter === chip.value ? 'on' : ''}`}
            >
              {chip.label} · {chip.count}
            </button>
          ))}
        </div>
      ) : null}

      {allCount === 0 ? (
        <div className="empty card pad">
          {loading ? (
            <>
              <p className="text-[18px] font-semibold">Check for warnings</p>
              <p className="mx-auto mt-2 max-w-md text-[14px] text-[var(--ink3)]">
                Scanning today and tomorrow. Results stay on Home and Weekly Report once they land.
              </p>
            </>
          ) : (
            <>
              <p className="text-[40px] text-[#0F6E56]">✓</p>
              <p className="mt-2 text-[18px] font-semibold">No active warnings</p>
              <p className="mx-auto mt-2 max-w-md text-[14px] text-[var(--ink3)]">
                High: operative, manager, and admin booking clashes plus unbooked labour. Tick a clash to note it on
                the weekly report. Low: material orders not placed by 16:00.
              </p>
            </>
          )}
        </div>
      ) : null}

      {showUnbooked
        ? unbookedGroups.map((group) => (
            <UnbookedDayCard key={group.id} date={group.date} people={group.people} canBook={canBook} />
          ))
        : null}

      {showMaterials
        ? materialWarnings.map((warning) => (
            <MaterialsCard key={warning.id} warning={warning} smallWorkIds={smallWorkIds} />
          ))
        : null}

      {filter === 'all'
        ? qualificationWarnings.map((warning) => (
            <LegacyCard
              key={warning.id}
              title="Qualification expiry"
              message={warning.message}
              severity={warning.severity}
            />
          ))
        : null}

      {filter === 'all'
        ? unverifiedWarnings.map((warning) => (
            <LegacyCard
              key={warning.id}
              title="Unverified operative"
              message={warning.message}
              severity="medium"
            />
          ))
        : null}

      {showClashes
        ? managerClashWarnings.map((warning) => (
            <ClashWarningCard
              key={warning.id}
              title="Manager booking clash"
              personName={warning.personName}
              date={warning.date}
              entries={warning.entries}
              busy={
                busyId === warning.id ||
                busyId === warning.bookingAId ||
                busyId === warning.bookingBId
              }
              onApprove={() => handleAccept(warning)}
              onRemove={handleRemoveEntry}
            />
          ))
        : null}

      {showClashes
        ? clashWarnings.map((clash) => (
            <ClashWarningCard
              key={clash.id}
              title="Operative booking clash"
              personName={clash.operativeName}
              date={clash.date}
              entries={clash.entries}
              busy={busyId === clash.id || busyId === clash.bookingAId || busyId === clash.bookingBId}
              onApprove={() => handleAccept(clash)}
              onRemove={handleRemoveEntry}
            />
          ))
        : null}
    </div>
  )
}
