/**
 * Company activity notices (rulebook 1.4.0 §13): `operative_created`, `manager_created`, `client_created`,
 * `project_created`, `small_works_created`, `warning_removed`. One inbox row per admin from
 * `companyActivityRecipients(actor, roster)` (active admins and super admins outside operative mode, never the
 * actor), each with `userId` and `actorUserId`. A row without `userId` is never written.
 */
import { companyActivityRecipients, COMPANY_ACTIVITY_NOTICE_TYPES } from '@/lib/canonical'
import { saveInboxNotification } from '@/lib/firebase/notifyInbox'
import { rulebookPerson, rulebookRoster } from '@/lib/staff/rulebookPeople'
import type { User } from '@/types'

export type CompanyActivityType = (typeof COMPANY_ACTIVITY_NOTICE_TYPES)[number]

export async function notifyCompanyActivity(input: {
  organizationId: string
  type: CompanyActivityType
  title: string
  message: string
  /** Rulebook 1.40.0: inbox-only text under the message, never pushed. */
  detail?: string | null
  relatedId?: string | null
  requiresPermission?: string | null
  /** The signed-in user who caused it. */
  actor: User | null | undefined
  /** The organisation roster (`users` on `organizationId`). */
  users: ReadonlyArray<User>
}): Promise<number> {
  const organizationId = input.organizationId.trim()
  if (!organizationId) return 0
  const actor = input.actor ? rulebookPerson(input.actor, input.users) : null
  const recipients = companyActivityRecipients(actor, rulebookRoster(input.users))
  await Promise.all(
    recipients.map((userId) =>
      saveInboxNotification({
        organizationId,
        type: input.type,
        title: input.title,
        message: input.message,
        detail: input.detail ?? null,
        userId,
        relatedId: input.relatedId ?? null,
        requiresPermission: input.requiresPermission ?? null,
      })
    )
  )
  return recipients.length
}
