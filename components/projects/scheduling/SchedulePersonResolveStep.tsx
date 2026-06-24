'use client'

import { SchedulePersonDayRows } from '@/components/projects/scheduling/SchedulePersonDayRows'
import type { DraftBookingPerson } from '@/lib/scheduling/draftProjectBooking'
import type { ScheduleDateSlot } from '@/lib/scheduling/scheduleUtils'

/** @deprecated Use inline clashes in SchedulePersonPickerStep */
export function SchedulePersonResolveStep({
  person,
  slots,
  onPersonChange,
}: {
  person: DraftBookingPerson
  slots: ScheduleDateSlot[]
  onPersonChange: (person: DraftBookingPerson) => void
}) {
  return (
    <SchedulePersonDayRows person={person} slots={slots} onPersonChange={onPersonChange} />
  )
}
