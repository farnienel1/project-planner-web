'use client'

import { ScheduleScreen } from '@/components/schedule/ScheduleScreen'
import type { Booking } from '@/types'
import type { MyScheduleClashMarker } from '@/lib/canonical'
import type { OrgPayrollTimePolicy } from '@/lib/settings/organizationSettings'

/** Read-only personal schedule for operatives and managers without self-booking enabled. */
export function MyScheduleReadOnlyScreen({
  organizationName,
  organizationId,
  bookings,
  operativesById,
  peopleById,
  projectsById,
  loading,
  focusOperativeId,
  focusOperativeName,
  canEditBookings,
  onSaveBooking,
  onDeleteBooking,
  payrollPolicy,
  canWriteBookingFor,
  canDeleteBookingFor,
  clashMarkers,
}: {
  organizationName: string
  organizationId?: string
  bookings: Booking[]
  operativesById: Map<string, string>
  peopleById?: Map<string, string>
  projectsById: Map<string, string>
  loading?: boolean
  focusOperativeId?: string | null
  focusOperativeName?: string | null
  canEditBookings?: boolean
  onSaveBooking?: (bookingId: string, updates: Partial<Booking>) => Promise<void>
  onDeleteBooking?: (bookingId: string) => Promise<void>
  payrollPolicy?: OrgPayrollTimePolicy
  canWriteBookingFor?: (booking: Booking) => boolean
  canDeleteBookingFor?: (booking: Booking) => boolean
  /** Rulebook 1.39.0 §10: the clash marker per booking id (`myScheduleClashMarkers`). */
  clashMarkers?: ReadonlyMap<string, MyScheduleClashMarker>
}) {
  return (
    <ScheduleScreen
      variant="personal"
      organizationName={organizationName}
      organizationId={organizationId}
      bookings={bookings}
      operativesById={operativesById}
      peopleById={peopleById}
      projectsById={projectsById}
      loading={loading}
      focusOperativeId={focusOperativeId}
      focusOperativeName={focusOperativeName}
      canEditBookings={canEditBookings}
      onSaveBooking={onSaveBooking}
      onDeleteBooking={onDeleteBooking}
      payrollPolicy={payrollPolicy}
      canWriteBookingFor={canWriteBookingFor}
      canDeleteBookingFor={canDeleteBookingFor}
      clashMarkers={clashMarkers}
    />
  )
}
