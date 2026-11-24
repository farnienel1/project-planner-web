import { NextRequest } from 'next/server'
import { apiFlag, apiObject, apiText, readApiBody } from '@/lib/security/apiBody'
import { enforceRateLimit, enforceRateLimitKey, isFirebaseUser, jsonError } from '@/lib/security/apiGuard'
import { isValidDocumentId } from '@/lib/security/validation'
import { ownerFreshnessRefusal, requireOwnerSession } from '@/lib/owner/requireOwner'
import { FirestoreChangedMeanwhileError, bearerToken, firestoreCommitUpdates, firestoreListCollection, restFieldsToPlain } from '@/lib/owner/firestoreRest'
import { OWNER_AUDIT_UNAVAILABLE_MESSAGE, beginOwnerAudit, type OwnerAuditRun } from '@/lib/owner/ownerAudit'
import { clearOwnerDirectoryCache } from '@/lib/owner/directoryServer'
import { ownerJson } from '@/lib/owner/ownerReadRoute'
import { OwnerPersonNotFoundError, loadOwnerPerson, ownerPersonEmails } from '@/lib/owner/personServer'
import {
  nameChangeRefusal,
  ownerNameChangePlan,
  ownerNameFields,
  ownerNamePartError,
  ownerReasonError,
  renameableUserDocs,
  rosterRowsForPerson,
  type RosterRowDoc,
} from '@/lib/owner/personActions'
import { ownerPersonIds } from '@/lib/owner/person360'
import { isPlatformOwnerEmail } from '@/lib/platform/owner'
import { rosterPersonName, type RosterSegmentProfile } from '@/lib/canonical/userRosterSegment'

export const runtime = 'nodejs'

/**
 * POST /api/owner/actions/change-name `{ uid, firstName, surname, reason, preview?, scope?, organizationId? }` — owner console PR 5.
 * 1.82.0 (rulebook §11 "Names per organisation"): always one organisation (`organizationId`): its `memberNames` entry
 * is set and its roster rows renamed; in the person's home organisation its users documents too. `scope` is ignored.
 * Changes a person's first name and surname on every users document of theirs (the directory's one-per-email fold,
 * every organisation) and on the `operatives` / `managers` rows on their email in their organisations, as the apps
 * do when a person's name is saved. Partial updates only (`userProfileWriteFields`, `operativeRowWriteFields`,
 * `managerRowWriteFields`), all in one atomic commit; a document deleted meanwhile refuses the whole change.
 * `preview: true` is a dry run (nothing written, no fresh code needed); the change itself needs a code entered within
 * 10 minutes and a reason, and is audited (`requested` before the write, then `completed` / `failed`).
 * Writes use the owner's own token: the security rules already let the platform owner update `users` and roster rows.
 */
export async function POST(request: NextRequest) {
  const limited = enforceRateLimit(request, 'owner-change-name', 60, 10 * 60 * 1000)
  if (limited) return limited
  const owner = await requireOwnerSession(request)
  if (!isFirebaseUser(owner)) return owner
  const perOwner = enforceRateLimitKey('owner-change-name:uid', owner.uid, 60, 10 * 60 * 1000)
  if (perOwner) return perOwner
  const body = await readApiBody(
    request,
    apiObject({
      uid: apiText(128),
      firstName: apiText(200),
      surname: apiText(200),
      reason: apiText(1000),
      preview: apiFlag(),
      scope: apiText(20),
      organizationId: apiText(128),
    })
  )
  if (!body.ok) return body.response
  const preview = body.value.preview === true
  // Rulebook 1.82.0 §11 "Names per organisation" (owner 24 Nov): a name belongs to one organisation, so the change acts
  // on one organisation at a time (the 1.81.0 "every organisation" scope is gone).
  const scope = 'organization' as const
  const scopedOrgId = (body.value.organizationId || '').trim()
  if (!isValidDocumentId(scopedOrgId)) return jsonError('Choose the organisation first.', 400)
  const uid = (body.value.uid || '').trim()
  if (!isValidDocumentId(uid)) return jsonError('Choose a person first.', 400)
  const firstName = (body.value.firstName || '').trim()
  const surname = (body.value.surname || '').trim()
  const nameError = ownerNamePartError('first name', firstName) || ownerNamePartError('surname', surname)
  if (nameError) return jsonError(nameError, 400)
  if (!preview) {
    const reasonError = ownerReasonError(body.value.reason)
    if (reasonError) return jsonError(reasonError, 400)
  }
  const notFresh = ownerFreshnessRefusal(owner, preview)
  if (notFresh) return notFresh

  const token = bearerToken(request)
  let person: Awaited<ReturnType<typeof loadOwnerPerson>>
  try {
    person = await loadOwnerPerson(token, uid, { refresh: !preview })
  } catch (error) {
    if (error instanceof OwnerPersonNotFoundError) return jsonError(error.message, 404)
    return jsonError('Could not read that person, so nothing was changed. Try again.', 503)
  }
  const allEmails = ownerPersonEmails(person.userDocs)
  if (allEmails.some((email) => isPlatformOwnerEmail(email)) || person.userDocs.some((doc) => doc.id === owner.uid)) {
    return jsonError('The owner account is not changed from this console.', 400)
  }
  // Review of #434: never rename an anonymised deleted profile.
  const refusal = nameChangeRefusal(person.userDocs)
  if (refusal) return jsonError(refusal, 409)
  // The person's email is the one on the directory's kept users document (rulebook `rosterPeople` keeps one per email);
  // a stored same-email id whose email has since changed is someone else now and is left alone.
  const kept = person.userDocs.find((doc) => doc.id === person.row.id) || person.userDocs[0]
  const keptEmail = typeof kept.data?.email === 'string' ? kept.data.email.trim().toLowerCase() : ''
  const emails = keptEmail ? [keptEmail] : allEmails
  const userDocs = renameableUserDocs(
    person.userDocs.map((doc) => ({ ...doc, updateTime: person.updateTimes.get(doc.id) })),
    emails
  )
  const personIds = ownerPersonIds(person.row, userDocs)

  if (scope === 'organization' && !person.row.organizationIds.includes(scopedOrgId)) {
    return jsonError('This person is not in that organisation.', 400)
  }
  const rosterRows: RosterRowDoc[] = []
  const existingMemberNames = new Set<string>()
  const unread: string[] = []
  for (const organizationId of person.row.organizationIds) {
    for (const collection of ['operatives', 'managers'] as const) {
      const path = `organizations/${organizationId}/${collection}`
      try {
        const rows = (await firestoreListCollection(token, path, 5000)).map((row) => ({
          id: row.id,
          data: restFieldsToPlain(row.fields),
          updateTime: row.updateTime,
          organizationId,
          collection,
        }))
        rosterRows.push(...rosterRowsForPerson(rows, emails, personIds))
      } catch {
        unread.push(path)
      }
    }
    if (organizationId === scopedOrgId) {
      const path = `organizations/${organizationId}/memberNames`
      try {
        for (const row of await firestoreListCollection(token, path, 5000)) existingMemberNames.add(`${organizationId}/${row.id}`.toLowerCase())
      } catch {
        unread.push(path)
      }
    }
  }
  // A list the owner could not read would leave that company's copy of the name behind: refuse instead.
  if (unread.length) return jsonError('Could not read every list this person is on, so nothing was changed. Try again.', 503)

  const plan = ownerNameChangePlan({
    firstName,
    surname,
    userDocs,
    rosterRows,
    scope,
    organizationId: scopedOrgId,
    organizationIds: person.row.organizationIds,
    keptUserId: kept.id,
    existingMemberNames,
  })
  const orgName = new Map(person.orgRows.map((org) => [org.id, org.name]))
  const summary = {
    users: plan.users.map((row) => ({ id: row.id, organisation: orgName.get(row.organizationId) || 'No organisation' })),
    rows: plan.rows.map((row) => ({ id: row.id, collection: row.collection, organisation: orgName.get(row.organizationId) || 'Unknown organisation' })),
    memberNames: plan.memberNames.map((row) => ({ action: row.action, organisation: orgName.get(row.organizationId) || 'Unknown organisation' })),
    unchanged: plan.unchanged,
  }
  if (preview) return ownerJson({ preview: true, ...summary })
  if (plan.unchanged) return jsonError('That is already the name on every record.', 400)

  let audit: OwnerAuditRun
  try {
    audit = await beginOwnerAudit(request, owner.uid, {
      action: 'ownerChangeUserName',
      targetUserId: kept.id,
      targetOrgId: (scope === 'organization' ? scopedOrgId : person.row.organizationIds[0]) || undefined,
      reason: body.value.reason,
      before: { name: rosterPersonName(kept.data as RosterSegmentProfile) },
      after: { name: ownerNameFields(firstName, surname).name, documents: plan.writes.length, scope, organizationId: scope === 'organization' ? scopedOrgId : null },
    })
  } catch {
    return jsonError(OWNER_AUDIT_UNAVAILABLE_MESSAGE, 502)
  }
  try {
    await firestoreCommitUpdates(token, plan.writes, owner.uid)
  } catch (error) {
    await audit.fail(error)
    if (error instanceof FirestoreChangedMeanwhileError) return jsonError(error.message, 409)
    return jsonError(error instanceof Error ? error.message : 'The change was refused. Nothing was changed.', 502)
  }
  clearOwnerDirectoryCache()
  await audit.complete()
  return ownerJson({ ok: true, ...summary, requestId: audit.requestId })
}
