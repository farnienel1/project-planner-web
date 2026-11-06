/**
 * Rulebook 1.34.0 §11: the web writes for ghost operatives. The rulebook builds every document
 * (`ghostCreateWrites`, `ghostUpgradeWrites`); this file only sends them, adds the server timestamps and tells the
 * admins (`operative_created`, company activity). No rule is decided here.
 */
import { deleteField, doc, serverTimestamp, setDoc, writeBatch } from 'firebase/firestore'
import { getFirebaseDb } from '@/lib/firebase/ensureFirebase'
import { newUuid } from '@/lib/firebase/firestoreUtils'
import { privatePayFor, securitySwitchesReady } from '@/lib/access/securitySwitches'
import {
  GHOST_CREATE_REFUSED_MESSAGE,
  GHOST_UPGRADE_REFUSAL_MESSAGES,
  canCreateGhost,
  ghostCreateError,
  ghostCreateWrites,
  ghostUpgradeRefusal,
  ghostUpgradeWrites,
  type GhostDraft,
  type GhostWrite,
} from '@/lib/canonical'
import { rulebookRoster } from '@/lib/staff/rulebookPeople'
import { loadInviteClaimState } from '@/lib/orgSetup/inviteUserCore'
import { resolveInviteEmailClaim } from '@/lib/canonical/inviteEmailClaim'
import type { User } from '@/types'

function withServerTimes(write: GhostWrite): Record<string, unknown> {
  const out: Record<string, unknown> = { ...write.fields }
  for (const key of write.serverTimestampFields) out[key] = serverTimestamp()
  return out
}

/** Creates a ghost operative and returns its users id. Throws the rulebook's message when refused. */
export async function createGhostOperative(input: {
  organizationId: string
  actor: User
  draft: GhostDraft
  roster: ReadonlyArray<User>
}): Promise<string> {
  if (!canCreateGhost(input.actor)) throw new Error(GHOST_CREATE_REFUSED_MESSAGE)
  const roster = rulebookRoster(input.roster)
  const refusal = ghostCreateError(input.draft, { roster: roster as never })
  if (refusal) throw new Error(refusal)
  await securitySwitchesReady()
  const ghostId = newUuid()
  const plan = ghostCreateWrites({
    organizationId: input.organizationId,
    ghostId,
    draft: input.draft,
    actorUserId: input.actor.id,
    platform: 'web',
    privatePay: privatePayFor(input.organizationId),
    roster: roster as never,
  })
  if (!plan) throw new Error('This ghost could not be saved.')
  const db = getFirebaseDb()
  await setDoc(doc(db, plan.user.path), withServerTimes(plan.user))
  // The pay profile's rule checks the users document, so it follows it (as Add User's pay profile does).
  if (plan.payProfile) await setDoc(doc(db, plan.payProfile.path), withServerTimes(plan.payProfile), { merge: true })
  void (async () => {
    const { notifyCompanyActivity } = await import('@/lib/notifications/companyActivity')
    const name = `${input.draft.firstName ?? ''} ${input.draft.surname ?? ''}`.trim()
    await notifyCompanyActivity({
      organizationId: input.organizationId,
      type: 'operative_created',
      title: 'Operative added',
      message: `${name} was added as an operative with no app login.`,
      relatedId: ghostId,
      actor: input.actor,
      users: input.roster,
    })
  })().catch((error) => console.warn('[ghostWrites] operative_created notice skipped', error))
  return ghostId
}

/**
 * "Give app access" (admins only): one batch — the ghost's email, the invitation and the email claim. The caller has
 * already checked the email is free in this organisation (`resolveInviteEmailClaim`, as Add User). Returns the
 * invitation id for the setup email.
 */
export async function giveGhostAppAccess(input: {
  organizationId: string
  viewer: User
  ghostId: string
  ghost: Record<string, unknown>
  email: string
}): Promise<string> {
  const refusal = ghostUpgradeRefusal(input.viewer as never, input.ghost, input.email)
  if (refusal) throw new Error(GHOST_UPGRADE_REFUSAL_MESSAGES[refusal])
  // The same email check as Add User (`resolveInviteEmailClaim`): a live claim or member on this email blocks it.
  const emailLower = input.email.trim().toLowerCase()
  const claim = await loadInviteClaimState(input.organizationId, emailLower)
  const decision = resolveInviteEmailClaim({ inviteEmail: emailLower, existingUsers: claim.existingUsers, emailPointer: claim.emailPointer })
  if (decision.action === 'block') throw new Error(`A user with email ${emailLower} already exists in this organisation.`)
  const invitationId = newUuid()
  const plan = ghostUpgradeWrites({
    viewer: input.viewer as never,
    organizationId: input.organizationId,
    ghostId: input.ghostId,
    ghost: input.ghost,
    email: input.email,
    invitationId,
    invitedBy: input.viewer.id,
    now: serverTimestamp(),
    actorUserId: input.viewer.id,
    platform: 'web',
  })
  if (!plan) throw new Error('App access could not be given.')
  const db = getFirebaseDb()
  const batch = writeBatch(db)
  const userUpdate: Record<string, unknown> = { ...plan.user.set, updatedAt: serverTimestamp() }
  for (const key of plan.user.remove) userUpdate[key] = deleteField()
  batch.update(doc(db, plan.user.path), userUpdate)
  batch.set(doc(db, plan.invitation.path), plan.invitation.fields)
  batch.set(doc(db, plan.claim.path), plan.claim.fields)
  await batch.commit()
  return invitationId
}
