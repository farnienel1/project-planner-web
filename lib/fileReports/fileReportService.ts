/**
 * Firestore reads and writes for "Report a problem with this file".
 * Document shape and who may review come from lib/canonical/fileReports.ts.
 */

import {
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  type Timestamp,
} from 'firebase/firestore'
import { db } from '@/lib/firebase/config'
import {
  fileReportCollectionPath,
  fileReportReviewWriteFields,
  fileReportWriteFields,
  type FileReportInput,
  type FileReportStatus,
} from '@/lib/canonical'
import { newUppercaseUuid } from '@/lib/ios-parity/uuid'

export type FileReportRow = {
  id: string
  storagePath: string
  surface: string
  parentId: string
  fileName: string
  reason: string
  details: string
  reportedByUserId: string
  status: FileReportStatus
  createdAtMs: number | null
  reviewedByUserId: string | null
}

export async function submitFileReport(input: FileReportInput): Promise<void> {
  const result = fileReportWriteFields(input)
  if (!result.ok) throw new Error(`file report refused: ${result.error}`)
  const reportId = newUppercaseUuid()
  await setDoc(doc(db, fileReportCollectionPath(input.organizationId), reportId), {
    ...result.fields,
    createdAt: serverTimestamp(),
  })
}

function timestampMs(value: unknown): number | null {
  const ts = value as Timestamp | null | undefined
  return ts && typeof ts.toMillis === 'function' ? ts.toMillis() : null
}

export async function listFileReports(organizationId: string): Promise<FileReportRow[]> {
  const snap = await getDocs(query(collection(db, fileReportCollectionPath(organizationId)), orderBy('createdAt', 'desc')))
  return snap.docs.map((row) => {
    const data = row.data()
    const status = data.status === 'reviewed' || data.status === 'removed' ? data.status : 'open'
    return {
      id: row.id,
      storagePath: String(data.storagePath ?? ''),
      surface: String(data.surface ?? ''),
      parentId: String(data.parentId ?? ''),
      fileName: String(data.fileName ?? ''),
      reason: String(data.reason ?? ''),
      details: String(data.details ?? ''),
      reportedByUserId: String(data.reportedByUserId ?? ''),
      status,
      createdAtMs: timestampMs(data.createdAt),
      reviewedByUserId: data.reviewedByUserId ? String(data.reviewedByUserId) : null,
    }
  })
}

export async function closeFileReport(input: {
  organizationId: string
  reportId: string
  status: 'reviewed' | 'removed'
  reviewedByUserId: string
}): Promise<void> {
  const fields = fileReportReviewWriteFields(input)
  if (!fields) throw new Error('file report review refused')
  await updateDoc(doc(db, fileReportCollectionPath(input.organizationId), input.reportId), {
    ...fields,
    reviewedAt: serverTimestamp(),
  })
}
