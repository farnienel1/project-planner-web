'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { format } from 'date-fns/format'
import { isToday } from 'date-fns/isToday'
import type { OperativeBookingClashWarning } from '@/lib/scheduling/bookingClashUtils'
import type { ManagerBookingClashWarning } from '@/lib/warnings/managerClashWarnings'
import type { MissedMaterialOrderWarning } from '@/lib/warnings/materialOrderWarnings'
import { groupUnbookedWarningsByDay, type UnbookedLabourWarning } from '@/lib/warnings/unbookedLabourWarnings'
import { formatWarningHours } from '@/lib/warnings/clashIntervals'
import type { QualificationExpiryWarning, UnverifiedOperativeWarning } from '@/lib/warnings/generateOrgWarnings'
import {
  projectSchedulePath,
  projectMaterialsPath,
  projectScheduleOpenLabel,
} from '@/lib/navigation/projectSchedulePaths'
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

function formatDayLabel(date: Date): string {
  if (isToday(date)) return 'Today'
  return format(date, 'EEE d MMM')
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

function ClashCard({
  title,
  personName,
  date,
  locationA,
  locationB,
  message,
  projectPathA,
  projectPathB,
  labelA,
  labelB,
  busy,
  onAccept,
  onDeleteA,
  onDeleteB,
}: {
  title: string
  personName: string
  date: Date
  locationA: string
  locationB: string
  message: string
  projectPathA?: string
  projectPathB?: string
  labelA?: string
  labelB?: string
  busy?: boolean
  onAccept?: () => Promise<void>
  onDeleteA?: () => Promise<void>
  onDeleteB?: () => Promise<void>
}) {
  return (
    <article className="overflow-hidden rounded-[15px] border border-black/[0.07] bg-white shadow-[0_2px_8px_rgba(0,0,0,0.08)]">
      <header className="flex items-center gap-2.5 bg-gradient-to-b from-[#B3261E] to-[#8C1A14] px-3.5 py-2.5">
        <p className="min-w-0 flex-1 text-[16.5px] font-semibold tracking-tight text-white">{title}</p>
        <PriorityBadge level="high" />
      </header>
      <div className="space-y-3 px-3.5 py-3.5">
        <div>
          <p className="text-[14.5px] text-[#121B23]">
            <span className="font-semibold">{personName}</span> is booked in two places on {formatDayLabel(date)}.
          </p>
          <p className="mt-1 text-[13.5px] text-[#6C6C72]">
            Approve if it&apos;s intentional and it&apos;ll be noted on the weekly report.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Avatar name={personName} size={30} />
          <p className="min-w-0 flex-1 text-[15px] font-semibold">{personName}</p>
          <p className="text-[13px] tabular-nums text-[#6C6C72]">{formatDayLabel(date)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-lg bg-[#F3F4F6] px-3 py-1 text-[12px] font-medium">{locationA}</span>
          <span className="text-lg font-light text-slate-300">⇄</span>
          <span className="rounded-lg bg-[#FAEED9] px-3 py-1 text-[12px] font-medium text-[#854F0B]">{locationB}</span>
        </div>
        <p className="text-[12px] leading-relaxed text-ios-muted">{message}</p>
        {onAccept ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void onAccept()}
            className="w-full rounded-[13px] bg-gradient-to-r from-[#1D4ED8] to-[#2563EB] py-3.5 text-[15px] font-bold text-white shadow-[0_3px_12px_rgba(37,99,235,0.28)] disabled:opacity-50"
          >
            Approve clash
          </button>
        ) : null}
      </div>
      <div className="flex divide-x divide-black/10 bg-[#FAFAFA]">
        <Link
          href={`/dashboard/daily-overview?date=${dayKey(date)}`}
          className="flex-1 py-3 text-center text-[13px] font-semibold text-[#2563EB]"
        >
          Open daily overview
        </Link>
        {projectPathA && labelA ? (
          <Link href={projectPathA} className="flex-1 py-3 text-center text-[13px] font-semibold text-[#2563EB]">
            {labelA}
          </Link>
        ) : null}
        {projectPathB && labelB ? (
          <Link href={projectPathB} className="flex-1 py-3 text-center text-[13px] font-semibold text-[#2563EB]">
            {labelB}
          </Link>
        ) : null}
      </div>
      {onDeleteA || onDeleteB ? (
        <div className="flex gap-2 border-t border-black/[0.07] px-3.5 py-2.5">
          {onDeleteA && labelA ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void onDeleteA()}
              className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-[12px] font-semibold text-red-700 disabled:opacity-50"
            >
              Delete · {labelA}
            </button>
          ) : null}
          {onDeleteB && labelB ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void onDeleteB()}
              className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-[12px] font-semibold text-red-700 disabled:opacity-50"
            >
              Delete · {labelB}
            </button>
          ) : null}
        </div>
      ) : null}
    </article>
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
    <article className="overflow-hidden rounded-[18px] border border-black/[0.07] bg-white shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
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
            href={`/dashboard/schedule?date=${dayKey(date)}`}
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
    <article className="overflow-hidden rounded-[18px] border border-black/[0.07] bg-white shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
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
  onAcceptClash: (clash: OperativeBookingClashWarning) => Promise<void>
  onDeleteBooking: (bookingId: string) => Promise<void>
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

  const handleAccept = async (clash: OperativeBookingClashWarning) => {
    setBusyId(clash.id)
    try {
      await onAcceptClash(clash)
    } finally {
      setBusyId(null)
    }
  }

  const handleDelete = async (bookingId: string, label: string) => {
    if (!window.confirm(`Delete the booking for ${label}?`)) return
    setBusyId(bookingId)
    try {
      await onDeleteBooking(bookingId)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1 text-center">
          <h1 className="text-[17px] font-bold">Warnings</h1>
          <p className="text-[11px] text-ios-muted">{organizationName}</p>
        </div>
        <div className="flex w-[76px] justify-end gap-2">
          {isAdmin ? (
            <Link
              href="/dashboard/settings"
              className="grid h-[34px] w-[34px] place-items-center rounded-full border border-black/10 bg-white text-[#555] shadow-sm"
              aria-label="Warning settings"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.3 4.3 9.8 7.1a7.2 7.2 0 0 0-1.6.9L5.5 7.1 3.7 10l2.1 1.6a7 7 0 0 0 0 1.8L3.7 15l1.8 3 2.7-.9a7.2 7.2 0 0 0 1.6.9l.5 2.8h3.4l.5-2.8a7.2 7.2 0 0 0 1.6-.9l2.7.9 1.8-3-2.1-1.6a7 7 0 0 0 0-1.8L21.3 10l-1.8-3-2.7.9a7.2 7.2 0 0 0-1.6-.9l-.5-2.8h-3.4Z" />
                <circle cx="12" cy="12.5" r="2.4" />
              </svg>
            </Link>
          ) : null}
        </div>
      </div>

      {coreCount > 0 ? (
        <section className="rounded-[18px] bg-gradient-to-br from-[#B83232] to-[#9E2A2A] p-4 text-white">
          <p className="text-[10px] font-bold uppercase tracking-[0.8px] text-white/60">Active issues</p>
          <div className="mt-1 flex items-center gap-3">
            <p className="text-[26px] font-bold">{coreCount} need attention</p>
            <span className="ml-auto grid h-9 w-9 place-items-center rounded-full bg-white/18">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 3 2 21h20L12 3Z" />
              </svg>
            </span>
          </div>
          <div className="mt-3.5 grid grid-cols-3 gap-2">
            <HeroStat value={highCount} label="High" />
            <HeroStat value={0} label="Medium" />
            <HeroStat value={lowCount} label="Low" />
          </div>
          <p className="mt-3 text-[11px] leading-4 text-white/55">
            High: booking clashes & unbooked labour (approve clashes for the weekly report) · Low: materials not
            ordered by 16:00
          </p>
        </section>
      ) : null}

      {allCount > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {chips.map((chip) => (
            <button
              key={chip.value}
              type="button"
              onClick={() => setFilter(chip.value)}
              className={`rounded-full px-3.5 py-1.5 text-[13px] font-semibold ${
                filter === chip.value
                  ? 'bg-[#1C1C1E] text-white'
                  : 'border border-black/10 bg-white text-[#6B7280]'
              }`}
            >
              {chip.label} · {chip.count}
            </button>
          ))}
        </div>
      ) : null}

      {allCount === 0 ? (
        <div className="rounded-2xl border border-ios-border bg-white px-6 py-16 text-center">
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
            <ClashCard
              key={warning.id}
              title="Manager booking clash"
              personName={warning.personName}
              date={warning.date}
              locationA={warning.locationALabel}
              locationB={warning.locationBLabel}
              message={warning.message}
            />
          ))
        : null}

      {showClashes
        ? clashWarnings.map((clash) => {
            const isSmallA = smallWorkIds.has(clash.projectAId)
            const isSmallB = smallWorkIds.has(clash.projectBId)
            return (
              <ClashCard
                key={clash.id}
                title="Operative booking clash"
                personName={clash.operativeName}
                date={clash.date}
                locationA={clash.projectALabel}
                locationB={clash.projectBLabel}
                message={clash.message}
                projectPathA={projectSchedulePath(clash.projectAId, smallWorkIds)}
                projectPathB={projectSchedulePath(clash.projectBId, smallWorkIds)}
                labelA={projectScheduleOpenLabel(clash.projectALabel, isSmallA)}
                labelB={projectScheduleOpenLabel(clash.projectBLabel, isSmallB)}
                busy={busyId === clash.id || busyId === clash.bookingAId || busyId === clash.bookingBId}
                onAccept={() => handleAccept(clash)}
                onDeleteA={() => handleDelete(clash.bookingAId, clash.projectALabel)}
                onDeleteB={() => handleDelete(clash.bookingBId, clash.projectBLabel)}
              />
            )
          })
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
