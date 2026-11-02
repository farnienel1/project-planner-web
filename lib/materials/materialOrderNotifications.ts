/**
 * iOS parity source: Core/NotificationService.swift notifyMaterialAdded,
 * Views/MaterialsAddWithCatalogueSheet.swift (MaterialOrderRecipientsRulebook).
 *
 * A new material line on a job notifies that job's managers. Who they are is
 * the rulebook's `materialOrderRecipients`; this only gathers its input and
 * writes the `material_order_placed` inbox rows, which the device-push
 * function already sends (`notificationDeliversDevicePush`).
 */

import {
  captureOrganizationContext,
  excludeActor,
  materialOrderRecipients,
  organizationContextStillCurrent,
} from '@/lib/canonical'
import { rulebookPerson, rulebookRoster } from '@/lib/staff/rulebookPeople'
import { saveInboxNotification } from '@/lib/firebase/notifyInbox'
import {
  MATERIAL_ORDER_PLACED_TYPE,
  materialOrderPlacedCopy,
  materialOrderRecipientsInput,
} from '@/lib/materials/materialOrderRecipientsInput'
import { useOperativeStore } from '@/lib/stores/operativeStore'
import { useOrgUserStore } from '@/lib/stores/siteAuditStore'
import type { Project, User } from '@/types'

/**
 * Write one inbox row per job manager. Called after a new line is saved (never
 * on edit); the line is already saved, so a failure here does not undo it.
 */
export async function notifyMaterialOrderPlaced(params: {
  organizationId: string
  project: Pick<Project, 'id' | 'siteName' | 'managerIds'>
  materialName: string
  addedByName: string
  adder: User
}): Promise<number> {
  const { organizationId } = params
  const captured = captureOrganizationContext()
  const operativeState = useOperativeStore.getState()
  if (operativeState.managersLoadedOrgId !== organizationId) {
    await operativeState.loadManagers(organizationId).catch(() => {})
  }
  const userState = useOrgUserStore.getState()
  if (userState.users.length === 0) {
    await userState.loadUsers(organizationId).catch(() => {})
  }
  if (!organizationContextStillCurrent(organizationId, captured)) return 0

  const users = useOrgUserStore.getState().users
  // `materialOrderRecipients`, then `excludeActor` (never the adder under any of their ids, no inactive
  // account). No "all admins" fallback: a job with no managers notifies nobody.
  const recipientIds = excludeActor(
    materialOrderRecipients(
      materialOrderRecipientsInput({
        project: params.project,
        managers: useOperativeStore.getState().managers,
        users,
        adder: params.adder,
      })
    ).map((row) => row.userId),
    rulebookPerson(params.adder, users),
    rulebookRoster(users)
  )
  const copy = materialOrderPlacedCopy({
    addedByName: params.addedByName,
    materialName: params.materialName,
    siteName: params.project.siteName,
  })
  let written = 0
  for (const userId of recipientIds) {
    if (!organizationContextStillCurrent(organizationId, captured)) break
    await saveInboxNotification({
      organizationId,
      type: MATERIAL_ORDER_PLACED_TYPE,
      title: copy.title,
      message: copy.message,
      userId,
      relatedId: params.project.id,
    })
    written += 1
  }
  return written
}
