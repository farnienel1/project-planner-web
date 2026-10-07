import { coversCalendarDay } from '@/lib/ios-parity/londonTime'

type Dated = { date: Date }

/**
 * Who is on a site for one London calendar day.
 * A booking stored at London midnight is the previous UTC date during British
 * Summer Time, so a device-local same-day check drops it.
 */
export function countBookingsOnSiteDay(input: {
  siteId: string
  day: Date
  operativeBookings: Array<Dated & { projectId: string }>
  managerBookings: Array<Dated & { locationType: string; locationId?: string }>
}): number {
  const onDay = (date: Date) => coversCalendarDay(new Date(date), input.day)
  const operative = input.operativeBookings.filter(
    (row) => row.projectId === input.siteId && onDay(row.date)
  ).length
  const managers = input.managerBookings.filter(
    (row) =>
      (row.locationType === 'project' || row.locationType === 'small_work') &&
      row.locationId === input.siteId &&
      onDay(row.date)
  ).length
  return operative + managers
}
