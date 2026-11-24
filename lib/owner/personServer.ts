/**
 * Server side of the owner console person page and person actions (PR 5): finds the person in the directory (one row
 * per email, rulebook `rosterPeople`) and reads every users document of theirs with the owner's own token.
 */
import { MEMBER_NAMES_COLLECTION, parseMemberNameDocuments, type MemberNames } from '@/lib/canonical/memberNames'
import { firestoreGet, restFieldsToPlain } from '@/lib/owner/firestoreRest'
import { loadOwnerDirectory } from '@/lib/owner/directoryServer'
import type { OwnerOrgRow, OwnerPersonRow, PlainDoc } from '@/lib/owner/directory'
import {
  PERSON_ORGANISATIONS_MAX,
  PERSON_USER_DOCS_MAX,
  findDirectoryPerson,
  ownerPersonOrganisations,
  storedLineManagerIds,
  type OwnerPersonOrganisation,
} from '@/lib/owner/person360'
import { documentOrganizationId } from '@/lib/canonical/peopleDocuments'
import { isValidDocumentId } from '@/lib/security/validation'
import { adminGetDocumentFields, adminListDocumentIds, firebaseAdminConfigured } from '@/lib/owner/identityToolkitAdmin'

export type OwnerPersonContext = {
  row: OwnerPersonRow
  /** Every users document of the person that still exists, the directory's kept one first. */
  userDocs: PlainDoc[]
  /** Each users document's `updateTime` as read (review of #434: the precondition of a write). */
  updateTimes: Map<string, string>
  orgRows: OwnerOrgRow[]
  /** Every users document the directory read (server only): line managers are resolved on it. */
  allUserDocs: PlainDoc[]
  truncated: boolean
}

export class OwnerPersonNotFoundError extends Error {
  constructor() {
    super('That person was not found.')
    this.name = 'OwnerPersonNotFoundError'
  }
}

/** Throws OwnerPersonNotFoundError when the id is no users document the directory knows; other errors when a read fails. */
export async function loadOwnerPerson(token: string, uid: string, options: { refresh?: boolean } = {}): Promise<OwnerPersonContext> {
  const directory = await loadOwnerDirectory(token, { refresh: options.refresh })
  const row = findDirectoryPerson(directory.peopleRows, uid)
  if (!row) throw new OwnerPersonNotFoundError()
  const ids = row.userIds.slice(0, PERSON_USER_DOCS_MAX)
  const updateTimes = new Map<string, string>()
  const docs = await Promise.all(
    ids.map(async (id) => {
      const doc = await firestoreGet(token, `users/${id}`)
      if (doc?.updateTime) updateTimes.set(id, doc.updateTime)
      return doc ? ({ id, data: restFieldsToPlain(doc.fields) } as PlainDoc) : null
    })
  )
  const userDocs = docs.filter((doc): doc is PlainDoc => Boolean(doc))
  if (!userDocs.length) throw new OwnerPersonNotFoundError()
  return { row, userDocs, updateTimes, orgRows: directory.orgRows, allUserDocs: directory.userDocs, truncated: directory.truncated }
}

/** Every email the person's users documents hold, lower case. */
export function ownerPersonEmails(userDocs: readonly PlainDoc[]): string[] {
  return [
    ...new Set(
      userDocs.map((doc) => (typeof doc.data?.email === 'string' ? doc.data.email.trim().toLowerCase() : '')).filter(Boolean)
    ),
  ]
}

export const PERSON_SERVER_KEY_NOTE =
  'Sign-in facts and memberships in other companies need the server key (FIREBASE_SERVICE_ACCOUNT_JSON) on Netlify.'

export type OwnerPersonOrganisationsRead = {
  organisations: OwnerPersonOrganisation[]
  /** True when the memberships in other companies were read with the server key. */
  membershipsRead: boolean
  serverKey: boolean
  /** Why the memberships could not be read (no server key, or the read failed), else null. */
  membershipsError: string | null
  /** The directory read stopped at DIRECTORY_SCAN_CAP: names and line managers may be missing people. */
  truncated: boolean
}

/**
 * The organisations the person belongs to, as the person page and the People list show them: the directory's
 * organisations plus their memberships (server key), each with their level there (`organizationLevelFor`), their name
 * there (rulebook 1.82.0 `memberNames`, read by id), whether they are active there and their line manager there.
 * Shared by `/api/owner/people/[uid]` and `/api/owner/people/[uid]/organisations` so both show the same thing.
 */
export async function readOwnerPersonOrganisations(
  token: string,
  person: OwnerPersonContext,
  personIds: readonly string[]
): Promise<OwnerPersonOrganisationsRead> {
  const organizationIds = person.row.organizationIds.slice(0, PERSON_ORGANISATIONS_MAX)
  const serverKey = firebaseAdminConfigured()
  const memberships = new Map<string, Record<string, unknown>>()
  let membershipsRead = false
  let membershipsError: string | null = serverKey ? null : PERSON_SERVER_KEY_NOTE
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
    } catch (error) {
      console.error('[owner/people] memberships read', error instanceof Error ? error.name : 'error')
      membershipsError = 'Sign-in facts could not be read with the server key just now. Try Refresh.'
    }
  }
  const allOrgIds = [...new Set([...organizationIds, ...memberships.keys()])].slice(0, PERSON_ORGANISATIONS_MAX)
  const orgDocs = (
    await Promise.all(
      allOrgIds.map(async (id) => {
        const doc = await firestoreGet(token, `organizations/${id}`).catch(() => null)
        return doc ? ({ id, data: restFieldsToPlain(doc.fields) } as PlainDoc) : null
      })
    )
  ).filter((doc): doc is PlainDoc => Boolean(doc))
  // Rulebook 1.82.0 §11: the person's name in each organisation — its `memberNames` entries for their ids — and their
  // line managers' names there (the ids stored on their users document of that organisation), read by id (a refused
  // or failed read shows the account name, never a blank).
  const memberNames = new Map<string, MemberNames>()
  await Promise.all(
    allOrgIds.map(async (orgId) => {
      const homeDoc = person.userDocs.find((doc) => (documentOrganizationId(doc.data?.organizationId) || '') === orgId)
      const ids = [...new Set([...person.userDocs.map((doc) => doc.id), ...storedLineManagerIds(homeDoc?.data)])].filter((id) => isValidDocumentId(id))
      const docs = await Promise.all(
        ids.map(async (id) => {
          const found = await firestoreGet(token, `organizations/${orgId}/${MEMBER_NAMES_COLLECTION}/${encodeURIComponent(id)}`).catch(() => null)
          return found ? { id, data: restFieldsToPlain(found.fields) } : null
        })
      )
      memberNames.set(orgId, parseMemberNameDocuments(docs.filter((row): row is { id: string; data: Record<string, unknown> } => Boolean(row))))
    })
  )
  return {
    organisations: ownerPersonOrganisations({
      organizationIds: allOrgIds,
      userDocs: person.userDocs,
      personIds,
      orgRows: person.orgRows,
      orgDocs,
      memberships,
      memberNames,
      allUserDocs: person.allUserDocs,
      truncated: person.truncated,
    }),
    truncated: person.truncated,
    membershipsRead,
    serverKey,
    membershipsError,
  }
}
