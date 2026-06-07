'use client'

import Link from 'next/link'
import { addDays, endOfWeek, format, isSameDay, isToday as dateFnsIsToday, startOfWeek } from 'date-fns'
import { useEffect, useMemo, useState } from 'react'
import { useBookingStore } from '@/lib/stores/bookingStore'
import { useOperativeStore } from '@/lib/stores/operativeStore'
import { useSubcontractorStore } from '@/lib/stores/subcontractorStore'
import { weekDaysFrom } from '@/lib/scheduling/scheduleUtils'
import type { Project } from '@/types'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '@/lib/firebase/config'

type SubBooking = {
  id: string
  subcontractorId: string
  date: Date
  timeSlot: string
}

function initials(name: string) {
  return name.split(' ').map(p => p[0] || '').join('').toUpperCase().slice(0, 2)
}

const AVATAR_COLORS = [
  'bg-blue-600', 'bg-violet-600', 'bg-emerald-600', 'bg-amber-500',
  'bg-pink-600', 'bg-teal-600', 'bg-indigo-600', 'bg-rose-600',
]

function avatarColor(name: string) {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

function Avatar({ name, size = 'sm' }: { name: string; size?: 'sm' | 'md' }) {
  const sz = size === 'sm' ? 'h-7 w-7 text-[10px]' : 'h-9 w-9 text-xs'
  return (
    <span className={`inline-flex items-center justify-center rounded-full font-bold text-white flex-shrink-0 ${sz} ${avatarColor(name)}`}>
      {initials(name)}
    </span>
  )
}

function formatSlot(slot: string): string {
  // Converts stored slot values to readable time ranges
  if (!slot || slot === 'FULL DAY' || slot === 'Full Day') return 'FULL DAY'
  return slot
}

function OTBadge({ hours }: { hours: number }) {
  if (hours <= 8) return null
  const ot = hours - 8
  return (
    <span className="rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">
      +{ot}h OT ×1.5
    </span>
  )
}

export function ProjectScheduleWeekOverview({
  project,
  organizationId,
  scheduleBasePath,
}: {
  project: Project
  organizationId: string
  scheduleBasePath: string
}) {
  const { bookings, loadBookings } = useBookingStore()
  const { operatives, loadOperatives } = useOperativeStore()
  const { subcontractors, loadSubcontractors } = useSubcontractorStore()
  const [weekStart, setWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }))
  const [subBookings, setSubBookings] = useState<SubBooking[]>([])
  const [expandedDay, setExpandedDay] = useState<string | null>(() => {
    // Auto-expand today
    const today = new Date()
    const todayKey = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString()
    return todayKey
  })
  useEffect(() => {
    loadBookings(organizationId)
    loadOperatives(organizationId)
    loadSubcontractors(organizationId)
  }, [organizationId, loadBookings, loadOperatives, loadSubcontractors])

  useEffect(() => {
    const load = async () => {
      const snapshot = await getDocs(collection(db, 'organizations', organizationId, 'subcontractorBookings'))
      setSubBookings(
        snapshot.docs
          .map((docSnap) => {
            const data = docSnap.data() as Record<string, unknown>
            if (String(data.projectId || '') !== project.id) return null
            return {
              id: docSnap.id,
              subcontractorId: String(data.subcontractorId || ''),
              date: (data.date as { toDate?: () => Date })?.toDate?.() || new Date(),
              timeSlot: String(data.timeSlot || 'FULL DAY'),
            }
          })
          .filter((row): row is SubBooking => row !== null)
      )
    }
    void load()
  }, [organizationId, project.id])

  const weekDays = useMemo(() => weekDaysFrom(weekStart), [weekStart])
  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 })
  const projectBookings = useMemo(
    () => bookings.filter((b) => b.projectId === project.id),
    [bookings, project.id]
  )

  const weekCounts = useMemo(() => {
    let ops = 0, subs = 0
    for (const day of weekDays) {
      ops += projectBookings.filter((b) => isSameDay(new Date(b.date), day)).length
      subs += subBookings.filter((b) => isSameDay(new Date(b.date), day)).length
    }
    return { ops, subs }
  }, [weekDays, projectBookings, subBookings])

  return (
    <div className="space-y-4">
      {/* ── Project info strip ── */}
      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <p className="text-xs font-bold text-blue-600 truncate">
          {project.jobNumber} {project.siteName}
        </p>
        <p className="text-xs text-slate-500 truncate">
          {project.client?.name}
          {project.addressLine1 ? ` · ${project.addressLine1}` : ''}
        </p>
        {project.jobType && (
          <span className="mt-1 inline-block rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
            {project.jobType}
          </span>
        )}
      </div>

      {/* ── Week nav ── */}
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setWeekStart(addDays(weekStart, -7))}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm hover:bg-slate-50 transition-colors"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="text-center">
          <p className="text-sm font-bold text-slate-900">
            Week of {format(weekStart, 'd MMM yyyy')}
          </p>
          <p className="text-xs text-slate-500">
            {weekCounts.ops} op{weekCounts.ops !== 1 ? 's' : ''} · {weekCounts.subs} sub{weekCounts.subs !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setWeekStart(addDays(weekStart, 7))}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm hover:bg-slate-50 transition-colors"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* ── Ops / Subs tab toggle ── */}
      <div className="grid grid-cols-2 gap-2">
        <Link
          href={`${scheduleBasePath}/operatives`}
          className="flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-3 text-sm font-bold text-white shadow-sm hover:bg-blue-700 transition-colors"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          Operatives &amp; Managers
        </Link>
        <Link
          href={`${scheduleBasePath}/subcontractors`}
          className="flex items-center justify-center gap-2 rounded-2xl bg-violet-600 px-4 py-3 text-sm font-bold text-white shadow-sm hover:bg-violet-700 transition-colors"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
          Subcontractors
        </Link>
      </div>

      {/* ── Week overview ── */}
      <div>
        <p className="mb-2 px-1 text-[11px] font-bold uppercase tracking-widest text-slate-400">Week overview</p>

        <div className="space-y-2">
          {weekDays.map((day) => {
            const dayKey = day.toISOString()
            const isExpanded = expandedDay === dayKey
            const isTodayDay = dateFnsIsToday(day)

            const opRows = projectBookings
              .filter((b) => isSameDay(new Date(b.date), day))
              .map((b) => {
                const op = operatives.find((o) => o.id === b.operativeId)
                const name = op ? `${op.firstName} ${op.lastName}`.trim() : 'Operative'
                // Estimate hours from timeSlot string
                const slotStr = String(b.timeSlot || 'FULL DAY')
                let hours = 8
                const match = slotStr.match(/(\d{2}):(\d{2})[–-](\d{2}):(\d{2})/)
                if (match) {
                  const start = parseInt(match[1]) * 60 + parseInt(match[2])
                  const end = parseInt(match[3]) * 60 + parseInt(match[4])
                  hours = Math.round((end - start) / 60 * 10) / 10
                }
                return { id: b.id, name, slot: slotStr, hours, kind: 'operative' as const }
              })

            const subRows = subBookings
              .filter((b) => isSameDay(new Date(b.date), day))
              .map((b) => {
                const sub = subcontractors.find((s) => s.id === b.subcontractorId)
                return {
                  id: b.id,
                  name: sub?.name || 'Sub contractor',
                  slot: formatSlot(b.timeSlot),
                  hours: 8,
                  kind: 'subcontractor' as const,
                }
              })

            const rows = [...opRows, ...subRows]
            const bookedCount = rows.length

            return (
              <div
                key={dayKey}
                className={`overflow-hidden rounded-2xl border bg-white shadow-sm transition-shadow ${
                  isTodayDay ? 'border-blue-400 shadow-blue-100' : 'border-slate-200'
                }`}
              >
                {/* Day header row */}
                <button
                  type="button"
                  onClick={() => setExpandedDay(isExpanded ? null : dayKey)}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left"
                >
                  <div className="flex items-center gap-3">
                    {isTodayDay && (
                      <span className="rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-bold text-white">Today</span>
                    )}
                    <div>
                      <p className={`text-sm font-bold ${isTodayDay ? 'text-blue-700' : 'text-slate-900'}`}>
                        {format(day, 'EEE · d MMM')}
                        {isTodayDay && <span className="ml-1 text-blue-500">·</span>}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {bookedCount > 0 && (
                      <div className="flex -space-x-1.5">
                        {rows.slice(0, 3).map((r) => (
                          <Avatar key={r.id} name={r.name} size="sm" />
                        ))}
                        {rows.length > 3 && (
                          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-200 text-[10px] font-bold text-slate-600">
                            +{rows.length - 3}
                          </span>
                        )}
                      </div>
                    )}
                    <span className={`text-xs font-semibold ${bookedCount > 0 ? 'text-blue-600' : 'text-slate-400'}`}>
                      {bookedCount === 0 ? 'No bookings' : `${bookedCount} booked`}
                    </span>
                    <svg
                      className={`h-4 w-4 text-slate-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                      fill="none" viewBox="0 0 24 24" stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </button>

                {/* Expanded rows */}
                {isExpanded && (
                  <div className="border-t border-slate-100">
                    {rows.length === 0 ? (
                      <div className="px-4 py-4 text-center">
                        <p className="text-sm text-slate-400">No bookings this day</p>
                        <Link
                          href={`${scheduleBasePath}/operatives`}
                          className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:underline"
                        >
                          + Add booking
                        </Link>
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-100">
                        {rows.map((row) => (
                          <div key={row.id} className="flex items-center gap-3 px-4 py-3">
                            <Avatar name={row.name} size="sm" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-slate-900 truncate">{row.name}</p>
                              <p className="text-xs text-slate-500">{row.slot}</p>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <OTBadge hours={row.hours} />
                              <span className={`rounded-lg px-2 py-0.5 text-xs font-bold ${
                                row.hours >= 10 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'
                              }`}>
                                {row.hours}h
                              </span>
                              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                row.kind === 'subcontractor'
                                  ? 'bg-violet-100 text-violet-700'
                                  : 'bg-emerald-100 text-emerald-700'
                              }`}>
                                {row.kind === 'subcontractor' ? 'Sub' : 'Op'}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
