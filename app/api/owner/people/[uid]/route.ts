import { NextRequest } from 'next/server'
import { isFirebaseUser, jsonError } from '@/lib/security/apiGuard'
import { isValidDocumentId } from '@/lib/security/validation'
import { bearerToken, firestoreGet, firestoreRunQuery, restFieldsToPlain, restIn, structuredQuery } from '@/lib/owner/firestoreRest'
import { OWNER_READ_FAILED_MESSAGE, ownerJson, ownerReadGuard, refreshParam } from '@/lib/owner/ownerReadRoute'
import { OwnerPersonNotFoundError, loadOwnerPerson } from '@/lib/owner/personServer'
import {
  PERSON_AUDIT_READ_MAX,
  PERSON_ORGANISATIONS_MAX,
  ownerPersonAudit,
  ownerPersonAuth,
  ownerPersonDocument,
  ownerPersonIds,
  ownerPersonOrganisations,
} from '@/lib/owner/person360'
import { adminGetDocumentFields, adminListDocumentIds, adminLookupAuthRecords, firebaseAdminConfigured } from '@/lib/owner/identityToolkitAdmin'
import { isPlatformOwnerEmail } from '@/lib/platform/owner'
import { stripPersonSearchKey, type PlainDoc } from '@/lib/owner/directory'

export const runtime = 'nodejs'

const PERSON_SERVER_KEY_NOTE =
  'Sign-in facts and memberships in other companies need the server key (FIREBASE_SERVICE_ACCOUNT_JSON) on Netlify.'

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
    const organizationIds = person.row.organizationIds.slice(0, PERSON_ORGANISATIONS_MAX)
    const orgDocs = (
      await Promise.all(
        organizationIds.map(async (id) => {
          const doc = await firestoreGet(token, `organizations/${id}`).catch(() => null)
          return doc ? ({ id, data: restFieldsToPlain(doc.fields) } as PlainDoc) : null
        })
      )
    ).filter((doc): doc is PlainDoc => Boolean(doc))

    const serverKey = firebaseAdminConfigured()
    const memberships = new Map<string, Record<string, unknown>>()
    let membershipsRead = false
    let auth: ReturnType<typeof ownerPersonAuth>[] | null = null
    let serverKeyError: string | null = serverKey ? null : PERSON_SERVER_KEY_NOTE
    if (serverKey) {
      try {
        for (const doc of person.userDocs) {
          const ids = await adminListDocumentIds(`users/${doc.id}/orgMemberships`, 100)
          for (const orgId of ids) {
            if (memberships.has(orgId)) continue
            const fields = await adminGetDocumentFields(`users/${doc.id}/orgMemberships/${orgId}`)
            if (fields) memberships.set(orgId, restFieldsToPlain(fields))
          }
        }
        membershipsRead = true
        auth = (await adminLookupAuthRecords(person.userDocs.map((doc) => doc.id))).map(ownerPersonAuth)
      } catch (error) {
        console.error('[owner/people] server key read', error instanceof Error ? error.name : 'error')
        serverKeyError = 'Sign-in facts could not be read with the server key just now. Try Refresh.'
      }
    }
    const allOrgIds = [...new Set([...organizationIds, ...memberships.keys()])].slice(0, PERSON_ORGANISATIONS_MAX)

    let auditError: string | null = null
    let auditEntries: PlainDoc[] = []
    try {
      const rows = await firestoreRunQuery(
        token,
        structuredQuery('adminAuditLog', restIn('targetUserId', personIds), { limit: PERSON_AUDIT_READ_MAX })
      )
      auditEntries = rows.map((row) => ({ id: row.id, data: restFieldsToPlain(row.fields) }))
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
      organisations: ownerPersonOrganisations({
        organizationIds: allOrgIds,
        userDocs: person.userDocs,
        personIds,
        orgRows: person.orgRows,
        orgDocs,
        memberships,
      }),
      membershipsRead,
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
