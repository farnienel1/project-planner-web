/**
 * Rulebook 1.10.0 §13 decision: whichever app creates a labour booking writes `booking_created` to the booked
 * person's account (`bookingCreatedRecipients`, never the booker); web did not before 1.10.0. relatedId is the job
 * id (`notificationRelatedIdFor`), the row carries the booking's day and catalogue, and its id is the synthetic UUID
 * of `bookingCreated|{bookingId}|{userId}` (same key as iOS).
 */
import { jobKind } from '@/lib/canonical/staffAccess'
import { bookingCreatedRecipients, dayKeyInOrganizationZone } from '@/lib/canonical'
import { saveInboxNotification } from '@/lib/firebase/notifyInbox'
import { syntheticUuidFromKey } from '@/lib/ios-parity/uuid'
import { rulebookPerson, rulebookRoster } from '@/lib/staff/rulebookPeople'
import type { Booking, Project, User } from '@/types'

function key(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

export async function notifyBookingCreated(input: {
  booking: Booking
  job: Project | null | undefined
  actor: User | null
  users: ReadonlyArray<User>
  operatives: ReadonlyArray<{ id: string; email?: string | null }>
  timeZone: string
}): Promise<void> {
  const operativeId = key(input.booking.operativeId)
  if (!operativeId) return
  const row = input.operatives.find((entry) => key(entry.id) === operativeId)
  const booked = input.users.filter(
    (user) =>
      user.isActive !== false &&
      (key(user.id) === operativeId ||
        (user.formerUserIds ?? []).some((id) => key(id) === operativeId) ||
        (row && key(row.email) !== '' && key(user.email) === key(row.email)))
  )
  const actor = input.actor ? rulebookPerson(input.actor, input.users) : null
  const recipients = bookingCreatedRecipients(
    booked.map((user) => user.id),
    actor,
    rulebookRoster(input.users)
  )
  if (recipients.length === 0) return
  const date = input.booking.date instanceof Date ? input.booking.date : new Date(input.booking.date)
  const dayKey = dayKeyInOrganizationZone(date.toISOString(), input.timeZone)
  const jobName = input.job ? `${input.job.jobNumber} ${input.job.siteName}`.trim() : 'a job'
  const by = input.booking.bookedBy || 'Your manager'
  await Promise.all(
    recipients.map(async (userId) =>
      saveInboxNotification({
        id: await syntheticUuidFromKey(`bookingCreated|${input.booking.id}|${userId}`),
        organizationId: input.booking.organizationId || '',
        type: 'booking_created',
        title: "You've Been Booked",
        message: `${by} booked you for ${jobName} on ${new Intl.DateTimeFormat('en-GB', { timeZone: input.timeZone, day: 'numeric', month: 'short', year: 'numeric' }).format(date)}`,
        userId,
        relatedId: input.booking.projectId,
        dayKey,
        catalogue: input.job ? jobKind(input.job, input.job.collection) : null,
      }).catch(() => undefined)
    )
  )
}
