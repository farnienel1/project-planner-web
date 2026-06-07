import { parseFirestoreDate, parseOptionalString, parseString } from '@/lib/firebase/firestoreUtils'
import type {
  HSOtherDocument,
  HSRamsDocument,
  HSProjectSafetyData,
  HSToolboxIssue,
  HSToolboxSignature,
  HSToolboxTalk,
} from '@/types'

function parseTalk(row: Record<string, unknown>): HSToolboxTalk | null {
  const id = parseString(row.id)
  const title = parseString(row.title)
  if (!id || !title) return null
  const trades = Array.isArray(row.trades)
    ? (row.trades as unknown[]).map((t) => parseString(t)).filter(Boolean)
    : []
  return {
    id,
    title,
    category: parseString(row.category, 'general'),
    isGeneral: row.isGeneral === true || trades.length === 0,
    trades,
    purpose: parseString(row.purpose, ''),
    keyPoints: Array.isArray(row.keyPoints)
      ? (row.keyPoints as unknown[]).map((p) => parseString(p)).filter(Boolean)
      : [],
    source: parseString(row.source, 'library'),
    status: parseString(row.status, 'approved'),
    version: typeof row.version === 'number' ? row.version : 1,
    updatedAt: parseFirestoreDate(row.updatedAt) || new Date(),
    fileURL: parseOptionalString(row.fileURL),
  }
}

function parseIssue(row: Record<string, unknown>, projectId: string): HSToolboxIssue | null {
  const id = parseString(row.id)
  const talkId = parseString(row.talkId)
  if (!id || !talkId) return null
  const rawProjectId = parseString(row.projectId) || projectId
  return {
    id,
    projectId: rawProjectId,
    talkId,
    weekCommencing: parseFirestoreDate(row.weekCommencing) || new Date(),
    issuedByUserId: parseString(row.issuedByUserId),
    issuedAt: parseFirestoreDate(row.issuedAt) || new Date(),
    publishAt: parseFirestoreDate(row.publishAt),
    recipientUserIds: Array.isArray(row.recipientUserIds)
      ? (row.recipientUserIds as unknown[]).map((id) => parseString(id)).filter(Boolean)
      : [],
    status: parseString(row.status, 'awaiting'),
  }
}

function parseSignature(row: Record<string, unknown>): HSToolboxSignature | null {
  const id = parseString(row.id)
  const issueId = parseString(row.issueId)
  const userId = parseString(row.userId)
  if (!id || !issueId || !userId) return null
  return {
    id,
    issueId,
    userId,
    status: parseString(row.status, 'pending'),
    readConfirmed: row.readConfirmed === true,
    signatureImageBase64: parseOptionalString(row.signatureImageBase64),
    signedAt: parseFirestoreDate(row.signedAt),
    reminderSentAt: parseFirestoreDate(row.reminderSentAt),
  }
}

function parseRams(row: Record<string, unknown>): HSRamsDocument | null {
  const id = parseString(row.id)
  const title = parseString(row.title)
  if (!id || !title) return null
  return {
    id,
    title,
    trade: parseString(row.trade, 'General'),
    version: typeof row.version === 'number' ? row.version : 1,
    status: parseString(row.status, 'live'),
    uploadedAt: parseFirestoreDate(row.uploadedAt) || new Date(),
    fileURL: parseOptionalString(row.fileURL),
    fileName: parseOptionalString(row.fileName),
  }
}

function parseOther(row: Record<string, unknown>): HSOtherDocument | null {
  const id = parseString(row.id)
  const title = parseString(row.title)
  if (!id || !title) return null
  return {
    id,
    title,
    trade: parseOptionalString(row.trade),
    category: parseString(row.category, 'trade'),
    uploadedAt: parseFirestoreDate(row.uploadedAt) || new Date(),
    fileURL: parseOptionalString(row.fileURL),
    fileName: parseOptionalString(row.fileName),
  }
}

export function parseHealthSafetyPayload(data: Record<string, unknown>, projectId: string): HSProjectSafetyData {
  const talksRaw = Array.isArray(data.talks) ? (data.talks as Record<string, unknown>[]) : []
  const issuesRaw = Array.isArray(data.issues) ? (data.issues as Record<string, unknown>[]) : []
  const signaturesRaw = Array.isArray(data.signatures) ? (data.signatures as Record<string, unknown>[]) : []
  const ramsRaw = Array.isArray(data.ramsDocuments) ? (data.ramsDocuments as Record<string, unknown>[]) : []
  const otherRaw = Array.isArray(data.otherDocuments) ? (data.otherDocuments as Record<string, unknown>[]) : []

  const talks = talksRaw.map(parseTalk).filter((t): t is HSToolboxTalk => t !== null)
  const issues = issuesRaw.map((row) => parseIssue(row, projectId)).filter((i): i is HSToolboxIssue => i !== null)
  const signatures = signaturesRaw.map(parseSignature).filter((s): s is HSToolboxSignature => s !== null)
  const ramsDocuments = ramsRaw.map(parseRams).filter((d): d is HSRamsDocument => d !== null)
  const otherDocuments = otherRaw.map(parseOther).filter((d): d is HSOtherDocument => d !== null)

  return {
    talks,
    issues: issues.sort((a, b) => b.issuedAt.getTime() - a.issuedAt.getTime()),
    signatures: signatures.sort(
      (a, b) => (b.signedAt?.getTime() ?? 0) - (a.signedAt?.getTime() ?? 0)
    ),
    ramsDocuments: ramsDocuments.sort((a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime()),
    otherDocuments: otherDocuments.sort((a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime()),
    updatedAt: parseFirestoreDate(data.updatedAt),
  }
}
