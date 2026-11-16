/**
 * Server side of the owner directory: reads `organizations` and `users` with the owner's own ID token over Firestore
 * REST (the security rules let the verified owner read them) and turns them into rows. Nothing is sent to the browser
 * but the page it asked for (PLAN A1: no full collection downloads in the browser).
 */
import { firestoreListCollection, restFieldsToPlain } from '@/lib/owner/firestoreRest'
import { DIRECTORY_SCAN_CAP, ownerOrgRows, ownerPeopleRows, type OwnerOrgRow, type OwnerPersonRow, type PlainDoc } from '@/lib/owner/directory'

export type OwnerDirectoryData = {
  orgRows: OwnerOrgRow[]
  peopleRows: OwnerPersonRow[]
  /** True when a collection reached DIRECTORY_SCAN_CAP: the page says so instead of hiding the rest. */
  truncated: boolean
  /** Documents read on the server for this request (shown in the PR's before/after read counts). */
  documentsRead: number
}

async function readAll(token: string, collection: string): Promise<PlainDoc[]> {
  const rows = await firestoreListCollection(token, collection, DIRECTORY_SCAN_CAP)
  return rows.map((row) => ({ id: row.id, data: restFieldsToPlain(row.fields) }))
}

export async function loadOwnerOrganisations(token: string, nowMs = Date.now()) {
  const docs = await readAll(token, 'organizations')
  return { orgRows: ownerOrgRows(docs, nowMs), truncated: docs.length >= DIRECTORY_SCAN_CAP, documentsRead: docs.length }
}

export async function loadOwnerDirectory(token: string, nowMs = Date.now()): Promise<OwnerDirectoryData> {
  const [orgDocs, userDocs] = await Promise.all([readAll(token, 'organizations'), readAll(token, 'users')])
  const orgRows = ownerOrgRows(orgDocs, nowMs)
  return {
    orgRows,
    peopleRows: ownerPeopleRows(userDocs, orgRows),
    truncated: orgDocs.length >= DIRECTORY_SCAN_CAP || userDocs.length >= DIRECTORY_SCAN_CAP,
    documentsRead: orgDocs.length + userDocs.length,
  }
}
