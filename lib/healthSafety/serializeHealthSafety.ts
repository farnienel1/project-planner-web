import { Timestamp } from 'firebase/firestore'
import type {
  HSOtherDocument,
  HSRamsDocument,
  HSProjectSafetyData,
  HSToolboxIssue,
  HSToolboxSignature,
  HSToolboxTalk,
} from '@/types'

export function serializeTalk(talk: HSToolboxTalk): Record<string, unknown> {
  return {
    id: talk.id,
    title: talk.title,
    category: talk.category,
    isGeneral: talk.isGeneral,
    trades: talk.trades,
    purpose: talk.purpose,
    keyPoints: talk.keyPoints,
    source: talk.source,
    ownerOrganizationId: '',
    status: talk.status,
    version: talk.version,
    updatedAt: Timestamp.fromDate(talk.updatedAt),
    fileURL: talk.fileURL ?? '',
  }
}

export function serializeIssue(issue: HSToolboxIssue): Record<string, unknown> {
  const row: Record<string, unknown> = {
    id: issue.id,
    projectId: issue.projectId,
    talkId: issue.talkId,
    weekCommencing: Timestamp.fromDate(issue.weekCommencing),
    issuedByUserId: issue.issuedByUserId,
    issuedAt: Timestamp.fromDate(issue.issuedAt),
    recipientUserIds: issue.recipientUserIds,
    status: issue.status,
  }
  if (issue.publishAt) row.publishAt = Timestamp.fromDate(issue.publishAt)
  return row
}

export function serializeSignature(sig: HSToolboxSignature): Record<string, unknown> {
  const row: Record<string, unknown> = {
    id: sig.id,
    issueId: sig.issueId,
    userId: sig.userId,
    status: sig.status,
    readConfirmed: sig.readConfirmed,
    signatureImageBase64: sig.signatureImageBase64 ?? '',
  }
  if (sig.signedAt) row.signedAt = Timestamp.fromDate(sig.signedAt)
  if (sig.reminderSentAt) row.reminderSentAt = Timestamp.fromDate(sig.reminderSentAt)
  return row
}

export function serializeRams(doc: HSRamsDocument): Record<string, unknown> {
  return {
    id: doc.id,
    title: doc.title,
    trade: doc.trade,
    version: doc.version,
    status: doc.status,
    uploadedAt: Timestamp.fromDate(doc.uploadedAt),
    fileURL: doc.fileURL ?? '',
    fileName: doc.fileName ?? '',
  }
}

export function serializeOtherDoc(doc: HSOtherDocument): Record<string, unknown> {
  return {
    id: doc.id,
    title: doc.title,
    trade: doc.trade ?? '',
    category: doc.category,
    uploadedAt: Timestamp.fromDate(doc.uploadedAt),
    fileURL: doc.fileURL ?? '',
    fileName: doc.fileName ?? '',
    issuableToClient: false,
  }
}

export function serializeHealthSafetyPayload(data: HSProjectSafetyData): Record<string, unknown> {
  return {
    talks: data.talks.map(serializeTalk),
    issues: data.issues.map(serializeIssue),
    signatures: data.signatures.map(serializeSignature),
    ramsDocuments: data.ramsDocuments.map(serializeRams),
    otherDocuments: data.otherDocuments.map(serializeOtherDoc),
    updatedAt: Timestamp.now(),
  }
}
