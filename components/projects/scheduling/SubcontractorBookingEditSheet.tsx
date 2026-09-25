'use client'

import { useMemo, useState } from 'react'
import { deleteDoc, doc, Timestamp, updateDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase/config'
import { HoursBreakdownCard } from '@/components/schedule/HoursBreakdownCard'
import { HoursTimelinePicker } from '@/components/scheduling/HoursTimelinePicker'
import { hoursBreakdown } from '@/lib/scheduling/paidHours'
import { DEFAULT_PAYROLL_POLICY, type OrgPayrollTimePolicy } from '@/lib/settings/organizationSettings'
import type { Subcontractor } from '@/types'

export type DiarySubBooking = {
  id: string
  subcontractorId: string
  date: Date
  timeSlot: string
  workStartTime?: string
  workEndTime?: string
  isBreakRemoved?: boolean
  bookedContactIds?: string[]
  bookedOperativeNames?: string[]
}

export function SubcontractorBookingEditSheet({
  organizationId,
  booking,
  subcontractor,
  payroll = DEFAULT_PAYROLL_POLICY,
  onSaved,
  onClose,
}: {
  organizationId: string
  booking: DiarySubBooking
  subcontractor: Subcontractor | null
  payroll?: OrgPayrollTimePolicy
  onSaved: (next: DiarySubBooking | 'deleted') => void
  onClose: () => void
}) {
  const [workStartTime, setWorkStartTime] = useState(booking.workStartTime || payroll.standardDayStart)
  const [workEndTime, setWorkEndTime] = useState(booking.workEndTime || payroll.standardDayEnd)
  const [selectedIds, setSelectedIds] = useState<string[]>(booking.bookedContactIds || [])
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const firmName = subcontractor?.name?.trim() || 'Sub contractor'

  const breakdown = useMemo(
    () =>
      hoursBreakdown({
        timeSlot: 'CUSTOM_HOURS',
        workStartTime,
        workEndTime,
        isBreakRemoved: true,
        unpaidBreakMinutes: payroll.unpaidBreakMinutes,
        breakWindowStart: payroll.breakWindowStart,
        breakWindowEnd: payroll.breakWindowEnd,
        standardPaidHours: payroll.standardPaidHours,
        standardDayStart: payroll.standardDayStart,
        standardDayEnd: payroll.standardDayEnd,
        overtimeMultiplier: payroll.weekdayOutsideStandardMultiplier,
      }),
    [workStartTime, workEndTime, payroll]
  )

  const hoursValid = useMemo(() => {
    const start = workStartTime.split(':').map(Number)
    const end = workEndTime.split(':').map(Number)
    return (end[0] || 0) * 60 + (end[1] || 0) > (start[0] || 0) * 60 + (start[1] || 0)
  }, [workStartTime, workEndTime])

  const toggleContact = (id: string) => {
    setSelectedIds((current) => (current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id]))
  }

  const save = async () => {
    if (!db || !hoursValid) return
    setSaving(true)
    setError(null)
    try {
      const names =
        subcontractor?.contacts.filter((contact) => selectedIds.includes(contact.id)).map((contact) => contact.name).filter(Boolean) ||
        []
      const next: DiarySubBooking = {
        ...booking,
        timeSlot: 'CUSTOM_HOURS',
        workStartTime,
        workEndTime,
        isBreakRemoved: true,
        bookedContactIds: selectedIds,
        bookedOperativeNames: names,
      }
      await updateDoc(doc(db, 'organizations', organizationId, 'subcontractorBookings', booking.id), {
        timeSlot: 'CUSTOM_HOURS',
        workStartTime,
        workEndTime,
        isBreakRemoved: true,
        bookedContactIds: selectedIds,
        bookedOperativeNames: names,
        updatedAt: Timestamp.fromDate(new Date()),
      })
      onSaved(next)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not update this booking')
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true)
      return
    }
    if (!db) return
    setSaving(true)
    setError(null)
    try {
      await deleteDoc(doc(db, 'organizations', organizationId, 'subcontractorBookings', booking.id))
      onSaved('deleted')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not delete this booking')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white shadow-xl">
        <div className="border-b border-slate-100 px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Edit booking</p>
              <p className="mt-1 text-base font-semibold text-slate-900">{firmName}</p>
              <p className="text-sm text-slate-500">{booking.date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}</p>
            </div>
            <button type="button" onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100" aria-label="Close">
              ✕
            </button>
          </div>
        </div>
        <div className="space-y-4 px-5 py-4">
          {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700">{error}</p> : null}
          {subcontractor && subcontractor.contacts.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-600">Operatives on site</p>
              <p className="text-xs text-slate-500">Select who from {firmName} is booked. Leave none selected for the whole firm.</p>
              {subcontractor.contacts.map((contact) => {
                const on = selectedIds.includes(contact.id)
                return (
                  <button
                    key={contact.id}
                    type="button"
                    onClick={() => toggleContact(contact.id)}
                    className={`flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left ${on ? 'border-violet-400 bg-violet-50' : 'border-slate-200'}`}
                  >
                    <span>
                      <span className="block text-sm font-medium text-slate-900">{contact.name}</span>
                      {contact.email ? <span className="block text-xs text-slate-500">{contact.email}</span> : null}
                    </span>
                    <span className="text-xs font-semibold text-violet-700">{on ? 'On' : 'Off'}</span>
                  </button>
                )
              })}
            </div>
          ) : null}
          <div>
            <p className="mb-2 text-xs font-semibold text-slate-600">Start and finish</p>
            <HoursTimelinePicker
              start={workStartTime}
              end={workEndTime}
              breakRemoved
              policy={payroll}
              showBreak={false}
              onStart={setWorkStartTime}
              onEnd={setWorkEndTime}
              onBreak={() => {}}
            />
            {!hoursValid ? <p className="mt-2 text-xs text-slate-500">Finish needs to be after the start.</p> : null}
          </div>
          <HoursBreakdownCard breakdown={breakdown} />
        </div>
        <div className="flex flex-col gap-2 border-t border-slate-100 px-5 py-4">
          <button
            type="button"
            disabled={saving || !hoursValid}
            onClick={() => void save()}
            className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save changes'}
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => void remove()}
            className={`rounded-xl px-4 py-2.5 text-sm font-semibold ${confirmDelete ? 'bg-red-600 text-white' : 'border border-red-200 bg-red-50 text-red-700'}`}
          >
            {confirmDelete ? 'Confirm delete booking' : 'Delete booking'}
          </button>
        </div>
      </div>
    </div>
  )
}
