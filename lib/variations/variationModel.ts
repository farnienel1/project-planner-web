/**
 * Shared with the variations contract (00-BUILD-ORDER).
 * Stored under organizations/{orgId}/variations — the app's existing org path.
 * The document id is the identity. voNumber is a display label only.
 */

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

export type VariationLabourLine = {
  id: string
  trade: string
  hours: number
}

export type VariationMaterialLine = {
  id: string
  name: string
  quantity: string
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

export const CUSTOM_TRADE_OPTION = 'Custom trade…'

export const EVIDENCE_ACCEPT = ['image/jpeg', 'image/png', 'image/heic', 'image/heif', 'application/pdf']
export const EVIDENCE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'heic', 'heif', 'pdf']
export const EVIDENCE_MAX_FILES = 10
export const EVIDENCE_MAX_BYTES = 20 * 1024 * 1024
export const TRACKER_LOCK_MS = 5 * 60 * 1000
export const TRACKER_ADDED_DESCRIPTION = 'Added from the tracker. Site needs to confirm the scope and add hours and materials.'

export function variationCounters(input: {
  labour: VariationLabourLine[]
  materials: VariationMaterialLine[]
  evidence: VariationEvidence[]
}): { totalLabourHours: number; materialLineCount: number; evidenceCount: number } {
  const totalLabourHours = input.labour.reduce((sum, line) => sum + (Number.isFinite(line.hours) ? line.hours : 0), 0)
  return {
    totalLabourHours: Math.round(totalLabourHours * 100) / 100,
    materialLineCount: input.materials.length,
    evidenceCount: input.evidence.length,
  }
}

export function evidenceFileAllowed(file: { name: string; type: string; size: number }): string | null {
  const ext = file.name.split('.').pop()?.toLowerCase() || ''
  const typeOk = EVIDENCE_ACCEPT.includes(file.type) || EVIDENCE_EXTENSIONS.includes(ext)
  if (!typeOk) return 'Upload a JPG, PNG, HEIC or PDF.'
  if (file.size > EVIDENCE_MAX_BYTES) return 'Each file must be 20 MB or smaller.'
  return null
}

export function parentDisplayName(jobNumber: string, siteName: string): string {
  const job = jobNumber.trim()
  const site = siteName.trim()
  if (job && site) return `${job} · ${site}`
  return site || job || 'Job'
}
