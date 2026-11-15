/**
 * Shared with the variations contract (00-BUILD-ORDER).
 * Stored under organizations/{orgId}/variations — the app's existing org path.
 * The document id is the identity. voNumber is a display label only.
 */

import { VARIATION_EVIDENCE_MAX_BYTES, uploadLimitError } from '@/lib/security/uploadLimits'
import { UPLOAD_ALLOWED_TYPES } from '@/lib/canonical/uploadPolicy'
import { variationTotals } from '@/lib/canonical/variations'

export const VARIATION_STATUSES = ['open', 'submitted', 'closed'] as const
export type VariationStatus = (typeof VARIATION_STATUSES)[number]

export const VARIATION_ORIGINS = ['app', 'tracker'] as const
export type VariationOrigin = (typeof VARIATION_ORIGINS)[number]

export type VariationParentType = 'project' | 'smallWork'

export type VariationNumberChange = {
  from: string
  to: string
  at: Date
  byUid: string
}

export type VariationStatusChange = {
  status: string
  byUid: string
  byName: string
  at: Date
}

/** Rulebook 1.52.0: `hours` = `operatives` × `hoursEach` (`variationLabourLineFields`). */
export type VariationLabourLine = {
  id: string
  trade: string
  hours: number
  operatives?: number
  hoursEach?: number
}

/**
 * Rulebook 1.52.0: `quantity` is the text older builds read ("100m"); `quantityValue` and `unit` are the number and
 * its unit (`variationMaterialLineFields`). A legacy text that is not a quantity ("1-") has no number.
 */
export type VariationMaterialLine = {
  id: string
  name: string
  quantity: string
  quantityValue?: number | null
  unit?: string
}

/** Rulebook 1.52.0: a custom line (quantity × cost, organisation currency). */
export type VariationCustomLine = {
  id: string
  name: string
  description: string
  quantity: number
  cost: number
}

/** Rulebook 1.52.0: a subcontractor line (firm, quote number, quantity × cost). */
export type VariationSubcontractorLine = {
  id: string
  subcontractorId: string
  name: string
  quoteNumber: string
  quantity: number
  cost: number
}

export type VariationEvidence = {
  id: string
  fileName: string
  contentType: string
  sizeBytes: number
  storagePath: string
  downloadURL: string
  uploadedByUid: string
  uploadedAt: Date
}

/** Rulebook 1.27.0 §24 (`variationEvidenceRemovalWriteFields`): an evidence file unlinked from the variation. */
export type VariationRemovedEvidence = {
  path: string
  name: string
  removedBy: string
  removedAt: Date | null
}

export type Variation = {
  id: string
  orgId: string
  parentType: VariationParentType
  parentId: string
  parentName: string
  origin: VariationOrigin
  voNumber: string
  sequence: number
  voNumberLocked: boolean
  numberHistory: VariationNumberChange[]
  heading: string
  description: string
  status: VariationStatus
  labour: VariationLabourLine[]
  materials: VariationMaterialLine[]
  customLines: VariationCustomLine[]
  subcontractorLines: VariationSubcontractorLine[]
  evidence: VariationEvidence[]
  totalLabourHours: number
  materialLineCount: number
  evidenceCount: number
  createdByUid: string
  createdByName: string
  createdAt: Date
  updatedByUid: string
  updatedAt: Date
  statusHistory: VariationStatusChange[]
  submittedAt?: Date | null
  closedAt?: Date | null
  isDeleted: boolean
  /**
   * Read only (1.27.0): evidence unlinked from this variation. Never written by `variationToFirestore` — only
   * `removeVariationEvidence` adds to it, so a save from an older copy can never shorten the list.
   */
  removedEvidence?: VariationRemovedEvidence[]
}

export type VariationTracker = {
  parentId: string
  parentType: VariationParentType
  enabled: boolean
  enabledAt?: Date | null
  enabledByUid?: string | null
  numberingMode: 'lockSubmitted' | 'resequenceAll'
  prefix: string
  padding: number
  version: number
  lockedByUid?: string | null
  lockedByName?: string | null
  lockedAt?: Date | null
}

export const VARIATION_HEADER_COPY =
  'Variations add up on a project, so capturing the materials and labour is key.'

export const VARIATION_STATUS_COPY: Record<VariationStatus, string> = {
  open: 'Any variations that have not been submitted, and are still required or have been carried out.',
  submitted: 'Any variations that have been submitted by the QS to the client.',
  closed: 'Any variations that are no longer required.',
}

/** iOS VariationsListView picker: All, Open, Submitted, Closed. */
export const VARIATION_LIST_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'open', label: 'Open' },
  { id: 'submitted', label: 'Submitted' },
  { id: 'closed', label: 'Closed' },
] as const

export type VariationListFilter = (typeof VARIATION_LIST_FILTERS)[number]['id']

export function variationMatchesListFilter(status: VariationStatus, filter: VariationListFilter): boolean {
  return filter === 'all' || status === filter
}

export const VARIATION_TRADES = [
  'Electrician',
  'Approved electrician',
  "Electrician's mate",
  'Plumber',
  'Pipefitter',
  'Ductwork fitter',
  'Ventilation fitter',
  'Sheet metal worker',
  'Gas engineer',
  'Refrigeration engineer',
  'Welder',
  'Insulation engineer',
  'BMS engineer',
  'Fire alarm engineer',
  'Sprinkler fitter',
  'Drainage operative',
  'Commissioning engineer',
  'Testing and inspection',
  'Supervisor',
  'Labourer',
] as const

/** iOS VariationTrades.mergedPickerOptions — standard order, then custom names A–Z. */
export function mergedVariationTradeOptions(custom: string[]): string[] {
  const seen = new Set<string>(VARIATION_TRADES.map((trade) => trade.toLowerCase()))
  const extras: string[] = []
  for (const trade of custom) {
    const trimmed = trade.trim()
    if (!trimmed) continue
    const key = trimmed.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    extras.push(trimmed)
  }
  extras.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
  return [...VARIATION_TRADES, ...extras]
}

export const CUSTOM_TRADE_OPTION = 'Custom trade…'

// Rulebook 1.50.0 §24: the variation evidence kind (photos and PDF, 10 MB) — `UPLOAD_ALLOWED_TYPES.variation_evidence`.
export const EVIDENCE_ACCEPT = [...UPLOAD_ALLOWED_TYPES.variation_evidence.contentTypes]
export const EVIDENCE_EXTENSIONS = [...UPLOAD_ALLOWED_TYPES.variation_evidence.extensions]
export const EVIDENCE_MAX_FILES = 10
export const EVIDENCE_MAX_BYTES = VARIATION_EVIDENCE_MAX_BYTES
export const TRACKER_LOCK_MS = 5 * 60 * 1000
export const TRACKER_ADDED_DESCRIPTION = 'Added from the tracker. Site needs to confirm the scope and add hours and materials.'

/** The stored counters, from the rulebook's `variationTotals` (the reader's evidence rule: a path or a URL). */
export function variationCounters(input: {
  labour: VariationLabourLine[]
  materials: VariationMaterialLine[]
  evidence: VariationEvidence[]
}): { totalLabourHours: number; materialLineCount: number; evidenceCount: number } {
  const totals = variationTotals(input)
  return {
    totalLabourHours: totals.labourHours,
    materialLineCount: totals.materialsCount,
    evidenceCount: totals.evidenceCount,
  }
}

export function evidenceFileAllowed(file: { name: string; type: string; size: number }): string | null {
  return uploadLimitError(file, 'variation')
}

export function parentDisplayName(jobNumber: string, siteName: string): string {
  const job = jobNumber.trim()
  const site = siteName.trim()
  if (job && site) return `${job} · ${site}`
  return site || job || 'Job'
}
