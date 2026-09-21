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

function PriorityBadge({ level }: { level: 'high' | 'medium' | 'low' }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-white/18 px-2.5 py-1 text-[11px] font-bold text-white ring-1 ring-white/28">
      <svg className="h-3 w-3" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 3 2 21h20L12 3Zm1 14h-2v2h2v-2Zm0-8h-2v6h2V9Z" />
      </svg>
      {level.toUpperCase()}
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
    <article className="card overflow-hidden">
      <header className="flex items-center gap-2 bg-gradient-to-br from-[#7F1D1D] to-[#B91C1C] px-4 py-4">
        <p className="min-w-0 flex-1 text-[17px] font-extrabold tracking-tight text-white">Unbooked labour</p>
        <PriorityBadge level="high" />
      </header>
      <div className="px-4 pb-1 pt-4">
        <p className="pb-3 text-[13px] font-semibold leading-5 text-[#374151]">
          {people.length} {people.length === 1 ? 'person is' : 'people are'} missing hours on{' '}
          <span className="font-bold">{formatLongDay(date)}</span> and are below the standard paid day.
        </p>
        {parsed.map((person, index) => (
          <div
            key={person.id}
            className={`flex items-center gap-2.5 py-2.5 ${index > 0 ? 'border-t border-black/[0.06]' : ''}`}
          >
            <Avatar name={person.name} />
            <p className="min-w-0 flex-1 text-[13px] font-semibold">{person.name}</p>
            {person.badge ? (
              <span className="rounded-lg border border-[#FDE2E2] bg-[#FEF2F2] px-2 py-0.5 text-[11px] font-bold text-[#DC2626]">
                {person.badge}
              </span>
            ) : null}
          </div>
        ))}
      </div>
      <div className="space-y-2.5 bg-[#FAFAFA] px-3.5 py-3.5">
        {canBook ? (
          <Link
            href={`/dashboard/book-labour?date=${dayKey(date)}&from=warnings`}
            className="flex w-full items-center justify-center gap-2 rounded-[13px] bg-gradient-to-r from-[#1D4ED8] to-[#2563EB] py-3.5 text-[15px] font-bold text-white shadow-[0_3px_12px_rgba(37,99,235,0.28)]"
          >
            Book labour for this day
          </Link>
        ) : null}
        <div className="flex overflow-hidden rounded-xl border border-black/10 bg-white">
          <Link
            href={`/dashboard/daily-overview?date=${dayKey(date)}`}
            className="flex-1 py-3 text-center text-[13px] font-semibold text-[#2563EB]"
          >
            Open daily overview
          </Link>
        </div>
      </div>
    </article>
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
    <article className="card overflow-hidden">
      <header className="flex items-center gap-2 bg-gradient-to-br from-[#374151] to-[#4B5563] px-4 py-4">
        <p className="min-w-0 flex-1 text-[17px] font-extrabold text-white">Missed material order</p>
        <PriorityBadge level="low" />
      </header>
      <div className="space-y-2.5 px-4 py-4">
        <p className="text-[13px] font-semibold text-[#374151]">{warning.message}</p>
        <p className="text-[13px] font-semibold">{warning.projectLabel}</p>
        <p className="text-[12px] text-ios-muted">Managers should confirm material lists with site teams.</p>
      </div>
      <div className="bg-[#FAFAFA] px-3.5 py-3.5">
        <Link
          href={projectMaterialsPath(warning.projectId, smallWorkIds)}
          className="flex w-full items-center justify-center rounded-[13px] bg-gradient-to-r from-[#1D4ED8] to-[#2563EB] py-3 text-[14px] font-bold text-white"
        >
          Open materials
        </Link>
      </div>
    </article>
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
  return (
    <article className="overflow-hidden rounded-[15px] border border-black/[0.07] bg-white shadow-[0_2px_8px_rgba(0,0,0,0.08)]">
      <header className="flex items-center gap-2.5 bg-gradient-to-b from-[#4B5563] to-[#374151] px-3.5 py-2.5">
        <p className="min-w-0 flex-1 text-[16.5px] font-semibold tracking-tight text-white">{title}</p>
        <PriorityBadge level={severity} />
      </header>
      <div className="px-3.5 py-3.5">
        <p className="text-[14px] text-[#121B23]">{message}</p>
      </div>
    </article>
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
          <div className="sub">{organizationName}</div>
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
            <p className="eb">Active issues</p>
            <div className="big" style={{ fontSize: 28 }}>{coreCount} need attention</div>
            <div className="stats">
              <div className="st"><b>{highCount}</b><span>High</span></div>
              <div className="st"><b>0</b><span>Medium</span></div>
              <div className="st"><b>{lowCount}</b><span>Low</span></div>
            </div>
            <p className="mt-3 text-[13px] opacity-85">
              High: booking clashes and unbooked labour. Low: materials not ordered by cut-off.
            </p>
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
              <p className="mx-auto mt-2 max-w-md text-[14px] text-ios-muted">
                Scanning today and tomorrow. Results stay on Home and Weekly Report once they land.
              </p>
            </>
          ) : (
            <>
              <p className="text-[40px] text-[#0F6E56]">✓</p>
              <p className="mt-2 text-[18px] font-semibold">No active warnings</p>
              <p className="mx-auto mt-2 max-w-md text-[14px] text-ios-muted">
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

function HeroStat({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-xl bg-white/14 px-2.5 py-2.5 ring-1 ring-white/12">
      <p className="text-[22px] font-bold">{value}</p>
      <p className="text-[11px] font-medium text-white/65">{label}</p>
    </div>
  )
}
