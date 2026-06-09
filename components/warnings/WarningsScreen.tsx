'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { format } from 'date-fns/format'
import { isToday } from 'date-fns/isToday'
import { isTomorrow } from 'date-fns/isTomorrow'
import { isPast } from 'date-fns/isPast'
import type { OperativeBookingClashWarning } from '@/lib/scheduling/bookingClashUtils'
import type { MissedMaterialOrderWarning } from '@/lib/warnings/materialOrderWarnings'
import {
  projectSchedulePath,
  projectMaterialsPath,
  projectScheduleOpenLabel,
} from '@/lib/navigation/projectSchedulePaths'
import type { Operative, User } from '@/types'
import { LoadingSpinner } from '@/components/dashboard/PageShell'

function formatDateLabel(date: Date): string {
  if (isToday(date)) return 'Today'
  if (isTomorrow(date)) return 'Tomorrow'
  return format(date, 'EEEE d MMMM yyyy')
}

function urgencyLevel(date: Date): 'past' | 'today' | 'soon' | 'future' {
  if (isPast(date) && !isToday(date)) return 'past'
  if (isToday(date)) return 'today'
  const diff = date.getTime() - Date.now()
  if (diff < 1000 * 60 * 60 * 24 * 3) return 'soon'
  return 'future'
}

const URGENCY_STYLES = {
  past: { badge: 'bg-slate-100 text-slate-600', border: 'border-l-slate-300', dot: 'bg-slate-400', label: 'Past' },
  today: { badge: 'bg-red-50 text-red-700', border: 'border-l-red-400', dot: 'bg-red-500', label: 'Today' },
  soon: { badge: 'bg-amber-50 text-amber-700', border: 'border-l-amber-400', dot: 'bg-amber-500', label: 'Soon' },
  future: { badge: 'bg-blue-50 text-blue-700', border: 'border-l-blue-300', dot: 'bg-blue-400', label: 'Upcoming' },
}

function StatCard({
  value,
  label,
  color,
  icon,
}: {
  value: number
  label: string
  color: string
  icon: React.ReactNode
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className={`text-2xl font-bold ${color}`}>{value}</p>
          <p className="mt-0.5 text-xs text-slate-500">{label}</p>
        </div>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-50">{icon}</div>
      </div>
    </div>
  )
}

function Avatar({ name }: { name: string }) {
  const initials = name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600 ring-2 ring-white">
      {initials}
    </div>
  )
}

function ActionButton({
  children,
  onClick,
  variant = 'secondary',
  disabled,
}: {
  children: React.ReactNode
  onClick?: () => void
  variant?: 'primary' | 'secondary' | 'danger' | 'success'
  disabled?: boolean
}) {
  const styles = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700',
    secondary: 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
    danger: 'border border-red-200 bg-red-50 text-red-700 hover:bg-red-100',
    success: 'border border-green-200 bg-green-50 text-green-700 hover:bg-green-100',
  }
  if (onClick) {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={onClick}
        className={`inline-flex shrink-0 items-center whitespace-nowrap gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50 ${styles[variant]}`}
      >
        {children}
      </button>
    )
  }
  return null
}

function ClashCard({
  clash,
  smallWorkIds,
  onAccept,
  onDeleteBooking,
  busy,
}: {
  clash: OperativeBookingClashWarning
  smallWorkIds: ReadonlySet<string>
  onAccept: () => Promise<void>
  onDeleteBooking: (bookingId: string, label: string) => Promise<void>
  busy?: boolean
}) {
  const urgency = urgencyLevel(clash.date)
  const styles = URGENCY_STYLES[urgency]
  const isSmallA = smallWorkIds.has(clash.projectAId)
  const isSmallB = smallWorkIds.has(clash.projectBId)
  const projectPathA = projectSchedulePath(clash.projectAId, smallWorkIds)
  const projectPathB = projectSchedulePath(clash.projectBId, smallWorkIds)
  const blueLink =
    'inline-flex shrink-0 items-center whitespace-nowrap rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-700'

  return (
    <div className={`overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm border-l-4 ${styles.border}`}>
      <div className="flex w-full items-start gap-4 px-5 py-4">
        <Avatar name={clash.operativeName} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-slate-900">{clash.operativeName}</span>
            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${styles.badge}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${styles.dot}`} />
              {formatDateLabel(clash.date)}
            </span>
            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase text-amber-700">
              Booking clash
            </span>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="rounded-lg bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">{clash.projectALabel}</span>
            <span className="text-lg font-light text-slate-300">⇄</span>
            <span className="rounded-lg bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800">{clash.projectBLabel}</span>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-slate-500">{clash.message}</p>
        </div>
      </div>
      <div className="border-t border-slate-100 bg-slate-50 px-5 py-3">
        <div className="flex flex-nowrap items-center gap-2 overflow-x-auto">
          <Link href={projectPathA} className={blueLink}>
            {projectScheduleOpenLabel(clash.projectALabel, isSmallA)}
          </Link>
          <Link href={projectPathB} className={blueLink}>
            {projectScheduleOpenLabel(clash.projectBLabel, isSmallB)}
          </Link>
          <ActionButton variant="success" disabled={busy} onClick={() => onAccept()}>
            Accept clash
          </ActionButton>
          <ActionButton variant="danger" disabled={busy} onClick={() => onDeleteBooking(clash.bookingAId, clash.projectALabel)}>
            Delete · {clash.projectALabel}
          </ActionButton>
          <ActionButton variant="danger" disabled={busy} onClick={() => onDeleteBooking(clash.bookingBId, clash.projectBLabel)}>
            Delete · {clash.projectBLabel}
          </ActionButton>
        </div>
      </div>
    </div>
  )
}

function MaterialWarningCard({
  warning,
  smallWorkIds,
}: {
  warning: MissedMaterialOrderWarning
  smallWorkIds: ReadonlySet<string>
}) {
  const materialsHref = projectMaterialsPath(warning.projectId, smallWorkIds)

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm border-l-4 border-l-violet-400">
      <div className="px-5 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-slate-900">{warning.projectLabel}</span>
          <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700">
            <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
            Today
          </span>
          <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-semibold uppercase text-violet-700">
            Missed material order
          </span>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-slate-500">{warning.message}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link
            href={materialsHref}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
          >
            Open materials
          </Link>
        </div>
      </div>
    </div>
  )
}

type FilterType = 'all' | 'today' | 'upcoming' | 'past' | 'clashes' | 'materials'

export function WarningsScreen({
  organizationName,
  clashWarnings,
  materialWarnings,
  loading,
  user: _user,
  operatives: _operatives,
  smallWorkIds,
  onAcceptClash,
  onDeleteBooking,
}: {
  organizationName: string
  clashWarnings: OperativeBookingClashWarning[]
  materialWarnings: MissedMaterialOrderWarning[]
  loading?: boolean
  user: User | null
  operatives: Operative[]
  smallWorkIds: ReadonlySet<string>
  onAcceptClash: (clash: OperativeBookingClashWarning) => Promise<void>
  onDeleteBooking: (bookingId: string) => Promise<void>
}) {
  const [filter, setFilter] = useState<FilterType>('all')
  const [search, setSearch] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)

  const totalCount = clashWarnings.length + materialWarnings.length
  const todayClashCount = clashWarnings.filter((w) => isToday(w.date)).length
  const todayMaterialCount = materialWarnings.length

  const filteredClashes = useMemo(() => {
    let list = [...clashWarnings]
    if (filter === 'today') list = list.filter((w) => isToday(w.date))
    else if (filter === 'upcoming') list = list.filter((w) => !isPast(w.date) || isToday(w.date))
    else if (filter === 'past') list = list.filter((w) => isPast(w.date) && !isToday(w.date))
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(
        (w) =>
          w.operativeName.toLowerCase().includes(q) ||
          w.projectALabel.toLowerCase().includes(q) ||
          w.projectBLabel.toLowerCase().includes(q)
      )
    }
    return list.sort((a, b) => a.date.getTime() - b.date.getTime())
  }, [clashWarnings, filter, search])

  const filteredMaterials = useMemo(() => {
    if (filter === 'past' || filter === 'upcoming' || filter === 'clashes') return []
    if (filter === 'materials') return materialWarnings
    if (search.trim()) {
      const q = search.toLowerCase()
      return materialWarnings.filter((w) => w.projectLabel.toLowerCase().includes(q))
    }
    return materialWarnings
  }, [materialWarnings, filter, search])

  const showClashes = filter !== 'materials'
  const showMaterials = filter !== 'clashes' && filter !== 'past' && filter !== 'upcoming'

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

  if (loading) {
    return <LoadingSpinner label="Loading warnings…" />
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-50">
              <svg className="h-5 w-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Warnings</h1>
            {totalCount > 0 && (
              <span className="rounded-full bg-red-600 px-2.5 py-0.5 text-xs font-bold text-white">{totalCount}</span>
            )}
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Booking clashes and missed material orders for {organizationName}.
          </p>
        </div>
        <Link href="/dashboard/my-schedule" className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
          Open My Schedule
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard value={totalCount} label="Total warnings" color="text-red-600" icon={<span className="text-red-500">!</span>} />
        <StatCard value={todayClashCount} label="Clashes today" color={todayClashCount > 0 ? 'text-red-600' : 'text-slate-900'} icon={<span>⏱</span>} />
        <StatCard value={todayMaterialCount} label="Materials today" color={todayMaterialCount > 0 ? 'text-violet-600' : 'text-slate-900'} icon={<span>📦</span>} />
        <StatCard value={clashWarnings.length} label="Booking clashes" color="text-amber-600" icon={<span>⇄</span>} />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          placeholder="Search operative or project…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="min-w-[200px] flex-1 rounded-xl border border-slate-200 bg-white py-2 px-3 text-sm"
          aria-label="Search warnings"
        />
        <div className="flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1">
          {(
            [
              { value: 'all', label: 'All' },
              { value: 'today', label: 'Today' },
              { value: 'clashes', label: 'Clashes' },
              { value: 'materials', label: 'Materials' },
            ] as { value: FilterType; label: string }[]
          ).map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setFilter(f.value)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${filter === f.value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {totalCount === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-16 text-center">
          <p className="text-sm font-semibold text-slate-700">No warnings</p>
          <p className="mt-1 text-xs text-slate-400">Schedules and material orders look good.</p>
        </div>
      )}

      {showMaterials && filteredMaterials.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-900">Missed material orders (today)</h2>
          {filteredMaterials.map((w) => (
            <MaterialWarningCard key={w.id} warning={w} smallWorkIds={smallWorkIds} />
          ))}
        </section>
      )}

      {showClashes && filteredClashes.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-900">Booking clashes</h2>
          {filteredClashes.map((clash) => (
            <ClashCard
              key={clash.id}
              clash={clash}
              smallWorkIds={smallWorkIds}
              busy={busyId === clash.id || busyId === clash.bookingAId || busyId === clash.bookingBId}
              onAccept={() => handleAccept(clash)}
              onDeleteBooking={handleDelete}
            />
          ))}
        </section>
      )}

      {totalCount > 0 && filteredClashes.length === 0 && filteredMaterials.length === 0 && (
        <p className="text-sm text-slate-500">No results match your filters.</p>
      )}
    </div>
  )
}
