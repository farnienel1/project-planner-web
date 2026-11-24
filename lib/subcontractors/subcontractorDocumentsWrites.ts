'use client'

/**
 * Web glue for rulebook 1.80.0 subcontractor documents (`lib/canonical/subcontractorDocuments.ts`). The rulebook
 * decides the path, the list and what changes; this file only uploads the file and writes one field-path update of
 * the firm document inside a transaction (so an entry added on another device meanwhile is kept).
 */

import { doc, runTransaction, serverTimestamp } from 'firebase/firestore'
import { deleteObject, ref } from 'firebase/storage'
import { db, storage } from '@/lib/firebase/config'
import { uploadFile } from '@/lib/firebase/storageUtils'
import { assertUploadAllowed } from '@/lib/security/uploadGuard'
import { writeMetadataFields } from '@/lib/canonical/writeMetadata'
import { uploadFileExtension } from '@/lib/canonical/uploadPolicy'
import { EDIT_OF_MISSING_DOCUMENT_MESSAGE } from '@/lib/canonical/liveSources'
import {
  SUBCONTRACTOR_DOCUMENTS_FULL_MESSAGE,
  subcontractorDocumentAddWriteFields,
  subcontractorDocumentExpiryWriteFields,
  subcontractorDocumentRemoveWriteFields,
  subcontractorDocumentStoragePath,
  type SubcontractorDocumentKind,
  type SubcontractorDocumentWrite,
} from '@/lib/canonical/subcontractorDocuments'

function firmRef(organizationId: string, subcontractorId: string) {
  if (!db) throw new Error('Firestore is not configured.')
  return doc(db, 'organizations', organizationId, 'subcontractors', subcontractorId)
}

async function writeList(
  organizationId: string,
  subcontractorId: string,
  actorUid: string,
  plan: (stored: Record<string, unknown>) => { set: SubcontractorDocumentWrite | null } & Record<string, unknown>
) {
  const reference = firmRef(organizationId, subcontractorId)
  return runTransaction(db!, async (transaction) => {
    const snap = await transaction.get(reference)
    // Rulebook 1.9.0: an edit of a document deleted elsewhere is refused, never re-created.
    if (!snap.exists()) throw new Error(EDIT_OF_MISSING_DOCUMENT_MESSAGE)
    const result = plan(snap.data() as Record<string, unknown>)
    if (result.set) {
      transaction.update(reference, {
        [result.set.fieldPath]: result.set.value,
        updatedAt: serverTimestamp(),
        ...(writeMetadataFields(actorUid, 'web') ?? {}),
      })
    }
    return result
  })
}

async function deleteObjectQuietly(path: string) {
  if (!storage || !path) return
  await deleteObject(ref(storage, path)).catch(() => {})
}

/**
 * Upload one file and link it. A file uploaded but refused (list full) or not linked because the save failed is
 * deleted again by its uploader (inside the §24 undo window), so no unlinked file is left.
 */
export async function uploadSubcontractorDocument(input: {
  organizationId: string
  subcontractorId: string
  kind: SubcontractorDocumentKind
  file: File
  expiresOn: string | null
  actorUid: string
}): Promise<void> {
  const nowMs = Date.now()
  const path = subcontractorDocumentStoragePath({
    organizationId: input.organizationId,
    subcontractorId: input.subcontractorId,
    uid: input.actorUid,
    unixMs: nowMs,
    extension: uploadFileExtension(input.file.name),
  })
  if (!path) throw new Error('This file cannot be uploaded here.')
  // §24: the type stored on the entry is the one the bytes were checked as (and the object is written with), never
  // the browser's guess from the file name.
  const contentType = await assertUploadAllowed(path, input.file, input.file.type)
  await uploadFile(path, input.file, contentType)
  let outcome: string
  try {
    const result = await writeList(input.organizationId, input.subcontractorId, input.actorUid, (stored) =>
      subcontractorDocumentAddWriteFields(stored, {
        kind: input.kind,
        subcontractorId: input.subcontractorId,
        organizationId: input.organizationId,
        entry: {
          path,
          name: input.file.name,
          contentType,
          sizeBytes: input.file.size,
          uploadedAtMs: nowMs,
          uploadedBy: input.actorUid,
          expiresOn: input.expiresOn,
        },
      })
    )
    outcome = String(result.outcome)
  } catch (error) {
    await deleteObjectQuietly(path)
    throw error
  }
  if (outcome === 'refused') {
    await deleteObjectQuietly(path)
    throw new Error(SUBCONTRACTOR_DOCUMENTS_FULL_MESSAGE)
  }
  if (outcome === 'invalid') {
    await deleteObjectQuietly(path)
    throw new Error('This document could not be saved. Try again.')
  }
}

/** Unlink one document. The Storage object is deleted only when `deleteFile` (the caller's §24 check) allows it. */
export async function removeSubcontractorDocument(input: {
  organizationId: string
  subcontractorId: string
  kind: SubcontractorDocumentKind
  entryId: string
  actorUid: string
  deleteFile: boolean
}): Promise<void> {
  const result = await writeList(input.organizationId, input.subcontractorId, input.actorUid, (stored) =>
    subcontractorDocumentRemoveWriteFields(stored, { kind: input.kind, subcontractorId: input.subcontractorId, entryId: input.entryId })
  )
  const path = typeof result.removedPath === 'string' ? result.removedPath : ''
  if (input.deleteFile && path) await deleteObjectQuietly(path)
}

export async function setSubcontractorDocumentExpiry(input: {
  organizationId: string
  subcontractorId: string
  kind: SubcontractorDocumentKind
  entryId: string
  expiresOn: string | null
  actorUid: string
}): Promise<void> {
  const result = await writeList(input.organizationId, input.subcontractorId, input.actorUid, (stored) =>
    subcontractorDocumentExpiryWriteFields(stored, {
      kind: input.kind,
      subcontractorId: input.subcontractorId,
      entryId: input.entryId,
      expiresOn: input.expiresOn,
    })
  )
  if (result.outcome === 'missing') throw new Error('This document was removed on another device.')
  if (result.outcome === 'invalid') throw new Error('Enter the expiry date as a date, or leave it empty.')
}
