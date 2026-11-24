'use client'

/**
 * Web glue for rulebook 1.83.0 §31 (`lib/canonical/orgCompliance.ts`): organisation insurance & accreditations.
 * The rulebook decides the path, the entry and what changes; this file uploads the file and writes one section's list
 * of `organizations/{orgId}/orgCompliance/documents` in a transaction built from the stored document, so an entry
 * added on another device meanwhile is kept. Admins only (firestore.rules / storage.rules enforce it).
 */

import { doc, onSnapshot, runTransaction, serverTimestamp } from 'firebase/firestore'
import { deleteObject, getDownloadURL, ref } from 'firebase/storage'
import { db, storage } from '@/lib/firebase/config'
import { uploadFile } from '@/lib/firebase/storageUtils'
import { assertUploadAllowed } from '@/lib/security/uploadGuard'
import { prepareClientUpload } from '@/lib/security/stripPhotoLocation'
import { writeMetadataFields } from '@/lib/canonical/writeMetadata'
import { safeExternalUrl, uploadFileExtension } from '@/lib/canonical/uploadPolicy'
import {
  ORG_COMPLIANCE_COLLECTION,
  ORG_COMPLIANCE_DOCUMENT_ID,
  ORG_COMPLIANCE_MESSAGES,
  orgComplianceAddWriteFields,
  orgComplianceMergePayload,
  orgComplianceRemoveWriteFields,
  orgComplianceReplaceWriteFields,
  orgComplianceStoragePath,
  orgComplianceUpdateWriteFields,
  parseOrgComplianceDocuments,
  type OrgComplianceDetails,
  type OrgComplianceDocuments,
  type OrgComplianceSectionKey,
  type OrgComplianceWrite,
} from '@/lib/canonical/orgCompliance'

function complianceRef(organizationId: string) {
  if (!db) throw new Error('Firestore is not configured.')
  return doc(db, 'organizations', organizationId, ORG_COMPLIANCE_COLLECTION, ORG_COMPLIANCE_DOCUMENT_ID)
}

/** Live listener on the organisation's document (rulebook §1). Returns the unsubscribe. */
export function subscribeOrgComplianceDocuments(
  organizationId: string,
  onData: (documents: OrgComplianceDocuments) => void,
  onError: (error: Error) => void
): () => void {
  return onSnapshot(
    complianceRef(organizationId),
    (snap) => onData(parseOrgComplianceDocuments(snap.exists() ? (snap.data() as Record<string, unknown>) : null, { organizationId })),
    (error) => onError(error)
  )
}

async function writeSection<T extends { set: OrgComplianceWrite | null }>(
  organizationId: string,
  actorUid: string,
  plan: (stored: Record<string, unknown> | null) => T
): Promise<T> {
  const reference = complianceRef(organizationId)
  return runTransaction(db!, async (transaction) => {
    const snap = await transaction.get(reference)
    const result = plan(snap.exists() ? (snap.data() as Record<string, unknown>) : null)
    if (result.set) {
      // A nested map with merge (never a dotted key, §1): only this section's list is replaced.
      transaction.set(
        reference,
        { ...orgComplianceMergePayload(result.set), updatedAt: serverTimestamp(), ...(writeMetadataFields(actorUid, 'web') ?? {}) },
        { merge: true }
      )
    }
    return result
  })
}

async function deleteObjectQuietly(path: string | null | undefined) {
  if (!storage || !path) return
  await deleteObject(ref(storage, path)).catch(() => {})
}

/** Prepare (photos redrawn, §24) and upload one file to a new compliance object. */
async function uploadComplianceFile(organizationId: string, actorUid: string, picked: File) {
  const prepared = await prepareClientUpload(picked, 'certificate')
  if (prepared.error) throw new Error(prepared.error)
  const file = prepared.file
  const nowMs = Date.now()
  const path = orgComplianceStoragePath({ organizationId, uid: actorUid, unixMs: nowMs, extension: uploadFileExtension(file.name) })
  if (!path) throw new Error('This file cannot be uploaded here.')
  const contentType = await assertUploadAllowed(path, file, file.type)
  await uploadFile(path, file, contentType)
  return { path, fileName: picked.name, contentType, sizeBytes: file.size, uploadedAtMs: nowMs, uploadedBy: actorUid }
}

export async function addOrgComplianceDocument(input: {
  organizationId: string
  section: OrgComplianceSectionKey
  details: OrgComplianceDetails
  file: File
  actorUid: string
  todayKey: string
}): Promise<void> {
  const uploaded = await uploadComplianceFile(input.organizationId, input.actorUid, input.file)
  let result
  try {
    result = await writeSection(input.organizationId, input.actorUid, (stored) =>
      orgComplianceAddWriteFields(stored, {
        section: input.section,
        organizationId: input.organizationId,
        todayKey: input.todayKey,
        details: input.details,
        file: uploaded,
      })
    )
  } catch (error) {
    await deleteObjectQuietly(uploaded.path)
    throw error
  }
  if (result.outcome === 'refused' || result.outcome === 'invalid') {
    await deleteObjectQuietly(uploaded.path)
    throw new Error(result.error ?? 'This document could not be saved. Try again.')
  }
}

export async function updateOrgComplianceDocument(input: {
  organizationId: string
  section: OrgComplianceSectionKey
  entryId: string
  details: OrgComplianceDetails
  actorUid: string
  todayKey: string
}): Promise<void> {
  const result = await writeSection(input.organizationId, input.actorUid, (stored) =>
    orgComplianceUpdateWriteFields(stored, {
      section: input.section,
      organizationId: input.organizationId,
      entryId: input.entryId,
      todayKey: input.todayKey,
      details: input.details,
      updatedAtMs: Date.now(),
      updatedBy: input.actorUid,
    })
  )
  if (result.outcome === 'missing' || result.outcome === 'invalid') throw new Error(result.error ?? ORG_COMPLIANCE_MESSAGES.missing)
}

/** Replace a document's file (a renewal). The old file is deleted; the bucket keeps it for 30 days (§24). */
export async function replaceOrgComplianceFile(input: {
  organizationId: string
  section: OrgComplianceSectionKey
  entryId: string
  details: OrgComplianceDetails
  file: File
  actorUid: string
  todayKey: string
}): Promise<void> {
  const uploaded = await uploadComplianceFile(input.organizationId, input.actorUid, input.file)
  let result
  try {
    result = await writeSection(input.organizationId, input.actorUid, (stored) =>
      orgComplianceReplaceWriteFields(stored, {
        section: input.section,
        organizationId: input.organizationId,
        entryId: input.entryId,
        todayKey: input.todayKey,
        details: input.details,
        file: uploaded,
      })
    )
  } catch (error) {
    await deleteObjectQuietly(uploaded.path)
    throw error
  }
  if (result.outcome === 'missing' || result.outcome === 'invalid') {
    await deleteObjectQuietly(uploaded.path)
    throw new Error(result.error ?? 'This document could not be saved. Try again.')
  }
  await deleteObjectQuietly(result.replacedPath)
}

/** Remove a document and its file (admins: recoverable for 30 days by the bucket's soft delete, §24). */
export async function removeOrgComplianceDocument(input: {
  organizationId: string
  section: OrgComplianceSectionKey
  entryId: string
  actorUid: string
}): Promise<void> {
  const result = await writeSection(input.organizationId, input.actorUid, (stored) =>
    orgComplianceRemoveWriteFields(stored, { section: input.section, organizationId: input.organizationId, entryId: input.entryId })
  )
  await deleteObjectQuietly(result.removedPath)
}

/** Open the file: its Storage download URL (only admins can read the object), through `safeExternalUrl`. */
export async function openOrgComplianceFile(path: string): Promise<void> {
  if (!storage) throw new Error('File storage is not configured.')
  const url = safeExternalUrl(await getDownloadURL(ref(storage, path)))
  if (!url) throw new Error('This file cannot be opened.')
  window.open(url, '_blank', 'noopener,noreferrer')
}
