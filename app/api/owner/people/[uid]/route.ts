import { NextRequest } from 'next/server'
import { isFirebaseUser, jsonError } from '@/lib/security/apiGuard'
import { isValidDocumentId } from '@/lib/security/validation'
import { bearerToken, firestoreRunQuery, restFieldsToPlain, restIn, structuredQuery } from '@/lib/owner/firestoreRest'
import { OWNER_READ_FAILED_MESSAGE, ownerJson, ownerReadGuard, refreshParam } from '@/lib/owner/ownerReadRoute'
import { OwnerPersonNotFoundError, loadOwnerPerson, readOwnerPersonOrganisations } from '@/lib/owner/personServer'
import { PERSON_AUDIT_READ_MAX, ownerPersonAudit, ownerPersonAuth, ownerPersonDocument, ownerPersonIds } from '@/lib/owner/person360'
import { adminLookupAuthRecords } from '@/lib/owner/identityToolkitAdmin'
import { isPlatformOwnerEmail } from '@/lib/platform/owner'
import { stripPersonSearchKey, type PlainDoc } from '@/lib/owner/directory'

export const runtime = 'nodejs'

/**
 * GET /api/owner/people/[uid]?refresh= — the person page (spec §4.4): every users document of the person (the
 * directory's one-per-email fold), their organisations and level in each (`organizationLevelFor`), the Firebase Auth
 * record and memberships (server key; "not connected" without it), and the owner actions about them. Read-only.
 * Emails are masked; no pay, tax id or push token ever leaves the server.
 */
export async function GET(request: NextRequest, context: { params: Promise<{ uid: string }> }) {
  const owner = await ownerReadGuard(request, 'owner-person', 60)
  if (!isFirebaseUser(owner)) return owner
  const { uid } = await context.params
  if (!isValidDocumentId(uid)) return jsonError('That person id is not valid.', 400)
  const token = bearerToken(request)
  try {
    const person = await loadOwnerPerson(token, uid, { refresh: refreshParam(request) })
    const personIds = ownerPersonIds(person.row, person.userDocs)
    const orgRead = await readOwnerPersonOrganisations(token, person, personIds)
    const serverKey = orgRead.serverKey
    let auth: ReturnType<typeof ownerPersonAuth>[] | null = null
    let serverKeyError: string | null = orgRead.membershipsError
    if (serverKey && !serverKeyError) {
      try {
        auth = (await adminLookupAuthRecords(person.userDocs.map((doc) => doc.id))).map(ownerPersonAuth)
      } catch (error) {
        console.error('[owner/people] server key read', error instanceof Error ? error.name : 'error')
        serverKeyError = 'Sign-in facts could not be read with the server key just now. Try Refresh.'
      }
    }

    let auditError: string | null = null
    let auditEntries: PlainDoc[] = []
    try {
      // Firestore `in` takes at most 30 values: one query per 30 ids (review of #434).
      const chunks: string[][] = []
      for (let i = 0; i < personIds.length; i += 30) chunks.push(personIds.slice(i, i + 30))
      const results = await Promise.all(
        chunks.map((ids) => firestoreRunQuery(token, structuredQuery('adminAuditLog', restIn('targetUserId', ids), { limit: PERSON_AUDIT_READ_MAX })))
      )
      const seen = new Set<string>()
      for (const row of results.flat()) {
        if (seen.has(row.id)) continue
        seen.add(row.id)
        auditEntries.push({ id: row.id, data: restFieldsToPlain(row.fields) })
      }
    } catch (error) {
      console.error('[owner/people] audit', error)
      auditError = 'Owner actions about this person could not be read.'
    }

    const emails = person.userDocs.map((doc) => (typeof doc.data.email === 'string' ? doc.data.email : ''))
    return ownerJson({
      // The directory row carries the full email for search only: stripped before it leaves the server.
      person: stripPersonSearchKey(person.row),
      documents: person.userDocs.map(ownerPersonDocument),
      personIds,
      organisations: orgRead.organisations,
      membershipsRead: orgRead.membershipsRead,
      auth,
      serverKey,
      serverKeyError,
      audit: ownerPersonAudit(auditEntries, personIds),
      auditTruncated: auditEntries.length >= PERSON_AUDIT_READ_MAX,
      auditError,
      isPlatformOwner: emails.some((email) => isPlatformOwnerEmail(email)) || personIds.includes(owner.uid),
      truncated: person.truncated,
    })
  } catch (error) {
    if (error instanceof OwnerPersonNotFoundError) return jsonError(error.message, 404)
    console.error('[owner/people]', error)
    return jsonError(OWNER_READ_FAILED_MESSAGE, 502)
  }
}
