'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import type { OperativeBookingClashWarning } from '@/lib/scheduling/bookingClashUtils'
import type { ManagerBookingClashWarning } from '@/lib/warnings/managerClashWarnings'
import type { MissedMaterialOrderWarning } from '@/lib/warnings/materialOrderWarnings'
import { groupUnbookedWarningsByDay, type UnbookedLabourWarning } from '@/lib/warnings/unbookedLabourWarnings'
import { formatWarningHours } from '@/lib/warnings/clashIntervals'
import type { QualificationExpiryWarning, UnverifiedOperativeWarning } from '@/lib/warnings/generateOrgWarnings'
import type { LeaveCoverageWarning } from '@/lib/warnings/leaveCoverageWarnings'
import { formatClockMinutes } from '@/lib/canonical'
import { projectMaterialsPath } from '@/lib/navigation/projectSchedulePaths'
import { ClashWarningCard } from '@/components/warnings/ClashWarningCard'
import { displayTitle, type ClashTimelineEntry } from '@/lib/warnings/clashTimeline'
import { hasAdminAccess } from '@/lib/permissions'
import type { Operative, User } from '@/types'
import { initialsFrom } from '@/lib/daily-overview/buildDailyOverview'
import { dayKey, formatLongDay } from '@/lib/ios-parity/londonTime'
import { addDoc, collection, serverTimestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase/config'
import { useAuthStore } from '@/lib/stores/authStore'

type FilterChip = 'all' | 'clashes' | 'unbooked' | 'leave' | 'materials' | 'qualifications'

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
          {people.length} {people.length === 1 ? 'person is' : 'people are'} not booked on{' '}
          <b>{formatLongDay(date)}</b>.
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
              href={`/dashboard/book-labour?date=${dayKey(date)}&from=warnings&focus=${encodeURIComponent(
                people.map((person) => person.userId || person.operativeId).filter(Boolean).join(',')
              )}`}
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
  const organization = useAuthStore((state) => state.organization)
  const user = useAuthStore((state) => state.user)
  const [hidden, setHidden] = useState(false)
  const [dismissing, setDismissing] = useState(false)
  if (hidden) return null

  async function dismiss() {
    if (dismissing) return
    setDismissing(true)
    const name = [user?.firstName, user?.surname].filter(Boolean).join(' ').trim() || user?.email || 'Someone'
    if (organization?.id) {
      try {
        await addDoc(collection(db, 'organizations', organization.id, 'notifications'), {
          organizationId: organization.id,
          type: 'warning_removed',
          title: `Warning dismissed by ${name}`,
          message: `${name} dismissed a materials cut-off warning. Dismissed warnings do not reappear.\n\n${warning.message}`,
          isRead: false,
          createdAt: serverTimestamp(),
          requiresPermission: 'hasAdminAccess',
        })
      } catch {
        // The card still leaves this device, matching an iPhone dismiss.
      }
    }
    setHidden(true)
  }

  return (
    <section className="card" data-hue="sw">
      <div className="card-h">
        <div className="ico-chip sm">
          <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 7.5l-9-4.5L3 7.5m18 0-9 4.5m9-4.5v9l-9 4.5M3 7.5l9 4.5M3 7.5v9l9 4.5m0-9v9" />
          </svg>
        </div>
        <h2 className="h2 grow">{warning.title}</h2>
        <span className="pill" data-hue="lib">LOW</span>
      </div>
      <div className="card-b stack" style={{ gap: 10 }}>
        <p className="small">{warning.message}</p>
        <p><b>{warning.projectLabel}</b></p>
        <p className="muted small">Managers should confirm material lists with site teams.</p>
        <div className="row" style={{ gap: 8 }}>
          <button type="button" className="btn" onClick={() => void dismiss()} disabled={dismissing}>
            Dismiss
          </button>
          <Link href={projectMaterialsPath(warning.projectId, smallWorkIds)} className="btn primary">
            Open materials
          </Link>
        </div>
      </div>
    </section>
  )
}

function LeaveCard({ warning, canBook }: { warning: LeaveCoverageWarning; canBook: boolean }) {
  const isClash = warning.kind === 'leave_clash'
  const hue = isClash ? 'red' : 'warn'
  const range = (interval: { start: number; end: number }) =>
    `${formatClockMinutes(interval.start)}–${formatClockMinutes(interval.end)}`
  return (
    <section className="card" data-hue={hue}>
      <div className="card-h">
        <div className="ico-chip sm">
          <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364-.707-.707M6.343 6.343l-.707-.707m12.728 0-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
        </div>
        <h2 className="h2 grow">{warning.title}</h2>
        <span className="pill" data-hue={hue}>
          {isClash ? 'HIGH' : 'MEDIUM'}
        </span>
      </div>
      <div className="card-b stack" style={{ gap: 10 }}>
        <div className="ritem accent" data-hue={hue} style={{ cursor: 'default' }}>
          <Avatar name={warning.personName} />
          <span className="grow">
            <span className="t">{warning.personName}</span>
            <span className="s">
              {warning.leaveLabel} annual leave · {formatLongDay(warning.date)}
            </span>
          </span>
          {!isClash ? (
            <span className="pill solid" data-hue="red">
              −{formatWarningHours(warning.missingHours)}h
            </span>
          ) : null}
        </div>
        <p className="small">{warning.message}</p>
        {isClash ? (
          <ul className="small" style={{ paddingLeft: 18, margin: 0 }}>
            {warning.clashes.map((clash) => (
              <li key={clash.bookingId}>
                <b>{clash.label}</b> {range(clash)} overlaps leave {range({ start: clash.overlapStart, end: clash.overlapEnd })}
              </li>
            ))}
          </ul>
        ) : warning.workingWindow ? (
          <p className="muted small">
            Working half: {range(warning.workingWindow)} · Not booked: {warning.missing.map(range).join(', ')}
          </p>
        ) : null}
        <div className="row wrap" style={{ paddingTop: 2 }}>
          {canBook && !isClash ? (
            <Link
              href={`/dashboard/book-labour?date=${warning.dayKey}&from=warnings&focus=${encodeURIComponent(
                warning.userId || warning.operativeId || ''
              )}`}
              className="btn primary"
            >
              Book the {warning.leaveSlot === 'PM' ? 'AM' : 'PM'}
            </Link>
          ) : null}
          <Link href={`/dashboard/daily-overview?date=${warning.dayKey}`} className="btn">
            Open daily overview
          </Link>
          <Link href="/dashboard/annual-leave" className="btn">
            Annual leave
          </Link>
        </div>
      </div>
    </section>
  )
}

function QualificationCard({
  warning,
  onDismiss,
}: {
  warning: QualificationExpiryWarning
  onDismiss?: (warning: QualificationExpiryWarning) => Promise<void>
}) {
  const [busy, setBusy] = useState(false)
  const expired = warning.daysUntilExpiry < 0
  const dismiss = async () => {
    if (!onDismiss || busy) return
    setBusy(true)
    try {
      await onDismiss(warning)
    } finally {
      setBusy(false)
    }
  }
  return (
    <section className="card" data-hue="lib">
      <div className="card-h">
        <div className="ico-chip sm">
          <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
        </div>
        <h2 className="h2 grow">{warning.title}</h2>
        <span className="pill" data-hue="lib">LOW</span>
      </div>
      <div className="card-b stack" style={{ gap: 10 }}>
        <p>{warning.message}</p>
        <div className="row" style={{ gap: 8 }}>
          {expired && onDismiss ? (
            <button type="button" className="btn" onClick={() => void dismiss()} disabled={busy}>
              {busy ? 'Dismissing…' : 'Dismiss'}
            </button>
          ) : null}
          <Link href={`/dashboard/operatives/${warning.operativeId}`} className="btn primary">
            Open operative
          </Link>
        </div>
        {expired ? (
          <p className="muted small">Dismissing hides this on web and iOS until a new expiry date is saved.</p>
        ) : null}
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
  leaveWarnings = [],
  materialWarnings,
  qualificationWarnings = [],
  unverifiedWarnings = [],
  loading,
  user,
  operatives: _operatives,
  smallWorkIds,
  onAcceptClash,
  onDismissQualification,
  onDeleteBooking,
  onDeleteManagerBooking,
}: {
  organizationName: string
  clashWarnings: OperativeBookingClashWarning[]
  managerClashWarnings: ManagerBookingClashWarning[]
  unbookedWarnings: UnbookedLabourWarning[]
  leaveWarnings?: LeaveCoverageWarning[]
  materialWarnings: MissedMaterialOrderWarning[]
  qualificationWarnings?: QualificationExpiryWarning[]
  unverifiedWarnings?: UnverifiedOperativeWarning[]
  loading?: boolean
  user: User | null
  operatives: Operative[]
  smallWorkIds: ReadonlySet<string>
  onAcceptClash: (clash: { id: string; bookingAId: string; bookingBId: string }) => Promise<void>
  onDismissQualification?: (warning: QualificationExpiryWarning) => Promise<void>
  onDeleteBooking: (bookingId: string) => Promise<void>
  onDeleteManagerBooking: (bookingId: string) => Promise<void>
}) {
  const [filter, setFilter] = useState<FilterChip>('all')
  const [busyId, setBusyId] = useState<string | null>(null)
  const canBook = Boolean(user && (hasAdminAccess(user) || user.permissions?.manager))
  const isAdmin = Boolean(user && hasAdminAccess(user))

  const unbookedGroups = useMemo(() => groupUnbookedWarningsByDay(unbookedWarnings), [unbookedWarnings])
  const leaveClashCount = leaveWarnings.filter((warning) => warning.kind === 'leave_clash').length
  const leaveCoverCount = leaveWarnings.length - leaveClashCount
  const clashCount = clashWarnings.length + managerClashWarnings.length
  const qualificationCount = qualificationWarnings.length + unverifiedWarnings.length
  const highCount = clashWarnings.length + unbookedWarnings.length + leaveClashCount
  const mediumCount = managerClashWarnings.length + leaveCoverCount
  const lowCount = materialWarnings.length + qualificationCount
  const allCount = highCount + mediumCount + lowCount

  const chips: { value: FilterChip; label: string; count: number }[] = [
    { value: 'all', label: 'All', count: allCount },
    { value: 'clashes', label: 'Clashes', count: clashCount },
    { value: 'unbooked', label: 'Unbooked', count: unbookedWarnings.length },
    { value: 'leave', label: 'Annual leave', count: leaveWarnings.length },
    { value: 'materials', label: 'Materials', count: materialWarnings.length },
    { value: 'qualifications', label: 'Qualifications', count: qualificationCount },
  ]

  const showClashes = filter === 'all' || filter === 'clashes'
  const showUnbooked = filter === 'all' || filter === 'unbooked'
  const showLeave = filter === 'all' || filter === 'leave'
  const showMaterials = filter === 'all' || filter === 'materials'
  const showQualifications = filter === 'all' || filter === 'qualifications'

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
            {organizationName} · Separate from the weekly report.
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

      {allCount > 0 ? (
        <section className="hero" data-hue="red" style={{ padding: '22px 26px' }}>
          <div className="relative z-[1]">
            <div className="row" style={{ alignItems: 'flex-start' }}>
              <div className="grow">
                <p className="eb">Active issues</p>
                <div className="big" style={{ fontSize: 28 }}>{allCount} need attention</div>
                <p className="small" style={{ marginTop: 8, maxWidth: 640 }}>
                  High: operative booking clashes, unbooked labour &amp; bookings during annual leave · Medium:
                  manager/admin overlaps &amp; half-day leave not covered · Low: materials and qualifications
                </p>
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
                <div className="xs" style={{ opacity: 0.75, marginTop: 2 }}>Clashes, unbooked labour & leave clashes</div>
              </button>
              <button type="button" className="st" onClick={() => setFilter('clashes')}>
                <b>{mediumCount}</b>
                <span>Medium</span>
                <div className="xs" style={{ opacity: 0.75, marginTop: 2 }}>Manager/admin overlaps & half-day leave cover</div>
              </button>
              <button type="button" className="st" onClick={() => setFilter('all')}>
                <b>{lowCount}</b>
                <span>Low</span>
                <div className="xs" style={{ opacity: 0.75, marginTop: 2 }}>Materials and qualifications</div>
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
              <p className="text-[18px] font-semibold">Scanning for warnings…</p>
              <p className="mx-auto mt-2 max-w-md text-[14px] text-[var(--ink3)]">
                Keep this screen open until results appear.
              </p>
            </>
          ) : (
            <>
              <p className="text-[40px] text-[#0F6E56]">✓</p>
              <p className="mt-2 text-[18px] font-semibold">No active warnings</p>
              <p className="mx-auto mt-2 max-w-md text-[14px] text-[var(--ink3)]">
                High: operative booking clashes, unbooked labour and bookings during annual leave. Medium:
                manager/admin overlaps and half-day leave not covered. Low: materials and qualifications.
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

      {showLeave
        ? leaveWarnings.map((warning) => <LeaveCard key={warning.id} warning={warning} canBook={canBook} />)
        : null}

      {showMaterials
        ? materialWarnings.map((warning) => (
            <MaterialsCard key={warning.id} warning={warning} smallWorkIds={smallWorkIds} />
          ))
        : null}

      {showQualifications
        ? qualificationWarnings.map((warning) => (
            <QualificationCard key={warning.id} warning={warning} onDismiss={onDismissQualification} />
          ))
        : null}

      {showQualifications
        ? unverifiedWarnings.map((warning) => (
            <LegacyCard
              key={warning.id}
              title="Unverified operative"
              message={warning.message}
              severity="low"
            />
          ))
        : null}

      {showClashes
        ? managerClashWarnings.map((warning) => (
            <ClashWarningCard
              key={warning.id}
              title="Manager booking clash"
              severity="medium"
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
