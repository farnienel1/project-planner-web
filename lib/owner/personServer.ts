/**
 * Server side of the owner console person page and person actions (PR 5): finds the person in the directory (one row
 * per email, rulebook `rosterPeople`) and reads every users document of theirs with the owner's own token.
 */
import { firestoreGet, restFieldsToPlain } from '@/lib/owner/firestoreRest'
import { loadOwnerDirectory } from '@/lib/owner/directoryServer'
import type { OwnerOrgRow, OwnerPersonRow, PlainDoc } from '@/lib/owner/directory'
import { PERSON_USER_DOCS_MAX, findDirectoryPerson } from '@/lib/owner/person360'

export type OwnerPersonContext = {
  row: OwnerPersonRow
  /** Every users document of the person that still exists, the directory's kept one first. */
  userDocs: PlainDoc[]
  orgRows: OwnerOrgRow[]
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
  const docs = await Promise.all(
    ids.map(async (id) => {
      const doc = await firestoreGet(token, `users/${id}`)
      return doc ? ({ id, data: restFieldsToPlain(doc.fields) } as PlainDoc) : null
    })
  )
  const userDocs = docs.filter((doc): doc is PlainDoc => Boolean(doc))
  if (!userDocs.length) throw new OwnerPersonNotFoundError()
  return { row, userDocs, orgRows: directory.orgRows, truncated: directory.truncated }
}

/** Every email the person's users documents hold, lower case. */
export function ownerPersonEmails(userDocs: readonly PlainDoc[]): string[] {
  return [
    ...new Set(
      userDocs.map((doc) => (typeof doc.data?.email === 'string' ? doc.data.email.trim().toLowerCase() : '')).filter(Boolean)
    ),
  ]
}
