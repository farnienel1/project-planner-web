import type { Booking } from '@/types'

export type ManagerLocationType =
  | 'project'
  | 'small_work'
  | 'office'
  | 'working_from_home'
  | 'site_survey'
  | 'custom'

export interface ManagerSiteBooking {
  id: string
  userId: string
  date: Date
  timeSlot: string
  locationType: ManagerLocationType
  locationId?: string
  customLocationName?: string
  workStartTime?: string
  workEndTime?: string
  isBreakRemoved?: boolean
  bookingGroupId?: string
  /** Rulebook 1.11.0: the job's collection for a job-linked booking (`jobCollection`). */
  jobCollection?: 'projects' | 'smallWorks'
  /** Rulebook 1.29.0: the booking's own overtime rate (1–3; missing = the organisation's). */
  otMultiplierOverride?: number | null
  createdAt: Date
  updatedAt: Date
  organizationId?: string
}

export function managerSiteBookingDisplayTitle(
  booking: ManagerSiteBooking,
  projectsById: Map<string, string>
): string {
  switch (booking.locationType) {
    case 'office':
      return 'Office'
    case 'working_from_home':
      return 'Working from home'
    case 'site_survey':
      return 'Site survey'
    case 'custom':
      return booking.customLocationName?.trim() || 'Custom location'
    case 'project':
    case 'small_work':
      if (booking.locationId) {
        return projectsById.get(booking.locationId) || (booking.locationType === 'small_work' ? 'Small work' : 'Project')
      }
      return booking.locationType === 'small_work' ? 'Small work' : 'Project'
    default:
      return 'Booking'
  }
}

export function managerSiteBookingToScheduleBooking(
  booking: ManagerSiteBooking,
  projectsById: Map<string, string>,
  organizationId?: string
): Booking {
  const displayTitle = managerSiteBookingDisplayTitle(booking, projectsById)
  return {
    id: booking.id,
    operativeId: '',
    projectId: booking.locationId || '',
    date: booking.date,
    timeSlot: booking.timeSlot,
    bookedBy: booking.userId,
    notes: displayTitle,
    status: 'Confirmed',
    workStartTime: booking.workStartTime,
    workEndTime: booking.workEndTime,
    createdAt: booking.createdAt,
    updatedAt: booking.updatedAt,
    organizationId,
    displayTitle,
    source: 'manager',
  }
}
