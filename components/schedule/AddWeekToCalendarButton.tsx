'use client'

import { useMemo, useRef, useState } from 'react'
import { format, endOfWeek } from 'date-fns'
import type { Booking } from '@/types'
import type { OrgPayrollTimePolicy } from '@/lib/settings/organizationSettings'
import { DEFAULT_PAYROLL_POLICY } from '@/lib/settings/organizationSettings'
import {
  bookingsInWeek,
  bookingsToCalendarEvents,
  downloadIcsFile,
  generateIcsCalendar,
  googleCalendarEventUrl,
  outlookWebEventUrl,
  weekCalendarFilename,
} from '@/lib/scheduling/bookingCalendarExport'

type AddWeekToCalendarButtonProps = {
  bookings: Booking[]
  weekStart: Date
  projectsById: Map<string, string>
  organizationName?: string
  payrollPolicy?: OrgPayrollTimePolicy
}

export function AddWeekToCalendarButton({
  bookings,
  weekStart,
  projectsById,
  organizationName,
  payrollPolicy = DEFAULT_PAYROLL_POLICY,
}: AddWeekToCalendarButtonProps) {
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const weekBookings = useMemo(() => bookingsInWeek(bookings, weekStart), [bookings, weekStart])
  const events = useMemo(
    () => bookingsToCalendarEvents(weekBookings, projectsById, payrollPolicy),
    [weekBookings, projectsById, payrollPolicy]
  )

  const weekLabel = `${format(weekStart, 'd MMM')} – ${format(endOfWeek(weekStart, { weekStartsOn: 1 }), 'd MMM yyyy')}`
  const calendarName = organizationName ? `${organizationName} – My Schedule` : 'My Schedule'

  const exportIcs = () => {
    if (events.length === 0) {
      setMessage('No bookings this week to add.')
      setOpen(false)
      return
    }
    const ics = generateIcsCalendar(events, calendarName)
    downloadIcsFile(ics, weekCalendarFilename(weekStart))
    setMessage(
      events.length === 1
        ? 'Calendar file downloaded — open it to add the event to your calendar app.'
        : `Calendar file downloaded with ${events.length} events — open it in Apple Calendar, Outlook, or import into Google Calendar.`
    )
    setOpen(false)
  }

  const openGoogle = () => {
    if (events.length === 0) {
      setMessage('No bookings this week to add.')
      setOpen(false)
      return
    }
    if (events.length === 1) {
      window.open(googleCalendarEventUrl(events[0]), '_blank', 'noopener,noreferrer')
      setMessage('Opened Google Calendar.')
    } else {
      exportIcs()
      setMessage(
        `Downloaded ${events.length} bookings as a calendar file. In Google Calendar, go to Settings → Import & export → Import and select the file.`
      )
    }
    setOpen(false)
  }

  const openOutlook = () => {
    if (events.length === 0) {
      setMessage('No bookings this week to add.')
      setOpen(false)
      return
    }
    if (events.length === 1) {
      window.open(outlookWebEventUrl(events[0]), '_blank', 'noopener,noreferrer')
      setMessage('Opened Outlook on the web.')
    } else {
      exportIcs()
      setMessage(
        `Downloaded ${events.length} bookings as a calendar file. Open it in Outlook desktop, or import via Outlook on the web.`
      )
    }
    setOpen(false)
  }

  return (
    <div className="space-y-2">
      <div className="relative" ref={menuRef}>
        <div className="flex overflow-hidden rounded-xl border border-blue-200 bg-blue-600 shadow-sm">
          <button
            type="button"
            onClick={exportIcs}
            className="inline-flex flex-1 items-center justify-center gap-2 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700"
          >
            <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            Add this week to Calendar
            {weekBookings.length > 0 && (
              <span className="rounded-full bg-blue-500 px-2 py-0.5 text-[11px] font-bold text-white">
                {weekBookings.length}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            className="border-l border-blue-500 px-3 text-white transition hover:bg-blue-700"
            aria-expanded={open}
            aria-label="Choose calendar app"
          >
            ▾
          </button>
        </div>

        {open && (
          <div className="absolute left-0 right-0 z-20 mt-2 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
            <button
              type="button"
              onClick={exportIcs}
              className="flex w-full flex-col items-start px-4 py-3 text-left text-sm transition hover:bg-slate-50"
            >
              <span className="font-semibold text-slate-900">Apple Calendar / default app</span>
              <span className="mt-0.5 text-xs text-slate-500">Download .ics — opens on Mac, iPhone, or Windows</span>
            </button>
            <button
              type="button"
              onClick={openGoogle}
              className="flex w-full flex-col items-start px-4 py-3 text-left text-sm transition hover:bg-slate-50"
            >
              <span className="font-semibold text-slate-900">Google Calendar</span>
              <span className="mt-0.5 text-xs text-slate-500">
                {events.length <= 1 ? 'Add event in browser' : 'Download .ics to import (full week)'}
              </span>
            </button>
            <button
              type="button"
              onClick={openOutlook}
              className="flex w-full flex-col items-start px-4 py-3 text-left text-sm transition hover:bg-slate-50"
            >
              <span className="font-semibold text-slate-900">Outlook</span>
              <span className="mt-0.5 text-xs text-slate-500">
                {events.length <= 1 ? 'Add event on outlook.com' : 'Download .ics for Outlook desktop or web'}
              </span>
            </button>
          </div>
        )}
      </div>

      <p className="text-xs text-slate-500">
        Week of {weekLabel}. Works with Apple Calendar, Google Calendar, and Outlook on Mac or Windows.
      </p>

      {message && (
        <div
          role="status"
          className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900"
        >
          {message}
          <button
            type="button"
            onClick={() => setMessage(null)}
            className="ml-2 font-semibold text-green-700 underline"
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  )
}
