import { NextRequest } from 'next/server'
import { apiFlag, apiObject, apiText, readApiBody } from '@/lib/security/apiBody'
import { enforceRateLimit, enforceRateLimitKey, isFirebaseUser, jsonError } from '@/lib/security/apiGuard'
import { isValidDocumentId } from '@/lib/security/validation'
import { ownerFreshnessRefusal, requireOwnerSession } from '@/lib/owner/requireOwner'
import { bearerToken, firestoreCommitUpdates, firestoreListCollection, restFieldsToPlain } from '@/lib/owner/firestoreRest'
import { OWNER_AUDIT_UNAVAILABLE_MESSAGE, beginOwnerAudit, type OwnerAuditRun } from '@/lib/owner/ownerAudit'
import { clearOwnerDirectoryCache } from '@/lib/owner/directoryServer'
import { ownerJson } from '@/lib/owner/ownerReadRoute'
import { OwnerPersonNotFoundError, loadOwnerPerson, ownerPersonEmails } from '@/lib/owner/personServer'
import { ownerNameChangePlan, ownerNamePartError, ownerNameFields, ownerReasonError, rosterRowsForEmails, type RosterRowDoc } from '@/lib/owner/personActions'
import { isPlatformOwnerEmail } from '@/lib/platform/owner'
import { rosterPersonName, type RosterSegmentProfile } from '@/lib/canonical/userRosterSegment'

export const runtime = 'nodejs'

/**
 * POST /api/owner/actions/change-name `{ uid, firstName, surname, reason, preview? }` — owner console PR 5.
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
    apiObject({ uid: apiText(128), firstName: apiText(200), surname: apiText(200), reason: apiText(1000), preview: apiFlag() })
  )
  if (!body.ok) return body.response
  const preview = body.value.preview === true
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
  const emails = ownerPersonEmails(person.userDocs)
  if (emails.some((email) => isPlatformOwnerEmail(email)) || person.userDocs.some((doc) => doc.id === owner.uid)) {
    return jsonError('The owner account is not changed from this console.', 400)
  }

  const rosterRows: RosterRowDoc[] = []
  const unread: string[] = []
  for (const organizationId of person.row.organizationIds) {
    for (const collection of ['operatives', 'managers'] as const) {
      const path = `organizations/${organizationId}/${collection}`
      try {
        const rows = (await firestoreListCollection(token, path, 5000)).map((row) => ({
          id: row.id,
          data: restFieldsToPlain(row.fields),
          organizationId,
          collection,
        }))
        rosterRows.push(...rosterRowsForEmails(rows, emails))
      } catch {
        unread.push(path)
      }
    }
  }
  // A list the owner could not read would leave that company's copy of the name behind: refuse instead.
  if (unread.length) return jsonError('Could not read every list this person is on, so nothing was changed. Try again.', 503)

  const plan = ownerNameChangePlan({ firstName, surname, userDocs: person.userDocs, rosterRows })
  const orgName = new Map(person.orgRows.map((org) => [org.id, org.name]))
  const summary = {
    users: plan.users.map((row) => ({ id: row.id, organisation: orgName.get(row.organizationId) || 'No organisation' })),
    rows: plan.rows.map((row) => ({ id: row.id, collection: row.collection, organisation: orgName.get(row.organizationId) || 'Unknown organisation' })),
    unchanged: plan.unchanged,
  }
  if (preview) return ownerJson({ preview: true, ...summary })
  if (plan.unchanged) return jsonError('That is already the name on every record.', 400)

  const kept = person.userDocs[0]
  let audit: OwnerAuditRun
  try {
    audit = await beginOwnerAudit(request, owner.uid, {
      action: 'ownerChangeUserName',
      targetUserId: kept.id,
      targetOrgId: person.row.organizationIds[0] || undefined,
      reason: body.value.reason,
      before: { name: rosterPersonName(kept.data as RosterSegmentProfile) },
      after: { name: ownerNameFields(firstName, surname).name, documents: plan.writes.length },
    })
  } catch {
    return jsonError(OWNER_AUDIT_UNAVAILABLE_MESSAGE, 502)
  }
  try {
    await firestoreCommitUpdates(token, plan.writes, owner.uid)
  } catch (error) {
    await audit.fail(error)
    return jsonError(error instanceof Error ? error.message : 'The change was refused. Nothing was changed.', 502)
  }
  clearOwnerDirectoryCache()
  await audit.complete()
  return ownerJson({ ok: true, ...summary, requestId: audit.requestId })
}
