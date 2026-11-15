/**
 * Pure serialisation of a web `Variation` (no Firestore connection), so the edit rules can be tested.
 * Rulebook 1.8.0 reader `parseVariationDocument`; 1.52.0 line shapes; 1.52.0 review HIGH 2 `variationEditWriteFields`.
 */
import { Timestamp } from 'firebase/firestore'
import { newUuid, sanitizeForFirestore } from '@/lib/firebase/firestoreUtils'
import {
  parseVariationDocument,
  variationCustomLineFields,
  variationLabourLineFields,
  variationLineId,
  variationMaterialLineFields,
  variationSubcontractorLineFields,
  variationWriteFields,
} from '@/lib/canonical'
import type { DocumentWriteFields } from '@/lib/canonical/peopleDocuments'
import type { Variation, VariationEvidence } from '@/lib/variations/variationModel'

/**
 * A variation through the rulebook reader `parseVariationDocument` (rulebook 1.8.0): lines with any content are kept,
 * a line stored without an id gets the same `variationLineId` on every read and platform, counters are recomputed.
 */
export function variationFromFirestore(id: string, data: Record<string, unknown>): Variation {
  const parsed = parseVariationDocument(id, data) ?? parseVariationDocument(newUuid(), data)!
  const when = (ms: number | null | undefined) => (ms != null ? new Date(ms) : null)
  return {
    id: parsed.id,
    orgId: parsed.orgId,
    parentType: parsed.parentType,
    parentId: parsed.parentId,
    parentName: parsed.parentName,
    origin: parsed.origin,
    voNumber: parsed.voNumber,
    sequence: parsed.sequence,
    voNumberLocked: parsed.voNumberLocked,
    numberHistory: parsed.numberHistory.map((item) => ({ from: item.from, to: item.to, at: when(item.atMs) || new Date(), byUid: item.byUid })),
    heading: parsed.heading,
    description: parsed.description,
    status: parsed.status,
    // Rulebook 1.52.0: the crew and the quantity number are carried only when the stored row has them, so a save that
    // did not touch a line never rewrites it in the new shape (§1, never re-save what you didn't change).
    labour: parsed.labour.map((line) =>
      storedLineHas(data, 'labour', parsed.id, line.id, 'operatives')
        ? { id: line.id, trade: line.trade, hours: line.hours, operatives: line.operatives, hoursEach: line.hoursEach }
        : { id: line.id, trade: line.trade, hours: line.hours }
    ),
    materials: parsed.materials.map((line) =>
      storedLineHas(data, 'materials', parsed.id, line.id, 'quantityValue')
        ? { id: line.id, name: line.name, quantity: line.quantity, quantityValue: line.quantityValue, unit: line.unit }
        : { id: line.id, name: line.name, quantity: line.quantity }
    ),
    customLines: parsed.customLines.map((line) => ({ id: line.id, name: line.name, description: line.description, quantity: line.quantity, cost: line.cost })),
    subcontractorLines: parsed.subcontractorLines.map((line) => ({
      id: line.id,
      subcontractorId: line.subcontractorId,
      name: line.name,
      quoteNumber: line.quoteNumber,
      quantity: line.quantity,
      cost: line.cost,
    })),
    evidence: parsed.evidence.map(
      (item): VariationEvidence => ({
        id: item.id,
        fileName: item.fileName,
        contentType: item.contentType,
        sizeBytes: item.sizeBytes,
        storagePath: item.storagePath,
        downloadURL: item.downloadURL,
        uploadedByUid: item.uploadedByUid,
        uploadedAt: when(item.uploadedAtMs) || new Date(),
      })
    ),
    totalLabourHours: parsed.totalLabourHours,
    materialLineCount: parsed.materialLineCount,
    evidenceCount: parsed.evidenceCount,
    createdByUid: parsed.createdByUid,
    createdByName: parsed.createdByName,
    createdAt: when(parsed.createdAtMs) || new Date(),
    updatedByUid: parsed.updatedByUid,
    updatedAt: when(parsed.updatedAtMs) || new Date(),
    statusHistory: parsed.statusHistory.map((item) => ({ status: item.status, byUid: item.byUid, byName: item.byName, at: when(item.atMs) || new Date() })),
    submittedAt: when(parsed.submittedAtMs),
    closedAt: when(parsed.closedAtMs),
    isDeleted: parsed.isDeleted,
    removedEvidence: parsed.removedEvidence.map((item) => ({
      path: item.path,
      name: item.name,
      removedBy: item.removedBy,
      removedAt: when(item.removedAtMs),
    })),
  }
}

/** Whether the stored row of that id (or derived id) carries `field`. */
function storedLineHas(data: Record<string, unknown>, kind: 'labour' | 'materials', variationId: string, lineId: string, field: string): boolean {
  const list = Array.isArray(data?.[kind]) ? (data[kind] as unknown[]) : []
  return list.some((entry, index) => {
    if (!entry || typeof entry !== 'object') return false
    const line = entry as Record<string, unknown>
    const id = (typeof line.id === 'string' && line.id.trim()) || variationLineId(variationId, kind, index, line)
    return id === lineId && line[field] != null
  })
}

function toTimestamp(date: Date | null | undefined): Timestamp | null {
  return date ? Timestamp.fromDate(date) : null
}

export function variationToFirestore(row: Variation): Record<string, unknown> {
  return sanitizeForFirestore({
    id: row.id,
    orgId: row.orgId,
    parentType: row.parentType,
    parentId: row.parentId,
    parentName: row.parentName,
    origin: row.origin,
    voNumber: row.voNumber,
    sequence: row.sequence,
    voNumberLocked: row.voNumberLocked,
    numberHistory: row.numberHistory.map((item) => ({
      from: item.from,
      to: item.to,
      at: Timestamp.fromDate(item.at),
      byUid: item.byUid,
    })),
    heading: row.heading,
    description: row.description,
    status: row.status,
    // Rulebook 1.52.0: labour with its crew, materials with the number and unit beside the text older builds read.
    labour: row.labour.map((line) =>
      line.operatives != null && line.hoursEach != null
        ? variationLabourLineFields({ id: line.id, trade: line.trade, operatives: line.operatives, hoursEach: line.hoursEach })
        : { id: line.id, trade: line.trade, hours: line.hours }
    ),
    materials: row.materials.map((line) =>
      line.quantityValue != null && line.unit
        ? variationMaterialLineFields({ id: line.id, name: line.name, quantity: line.quantityValue, unit: line.unit })
        : { id: line.id, name: line.name, quantity: line.quantity }
    ),
    customLines: (row.customLines || []).map((line) => variationCustomLineFields(line)),
    subcontractorLines: (row.subcontractorLines || []).map((line) => variationSubcontractorLineFields(line)),
    evidence: row.evidence.map((item) => ({
      ...item,
      uploadedAt: Timestamp.fromDate(item.uploadedAt),
    })),
    totalLabourHours: row.totalLabourHours,
    materialLineCount: row.materialLineCount,
    evidenceCount: row.evidenceCount,
    createdByUid: row.createdByUid,
    createdByName: row.createdByName,
    createdAt: Timestamp.fromDate(row.createdAt),
    updatedByUid: row.updatedByUid,
    updatedAt: Timestamp.fromDate(row.updatedAt),
    statusHistory: row.statusHistory.map((item) => ({
      status: item.status,
      byUid: item.byUid,
      byName: item.byName,
      at: Timestamp.fromDate(item.at),
    })),
    submittedAt: toTimestamp(row.submittedAt),
    closedAt: toTimestamp(row.closedAt),
    isDeleted: row.isDeleted,
  }) as Record<string, unknown>
}


/** A serialised variation as a partial-write payload: no `updatedAt` (stamped by the write). */
function plain(map: Record<string, unknown>): Record<string, unknown> {
  const out = { ...map }
  delete out.updatedAt
  return out
}

/**
 * Review of #330, HIGH 2 (rulebook §1 "Never re-save what you didn't change"): the fields an edit writes are the
 * fields that differ between the copy the editor opened (`base`) and the edited copy (`next`), never every difference
 * from the server copy. So a renumber by the tracker (`voNumber`, `sequence`, `numberHistory`), a status change or
 * evidence linked in the background after the editor opened is never written back from the editor's stale copy.
 * Without `base` (a create) the whole copy is written.
 */
export function variationEditWriteFields(base: Variation | null | undefined, next: Variation): DocumentWriteFields {
  return variationWriteFields(base ? plain(variationToFirestore(base)) : null, plain(variationToFirestore(next)))
}

/**
 * The settings-log entry for an edit: the id plus only the fields the edit changed (`variationEditWriteFields`), laid
 * over the stored entry by `variationLogWriteFields`, so the log never takes stale fields either. A create (no
 * `base`) is the whole copy.
 */
export function variationLogEntry(base: Variation | null | undefined, next: Variation): Record<string, unknown> {
  const map = variationToFirestore(next)
  if (!base) return map
  const write = variationEditWriteFields(base, next)
  return { id: next.id, ...write.set }
}
