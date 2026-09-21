'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import {
  format,
  startOfWeek,
  endOfWeek,
  addWeeks,
  subWeeks,
  addDays,
  isSameDay,
  isToday,
  isTomorrow,
  isYesterday,
  isPast,
  startOfDay,
  differenceInCalendarDays,
  getWeek,
} from 'date-fns'
import type { Booking } from '@/types'
import { BookingEditSheet } from '@/components/schedule/BookingEditSheet'
import { AddWeekToCalendarButton } from '@/components/schedule/AddWeekToCalendarButton'
import { MyScheduleTotalHoursCard, myScheduleClockSubtitle, myScheduleStripeClass } from '@/components/schedule/MyScheduleLooks'
import type { OrgPayrollTimePolicy } from '@/lib/settings/organizationSettings'
import { DEFAULT_PAYROLL_POLICY } from '@/lib/settings/organizationSettings'

type FilterStatus = 'all' | 'confirmed' | 'tentative'

function humanDate(d: Date): string {
  if (isToday(d)) return 'Today'
  if (isTomorrow(d)) return 'Tomorrow'
  if (isYesterday(d)) return 'Yesterday'
  const diff = differenceInCalendarDays(d, new Date())
  if (diff > 0 && diff < 7) return format(d, 'EEEE')
  return format(d, 'EEEE, d MMMM yyyy')
}

function slotLabel(slot: string): string {
  const s = (slot || '').toUpperCase()
  if (s === 'FULL DAY' || s === 'FULLDAY') return 'Full day'
  if (s === 'AM' || s === 'MORNING') return 'Morning (AM)'
  if (s === 'PM' || s === 'AFTERNOON') return 'Afternoon (PM)'
  if (s === 'CUSTOM_HOURS') return 'Custom hours'
  return slot || 'Unspecified'
}

function bookingStatus(value: string): string {
  return (value || '').toLowerCase()
}

function DayPill({
  date,
  count,
  selected,
  onClick,
}: {
  date: Date
  count: number
  selected: boolean
  onClick: () => void
}) {
  const today = isToday(date)
  return (
    <button
      type="button"
      onClick={onClick}
      className={`day ${today ? 'today' : ''} ${selected ? 'sel' : ''}`}
      style={{ minHeight: 0, padding: '10px 8px', alignItems: 'center' }}
    >
      <span className="muted xs" style={{ fontWeight: 700, textTransform: 'uppercase' }}>
        {format(date, 'EEE')}
      </span>
      <b style={{ fontFamily: 'var(--head)', fontSize: 18 }}>{format(date, 'd')}</b>
      {count > 0 ? <span className="count">{count}</span> : <span className="h-4" />}
    </button>
  )
}

function SlotPill({ slot }: { slot: string }) {
  const s = (slot || '').toUpperCase()
  let color = 'bg-slate-100 text-slate-600'
  if (s.includes('FULL')) color = 'bg-indigo-50 text-indigo-700'
  else if (s === 'AM' || s === 'MORNING') color = 'bg-amber-50 text-amber-700'
  else if (s === 'PM' || s === 'AFTERNOON') color = 'bg-violet-50 text-violet-700'
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${color}`}>
      {slotLabel(slot)}
    </span>
  )
}

function BookingCard({
  booking,
  operativeName,
  projectName,
  isHighlighted,
  canEdit,
  onSave,
  onDelete,
}: {
  booking: Booking
  operativeName: string
  projectName: string
  isHighlighted: boolean
  canEdit?: boolean
  onSave?: (updates: Partial<Booking>) => Promise<void>
  onDelete?: () => Promise<void>
}) {
  const [expanded, setExpanded] = useState(isHighlighted)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)
  const past = isPast(booking.date) && !isToday(booking.date)

  useEffect(() => {
    if (isHighlighted) setExpanded(true)
  }, [isHighlighted])

  useEffect(() => {
    if (isHighlighted && cardRef.current) {
      cardRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [isHighlighted])

  return (
    <>
    <div
      ref={cardRef}
      id={`booking-${booking.id}`}
      className={`overflow-hidden card ${
        isHighlighted ? 'shadow-[0_0_0_2px_var(--blue),var(--sh)]' : past ? 'opacity-60' : ''
      }`}
    >
      <button
        type="button"
        className="flex w-full items-stretch gap-0 text-left"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        <div
          className={`w-1 shrink-0 self-stretch ${
            booking.source === 'manager' ? myScheduleStripeClass('office') : myScheduleStripeClass('project')
          }`}
        />

        <div className="min-w-0 flex-1 px-4 py-3">
          <p className={`truncate text-[15px] font-semibold ${past ? 'text-[var(--ink3)]' : ''}`}>
            {projectName}
          </p>
          <p className="mt-0.5 text-[12px] font-medium text-[var(--ink3)]">
            {myScheduleClockSubtitle(booking)}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center gap-1 text-xs text-slate-500">
              <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
              {operativeName}
            </span>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <SlotPill slot={String(booking.timeSlot)} />
          </div>
        </div>

        <svg
          className={`mt-1.5 h-4 w-4 shrink-0 text-slate-300 transition-transform ${expanded ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className="border-t border-slate-100 bg-slate-50/60 px-5 py-4">
          <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-xs">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Operative</p>
              <p className="mt-0.5 font-medium text-slate-800">{operativeName}</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Project</p>
              <p className="mt-0.5 font-medium text-slate-800">{projectName}</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Date</p>
              <p className="mt-0.5 font-medium text-slate-800">{format(booking.date, 'EEEE d MMMM yyyy')}</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Time slot</p>
              <p className="mt-0.5 font-medium text-slate-800">{slotLabel(String(booking.timeSlot))}</p>
            </div>
            {booking.bookedBy && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Booked by</p>
                <p className="mt-0.5 font-medium text-slate-800">{booking.bookedBy}</p>
              </div>
            )}
          </div>
          {booking.notes && (
            <p className="mt-3 border-t border-slate-200 pt-3 text-xs leading-relaxed text-slate-600">{booking.notes}</p>
          )}
          {canEdit && onSave && onDelete && (
            <div className="mt-3 border-t border-slate-200 pt-3">
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
              >
                Edit or delete booking
              </button>
            </div>
          )}
        </div>
      )}
    </div>
    {editing && onSave && onDelete && (
      <BookingEditSheet
        booking={booking}
        operativeName={operativeName}
        projectName={projectName}
        saving={saving}
        onClose={() => setEditing(false)}
        onSave={async (updates) => {
          setSaving(true)
          try {
            await onSave(updates)
          } finally {
            setSaving(false)
          }
        }}
        onDelete={async () => {
          setSaving(true)
          try {
            await onDelete()
          } finally {
            setSaving(false)
          }
        }}
      />
    )}
    </>
  )
}

function DaySection({
  date,
  bookings,
  operativesById,
  peopleById,
  projectsById,
  selectedDate,
  highlightBookingId,
  canEditBookings,
  onSaveBooking,
  onDeleteBooking,
  selfDisplayName,
}: {
  date: Date
  bookings: Booking[]
  operativesById: Map<string, string>
  peopleById?: Map<string, string>
  projectsById: Map<string, string>
  selectedDate: Date | null
  highlightBookingId: string | null
  canEditBookings?: boolean
  onSaveBooking?: (bookingId: string, updates: Partial<Booking>) => Promise<void>
  onDeleteBooking?: (bookingId: string) => Promise<void>
  selfDisplayName?: string
}) {
  const today = isToday(date)
  const past = isPast(startOfDay(date)) && !today
  const isSelected = selectedDate ? isSameDay(date, selectedDate) : false
  const sectionRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isSelected && sectionRef.current && !highlightBookingId) {
      sectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [isSelected, highlightBookingId])

  const confirmed = bookings.filter((b) => bookingStatus(String(b.status)) === 'confirmed').length
  const tentative = bookings.filter((b) => bookingStatus(String(b.status)) === 'tentative').length

  return (
    <div
      ref={sectionRef}
      className={`scroll-mt-4 ${isSelected ? 'rounded-2xl ring-2 ring-blue-200 ring-offset-2' : ''}`}
    >
      <div className={`mb-3 flex items-center gap-3 px-1 ${past ? 'opacity-50' : ''}`}>
        <div
          className={`flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-xl text-center ${
            today ? 'bg-blue-600 text-white shadow-sm' : 'bg-slate-100 text-slate-700'
          }`}
        >
          <span className={`text-[9px] font-bold uppercase tracking-wider ${today ? 'text-blue-200' : 'text-slate-400'}`}>
            {format(date, 'EEE')}
          </span>
          <span className={`text-base font-bold leading-none ${today ? 'text-white' : 'text-slate-800'}`}>
            {format(date, 'd')}
          </span>
        </div>
        <div>
          <p className={`text-sm font-semibold ${today ? 'text-blue-700' : 'text-slate-800'}`}>
            {humanDate(date)}
            {today && (
              <span className="ml-2 inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700">
                TODAY
              </span>
            )}
          </p>
          <p className="text-xs text-slate-400">
            {format(date, 'MMMM yyyy')} · {bookings.length} booking{bookings.length !== 1 ? 's' : ''}
            {confirmed > 0 && ` · ${confirmed} confirmed`}
            {tentative > 0 && ` · ${tentative} tentative`}
          </p>
        </div>
      </div>

      <div className="space-y-2">
        {bookings.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-3 text-xs text-slate-400">
            No bookings scheduled
          </p>
        ) : (
          bookings.map((b) => (
            <BookingCard
              key={b.id}
              booking={b}
              operativeName={
                b.source === 'manager' && b.bookedBy
                  ? peopleById?.get(b.bookedBy) || 'Manager'
                  : b.operativeId
                    ? operativesById.get(b.operativeId) || `Operative ${b.operativeId.slice(0, 6)}`
                    : selfDisplayName || 'You'
              }
              projectName={
                b.displayTitle ||
                projectsById.get(b.projectId) ||
                (b.projectId ? `Project ${b.projectId.slice(0, 6)}` : 'Booking')
              }
              isHighlighted={highlightBookingId === b.id}
              canEdit={canEditBookings && b.source !== 'manager'}
              onSave={onSaveBooking ? (updates) => onSaveBooking(b.id, updates) : undefined}
              onDelete={onDeleteBooking ? () => onDeleteBooking(b.id) : undefined}
            />
          ))
        )}
      </div>
    </div>
  )
}

function MiniStat({
  label,
  value,
  sub,
  color,
}: {
  label: string
  value: number | string
  sub?: string
  color: string
}) {
  return (
    <div className="card pad">
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      <p className="mt-0.5 text-xs font-medium text-slate-500">{label}</p>
      {sub && <p className="mt-0.5 text-[10px] text-slate-400">{sub}</p>}
    </div>
  )
}

export function ScheduleScreen({
  variant = 'overview',
  organizationName,
  organizationId,
  bookings,
  operativesById,
  peopleById,
  projectsById,
  loading,
  focusDate,
  focusOperativeId,
  focusOperativeName,
  highlightBookingId,
  canEditBookings = false,
  onSaveBooking,
  onDeleteBooking,
  payrollPolicy,
}: {
  variant?: 'overview' | 'personal'
  organizationName: string
  organizationId?: string
  bookings: Booking[]
  operativesById: Map<string, string>
  peopleById?: Map<string, string>
  projectsById: Map<string, string>
  loading?: boolean
  focusDate?: Date | null
  focusOperativeId?: string | null
  focusOperativeName?: string | null
  highlightBookingId?: string | null
  canEditBookings?: boolean
  onSaveBooking?: (bookingId: string, updates: Partial<Booking>) => Promise<void>
  onDeleteBooking?: (bookingId: string) => Promise<void>
  payrollPolicy?: OrgPayrollTimePolicy
}) {
  const isPersonal = variant === 'personal'
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all')
  const [search, setSearch] = useState('')
  const [weekStart, setWeekStart] = useState(() =>
    startOfWeek(focusDate ?? new Date(), { weekStartsOn: 1 })
  )
  const [selectedDate, setSelectedDate] = useState<Date | null>(focusDate ?? new Date())
  const [showPast, setShowPast] = useState(() =>
    focusDate ? isPast(startOfDay(focusDate)) && !isToday(focusDate) : false
  )

  useEffect(() => {
    if (focusDate) {
      setSelectedDate(focusDate)
      setWeekStart(startOfWeek(focusDate, { weekStartsOn: 1 }))
      if (isPast(startOfDay(focusDate)) && !isToday(focusDate)) setShowPast(true)
    }
  }, [focusDate])

  const scopedBookings = useMemo(() => {
    if (variant === 'personal') return bookings
    if (!focusOperativeId) return bookings
    return bookings.filter((b) => b.operativeId === focusOperativeId)
  }, [bookings, focusOperativeId, variant])

  const filteredBookings = useMemo(() => {
    let list = [...scopedBookings]
    if (filterStatus !== 'all') {
      list = list.filter((b) => bookingStatus(String(b.status)) === filterStatus)
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter((b) => {
        const opName = (operativesById.get(b.operativeId) || '').toLowerCase()
        const projName = (projectsById.get(b.projectId) || '').toLowerCase()
        return opName.includes(q) || projName.includes(q) || b.notes?.toLowerCase().includes(q)
      })
    }
    return list
  }, [scopedBookings, filterStatus, search, operativesById, projectsById])

  const bookingsByDate = useMemo(() => {
    const map = new Map<string, Booking[]>()
    filteredBookings.forEach((b) => {
      const d = b.date instanceof Date ? b.date : new Date(b.date)
      const key = startOfDay(d).toISOString()
      const list = map.get(key) || []
      list.push({ ...b, date: d })
      map.set(key, list)
    })
    const slotOrder = ['FULL DAY', 'FULLDAY', 'AM', 'MORNING', 'PM', 'AFTERNOON', 'CUSTOM_HOURS']
    map.forEach((list) => {
      list.sort((a, b) => {
        const ai = slotOrder.indexOf(String(a.timeSlot || '').toUpperCase())
        const bi = slotOrder.indexOf(String(b.timeSlot || '').toUpperCase())
        return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
      })
    })
    return map
  }, [filteredBookings])

  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart])

  const overviewDates = useMemo(() => {
    const dates = Array.from(bookingsByDate.keys())
      .map((k) => new Date(k))
      .sort((a, b) => a.getTime() - b.getTime())

    return dates.filter((d) => showPast || !isPast(startOfDay(d)) || isToday(d))
  }, [bookingsByDate, showPast])

  const datesToRender = isPersonal ? weekDays : overviewDates

  const confirmedCount = scopedBookings.filter((b) => bookingStatus(String(b.status)) === 'confirmed').length
  const tentativeCount = scopedBookings.filter((b) => bookingStatus(String(b.status)) === 'tentative').length
  const todayCount = filteredBookings.filter((b) => isToday(b.date instanceof Date ? b.date : new Date(b.date))).length
  const thisWeekCount = filteredBookings.filter((b) => {
    const d = b.date instanceof Date ? b.date : new Date(b.date)
    return d >= weekStart && d <= endOfWeek(weekStart, { weekStartsOn: 1 })
  }).length
  const pastCount = filteredBookings.filter((b) => {
    const d = b.date instanceof Date ? b.date : new Date(b.date)
    return isPast(startOfDay(d)) && !isToday(d)
  }).length

  if (loading && scopedBookings.length === 0) {
    return (
      <div className="space-y-3">
        <h1 className="text-[28px] font-semibold tracking-tight">{variant === 'personal' ? 'My Schedule' : 'Daily overview'}</h1>
        <p className="text-[14px] text-[var(--ink3)]">{variant === 'personal' ? 'Opening your week…' : 'Opening daily overview…'}</p>
      </div>
    )
  }

  const pageTitle = variant === 'personal' ? 'My Schedule' : 'Daily overview'
  const pageSubtitle =
    variant === 'personal'
      ? focusOperativeName
        ? `Your bookings and assignments for ${organizationName}.`
        : `Your personal schedule for ${organizationName}.`
      : focusOperativeName
        ? `Bookings for ${focusOperativeName} in ${organizationName}.`
        : `All operative bookings across ${organizationName}.`

  return (
    <div className="stack" data-hue={isPersonal ? 'sched' : 'daily'}>
      <div className="phead" data-hue={isPersonal ? 'sched' : 'daily'}>
        <div className="badge-ico">
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
          </svg>
        </div>
        <div>
          <h1>{pageTitle}</h1>
          <div className="sub">{pageSubtitle}</div>
        </div>
        <div className="acts">
          {variant === 'overview' ? (
            <Link href="/dashboard/warnings" className="btn" data-hue="warn">
              View warnings
            </Link>
          ) : null}
        </div>
      </div>

      {variant === 'overview' && focusOperativeId && focusOperativeName && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
          <span>
            Viewing <span className="font-semibold">{focusOperativeName}</span>&apos;s bookings
          </span>
          <Link href="/dashboard/daily-overview" className="font-semibold text-blue-700 hover:text-blue-800">
            Show all bookings
          </Link>
        </div>
      )}

      {!isPersonal && (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MiniStat label="Total bookings" value={scopedBookings.length} color="text-slate-900" />
        <MiniStat
          label="Confirmed"
          value={confirmedCount}
          color="text-green-600"
          sub={`${Math.round((confirmedCount / Math.max(scopedBookings.length, 1)) * 100)}% of total`}
        />
        <MiniStat label="Tentative" value={tentativeCount} color="text-amber-600" />
        <MiniStat
          label="Today"
          value={todayCount}
          color={todayCount > 0 ? 'text-blue-600' : 'text-slate-400'}
          sub={`${thisWeekCount} this week`}
        />
      </div>
      )}

      <div className="card pad">
        <div className="mb-2 flex items-center justify-between px-1">
          <p className="text-xs font-semibold text-slate-700">
            Week {getWeek(weekStart)} · {format(weekStart, 'MMM d')} –{' '}
            {format(endOfWeek(weekStart, { weekStartsOn: 1 }), 'MMM d, yyyy')}
          </p>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setWeekStart((w) => subWeeks(w, 1))}
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 transition hover:bg-slate-50"
              aria-label="Previous week"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={() => {
                setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))
                setSelectedDate(new Date())
              }}
              className="rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-600 transition hover:bg-slate-50"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => setWeekStart((w) => addWeeks(w, 1))}
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 transition hover:bg-slate-50"
              aria-label="Next week"
            >
              ›
            </button>
          </div>
        </div>

        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {weekDays.map((day) => {
            const key = startOfDay(day).toISOString()
            const count = (bookingsByDate.get(key) || []).length
            return (
              <DayPill
                key={day.toISOString()}
                date={day}
                count={count}
                selected={selectedDate ? isSameDay(day, selectedDate) : false}
                onClick={() => {
                  setSelectedDate(day)
                  if (isPast(startOfDay(day)) && !isToday(day)) setShowPast(true)
                }}
              />
            )
          })}
        </div>
      </div>

      {isPersonal && (
        <>
          <AddWeekToCalendarButton
            bookings={scopedBookings}
            weekStart={weekStart}
            projectsById={projectsById}
            organizationName={organizationName}
            payrollPolicy={payrollPolicy}
          />
          {selectedDate ? (
            <MyScheduleTotalHoursCard
              bookings={bookingsByDate.get(startOfDay(selectedDate).toISOString()) || []}
              policy={payrollPolicy || DEFAULT_PAYROLL_POLICY}
            />
          ) : null}
        </>
      )}

      {!isPersonal && (
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[200px] flex-1">
          <input
            type="text"
            placeholder="Search operative, project or notes…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-3 pr-4 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-400 focus:outline-none"
            aria-label="Search schedule"
          />
        </div>

        <div className="flex gap-1 rounded-xl bg-slate-100 p-1">
          {(
            [
              { value: 'all', label: `All (${scopedBookings.length})` },
              { value: 'confirmed', label: `Confirmed (${confirmedCount})` },
              { value: 'tentative', label: `Tentative (${tentativeCount})` },
            ] as { value: FilterStatus; label: string }[]
          ).map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setFilterStatus(f.value)}
              className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                filterStatus === f.value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setShowPast((v) => !v)}
          className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition ${
            showPast
              ? 'border-slate-400 bg-slate-800 text-white'
              : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
          }`}
        >
          {showPast ? `Showing past (${pastCount})` : `Show past (${pastCount})`}
        </button>
      </div>
      )}

      {datesToRender.length === 0 ? (
        <div className="empty card pad py-16 text-center">
          <p className="text-sm font-semibold text-slate-700">No bookings found</p>
          <p className="mt-1 text-xs text-slate-400">Try adjusting filters or selecting another week.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {datesToRender.map((date) => {
            const key = startOfDay(date).toISOString()
            const dayBookings = bookingsByDate.get(key) || []
            return (
              <DaySection
                key={key}
                date={date}
                bookings={dayBookings}
                operativesById={operativesById}
                peopleById={peopleById}
                projectsById={projectsById}
                selectedDate={selectedDate}
                highlightBookingId={highlightBookingId ?? null}
                canEditBookings={canEditBookings && Boolean(organizationId)}
                onSaveBooking={onSaveBooking}
                onDeleteBooking={onDeleteBooking}
                selfDisplayName={variant === 'personal' ? focusOperativeName || undefined : undefined}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}
