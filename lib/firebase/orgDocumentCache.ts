import { doc, getDoc, type DocumentSnapshot, type Firestore } from 'firebase/firestore'

/**
 * Boot reads the organisation document from several places within the same
 * second (session hydration, membership probe, roster, job types). Share one
 * read across that burst. The window is short so a settings save followed by a
 * fresh page read still sees the new document.
 */
const SHARE_WINDOW_MS = 2_500

type Entry = { at: number; promise: Promise<DocumentSnapshot> }
const entries = new Map<string, Entry>()

export function readOrganizationDocument(db: Firestore, organizationId: string): Promise<DocumentSnapshot> {
  const now = Date.now()
  const existing = entries.get(organizationId)
  if (existing && now - existing.at < SHARE_WINDOW_MS) return existing.promise
  const promise = getDoc(doc(db, 'organizations', organizationId))
  entries.set(organizationId, { at: now, promise })
  promise.catch(() => {
    if (entries.get(organizationId)?.promise === promise) entries.delete(organizationId)
  })
  return promise
}

export function forgetOrganizationDocument(organizationId: string): void {
  entries.delete(organizationId)
}
