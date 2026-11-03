import { normalizeHSIssueStatus, normalizeHSSignatureStatus, parseHealthSafetyDocument } from '@/lib/canonical'
import { parseFirestoreDate, parseOptionalString, parseString } from '@/lib/firebase/firestoreUtils'
import { organizationZoneOr } from '@/lib/orgTime/activeOrganizationZone'
import type { HSProjectSafetyData, HSToolboxSignature, HSToolboxTalk } from '@/types'

export function parseTalk(row: Record<string, unknown>): HSToolboxTalk | null {
  const id = parseString(row.id) || parseOptionalString(row.referenceCode) || parseOptionalString(row.ref)
  const title = parseString(row.title)
  if (!id || !title) return null
  const trades = Array.isArray(row.trades)
    ? (row.trades as unknown[]).map((t) => parseString(t)).filter(Boolean)
    : []
  return {
    id,
    referenceCode: parseOptionalString(row.referenceCode) || parseOptionalString(row.ref) || undefined,
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

/** Rulebook 1.8.0 `normalizeHSIssueStatus`: complete / completed / signed → complete; scheduled; else awaiting. */
export function normalizeIssueStatus(raw: string): string {
  return normalizeHSIssueStatus(raw)
}

/** Rulebook 1.8.0 `normalizeHSSignatureStatus`. */
export function normalizeSignatureStatus(raw: string): string {
  return normalizeHSSignatureStatus(raw)
}

const when = (ms: number | null | undefined): Date | undefined => (ms != null ? new Date(ms) : undefined)

/**
 * One health & safety document through the rulebook reader `parseHealthSafetyDocument` (rulebook 1.8.0): one issue
 * status vocabulary, signatures from the `signatures` array and the per-signer `signatureRecords` map folded to one
 * per issue and person.
 */
export function parseHealthSafetyPayload(data: Record<string, unknown>, projectId: string): HSProjectSafetyData {
  const parsed = parseHealthSafetyDocument(data, { projectId, timeZone: organizationZoneOr() })
  return {
    talks: parsed.talks.map((talk) => ({
      id: talk.id,
      referenceCode: talk.referenceCode ?? undefined,
      title: talk.title,
      category: talk.category,
      isGeneral: talk.isGeneral,
      trades: talk.trades,
      purpose: talk.purpose,
      keyPoints: talk.keyPoints,
      source: talk.source,
      status: talk.status,
      version: talk.version,
      updatedAt: when(talk.updatedAtMs) ?? new Date(),
      fileURL: talk.fileURL ?? undefined,
    })),
    issues: parsed.issues.map((issue) => ({
      id: issue.id,
      projectId: issue.projectId,
      talkId: issue.talkId,
      weekCommencing: when(issue.weekCommencingMs) ?? new Date(),
      issuedByUserId: issue.issuedByUserId,
      issuedAt: when(issue.issuedAtMs) ?? new Date(),
      publishAt: when(issue.publishAtMs),
      recipientUserIds: issue.recipientUserIds,
      status: issue.status,
    })),
    signatures: parsed.signatures.map((signature) => ({
      id: signature.id,
      issueId: signature.issueId,
      userId: signature.userId,
      status: signature.status,
      readConfirmed: signature.readConfirmed,
      signatureImageBase64: signature.signatureImageBase64 ?? undefined,
      signedAt: when(signature.signedAtMs),
      reminderSentAt: when(signature.reminderSentAtMs),
    })),
    ramsDocuments: parsed.ramsDocuments.map((row) => ({
      id: row.id,
      title: row.title,
      trade: row.trade,
      version: row.version,
      status: row.status,
      uploadedAt: when(row.uploadedAtMs) ?? new Date(),
      fileURL: row.fileURL ?? undefined,
      fileName: row.fileName ?? undefined,
    })),
    otherDocuments: parsed.otherDocuments.map((row) => ({
      id: row.id,
      title: row.title,
      trade: row.trade ?? undefined,
      category: row.category,
      uploadedAt: when(row.uploadedAtMs) ?? new Date(),
      fileURL: row.fileURL ?? undefined,
      fileName: row.fileName ?? undefined,
    })),
    updatedAt: when(parsed.updatedAtMs),
  }
}

function byId<T extends { id: string }>(rows: T[], pick: (current: T, extra: T) => T): T[] {
  const map = new Map<string, T>()
  for (const row of rows) {
    const existing = map.get(row.id)
    map.set(row.id, existing ? pick(existing, row) : row)
  }
  return [...map.values()]
}

function richerTalk(a: HSToolboxTalk, b: HSToolboxTalk): HSToolboxTalk {
  const aScore = (a.purpose ? 1 : 0) + a.keyPoints.length + (a.fileURL ? 2 : 0)
  const bScore = (b.purpose ? 1 : 0) + b.keyPoints.length + (b.fileURL ? 2 : 0)
  if (bScore !== aScore) return bScore > aScore ? b : a
  return (b.updatedAt?.getTime() || 0) >= (a.updatedAt?.getTime() || 0) ? b : a
}

/**
 * Two copies of one uploaded document (the web nested copy and a settings copy): the newer one, keeping the file
 * link and name when only one copy has them, so the copy that lost its link never hides the file.
 */
function richerDocument<T extends { uploadedAt: Date; fileURL?: string; fileName?: string }>(a: T, b: T): T {
  const newer = b.uploadedAt.getTime() >= a.uploadedAt.getTime() ? b : a
  const older = newer === a ? b : a
  return {
    ...newer,
    fileURL: newer.fileURL?.trim() ? newer.fileURL : older.fileURL,
    fileName: newer.fileName?.trim() ? newer.fileName : older.fileName,
  }
}

function richerSignature(a: HSToolboxSignature, b: HSToolboxSignature): HSToolboxSignature {
  if (a.status === 'signed' && b.status !== 'signed') return { ...b, ...a }
  if (b.status === 'signed' && a.status !== 'signed') return { ...a, ...b }
  const aTime = a.signedAt?.getTime() || a.reminderSentAt?.getTime() || 0
  const bTime = b.signedAt?.getTime() || b.reminderSentAt?.getTime() || 0
  const newer = bTime >= aTime ? { ...a, ...b } : { ...b, ...a }
  return {
    ...newer,
    signatureImageBase64: a.signatureImageBase64 || b.signatureImageBase64,
  }
}

function signatureMergeKey(row: HSToolboxSignature): string {
  return `${row.issueId}::${row.userId.toLowerCase()}`
}

function mergeByKey<T>(rows: T[], keyOf: (row: T) => string, pick: (current: T, extra: T) => T): T[] {
  const map = new Map<string, T>()
  for (const row of rows) {
    const key = keyOf(row)
    const existing = map.get(key)
    map.set(key, existing ? pick(existing, row) : row)
  }
  return [...map.values()]
}

/** Union iOS settings doc with the nested web doc so tracking/signing stay in sync. */
export function mergeHealthSafetyPayload(
  primary: HSProjectSafetyData,
  extra: HSProjectSafetyData
): HSProjectSafetyData {
  return {
    talks: byId([...extra.talks, ...primary.talks], richerTalk),
    issues: byId([...extra.issues, ...primary.issues], (a, b) =>
      (b.issuedAt?.getTime() || 0) >= (a.issuedAt?.getTime() || 0) ? { ...a, ...b } : { ...b, ...a }
    ).sort((a, b) => b.issuedAt.getTime() - a.issuedAt.getTime()),
    signatures: mergeByKey(
      [...extra.signatures, ...primary.signatures],
      signatureMergeKey,
      richerSignature
    ).sort((a, b) => (b.signedAt?.getTime() ?? 0) - (a.signedAt?.getTime() ?? 0)),
    ramsDocuments: byId([...extra.ramsDocuments, ...primary.ramsDocuments], richerDocument).sort((a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime()),
    otherDocuments: byId([...extra.otherDocuments, ...primary.otherDocuments], richerDocument).sort((a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime()),
    updatedAt:
      (primary.updatedAt?.getTime() || 0) >= (extra.updatedAt?.getTime() || 0) ? primary.updatedAt : extra.updatedAt,
  }
}
