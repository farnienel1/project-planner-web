/**
 * How much of a material is ordered (rulebook 1.48.0 §28, owner decisions 15 Nov).
 *
 * Before 1.48.0 one field, the unit (`Number`, `Box`, `Length`, `Drum`, `Pallet`), did two jobs: `Length` meant both
 * "sold by the metre" (flex: 1 m × 100) and "a fixed bar" (trunking: 3 m × 10), and each app printed the unit and the
 * length separately ("100 Lengths · Length: 1 m"). From 1.48.0 a line (and a catalogue item's default) says three
 * things:
 *   - the quantity ordered;
 *   - the order unit (`MATERIAL_ORDER_UNITS`): Each, Box, Pack, Drum, Reel, Coil, Pallet, Length (a fixed bar or
 *     stick), or Metre (cut to length — the quantity is the metres);
 *   - optionally what is in one (`contentAmount` + `contentMeasure`: m, mm or pcs): 50 m in a drum, 3 m per length.
 *
 * Nothing stored is rewritten. `materialQuantityModel` reads the new fields when stored, else the old ones
 * (`unit` / `defaultUnit`, `length` / `sizeOrLength` / `packSize`, `lengthUnit`). A save writes the new fields and the
 * old ones with the nearest old meaning (`materialQuantityWriteFields`), so older builds still read the line.
 *
 * Every screen, email, WhatsApp message and new send record prints the quantity with `materialLineText` (UK trade
 * style: "2no 50m drums", "100m", "4no"). Past send records keep the text they were sent with
 * (`materialSendLineText`).
 */

import { documentNumber } from './peopleDocuments'

export const MATERIAL_ORDER_UNITS = ['Each', 'Box', 'Pack', 'Drum', 'Reel', 'Coil', 'Pallet', 'Length', 'Metre'] as const
export type MaterialOrderUnit = (typeof MATERIAL_ORDER_UNITS)[number]

export const MATERIAL_CONTENT_MEASURES = ['m', 'mm', 'pcs'] as const
export type MaterialContentMeasure = (typeof MATERIAL_CONTENT_MEASURES)[number]

/** The unit older builds read (`unit` on a line, `defaultUnit` on a catalogue item) for each order unit. */
export type MaterialLegacyUnit = 'Number' | 'Box' | 'Length' | 'Drum' | 'Pallet'

export type MaterialOrderUnitDetail = {
  /** Picker label. */
  label: string
  /** Noun in `materialLineText` ('' for Each and Metre, which print no noun). */
  singular: string
  plural: string
  /** One-line help under the picker. */
  hint: string
  /** Measures the "What's in one" picker offers (empty: none). */
  measures: readonly MaterialContentMeasure[]
  /** Whether the quantity may have decimals (owner decision 3: only Metre). */
  decimalQuantity: boolean
  legacyUnit: MaterialLegacyUnit
}

export const MATERIAL_ORDER_UNIT_DETAILS: Readonly<Record<MaterialOrderUnit, MaterialOrderUnitDetail>> = {
  Each: {
    label: 'Each',
    singular: '',
    plural: '',
    hint: 'Single items such as sockets or fittings.',
    measures: ['m', 'mm'],
    decimalQuantity: false,
    legacyUnit: 'Number',
  },
  Box: {
    label: 'Box',
    singular: 'box',
    plural: 'boxes',
    hint: 'Sold by the box. Add what is in one box (100 pcs, 305 m).',
    measures: ['pcs', 'm'],
    decimalQuantity: false,
    legacyUnit: 'Box',
  },
  Pack: {
    label: 'Pack',
    singular: 'pack',
    plural: 'packs',
    hint: 'Sold by the pack. Add what is in one pack (10 pcs).',
    measures: ['pcs', 'm'],
    decimalQuantity: false,
    legacyUnit: 'Box',
  },
  Drum: {
    label: 'Drum',
    singular: 'drum',
    plural: 'drums',
    hint: 'Cable on a drum. Add the metres on one drum (50 m).',
    measures: ['m'],
    decimalQuantity: false,
    legacyUnit: 'Drum',
  },
  Reel: {
    label: 'Reel',
    singular: 'reel',
    plural: 'reels',
    hint: 'Sold by the reel. Add the metres on one reel.',
    measures: ['m'],
    decimalQuantity: false,
    legacyUnit: 'Drum',
  },
  Coil: {
    label: 'Coil',
    singular: 'coil',
    plural: 'coils',
    hint: 'Sold by the coil. Add the metres in one coil.',
    measures: ['m'],
    decimalQuantity: false,
    legacyUnit: 'Drum',
  },
  Pallet: {
    label: 'Pallet',
    singular: 'pallet',
    plural: 'pallets',
    hint: 'Sold by the pallet. Add how many pieces are on one, if you know.',
    measures: ['pcs'],
    decimalQuantity: false,
    legacyUnit: 'Pallet',
  },
  Length: {
    label: 'Length',
    singular: 'length',
    plural: 'lengths',
    hint: 'A fixed bar or stick (trunking, timber). Add the length of one (3 m).',
    measures: ['m', 'mm'],
    decimalQuantity: false,
    legacyUnit: 'Length',
  },
  Metre: {
    label: 'Metre',
    singular: '',
    plural: '',
    hint: 'Cut to length. The quantity is the metres (12.5 m).',
    measures: [],
    decimalQuantity: true,
    legacyUnit: 'Length',
  },
}

const ORDER_UNIT_SYNONYMS: Readonly<Record<string, MaterialOrderUnit>> = {
  each: 'Each',
  ea: 'Each',
  no: 'Each',
  number: 'Each',
  numbers: 'Each',
  item: 'Each',
  items: 'Each',
  piece: 'Each',
  pieces: 'Each',
  box: 'Box',
  boxes: 'Box',
  pack: 'Pack',
  packs: 'Pack',
  packet: 'Pack',
  packets: 'Pack',
  drum: 'Drum',
  drums: 'Drum',
  reel: 'Reel',
  reels: 'Reel',
  coil: 'Coil',
  coils: 'Coil',
  pallet: 'Pallet',
  pallets: 'Pallet',
  length: 'Length',
  lengths: 'Length',
  bar: 'Length',
  bars: 'Length',
  metre: 'Metre',
  metres: 'Metre',
  meter: 'Metre',
  meters: 'Metre',
  m: 'Metre',
  permetre: 'Metre',
}

function text(value: unknown): string {
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return ''
}

/** An order unit from any spelling (case, plural, "number", "metre"/"meter"). Null when unknown or blank. */
export function normalizeMaterialOrderUnit(raw: unknown): MaterialOrderUnit | null {
  const token = text(raw).toLowerCase().replace(/[\s_\-]+/g, '')
  if (!token) return null
  return ORDER_UNIT_SYNONYMS[token] ?? null
}

/** m / mm / pcs from any spelling ("M", "MM", "metres", "pieces"). Null when unknown. */
export function normalizeMaterialContentMeasure(raw: unknown): MaterialContentMeasure | null {
  const token = text(raw).toLowerCase().replace(/\s+/g, '')
  if (!token) return null
  if (['m', 'metre', 'metres', 'meter', 'meters', 'mtr', 'mtrs'].includes(token)) return 'm'
  if (['mm', 'millimetre', 'millimetres', 'millimeter', 'millimeters'].includes(token)) return 'mm'
  if (['pcs', 'pc', 'piece', 'pieces', 'no', 'each', 'ea', 'items'].includes(token)) return 'pcs'
  return null
}

/** A stored amount without float noise (2.4000000000000004 → 2.4); up to 3 decimals. */
export function tidyMaterialAmount(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.round(value * 1000) / 1000
}

/** An amount as text with no trailing zeros ("2.4", "50", "12.5"). */
export function formatMaterialAmount(value: number): string {
  return String(tidyMaterialAmount(value))
}

const MEASURE_TEXT = /^\s*(\d+(?:[.,]\d+)?)\s*([a-zA-Z]*)\s*$/

/**
 * A stored length or content ("3", 3, "3m", "150 mm", "2.4000000000000004", "100M") with its unit field ("M" / "MM"),
 * as `{ amount, measure }`. A unit glued to the value wins over the unit field; with neither, metres. Null when the
 * value is blank, not a number, 0 or below, or has a unit that is not a length.
 */
export function parseMaterialMeasure(
  value: unknown,
  unitHint?: unknown
): { amount: number; measure: MaterialContentMeasure } | null {
  const raw = text(value)
  if (!raw) return null
  const match = MEASURE_TEXT.exec(raw)
  if (!match) return null
  const amount = Number(match[1].replace(',', '.'))
  if (!Number.isFinite(amount) || amount <= 0) return null
  const suffix = match[2]
  const measure = suffix ? normalizeMaterialContentMeasure(suffix) : normalizeMaterialContentMeasure(unitHint) ?? 'm'
  if (!measure) return null
  return { amount: tidyMaterialAmount(amount), measure }
}

export type MaterialQuantityModel = {
  orderUnit: MaterialOrderUnit
  /** What is in one (null when not given; always null for Metre). */
  contentAmount: number | null
  contentMeasure: MaterialContentMeasure | null
  /** True when read from the pre-1.48.0 fields (no `orderUnit` stored). */
  fromLegacy: boolean
}

function withoutNewFields(row: Record<string, unknown>): Record<string, unknown> {
  const out = { ...row }
  delete out.orderUnit
  delete out.contentAmount
  delete out.contentMeasure
  return out
}

/**
 * Whether a document's stored old fields are what `materialQuantityWriteFields(model)` writes for its new fields.
 * Only the fields the document carries are compared: the old unit when `unit` / `defaultUnit` is stored, the length
 * when `length` / `sizeOrLength` / `lengthUnit` is stored — so an email payload with `orderUnit` and no old length
 * is trusted. Unit names compare without case; lengths by amount and measure.
 */
function storedLegacyMatches(row: Record<string, unknown>, model: MaterialQuantityModel): boolean {
  const unitField = 'unit' in row ? 'unit' : 'defaultUnit' in row ? 'defaultUnit' : null
  const expected = materialQuantityWriteFields(model, { unitField: unitField ?? 'unit' })
  if (unitField && text(row[unitField])) {
    if (text(row[unitField]).toLowerCase() !== String(expected[unitField]).toLowerCase()) return false
  }
  const hasLength = 'length' in row || 'sizeOrLength' in row || 'lengthUnit' in row
  if (hasLength) {
    // A stored `packSize` is never compared: no writer since 1.8.0 writes it, so beside `orderUnit` and contents it is
    // stale and must not make the new fields look stale (second review of #326).
    const storedText = text(row.length) || text(row.sizeOrLength)
    const storedLength = parseMaterialMeasure(storedText, row.lengthUnit)
    const expectedLength = parseMaterialMeasure(expected.length, expected.lengthUnit)
    if (!storedLength && !expectedLength) return true
    if (!storedLength || !expectedLength) {
      // A stored length that is not a number ("3m x 2") is kept as given by the writer; it never disagrees.
      return !storedLength && Boolean(storedText)
    }
    return storedLength.amount === expectedLength.amount && storedLength.measure === expectedLength.measure
  }
  return true
}

/** The old length: `length`, else `sizeOrLength`, else `packSize` (a number, read as metres like a bare length). */
function legacyLength(row: Record<string, unknown>): unknown {
  const length = text(row.length) || text(row.sizeOrLength)
  if (length) return length
  const pack = documentNumber(row.packSize)
  return pack == null ? null : pack
}

/**
 * The quantity model of a stored line or catalogue item (`materials/{id}`, `materialCatalogue/{id}`, a send line, an
 * email payload line). A valid stored `orderUnit` wins, with `contentAmount` / `contentMeasure`, while the stored old
 * fields agree with it (`storedLegacyMatches`); when they do not, an older build edited the old fields and left the new
 * ones stale, so the old fields are read. Otherwise the old
 * fields are read (owner decisions 1–2):
 *   - Number → Each (its length, if any, is what is in one);
 *   - Box / Drum / Pallet → the same, the length what is in one;
 *   - Length with exactly 1 m → Metre (the quantity is the metres);
 *   - Length with another length (3 m, 150 mm) → Length, that length each; Length with none → Length.
 * The old unit is `unit`, else `defaultUnit`; unknown or missing reads as Number. A legacy email line may carry only
 * `lengthDisplay` ("3 m"), which is read the same way.
 */
export function materialQuantityModel(data: Record<string, unknown> | null | undefined): MaterialQuantityModel {
  const row = data && typeof data === 'object' ? data : {}
  const stored = normalizeMaterialOrderUnit(row.orderUnit)
  if (stored) {
    const amount = documentNumber(row.contentAmount)
    const measure = normalizeMaterialContentMeasure(row.contentMeasure)
    const valid = stored !== 'Metre' && amount != null && amount > 0 && measure != null
    const model: MaterialQuantityModel = {
      orderUnit: stored,
      contentAmount: valid ? tidyMaterialAmount(amount as number) : null,
      contentMeasure: valid ? measure : null,
      fromLegacy: false,
    }
    // An older build edits only the old fields it knows and leaves `orderUnit` / `contentAmount` stale (web Drum
    // 50 m, then an older iPhone changes it to Box 100 M). When the stored old fields are not what this model would
    // have written, the old fields are the newer edit: read them instead.
    if (!storedLegacyMatches(row, model)) return materialQuantityModel(withoutNewFields(row))
    return model
  }
  const legacyToken = text(row.unit) || text(row.defaultUnit)
  const legacy = (['number', 'box', 'length', 'drum', 'pallet'] as const).find((u) => u === legacyToken.toLowerCase())
  const length =
    parseMaterialMeasure(legacyLength(row), row.lengthUnit) ?? parseMaterialMeasure(row.lengthDisplay, null)
  const content = length ? { contentAmount: length.amount, contentMeasure: length.measure } : { contentAmount: null, contentMeasure: null }
  switch (legacy) {
    case 'box':
      return { orderUnit: 'Box', ...content, fromLegacy: true }
    case 'drum':
      return { orderUnit: 'Drum', ...content, fromLegacy: true }
    case 'pallet':
      return { orderUnit: 'Pallet', ...content, fromLegacy: true }
    case 'length':
      if (length && length.measure === 'm' && length.amount === 1) {
        return { orderUnit: 'Metre', contentAmount: null, contentMeasure: null, fromLegacy: true }
      }
      return { orderUnit: 'Length', ...content, fromLegacy: true }
    case 'number':
      return { orderUnit: 'Each', ...content, fromLegacy: true }
    default: {
      // Web before 1.48.0 also offered "m", "mm" and "kg" as a line unit: "m" is cut to length (Metre); any other
      // order-unit spelling is that unit; the rest read as Each.
      const named = normalizeMaterialOrderUnit(legacyToken)
      if (named === 'Metre') return { orderUnit: 'Metre', contentAmount: null, contentMeasure: null, fromLegacy: true }
      return { orderUnit: named ?? 'Each', ...content, fromLegacy: true }
    }
  }
}

/** Two models say the same thing (unit and content; `fromLegacy` ignored). */
export function materialQuantityModelsEqual(a: MaterialQuantityModel, b: MaterialQuantityModel): boolean {
  return a.orderUnit === b.orderUnit && a.contentAmount === b.contentAmount && a.contentMeasure === b.contentMeasure
}

export type MaterialQuantityInput = {
  orderUnit?: unknown
  contentAmount?: unknown
  contentMeasure?: unknown
}

/**
 * The stored quantity fields for a model: the new `orderUnit` / `contentAmount` / `contentMeasure` and the old fields
 * with the nearest old meaning, for older builds — `unit` (or `defaultUnit` on a catalogue item): Reel / Coil → Drum,
 * Pack → Box, Each → Number, Metre → Length; `length` / `sizeOrLength` / `lengthUnit`: Metre → "1" + M, a content in
 * m or mm → that amount + M / MM, pcs or none → null (old builds have no field for a piece count).
 */
export function materialQuantityWriteFields(
  model: MaterialQuantityInput,
  options?: { unitField?: 'unit' | 'defaultUnit' } | null
): Record<string, unknown> {
  const orderUnit = normalizeMaterialOrderUnit(model?.orderUnit) ?? 'Each'
  const detail = MATERIAL_ORDER_UNIT_DETAILS[orderUnit]
  const amountRaw = documentNumber(model?.contentAmount)
  const measure = normalizeMaterialContentMeasure(model?.contentMeasure)
  const hasContent = orderUnit !== 'Metre' && amountRaw != null && amountRaw > 0 && measure != null
  const amount = hasContent ? tidyMaterialAmount(amountRaw as number) : null
  let legacyLengthText: string | null = null
  let legacyLengthUnit: 'M' | 'MM' | null = null
  if (orderUnit === 'Metre') {
    legacyLengthText = '1'
    legacyLengthUnit = 'M'
  } else if (hasContent && measure !== 'pcs') {
    legacyLengthText = formatMaterialAmount(amount as number)
    legacyLengthUnit = measure === 'mm' ? 'MM' : 'M'
  }
  return {
    orderUnit,
    contentAmount: amount,
    contentMeasure: hasContent ? measure : null,
    [options?.unitField ?? 'unit']: detail.legacyUnit,
    length: legacyLengthText,
    sizeOrLength: legacyLengthText,
    lengthUnit: legacyLengthUnit,
  }
}

/** The fields `materialQuantityWriteFields` writes (a partial save writes them together). */
export const MATERIAL_QUANTITY_FIELDS = ['orderUnit', 'contentAmount', 'contentMeasure'] as const

/** "50m", "150mm", "100pcs" — what is in one. '' when there is nothing. */
export function materialContentText(model: {
  contentAmount?: number | null
  contentMeasure?: MaterialContentMeasure | null
}): string {
  if (model?.contentAmount == null || !model.contentMeasure) return ''
  return `${formatMaterialAmount(model.contentAmount)}${model.contentMeasure}`
}

export type MaterialLineTextInput = MaterialQuantityInput & {
  quantity?: unknown
  unit?: unknown
  defaultUnit?: unknown
  length?: unknown
  sizeOrLength?: unknown
  lengthUnit?: unknown
  packSize?: unknown
  lengthDisplay?: unknown
}

function quantityOf(raw: unknown): number {
  const n = documentNumber(raw)
  return n != null && n >= 0 ? tidyMaterialAmount(n) : 1
}

/**
 * The quantity text every screen, email, WhatsApp message and new send record prints (UK trade style, owner decision
 * 15 Nov, no pack totals):
 *   - Metre: "100m", "12.5m";
 *   - Each: "4no", with a length "4no 3m";
 *   - with what is in one in m / mm: "2no 50m drums", "1no 50m drum", "10no 3m lengths", "2no 100m boxes";
 *   - with pieces: "2no boxes of 100", "1no pack of 10";
 *   - with nothing in one: "2no boxes", "1no pallet".
 * The noun is singular for a quantity of exactly 1. A legacy line's `lengthDisplay` that cannot be read as a length
 * is kept after the text in brackets, so nothing the sender typed is lost.
 */
export function materialLineText(line: MaterialLineTextInput | null | undefined): string {
  const row = (line ?? {}) as Record<string, unknown>
  const model = materialQuantityModel(row)
  const quantity = quantityOf(row.quantity)
  const q = formatMaterialAmount(quantity)
  const detail = MATERIAL_ORDER_UNIT_DETAILS[model.orderUnit]
  const noun = quantity === 1 ? detail.singular : detail.plural
  let out: string
  if (model.orderUnit === 'Metre') {
    out = `${q}m`
  } else if (model.contentAmount != null && model.contentMeasure === 'pcs') {
    out = noun ? `${q}no ${noun} of ${formatMaterialAmount(model.contentAmount)}` : `${q}no (${materialContentText(model)})`
  } else {
    const content = materialContentText(model)
    out = [`${q}no`, content, noun].filter(Boolean).join(' ')
  }
  const display = text(row.lengthDisplay)
  const lengthStored = text(row.length) || text(row.sizeOrLength) || documentNumber(row.packSize) != null
  if (model.fromLegacy && display && !lengthStored && !parseMaterialMeasure(display, null)) out = `${out} (${display})`
  return out
}

/** A send-record line as shown in quote / order history: its stored `quantityText`, else the pre-1.48.0 wording. */
export function materialSendLineText(line: {
  quantityText?: unknown
  quantity?: unknown
  unit?: unknown
  lengthDisplay?: unknown
}): string {
  const stored = text(line?.quantityText)
  if (stored) return stored
  const quantity = quantityOf(line?.quantity)
  const unit = text(line?.unit) || 'Number'
  const key = unit.toLowerCase()
  const plural = quantity !== 1
  const word =
    key === 'number'
      ? plural ? 'Numbers' : 'Number'
      : key === 'box'
        ? plural ? 'Boxes' : 'Box'
        : key === 'length'
          ? plural ? 'Lengths' : 'Length'
          : key === 'drum'
            ? plural ? 'Drums' : 'Drum'
            : key === 'pallet'
              ? plural ? 'Pallets' : 'Pallet'
              : unit
  const length = text(line?.lengthDisplay)
  return length ? `${formatMaterialAmount(quantity)} ${word} · Length: ${length}` : `${formatMaterialAmount(quantity)} ${word}`
}

/** A catalogue or line Size as shown: '' for the "1" / "1.0" placeholder the starter rows carried (owner decision 4). */
export function materialSizeText(size: unknown): string {
  const value = text(size)
  if (/^1(?:\.0+)?$/.test(value)) return ''
  return value
}

export const MATERIAL_QUANTITY_WHOLE_MESSAGE = 'Use a whole number. Only Metre can have decimals (12.5 m).'
export const MATERIAL_QUANTITY_POSITIVE_MESSAGE = 'Enter a quantity above 0.'
export const MATERIAL_CONTENT_MESSAGE = 'Enter what is in one as a number above 0, or leave it blank.'
export const MATERIAL_QUANTITY_MAX = 100000

/**
 * Why a quantity cannot be saved for an order unit, or null (owner decision 3): above 0, at most
 * `MATERIAL_QUANTITY_MAX`, a whole number except for Metre (up to 3 decimals). Old stored decimals are never
 * rewritten; this is checked only when a person types a quantity.
 */
export function materialQuantityError(quantity: unknown, orderUnit: unknown): string | null {
  const n = documentNumber(quantity)
  if (n == null || n <= 0) return MATERIAL_QUANTITY_POSITIVE_MESSAGE
  if (n > MATERIAL_QUANTITY_MAX) return `Enter a quantity of at most ${MATERIAL_QUANTITY_MAX}.`
  const unit = normalizeMaterialOrderUnit(orderUnit) ?? 'Each'
  if (MATERIAL_ORDER_UNIT_DETAILS[unit].decimalQuantity) {
    return tidyMaterialAmount(n) === n ? null : 'Use at most 3 decimals.'
  }
  return Number.isInteger(n) ? null : MATERIAL_QUANTITY_WHOLE_MESSAGE
}

/** Why "What's in one" cannot be saved, or null: blank is fine; otherwise a number above 0 with a measure the unit offers. */
export function materialContentError(amount: unknown, measure: unknown, orderUnit: unknown): string | null {
  const raw = text(amount)
  if (!raw) return null
  const n = documentNumber(amount)
  if (n == null || n <= 0 || n > MATERIAL_QUANTITY_MAX) return MATERIAL_CONTENT_MESSAGE
  const unit = normalizeMaterialOrderUnit(orderUnit) ?? 'Each'
  const m = normalizeMaterialContentMeasure(measure)
  if (!m || !MATERIAL_ORDER_UNIT_DETAILS[unit].measures.includes(m)) {
    return `Choose ${MATERIAL_ORDER_UNIT_DETAILS[unit].measures.join(', ') || 'no measure'} for ${unit}.`
  }
  return null
}

// MARK: - Material brand (1.57.0)

/** What a missing brand reads as on every screen, email and export slot (owner decision 17 Nov). */
export const MATERIAL_BRAND_MISSING_TEXT = 'N/A'

/** The word older builds stored for a blank catalogue brand (before 1.57.0); read as no brand. */
export const MATERIAL_BRAND_LEGACY_BLANK = 'Custom'

/**
 * The brand as the apps hold and save it (1.57.0): trimmed, '' for none. The stored word "Custom" (trimmed, any
 * letter case) is the old placeholder for a blank brand, so it reads as none too. Never rewrites what is stored.
 */
export function materialBrandStored(value: unknown): string {
  const brand = typeof value === 'string' ? value.trim() : ''
  if (!brand) return ''
  return brand.toLowerCase() === MATERIAL_BRAND_LEGACY_BLANK.toLowerCase() ? '' : brand
}

/** The brand shown in a brand slot (catalogue list, pickers, the email "Manufacturer"): "N/A" when none. */
export function materialBrandText(value: unknown): string {
  return materialBrandStored(value) || MATERIAL_BRAND_MISSING_TEXT
}
