import { deleteField, getDoc, serverTimestamp, setDoc, updateDoc, type DocumentReference } from 'firebase/firestore'
import type { DocumentWriteFields } from '@/lib/canonical/peopleDocuments'
import { writeMetadataFields } from '@/lib/canonical/writeMetadata'
import { EDIT_OF_MISSING_DOCUMENT_MESSAGE } from '@/lib/canonical/liveSources'

/**
 * Web glue for the rulebook partial-write helpers (`documentWriteFields`, `jobWriteFields`, `bookingUpdateWriteFields`,
 * `subcontractorBookingWriteFields`, `operativeRowWriteFields`,
 * `managerRowWriteFields`, `clientWriteFields`, `subcontractorWriteFields`; rulebook §1 "Partial writes only").
 * The rulebook decides which fields change; this file only turns the result into one Firestore call.
 */

function sentinelKind(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null
  const name = (value as { _methodName?: unknown })._methodName
  return typeof name === 'string' ? name : null
}

/** A web payload for the rulebook: `deleteField()` → null (remove), other SDK sentinels left out. */
export function plainWritePayload(payload: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(payload)) {
    const kind = sentinelKind(value)
    if (kind === 'deleteField') out[key] = null
    else if (!kind) out[key] = value
  }
  return out
}

/** The Firestore update map for a rulebook write: `set` plus a delete for each `remove`. */
export function firestoreUpdateFields(write: DocumentWriteFields): Record<string, unknown> {
  const out: Record<string, unknown> = { ...write.set }
  for (const key of write.remove) out[key] = deleteField()
  return out
}

/** The base an edit is diffed against: the editor's loaded copy when given, else the stored copy. */
export function changeBase(
  base: Record<string, unknown> | null | undefined,
  stored: Record<string, unknown>
): Record<string, unknown> {
  if (!base) return stored
  const plain = plainWritePayload(base)
  delete plain.updatedAt
  return plain
}

/** The document an edit was aimed at is gone (deleted elsewhere); the edit is not turned into a create. */
export class MissingDocumentError extends Error {
  readonly code = 'not-found'
  readonly path: string
  constructor(path: string) {
    // Rulebook 1.9.0 `editOfMissingDocumentIsRefused` / `EDIT_OF_MISSING_DOCUMENT_MESSAGE`.
    super(EDIT_OF_MISSING_DOCUMENT_MESSAGE)
    this.name = 'MissingDocumentError'
    this.path = path
  }
}

/**
 * Save a document as a partial update: ask the rulebook helper what changed, write only that (plus `updatedAt`
 * and write metadata). A missing document is created from the payload. Returns whether anything was written.
 *
 * `base` is the copy the editor opened with (serialized like `payload`). When given, the change is diffed against
 * it — the fields this editor changed — never against a fresh server read, so a field changed on another device
 * after the editor opened (and untouched here) is not written back (rulebook §1 "Never re-save what you didn't
 * change", as `timesheetChangedFields` does for timesheets). Without `base`, the stored copy is the base.
 */
export async function savePartialDocument(
  ref: DocumentReference,
  payload: Record<string, unknown>,
  writeFields: (before: Record<string, unknown> | null, next: Record<string, unknown>) => DocumentWriteFields,
  options?: {
    userId?: string | null
    /** `refuse`: an edit of a document that no longer exists throws `MissingDocumentError` instead of creating it. */
    missing?: 'create' | 'refuse'
    /** The copy the editor loaded, serialized like `payload`. */
    base?: Record<string, unknown> | null
  }
): Promise<boolean> {
  const metadata = writeMetadataFields(options?.userId, 'web')
  const snap = await getDoc(ref)
  const next = plainWritePayload(payload)
  delete next.updatedAt
  if (!snap.exists()) {
    if (options?.missing === 'refuse') throw new MissingDocumentError(ref.path)
    const create = writeFields(null, next)
    await setDoc(ref, { ...create.set, updatedAt: serverTimestamp(), ...(metadata ?? {}) })
    return true
  }
  const write = writeFields(changeBase(options?.base, snap.data() as Record<string, unknown>), next)
  if (Object.keys(write.set).length === 0 && write.remove.length === 0) return false
  await updateDoc(ref, { ...firestoreUpdateFields(write), updatedAt: serverTimestamp(), ...(metadata ?? {}) })
  return true
}
