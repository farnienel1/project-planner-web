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

export async function notifyBookingCreated(input: {
  booking: Booking
  job: Project | null | undefined
  actor: User | null
  users: ReadonlyArray<User>
  operatives: ReadonlyArray<{ id: string; email?: string | null }>
  timeZone: string
}): Promise<void> {
  const operativeId = String(input.booking.operativeId ?? '').trim()
  if (!operativeId) return
  const actor = input.actor ? rulebookPerson(input.actor, input.users) : null
  // Rulebook 1.16.0 §13: the booked id (operatives row, former / same-email id, any case) resolves to the person's
  // signed-in account inside the recipient rule (`notificationRecipientAccountId`), one row per person.
  const recipients = bookingCreatedRecipients(
    [operativeId],
    actor,
    rulebookRoster(input.users),
    input.operatives.map((row) => ({ id: row.id, email: row.email ?? null }))
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
