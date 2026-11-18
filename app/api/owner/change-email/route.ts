import { NextRequest, NextResponse } from 'next/server'
import { apiObject, apiText, readApiBody } from '@/lib/security/apiBody'
import { z } from 'zod'
import { isPlatformOwnerEmail } from '@/lib/platform/owner'
import { enforceRateLimit, isFirebaseUser, jsonError } from '@/lib/security/apiGuard'
import { requireOwner } from '@/lib/owner/requireOwner'
import { clearOwnerDirectoryCache } from '@/lib/owner/directoryServer'
import { OWNER_AUDIT_UNAVAILABLE_MESSAGE, beginOwnerAudit, type OwnerAuditRun } from '@/lib/owner/ownerAudit'
import { isValidDocumentId, isValidEmail } from '@/lib/security/validation'
import { adminListDocumentIds, adminUpdateAuthEmail, firebaseAdminConfigured } from '@/lib/owner/identityToolkitAdmin'
import { firebaseDefaultPasswordReset, sendBrandedPasswordReset } from '@/lib/auth/passwordResetServer'
import {
  bearerToken,
  firestoreDelete,
  firestoreGet,
  firestorePatch,
  firestoreListCollection,
  readString,
  restFieldsToPlain,
  stringField,
} from '@/lib/owner/firestoreRest'
import { orgEmailPointerUserId } from '@/lib/orgSetup/staleOrgEmailPointer'
import {
  CHANGE_EMAIL_CLAIM_TAKEN_MESSAGE,
  CHANGE_EMAIL_HOME_ONLY_NOTE,
  changeEmailOrganizations,
  claimMoves,
  readMembershipIds,
  rosterRowsOnEmail,
  type ClaimState,
} from '@/lib/owner/changeEmailPlan'
import { documentOrganizationId } from '@/lib/canonical/peopleDocuments'
import { passwordResetActionSettings } from '@/lib/auth/passwordResetSettings'

export const runtime = 'nodejs'

/** Roster rows on the old email in any letter case (`rosterRowsOnEmail`); failures are returned, never swallowed. */
async function syncRosterEmail(token: string, organizationId: string, oldEmail: string, newEmail: string): Promise<string[]> {
  const failed: string[] = []
  if (!token || !oldEmail) return failed
  for (const collectionId of ['operatives', 'managers']) {
    const collectionPath = `organizations/${organizationId}/${collectionId}`
    let rows: { id: string; email: string }[] = []
    try {
      rows = (await firestoreListCollection(token, collectionPath, 5000)).map((row) => ({
        id: row.id,
        email: readString(row.fields, 'email'),
      }))
    } catch (error) {
      console.error('[owner/change-email] roster list', collectionPath, error)
      failed.push(`${collectionPath} (could not be read)`)
      continue
    }
    for (const row of rosterRowsOnEmail(rows, oldEmail)) {
      const path = `${collectionPath}/${row.id}`
      await firestorePatch(token, path, { email: stringField(newEmail) }, ['email']).catch((error) => {
        console.error('[owner/change-email] roster', path, error)
        failed.push(path)
      })
    }
  }
  return failed
}

async function claimUserId(token: string, organizationId: string, email: string): Promise<string> {
  const claim = await firestoreGet(token, `organizations/${organizationId}/userEmails/${encodeURIComponent(email)}`)
  return claim ? orgEmailPointerUserId(restFieldsToPlain(claim.fields)) : ''
}

export async function POST(request: NextRequest) {
  const limited = enforceRateLimit(request, 'owner-change-email', 20, 10 * 60 * 1000)
  if (limited) return limited
  const owner = await requireOwner(request)
  if (!isFirebaseUser(owner)) return owner
  const body = await readApiBody(request, apiObject({ uid: apiText(128), newEmail: apiText(254), reason: apiText(1000), sendReset: z.unknown().optional() }))
  if (!body.ok) return body.response
  const uid = (body.value.uid || '').trim()
  const newEmail = (body.value.newEmail || '').trim().toLowerCase()
  const reason = (body.value.reason || '').trim()
  const sendReset = body.value.sendReset !== false
  if (!uid || !isValidEmail(newEmail)) return jsonError('Choose a user and enter a valid new login email.', 400)
  if (!isValidDocumentId(uid)) return jsonError('uid is not valid', 400)
  if (isPlatformOwnerEmail(newEmail)) return jsonError('That email is reserved for the platform owner.', 400)
  if (uid === owner.uid) return jsonError('The owner login email cannot be changed from this console.', 400)
  if (!firebaseAdminConfigured()) {
    return jsonError(
      'Changing a login email needs FIREBASE_SERVICE_ACCOUNT_JSON on the server so Auth can be updated. Password reset still works without it.',
      501
    )
  }

  const token = bearerToken(request)
  let userDoc: Awaited<ReturnType<typeof firestoreGet>>
  try {
    userDoc = await firestoreGet(token, `users/${uid}`)
  } catch (error) {
    console.error('[owner/change-email] read user', error)
    return jsonError('Could not read that user record, so nothing was changed. Try again.', 503)
  }
  if (!userDoc) return jsonError('That user record was not found.', 404)
  const oldEmail = readString(userDoc.fields, 'email').toLowerCase()
  if (isPlatformOwnerEmail(oldEmail)) {
    return jsonError('The owner login email cannot be changed from this console.', 400)
  }
  if (oldEmail && oldEmail === newEmail) {
    return jsonError('That is already the login email.', 400)
  }

  // Every organisation the person belongs to: the home company (an id, a path or a reference, rulebook
  // `documentOrganizationId`) and each membership. Memberships are listed with the server key: the security rules let
  // only the person list `users/{uid}/orgMemberships`. If that fails, the home company alone, said in the response.
  const membershipRead = await readMembershipIds([
    () => adminListDocumentIds(`users/${uid}/orgMemberships`, 500),
    async () => (await firestoreListCollection(token, `users/${uid}/orgMemberships`, 500)).map((row) => row.id),
  ])
  const homeRaw = restFieldsToPlain(userDoc.fields).organizationId
  const homeOrgId = documentOrganizationId(homeRaw) || ''
  const organizationIds = changeEmailOrganizations(homeRaw, membershipRead.ids)
  const organizationId = organizationIds[0] || ''
  let moves: ReturnType<typeof claimMoves>
  try {
    const claims: ClaimState[] = []
    for (const orgId of organizationIds) {
      claims.push({
        orgId,
        oldOwner: oldEmail ? await claimUserId(token, orgId, oldEmail) : null,
        newOwner: await claimUserId(token, orgId, newEmail),
      })
    }
    // The new claim goes only to the home company and where the old claim names this person; a new claim that names
    // someone else there (e.g. a pending invite placeholder, which has no Auth account, so Auth does not refuse the
    // email) refuses the whole change before Auth or Firestore is touched.
    moves = claimMoves({ uid, homeOrgId, claims })
  } catch {
    return jsonError('Could not check who holds this email. Nothing was changed.', 503)
  }
  if (moves.refuse) return jsonError(CHANGE_EMAIL_CLAIM_TAKEN_MESSAGE, 409)

  // Owner console PLAN A4: `requested` is stored before Auth or Firestore is touched, or nothing changes.
  let audit: OwnerAuditRun
  try {
    audit = await beginOwnerAudit(request, owner.uid, {
      action: 'ownerChangeUserEmail',
      targetUserId: uid,
      targetOrgId: organizationId || undefined,
      reason: reason || undefined,
      before: { email: oldEmail },
      after: { email: newEmail, sendReset, organizations: organizationIds.length },
    })
  } catch {
    return jsonError(OWNER_AUDIT_UNAVAILABLE_MESSAGE, 502)
  }

  try {
    await adminUpdateAuthEmail(uid, newEmail)
  } catch (error) {
    await audit.fail(error, { step: 'auth' })
    return jsonError(error instanceof Error ? error.message : 'Could not update the Firebase login email.', 502)
  }

  const incomplete: string[] = []
  try {
    await firestorePatch(token, `users/${uid}`, { email: stringField(newEmail) }, ['email'])
  } catch (error) {
    console.error('[owner/change-email] firestore', error)
    await audit.fail(error, { step: 'users document', authEmailChanged: true })
    return jsonError(
      'Firebase Auth email was updated, but the user record could not be saved. Try again or contact support with the user id.',
      502
    )
  }
  for (const orgId of moves.writes) {
    const newClaimPath = `organizations/${orgId}/userEmails/${encodeURIComponent(newEmail)}`
    await firestorePatch(token, newClaimPath, { userId: stringField(uid) }, ['userId']).catch((error) => {
      console.error('[owner/change-email] claim', newClaimPath, error)
      incomplete.push(newClaimPath)
    })
  }
  for (const orgId of moves.deletes) {
    if (!oldEmail) break
    const oldClaimPath = `organizations/${orgId}/userEmails/${encodeURIComponent(oldEmail)}`
    await firestoreDelete(token, oldClaimPath).catch((error) => {
      console.error('[owner/change-email] old claim', oldClaimPath, error)
      incomplete.push(oldClaimPath)
    })
  }
  for (const orgId of organizationIds) {
    incomplete.push(...(await syncRosterEmail(token, orgId, oldEmail, newEmail)))
  }
  if (!membershipRead.complete) incomplete.push(CHANGE_EMAIL_HOME_ONLY_NOTE)

  if (sendReset) {
    const settings = passwordResetActionSettings(newEmail)
    // The branded reset email (owner request 17 Nov); Firebase's own email only when it cannot be sent.
    try {
      await sendBrandedPasswordReset({ email: newEmail, continueUrl: settings.url, reason: 'emailChanged', idToken: token })
    } catch {
      await firebaseDefaultPasswordReset(newEmail, settings.url).catch(() => undefined)
    }
  }

  clearOwnerDirectoryCache()
  await audit.complete({
    email: newEmail,
    sendReset,
    organizations: organizationIds.length,
    membershipsRead: membershipRead.complete,
    incomplete: incomplete.length,
  })
  // Writes that failed are reported (the Auth email already changed), never swallowed.
  return NextResponse.json({ ok: true, uid, email: newEmail, incomplete, membershipsRead: membershipRead.complete, requestId: audit.requestId })
}
