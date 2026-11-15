/**
 * Variations (rulebook 1.52.0, §22, owner decisions 15 Nov).
 *
 * - **Line types.** Besides labour and materials a variation has **Custom** lines (`customLines`: name, description,
 *   quantity, cost — line total quantity × cost) and **Subcontractor** lines (`subcontractorLines`: the firm picked
 *   from the Subcontractors list or typed, its quote number, cost and quantity — line total cost × quantity). They are
 *   NEW arrays on the variation document, never extra fields inside `labour` / `materials` rows, because older builds
 *   rewrite those rows field by field. Costs are in the organisation currency (`resolveOrganizationCurrency`, shown with
 *   `formatMoney`) and are seen by the people who see variations (admins and managers, `canSeeVariations`).
 * - **Labour keeps the crew.** A labour row stores `operatives` and `hoursEach` beside `hours` (= operatives × hours
 *   each), so "2 × 4h" is not stored as just 8h. A row written by an older build (no crew, or a crew that no longer
 *   multiplies to `hours`) reads as one operative × `hours`.
 * - **Material quantity is a number.** A material row stores `quantityValue` (a number above 0) and `unit`
 *   (`VARIATION_MATERIAL_UNITS`) beside the text `quantity` older builds read ("100m", "4"). Text written by an older
 *   build is parsed when it can be ("100m" → 100 m); text that is not a quantity ("1-") is kept and shown as stored,
 *   with no number.
 * - **Totals** are `variationTotals` (one variation) and `variationListTotals` (a list, deleted rows left out); every
 *   screen and export takes its figures from them.
 * - **Export rows** for the Excel file are `variationExportRows`: one summary row per variation (lines or not) and one
 *   row per line, dates in the organisation zone. Each app draws the workbook itself.
 * - **The tracker** reorders with `variationRenumberPlan`: Submitted and Closed variations (and any whose number is
 *   locked) are pinned — they keep their numbers and do not move; the open variations share their own current numbers
 *   in the new order; a number held by a deleted or pinned variation, or ever issued and moved away from, is never
 *   handed out again. `variationRenumberConflict` refuses a save when the variations changed since the screen loaded.
 *   Admins and the job's managers renumber (`canRenumberVariations`).
 *
 * Plain inputs only, so iOS calls it through JavaScriptCore.
 */

import { derivedRowId } from './derivedIds'
import { documentBool, documentInstantMs, documentNumber } from './peopleDocuments'
import { normalizeDocumentId } from './scheduleSources'
import type { StaffAccountRole } from './staffAccess'
import {
  DEFAULT_VARIATION_PADDING,
  DEFAULT_VARIATION_PREFIX,
  formatVariationNumber,
  variationNumberValue,
} from './variationNumbers'

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

function text(value: unknown): string {
  if (value == null) return ''
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return ''
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

function positive(value: unknown): number | null {
  const n = documentNumber(value)
  return n != null && n > 0 ? n : null
}

function nonNegative(value: unknown): number | null {
  const n = documentNumber(value)
  return n != null && n >= 0 ? n : null
}

// MARK: - Labour

export type VariationLabourCrew = { hours: number; operatives: number; hoursEach: number }

/**
 * The crew of a stored labour row: `operatives` (a whole number ≥ 1) × `hoursEach` (> 0) when both are stored and
 * multiply to `hours` (within 0.01); otherwise one operative × `hours` (rows from older builds).
 */
export function variationLabourCrew(row: Record<string, unknown> | null | undefined): VariationLabourCrew {
  const line = record(row)
  const hours = documentNumber(line.hours) ?? 0
  const operatives = documentNumber(line.operatives)
  const hoursEach = documentNumber(line.hoursEach)
  if (operatives != null && Number.isInteger(operatives) && operatives >= 1 && hoursEach != null && hoursEach > 0 && Math.abs(operatives * hoursEach - hours) < 0.01) {
    return { hours, operatives, hoursEach }
  }
  return { hours, operatives: 1, hoursEach: hours }
}

/** The stored labour row: `hours` = operatives × hours each (rounded to 0.01), with the crew beside it. */
export function variationLabourLineFields(input: { id: unknown; trade: unknown; operatives: unknown; hoursEach: unknown }): {
  id: string
  trade: string
  hours: number
  operatives: number
  hoursEach: number
} {
  const operatives = Math.max(1, Math.trunc(documentNumber(input?.operatives) ?? 1))
  const hoursEach = Math.max(0, documentNumber(input?.hoursEach) ?? 0)
  return { id: text(input?.id), trade: text(input?.trade), hours: round2(operatives * hoursEach), operatives, hoursEach }
}

/** "2 × 4h" for a crew, "8h" for one operative. */
export function variationLabourText(crew: { operatives?: unknown; hoursEach?: unknown; hours?: unknown }): string {
  const operatives = Math.trunc(documentNumber(crew?.operatives) ?? 1)
  const hours = documentNumber(crew?.hours) ?? 0
  const each = documentNumber(crew?.hoursEach) ?? hours
  const fmt = (n: number) => String(round2(n))
  return operatives > 1 ? `${operatives} × ${fmt(each)}h = ${fmt(hours)}h` : `${fmt(hours)}h`
}

// MARK: - Materials

export const VARIATION_MATERIAL_UNITS = ['no', 'm', 'box', 'kg'] as const
export type VariationMaterialUnit = (typeof VARIATION_MATERIAL_UNITS)[number]
export const VARIATION_QUANTITY_MAX = 100000
export const VARIATION_QUANTITY_MESSAGE = 'Enter the quantity as a number above 0.'

export function normalizeVariationMaterialUnit(raw: unknown): VariationMaterialUnit | null {
  const value = text(raw).toLowerCase()
  return (VARIATION_MATERIAL_UNITS as readonly string[]).includes(value) ? (value as VariationMaterialUnit) : null
}

/** "100m", "2.5kg", "4" (the text both apps have always stored in `quantity`; `no` prints no unit). */
export function variationMaterialQuantityText(value: number, unit: unknown): string {
  const amount = String(round2(value))
  const u = normalizeVariationMaterialUnit(unit) ?? 'no'
  return u === 'no' ? amount : `${amount}${u}`
}

/** Parse quantity text ("100m", "100 m", "2,5 kg", "4", "4no"): `{ value, unit }`, or null when it is not a quantity. */
export function parseVariationMaterialQuantity(raw: unknown): { value: number; unit: VariationMaterialUnit } | null {
  const match = /^\s*(\d+(?:[.,]\d+)?)\s*(no|m|box|kg)?\s*$/i.exec(text(raw))
  if (!match) return null
  const value = Number(match[1].replace(',', '.'))
  if (!Number.isFinite(value) || value <= 0) return null
  return { value, unit: (match[2]?.toLowerCase() as VariationMaterialUnit) || 'no' }
}

export type VariationMaterialQuantity = {
  /** The text to show and to store in `quantity` (as stored when it is not a quantity, e.g. "1-"). */
  quantity: string
  /** The number, or null when the stored text is not a quantity. */
  quantityValue: number | null
  /** The unit; '' with no number. */
  unit: VariationMaterialUnit | ''
}

/** A stored material row's quantity: `quantityValue` + `unit` when stored and agreeing with the text, else the text parsed. */
export function variationMaterialQuantity(row: Record<string, unknown> | null | undefined): VariationMaterialQuantity {
  const line = record(row)
  const stored = typeof line.quantity === 'number' ? String(line.quantity) : text(line.quantity)
  const parsed = parseVariationMaterialQuantity(stored)
  const value = positive(line.quantityValue)
  const unit = normalizeVariationMaterialUnit(line.unit)
  if (value != null && unit && (!stored || (parsed && Math.abs(parsed.value - value) < 1e-9 && parsed.unit === unit))) {
    return { quantity: stored || variationMaterialQuantityText(value, unit), quantityValue: value, unit }
  }
  if (parsed) return { quantity: stored, quantityValue: parsed.value, unit: parsed.unit }
  return { quantity: stored, quantityValue: null, unit: '' }
}

/** Refusal for a typed material quantity, or null. */
export function variationMaterialQuantityError(value: unknown): string | null {
  const n = documentNumber(typeof value === 'string' ? value.replace(',', '.') : value)
  if (n == null || n <= 0 || n > VARIATION_QUANTITY_MAX) return VARIATION_QUANTITY_MESSAGE
  return null
}

/** The stored material row: text `quantity` (older builds) + `quantityValue` + `unit`. */
export function variationMaterialLineFields(input: { id: unknown; name: unknown; quantity: unknown; unit: unknown }): {
  id: string
  name: string
  quantity: string
  quantityValue: number
  unit: VariationMaterialUnit
} {
  const value = round2(documentNumber(typeof input?.quantity === 'string' ? input.quantity.replace(',', '.') : input?.quantity) ?? 0)
  const unit = normalizeVariationMaterialUnit(input?.unit) ?? 'no'
  return { id: text(input?.id), name: text(input?.name), quantity: variationMaterialQuantityText(value, unit), quantityValue: value, unit }
}

// MARK: - Custom and subcontractor lines

export type VariationCustomLineDocument = {
  id: string
  idStored: boolean
  name: string
  description: string
  quantity: number
  /** Cost of one, organisation currency. */
  cost: number
  lineTotal: number
}

export type VariationSubcontractorLineDocument = {
  id: string
  idStored: boolean
  /** The `subcontractors/{id}` row picked, or '' when typed. */
  subcontractorId: string
  name: string
  quoteNumber: string
  quantity: number
  cost: number
  lineTotal: number
}

export const VARIATION_COST_MAX = 10_000_000
export const VARIATION_LINE_NAME_MESSAGE = 'Add a name for this line.'
export const VARIATION_COST_MESSAGE = 'Enter the cost as a number of 0 or more.'

/** The id of a custom or subcontractor line stored without one (`derivedRowId`, never random). */
export function variationExtraLineId(
  variationId: unknown,
  kind: 'customLines' | 'subcontractorLines',
  index: number,
  row: Record<string, unknown> | null | undefined
): string {
  const line = record(row)
  return derivedRowId(variationId, kind, index, [text(line.name), text(line.quoteNumber), String(documentNumber(line.quantity) ?? ''), String(documentNumber(line.cost) ?? '')])
}

/** Read `customLines`: rows with a name or a cost; quantity defaults to 1, cost to 0. */
export function parseVariationCustomLines(variationId: unknown, value: unknown): VariationCustomLineDocument[] {
  const out: VariationCustomLineDocument[] = []
  for (const [index, entry] of (Array.isArray(value) ? value : []).entries()) {
    const line = record(entry)
    const name = text(line.name)
    const cost = nonNegative(line.cost) ?? 0
    if (!name && !cost) continue
    const quantity = positive(line.quantity) ?? 1
    out.push({
      id: text(line.id) || variationExtraLineId(variationId, 'customLines', index, line),
      idStored: Boolean(text(line.id)),
      name,
      description: typeof line.description === 'string' ? line.description : '',
      quantity,
      cost,
      lineTotal: round2(quantity * cost),
    })
  }
  return out
}

/** Read `subcontractorLines`: rows with a name or a cost; quantity defaults to 1, cost to 0. */
export function parseVariationSubcontractorLines(variationId: unknown, value: unknown): VariationSubcontractorLineDocument[] {
  const out: VariationSubcontractorLineDocument[] = []
  for (const [index, entry] of (Array.isArray(value) ? value : []).entries()) {
    const line = record(entry)
    const name = text(line.name)
    const cost = nonNegative(line.cost) ?? 0
    if (!name && !cost) continue
    const quantity = positive(line.quantity) ?? 1
    out.push({
      id: text(line.id) || variationExtraLineId(variationId, 'subcontractorLines', index, line),
      idStored: Boolean(text(line.id)),
      subcontractorId: text(line.subcontractorId),
      name,
      quoteNumber: text(line.quoteNumber),
      quantity,
      cost,
      lineTotal: round2(quantity * cost),
    })
  }
  return out
}

function costError(cost: unknown): string | null {
  const n = documentNumber(typeof cost === 'string' ? cost.replace(',', '.') : cost)
  return n == null || n < 0 || n > VARIATION_COST_MAX ? VARIATION_COST_MESSAGE : null
}

/** Refusal for a custom line, or null: a name, a quantity above 0 and a cost of 0 or more. */
export function variationCustomLineError(input: { name?: unknown; quantity?: unknown; cost?: unknown }): string | null {
  if (!text(input?.name)) return VARIATION_LINE_NAME_MESSAGE
  return variationMaterialQuantityError(input?.quantity) ?? costError(input?.cost)
}

/** Refusal for a subcontractor line, or null: a firm name, a quantity above 0 and a cost of 0 or more. */
export function variationSubcontractorLineError(input: { name?: unknown; quantity?: unknown; cost?: unknown }): string | null {
  if (!text(input?.name)) return 'Pick a subcontractor or type its name.'
  return variationMaterialQuantityError(input?.quantity) ?? costError(input?.cost)
}

function money(value: unknown): number {
  return round2(documentNumber(typeof value === 'string' ? value.replace(',', '.') : value) ?? 0)
}

/** The stored custom line. */
export function variationCustomLineFields(input: { id: unknown; name: unknown; description?: unknown; quantity: unknown; cost: unknown }): Record<string, unknown> {
  return {
    id: text(input?.id),
    name: text(input?.name),
    description: typeof input?.description === 'string' ? input.description.trim() : '',
    quantity: money(input?.quantity),
    cost: money(input?.cost),
  }
}

/** The stored subcontractor line. */
export function variationSubcontractorLineFields(input: {
  id: unknown
  subcontractorId?: unknown
  name: unknown
  quoteNumber?: unknown
  quantity: unknown
  cost: unknown
}): Record<string, unknown> {
  return {
    id: text(input?.id),
    subcontractorId: text(input?.subcontractorId),
    name: text(input?.name),
    quoteNumber: text(input?.quoteNumber),
    quantity: money(input?.quantity),
    cost: money(input?.cost),
  }
}

// MARK: - Totals

export type VariationTotalsInput = {
  labour?: ReadonlyArray<{ hours?: unknown }> | null
  materials?: ReadonlyArray<unknown> | null
  customLines?: ReadonlyArray<{ quantity?: unknown; cost?: unknown; lineTotal?: unknown }> | null
  subcontractorLines?: ReadonlyArray<{ quantity?: unknown; cost?: unknown; lineTotal?: unknown }> | null
  evidence?: ReadonlyArray<{ storagePath?: unknown; downloadURL?: unknown }> | null
  isDeleted?: unknown
}

export type VariationTotals = {
  labourHours: number
  materialsCount: number
  customCount: number
  subcontractorCount: number
  customTotal: number
  subcontractorTotal: number
  /** Custom total + subcontractor total (labour and materials carry no price on a variation). */
  costTotal: number
  /** Evidence entries with a storage path or a download URL (the reader's rule). */
  evidenceCount: number
}

function lineTotal(line: { quantity?: unknown; cost?: unknown }): number {
  const quantity = positive(line?.quantity) ?? 1
  const cost = nonNegative(line?.cost) ?? 0
  return round2(quantity * cost)
}

/** One variation's figures. Every screen, export and badge takes them from here. */
export function variationTotals(variation: VariationTotalsInput | null | undefined): VariationTotals {
  const v = variation || {}
  const labourHours = round2((v.labour || []).reduce((sum, line) => sum + (documentNumber(line?.hours) ?? 0), 0))
  const customTotal = round2((v.customLines || []).reduce((sum, line) => sum + lineTotal(line), 0))
  const subcontractorTotal = round2((v.subcontractorLines || []).reduce((sum, line) => sum + lineTotal(line), 0))
  const evidenceCount = (v.evidence || []).filter((item) => Boolean(text(item?.storagePath) || text(item?.downloadURL))).length
  return {
    labourHours,
    materialsCount: (v.materials || []).length,
    customCount: (v.customLines || []).length,
    subcontractorCount: (v.subcontractorLines || []).length,
    customTotal,
    subcontractorTotal,
    costTotal: round2(customTotal + subcontractorTotal),
    evidenceCount,
  }
}

/** A list's figures: the sum of `variationTotals` over the variations not deleted. */
export function variationListTotals(variations: ReadonlyArray<VariationTotalsInput> | null | undefined): VariationTotals & { count: number } {
  const out = { labourHours: 0, materialsCount: 0, customCount: 0, subcontractorCount: 0, customTotal: 0, subcontractorTotal: 0, costTotal: 0, evidenceCount: 0, count: 0 }
  for (const row of variations || []) {
    if (!row || documentBool(row.isDeleted) === true) continue
    const t = variationTotals(row)
    out.count += 1
    out.labourHours += t.labourHours
    out.materialsCount += t.materialsCount
    out.customCount += t.customCount
    out.subcontractorCount += t.subcontractorCount
    out.customTotal += t.customTotal
    out.subcontractorTotal += t.subcontractorTotal
    out.evidenceCount += t.evidenceCount
  }
  out.labourHours = round2(out.labourHours)
  out.customTotal = round2(out.customTotal)
  out.subcontractorTotal = round2(out.subcontractorTotal)
  out.costTotal = round2(out.customTotal + out.subcontractorTotal)
  return out
}

/** Who sees variation costs: the people who see variations (admins and super admins, managers; never operatives). */
export function canSeeVariationCosts(role: Partial<StaffAccountRole> | null | undefined): boolean {
  if (!role || role.isOperativeMode === true) return false
  return role.isSuperAdmin === true || role.isAdmin === true || role.isManager === true
}

// MARK: - Evidence

export const VARIATION_EVIDENCE_MAX_FILES = 10

/**
 * Adding evidence to a variation (1.52.0): `{ set: { evidence, evidenceCount } }` — the stored list (exactly as stored)
 * plus each new entry whose storage path (and id) is not already on it, up to `VARIATION_EVIDENCE_MAX_FILES` files,
 * built from the stored document in a transaction so a file another person added meanwhile is kept. `evidenceCount`
 * is the reader's count (entries with a storage path or a URL). `skipped` lists entries not added (already there, or
 * over the limit). Null when nothing is added.
 */
export function variationEvidenceAddWriteFields(
  stored: Record<string, unknown> | null | undefined,
  entries: ReadonlyArray<Record<string, unknown>> | null | undefined
): { set: { evidence: unknown[]; evidenceCount: number }; added: string[]; skipped: string[] } | null {
  const row = record(stored)
  const evidence: unknown[] = Array.isArray(row.evidence) ? [...row.evidence] : []
  const hasFile = (entry: unknown) => {
    const line = record(entry)
    return Boolean(text(line.storagePath) || text(line.downloadURL))
  }
  const paths = new Set(evidence.map((entry) => text(record(entry).storagePath)).filter(Boolean))
  const ids = new Set(evidence.map((entry) => normalizeDocumentId(record(entry).id)).filter(Boolean))
  const added: string[] = []
  const skipped: string[] = []
  for (const entry of entries || []) {
    const line = record(entry)
    const path = text(line.storagePath)
    const id = text(line.id)
    if (!path && !text(line.downloadURL)) continue
    if ((path && paths.has(path)) || (id && ids.has(normalizeDocumentId(id)))) {
      skipped.push(path || id)
      continue
    }
    if (evidence.filter(hasFile).length >= VARIATION_EVIDENCE_MAX_FILES) {
      skipped.push(path || id)
      continue
    }
    evidence.push({ ...line })
    if (path) paths.add(path)
    if (id) ids.add(normalizeDocumentId(id))
    added.push(path || id)
  }
  if (added.length === 0) return null
  return { set: { evidence, evidenceCount: evidence.filter(hasFile).length }, added, skipped }
}

// MARK: - Dates and status words

export const VARIATION_STATUS_LABELS: Readonly<Record<string, string>> = { open: 'Open', submitted: 'Submitted', closed: 'Closed' }

/** "15 Nov 2026" in the organisation zone (London when missing); '' without a time. */
export function variationDateText(ms: unknown, timeZone?: string | null): string {
  const value = documentInstantMs(ms)
  if (value == null) return ''
  try {
    return new Intl.DateTimeFormat('en-GB', { timeZone: timeZone || 'Europe/London', day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value))
  } catch {
    return new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value))
  }
}

/** The numbers a variation had before ("VO-003, VO-005"), oldest first, without its current number. */
export function variationPreviousNumbers(row: { voNumber?: unknown; numberHistory?: ReadonlyArray<{ from?: unknown }> | null }): string[] {
  const current = text(row?.voNumber).toLowerCase()
  const out: string[] = []
  for (const entry of row?.numberHistory || []) {
    const from = text(entry?.from)
    if (!from || from.toLowerCase() === current || out.some((value) => value.toLowerCase() === from.toLowerCase())) continue
    out.push(from)
  }
  return out
}

// MARK: - Export rows

export type VariationExportInput = VariationTotalsInput & {
  id?: unknown
  voNumber?: unknown
  heading?: unknown
  description?: unknown
  status?: unknown
  createdByName?: unknown
  createdAtMs?: unknown
  numberHistory?: ReadonlyArray<{ from?: unknown }> | null
  labour?: ReadonlyArray<{ trade?: unknown; hours?: unknown; operatives?: unknown; hoursEach?: unknown }> | null
  materials?: ReadonlyArray<{ name?: unknown; quantity?: unknown; quantityValue?: unknown; unit?: unknown }> | null
  customLines?: ReadonlyArray<{ name?: unknown; description?: unknown; quantity?: unknown; cost?: unknown }> | null
  subcontractorLines?: ReadonlyArray<{ name?: unknown; quoteNumber?: unknown; quantity?: unknown; cost?: unknown }> | null
}

export type VariationExportSummaryRow = {
  voNumber: string
  heading: string
  description: string
  status: string
  raisedBy: string
  raisedOn: string
  labourHours: number
  materialLines: number
  customTotal: number | null
  subcontractorTotal: number | null
  totalCost: number | null
  evidenceCount: number
  previousNumbers: string
}

export type VariationExportLineRow = {
  voNumber: string
  type: 'Labour' | 'Material' | 'Custom' | 'Subcontractor'
  description: string
  /** A number, or the stored text when a legacy material quantity is not a number ("1-"); null when none. */
  quantity: number | string | null
  unit: string
  hours: number | null
  cost: number | null
  lineTotal: number | null
  quoteNumber: string
  subcontractor: string
}

export const VARIATION_EXPORT_SUMMARY_COLUMNS = [
  { key: 'voNumber', label: 'VO no.' },
  { key: 'heading', label: 'Heading' },
  { key: 'description', label: 'Description' },
  { key: 'status', label: 'Status' },
  { key: 'raisedBy', label: 'Raised by' },
  { key: 'raisedOn', label: 'Raised on' },
  { key: 'labourHours', label: 'Labour hours' },
  { key: 'materialLines', label: 'Material lines' },
  { key: 'customTotal', label: 'Custom total' },
  { key: 'subcontractorTotal', label: 'Subcontractor total' },
  { key: 'totalCost', label: 'Total cost' },
  { key: 'evidenceCount', label: 'Evidence' },
  { key: 'previousNumbers', label: 'Previous VO numbers' },
] as const

export const VARIATION_EXPORT_LINE_COLUMNS = [
  { key: 'voNumber', label: 'VO' },
  { key: 'type', label: 'Type' },
  { key: 'description', label: 'Description' },
  { key: 'quantity', label: 'Quantity' },
  { key: 'unit', label: 'Unit' },
  { key: 'hours', label: 'Hours' },
  { key: 'cost', label: 'Cost' },
  { key: 'lineTotal', label: 'Line total' },
  { key: 'quoteNumber', label: 'Quote number' },
  { key: 'subcontractor', label: 'Subcontractor' },
] as const

/** Columns that hold money (drawn in the organisation currency; left out when costs are hidden). */
export const VARIATION_EXPORT_COST_KEYS = ['customTotal', 'subcontractorTotal', 'totalCost', 'cost', 'lineTotal'] as const

function byNumber(a: VariationExportInput, b: VariationExportInput): number {
  const diff = variationNumberValue(a.voNumber) - variationNumberValue(b.voNumber)
  if (diff !== 0) return diff
  return (documentInstantMs(a.createdAtMs) ?? 0) - (documentInstantMs(b.createdAtMs) ?? 0)
}

/**
 * The rows of the variations workbook (1.52.0, owner decision 15 Nov): every variation not deleted — with or without
 * lines — in VO-number order, `summaryRows` (one per variation) with `summaryTotals`, and `lineRows` (one per labour,
 * material, custom and subcontractor line). Dates are the organisation zone ("15 Nov 2026"); quantities, hours and
 * money are numbers with the unit in its own column. With `includeCost` false every money cell is null.
 */
export function variationExportRows(
  variations: ReadonlyArray<VariationExportInput> | null | undefined,
  options: { timeZone?: string | null; currency?: string | null; includeCost?: boolean } = {}
): {
  currency: string
  includeCost: boolean
  summaryColumns: typeof VARIATION_EXPORT_SUMMARY_COLUMNS
  lineColumns: typeof VARIATION_EXPORT_LINE_COLUMNS
  summaryRows: VariationExportSummaryRow[]
  summaryTotals: { count: number; labourHours: number; materialLines: number; customTotal: number | null; subcontractorTotal: number | null; totalCost: number | null; evidenceCount: number }
  lineRows: VariationExportLineRow[]
} {
  const includeCost = options.includeCost !== false
  const cost = (n: number) => (includeCost ? n : null)
  const rows = [...(variations || [])].filter((row) => row && documentBool(row.isDeleted) !== true).sort(byNumber)
  const summaryRows: VariationExportSummaryRow[] = []
  const lineRows: VariationExportLineRow[] = []
  for (const row of rows) {
    const t = variationTotals(row)
    const voNumber = text(row.voNumber)
    summaryRows.push({
      voNumber,
      heading: text(row.heading),
      description: typeof row.description === 'string' ? row.description.trim() : '',
      status: VARIATION_STATUS_LABELS[text(row.status).toLowerCase()] ?? 'Open',
      raisedBy: text(row.createdByName),
      raisedOn: variationDateText(row.createdAtMs, options.timeZone),
      labourHours: t.labourHours,
      materialLines: t.materialsCount,
      customTotal: cost(t.customTotal),
      subcontractorTotal: cost(t.subcontractorTotal),
      totalCost: cost(t.costTotal),
      evidenceCount: t.evidenceCount,
      previousNumbers: variationPreviousNumbers(row).join(', '),
    })
    for (const line of row.labour || []) {
      const crew = variationLabourCrew(line as Record<string, unknown>)
      lineRows.push({
        voNumber,
        type: 'Labour',
        description: text(line?.trade),
        quantity: crew.operatives,
        unit: crew.operatives === 1 ? 'operative' : 'operatives',
        hours: round2(crew.hours),
        cost: null,
        lineTotal: null,
        quoteNumber: '',
        subcontractor: '',
      })
    }
    for (const line of row.materials || []) {
      const q = variationMaterialQuantity(line as Record<string, unknown>)
      lineRows.push({
        voNumber,
        type: 'Material',
        description: text(line?.name),
        quantity: q.quantityValue ?? (q.quantity || null),
        unit: q.unit,
        hours: null,
        cost: null,
        lineTotal: null,
        quoteNumber: '',
        subcontractor: '',
      })
    }
    for (const line of row.customLines || []) {
      const quantity = positive(line?.quantity) ?? 1
      const each = nonNegative(line?.cost) ?? 0
      const description = [text(line?.name), typeof line?.description === 'string' ? line.description.trim() : ''].filter(Boolean).join(' — ')
      lineRows.push({ voNumber, type: 'Custom', description, quantity, unit: '', hours: null, cost: cost(each), lineTotal: cost(round2(quantity * each)), quoteNumber: '', subcontractor: '' })
    }
    for (const line of row.subcontractorLines || []) {
      const quantity = positive(line?.quantity) ?? 1
      const each = nonNegative(line?.cost) ?? 0
      lineRows.push({
        voNumber,
        type: 'Subcontractor',
        description: text(line?.name),
        quantity,
        unit: '',
        hours: null,
        cost: cost(each),
        lineTotal: cost(round2(quantity * each)),
        quoteNumber: text(line?.quoteNumber),
        subcontractor: text(line?.name),
      })
    }
  }
  const totals = variationListTotals(rows)
  return {
    currency: text(options.currency) || 'GBP',
    includeCost,
    summaryColumns: VARIATION_EXPORT_SUMMARY_COLUMNS,
    lineColumns: VARIATION_EXPORT_LINE_COLUMNS,
    summaryRows,
    summaryTotals: {
      count: totals.count,
      labourHours: totals.labourHours,
      materialLines: totals.materialsCount,
      customTotal: cost(totals.customTotal),
      subcontractorTotal: cost(totals.subcontractorTotal),
      totalCost: cost(totals.costTotal),
      evidenceCount: totals.evidenceCount,
    },
    lineRows,
  }
}

/** The workbook's file name: "{job number}-variations.xlsx" (letters, digits, - and _ only). */
export function variationExportFileName(jobNumber: unknown): string {
  const base = text(jobNumber).replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '')
  return `${base || 'variations'}-variations.xlsx`
}

// MARK: - Tracker renumbering

export type VariationRenumberInputRow = {
  id?: unknown
  voNumber?: unknown
  status?: unknown
  isDeleted?: unknown
  voNumberLocked?: unknown
  sequence?: unknown
  numberHistory?: ReadonlyArray<{ from?: unknown; to?: unknown }> | null
}

/** Submitted and Closed variations, and any whose number is locked, keep their numbers and do not move (owner 15 Nov). */
export function variationIsPinned(row: VariationRenumberInputRow | null | undefined): boolean {
  const status = text(row?.status).toLowerCase()
  return status === 'submitted' || status === 'closed' || status === 'sent' || status === 'complete' || status === 'completed' || status === 'done' || documentBool(row?.voNumberLocked) === true
}

export type VariationRenumberPlanRow = {
  id: string
  from: string
  to: string
  changed: boolean
  pinned: boolean
  /** 1-based position in the new order. */
  sequence: number
  sequenceChanged: boolean
}

/**
 * The new numbers for a tracker order (1.52.0; replaces web's `previewRenumber`). `rows` are the STORED variations of
 * the job (deleted included); `order` is the ids of the live ones top to bottom (ids missing from it keep their stored
 * place after the listed ones). Pinned variations (`variationIsPinned`) keep their numbers. The open variations, in
 * the new order, take the pool of their own current numbers sorted lowest first — leaving out any number a deleted or
 * pinned variation holds, and duplicates — and, when the pool runs short, new numbers above every number ever issued
 * on the job (current numbers of every variation and every `numberHistory` entry), so a number is never reused (§22).
 * `sequence` is the 1-based position. The live preview while dragging and the save use the same plan.
 */
export function variationRenumberPlan(input: {
  rows: ReadonlyArray<VariationRenumberInputRow> | null | undefined
  order?: ReadonlyArray<unknown> | null
  prefix?: string | null
  padding?: number | null
}): { rows: VariationRenumberPlanRow[]; changes: VariationRenumberPlanRow[] } {
  const prefix = text(input?.prefix) || DEFAULT_VARIATION_PREFIX
  const padding = Number.isFinite(Number(input?.padding)) && Number(input?.padding) >= 1 ? Number(input?.padding) : DEFAULT_VARIATION_PADDING
  const all = (input?.rows || []).filter((row) => row && text(row.id))
  const live = all.filter((row) => documentBool(row.isDeleted) !== true)
  const byKey = new Map(live.map((row) => [normalizeDocumentId(row.id), row]))
  const ordered: VariationRenumberInputRow[] = []
  const seen = new Set<string>()
  for (const id of input?.order || []) {
    const key = normalizeDocumentId(id)
    const row = byKey.get(key)
    if (!row || seen.has(key)) continue
    seen.add(key)
    ordered.push(row)
  }
  const rest = live
    .filter((row) => !seen.has(normalizeDocumentId(row.id)))
    .sort((a, b) => (documentNumber(a.sequence) ?? 0) - (documentNumber(b.sequence) ?? 0) || variationNumberValue(a.voNumber) - variationNumberValue(b.voNumber))
  ordered.push(...rest)

  const reserved = new Set<string>()
  for (const row of all) {
    if (documentBool(row.isDeleted) === true || variationIsPinned(row)) {
      const n = text(row.voNumber).toLowerCase()
      if (n) reserved.add(n)
    }
  }
  let highest = 0
  for (const row of all) {
    highest = Math.max(highest, variationNumberValue(row.voNumber))
    for (const entry of row.numberHistory || []) highest = Math.max(highest, variationNumberValue(entry?.from), variationNumberValue(entry?.to))
  }
  const openRows = ordered.filter((row) => !variationIsPinned(row))
  const poolSeen = new Set<string>()
  const pool: string[] = []
  for (const row of openRows) {
    const n = text(row.voNumber)
    const key = n.toLowerCase()
    if (!n || reserved.has(key) || poolSeen.has(key)) continue
    poolSeen.add(key)
    pool.push(n)
  }
  pool.sort((a, b) => variationNumberValue(a) - variationNumberValue(b))
  while (pool.length < openRows.length) {
    highest += 1
    pool.push(formatVariationNumber(highest, prefix, padding))
  }
  let cursor = 0
  const out: VariationRenumberPlanRow[] = ordered.map((row, index) => {
    const from = text(row.voNumber)
    const pinned = variationIsPinned(row)
    const to = pinned ? from : pool[cursor++]
    const sequence = index + 1
    return {
      id: text(row.id),
      from,
      to,
      changed: to !== from,
      pinned,
      sequence,
      sequenceChanged: Math.trunc(documentNumber(row.sequence) ?? NaN) !== sequence,
    }
  })
  return { rows: out, changes: out.filter((row) => row.changed || row.sequenceChanged) }
}

export const VARIATION_RENUMBER_STALE_MESSAGE = 'Someone else changed the variations — reload'
export const VARIATION_PINNED_MESSAGE = 'Submitted and closed variations keep their numbers. They cannot be moved.'

function renumberFingerprint(rows: ReadonlyArray<VariationRenumberInputRow> | null | undefined): string {
  return (rows || [])
    .filter((row) => row && text(row.id))
    .map((row) => [normalizeDocumentId(row.id), text(row.voNumber).toLowerCase(), Math.trunc(documentNumber(row.sequence) ?? 0), text(row.status).toLowerCase(), documentBool(row.isDeleted) === true ? 1 : 0].join('|'))
    .sort()
    .join('\n')
}

/**
 * Whether the variations changed since the tracker screen loaded them (`base`) — another number, position, status,
 * a removal or a new variation in the stored copy (`live`, read in the save's transaction). A save is refused then
 * with `VARIATION_RENUMBER_STALE_MESSAGE`.
 */
export function variationRenumberConflict(
  base: ReadonlyArray<VariationRenumberInputRow> | null | undefined,
  live: ReadonlyArray<VariationRenumberInputRow> | null | undefined
): boolean {
  return renumberFingerprint(base) !== renumberFingerprint(live)
}

/**
 * Who reorders and renumbers variations in the tracker (1.52.0): admins and super admins outside operative mode, and
 * a manager who is one of the job's managers (`isJobManager`, passed as `managesJob`). Operatives never.
 */
export function canRenumberVariations(role: Partial<StaffAccountRole> | null | undefined, options: { managesJob?: boolean } = {}): boolean {
  if (!role || role.isOperativeMode === true) return false
  if (role.isSuperAdmin === true || role.isAdmin === true) return true
  return role.isManager === true && options.managesJob === true
}
