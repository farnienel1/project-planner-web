/**
 * Material catalogue CSV: the one import and export rule for web and iOS (rulebook 1.48.0 §28).
 *
 * Columns (export): Catalogue ID, Name, Category, Manufacturer/Brand, Product Code, Order unit, Contents amount,
 * Contents measure, Size, then the pre-1.48.0 Default Type, Length, Length Unit filled with the nearest old meaning
 * (`materialQuantityWriteFields`) so an older iPhone imports the file correctly. Import finds columns by header name
 * (case and spacing ignored); a filled Order unit wins, else the old columns are read with `materialQuantityModel`
 * exactly like stored documents, so files in the pre-1.48.0 layout still import.
 *
 * Upload safety (owner request 15 Nov): a file is accepted only when it is named `.csv`, is at most
 * `MATERIAL_CATALOGUE_CSV_MAX_BYTES`, decodes as UTF-8 and holds no NUL or other binary control characters
 * (`materialCatalogueCsvFileError`, `materialCatalogueCsvTextError`; each app also refuses bytes that are not UTF-8).
 * The file is parsed on the device only and never uploaded. At most `MATERIAL_CATALOGUE_CSV_MAX_ROWS` rows; every
 * field is capped (`MATERIAL_CATALOGUE_CSV_FIELD_MAX`) and kept as plain text. Export neutralises spreadsheet
 * formulas: a cell starting with = + - @ tab or CR gets a leading apostrophe (`materialCatalogueCsvCell`), and the
 * import takes that apostrophe off again so a round trip keeps the text.
 */

import {
  formatMaterialAmount,
  materialContentError,
  materialQuantityWriteFields,
  materialQuantityModel,
  normalizeMaterialContentMeasure,
  normalizeMaterialOrderUnit,
  type MaterialContentMeasure,
  type MaterialOrderUnit,
} from './materialQuantity'
import { documentNumber } from './peopleDocuments'

export const MATERIAL_CATALOGUE_CSV_COLUMNS = [
  'Catalogue ID',
  'Name',
  'Category',
  'Manufacturer/Brand',
  'Product Code',
  'Order unit',
  'Contents amount',
  'Contents measure',
  'Size',
  // The pre-1.48.0 columns, filled with the nearest old meaning, so an older iPhone imports the file correctly.
  // On import a filled Order unit wins over them.
  'Default Type (Length Drum Box Pallet or Number)',
  'Length',
  'Length Unit (M or MM)',
] as const

export const MATERIAL_CATALOGUE_CSV_HEADER = MATERIAL_CATALOGUE_CSV_COLUMNS.join(',')

/** The pre-1.48.0 header (still imported). */
export const MATERIAL_CATALOGUE_CSV_LEGACY_HEADER =
  'Catalogue ID,Name,Category,Manufacturer/Brand,Product Code,Default Type (Length Drum Box Pallet or Number),Size,Length,Length Unit (M or MM)'

export const MATERIAL_CATALOGUE_CSV_MAX_BYTES = 2 * 1024 * 1024
export const MATERIAL_CATALOGUE_CSV_MAX_ROWS = 10000

/** Longest text kept per field; a longer cell refuses that row with a message. */
export const MATERIAL_CATALOGUE_CSV_FIELD_MAX = {
  id: 64,
  name: 200,
  category: 80,
  brand: 80,
  productCode: 80,
  orderUnit: 20,
  contentAmount: 20,
  contentMeasure: 20,
  size: 80,
} as const

export const MATERIAL_CATALOGUE_CSV_NOT_CSV_MESSAGE = 'Choose a .csv file. Excel (.xlsx) and Numbers files cannot be read — save as CSV first.'
export const MATERIAL_CATALOGUE_CSV_TOO_BIG_MESSAGE = 'That file is over 2 MB. Split it into smaller files and upload each one.'
export const MATERIAL_CATALOGUE_CSV_EMPTY_MESSAGE = 'That file is empty.'
export const MATERIAL_CATALOGUE_CSV_BINARY_MESSAGE =
  'That file is not a plain-text CSV (it holds binary data). Open it in a spreadsheet and save it as CSV (UTF-8).'
export const MATERIAL_CATALOGUE_CSV_ENCODING_MESSAGE =
  'That file is not saved as UTF-8 text. In your spreadsheet choose "CSV UTF-8" when you save it.'
export const MATERIAL_CATALOGUE_CSV_HEADER_MESSAGE =
  'That CSV does not have the catalogue columns. It needs at least Name and Category — download the template to start.'
export const MATERIAL_CATALOGUE_CSV_TOO_MANY_ROWS_MESSAGE = `That CSV has more than ${MATERIAL_CATALOGUE_CSV_MAX_ROWS.toLocaleString('en-GB')} rows. Split it into smaller files.`

/** Why a chosen file is refused before it is read, or null. `byteLength` is the file size. */
export function materialCatalogueCsvFileError(input: { fileName?: unknown; byteLength?: unknown }): string | null {
  const name = typeof input?.fileName === 'string' ? input.fileName.trim().toLowerCase() : ''
  if (!name.endsWith('.csv')) return MATERIAL_CATALOGUE_CSV_NOT_CSV_MESSAGE
  const size = documentNumber(input?.byteLength)
  if (size == null || size <= 0) return MATERIAL_CATALOGUE_CSV_EMPTY_MESSAGE
  if (size > MATERIAL_CATALOGUE_CSV_MAX_BYTES) return MATERIAL_CATALOGUE_CSV_TOO_BIG_MESSAGE
  return null
}

// NUL and C0 controls other than tab, LF and CR, plus DEL: never in a spreadsheet's CSV.
// eslint-disable-next-line no-control-regex
const BINARY_CHARACTERS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/

/**
 * Why decoded text is refused, or null: empty, binary (NUL or control characters, e.g. an .xlsx renamed .csv) or
 * not UTF-8 (the replacement character U+FFFD, which a decoder writes for bytes that are not UTF-8).
 */
export function materialCatalogueCsvTextError(textValue: unknown): string | null {
  const value = typeof textValue === 'string' ? textValue : ''
  if (!value.replace(/^﻿/, '').trim()) return MATERIAL_CATALOGUE_CSV_EMPTY_MESSAGE
  if (BINARY_CHARACTERS.test(value)) return MATERIAL_CATALOGUE_CSV_BINARY_MESSAGE
  if (value.includes('�')) return MATERIAL_CATALOGUE_CSV_ENCODING_MESSAGE
  return null
}

const FORMULA_PREFIX = /^[=+\-@\t\r]/

/** One exported cell: formula-leading text gets an apostrophe, and the cell is quoted when it needs to be. */
export function materialCatalogueCsvCell(value: unknown): string {
  const raw = value == null ? '' : typeof value === 'number' ? String(value) : String(value)
  const safe = FORMULA_PREFIX.test(raw) ? `'${raw}` : raw
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}

/** RFC 4180 records: quoted fields may hold commas, quotes ("") and line breaks. */
export function splitCsvRecords(textValue: string): string[][] {
  const records: string[][] = []
  let field = ''
  let record: string[] = []
  let quoted = false
  const value = textValue.replace(/^﻿/, '')
  for (let i = 0; i < value.length; i += 1) {
    const char = value[i]
    if (quoted) {
      if (char === '"') {
        if (value[i + 1] === '"') {
          field += '"'
          i += 1
        } else {
          quoted = false
        }
      } else {
        field += char
      }
      continue
    }
    if (char === '"') {
      quoted = true
    } else if (char === ',') {
      record.push(field)
      field = ''
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && value[i + 1] === '\n') i += 1
      record.push(field)
      records.push(record)
      record = []
      field = ''
    } else {
      field += char
    }
  }
  if (field !== '' || record.length > 0) {
    record.push(field)
    records.push(record)
  }
  return records
}

function header(value: string): string {
  return value.toLowerCase().replace(/\s+/g, ' ').trim()
}

const COLUMN_NAMES: Record<string, readonly string[]> = {
  id: ['catalogue id', 'catalog id', 'catalogueid', 'id'],
  name: ['name'],
  category: ['category'],
  brand: ['manufacturer/brand', 'manufacturer', 'brand'],
  productCode: ['product code', 'code'],
  orderUnit: ['order unit'],
  contentAmount: ['contents amount', 'content amount', "what's in one"],
  contentMeasure: ['contents measure', 'content measure'],
  legacyUnit: [
    'default type (length drum box pallet or number)',
    'default type (length drum box or number)',
    'default unit (length, box or number)',
    'default unit',
    'unit',
    'type',
  ],
  size: ['size', 'size/length', 'pack size', 'packsize'],
  length: ['length'],
  lengthUnit: ['length unit (m or mm)', 'length unit'],
}

function isNoteRecord(cells: string[]): boolean {
  const first = (cells[0] ?? '').trim()
  if (first.startsWith('#') || first.startsWith('//')) return true
  const joined = cells.join(' ').toLowerCase()
  return joined.includes('ignored on upload') || joined.includes('project planner category guide')
}

/** A cell as plain text: control characters removed, the export's formula apostrophe taken off, trimmed. */
function plainCell(value: string | undefined): string {
  const raw = (value ?? '').replace(/^[ ]+/, '')
  // The apostrophe comes off before control characters become spaces, so "'\t=cmd" round-trips to "\t=cmd" → "=cmd".
  const unprefixed = /^'[=+\-@\t\r]/.test(raw) ? raw.slice(1) : raw
  // eslint-disable-next-line no-control-regex
  return unprefixed.replace(/[\u0000-\u001F\u007F]/g, ' ').trim()
}

export type MaterialCatalogueCsvRow = {
  /** The Catalogue ID cell ('' for a new row). */
  id: string
  name: string
  /** Blank → "Other". */
  category: string
  /** As typed ('' when blank; the catalogue writer stores a blank brand as before). */
  brand: string
  productCode: string
  orderUnit: MaterialOrderUnit
  contentAmount: number | null
  contentMeasure: MaterialContentMeasure | null
  /** '' for the "1" / "1.0" placeholder. */
  size: string
  /** The CSV line number (1 = header). */
  rowNumber: number
}

export type MaterialCatalogueCsvParse = {
  rows: MaterialCatalogueCsvRow[]
  /** Messages for the person: the file as a whole, or "Row N: …" for a row that was left out. */
  errors: string[]
  /** Rows left out because the same name and product code was already in the file. */
  duplicateRows: number[]
}

function rowKey(name: string, code: string): string {
  const norm = (value: string) => value.trim().toLowerCase().replace(/\s+/g, ' ')
  return `${norm(name)}|${norm(code)}`
}

/**
 * Read catalogue CSV text into rows (no writes). The file is refused as a whole for `materialCatalogueCsvTextError`,
 * a missing Name or Category column or too many rows; otherwise each bad row is left out with a "Row N: …" message.
 * A row with a blank name is skipped silently (spreadsheets leave blank rows). In-file duplicates (same name and
 * product code, ignoring case) keep the first row.
 */
export function parseMaterialCatalogueCsv(textValue: unknown): MaterialCatalogueCsvParse {
  const value = typeof textValue === 'string' ? textValue : ''
  const refused = materialCatalogueCsvTextError(value)
  if (refused) return { rows: [], errors: [refused], duplicateRows: [] }
  const records = splitCsvRecords(value)
  let headerIndex = -1
  for (let i = 0; i < records.length; i += 1) {
    const cells = records[i].map(header)
    if (cells.every((cell) => !cell) || isNoteRecord(records[i])) continue
    if (cells.includes('name')) headerIndex = i
    break
  }
  if (headerIndex < 0) return { rows: [], errors: [MATERIAL_CATALOGUE_CSV_HEADER_MESSAGE], duplicateRows: [] }
  const headers = records[headerIndex].map(header)
  const column = (key: keyof typeof COLUMN_NAMES): number => {
    for (const name of COLUMN_NAMES[key]) {
      const index = headers.indexOf(name)
      if (index >= 0) return index
    }
    return -1
  }
  const index = Object.fromEntries(Object.keys(COLUMN_NAMES).map((key) => [key, column(key)])) as Record<string, number>
  if (index.name < 0 || index.category < 0) {
    return { rows: [], errors: [MATERIAL_CATALOGUE_CSV_HEADER_MESSAGE], duplicateRows: [] }
  }
  // Line numbers count physical lines up to the header; quoted line breaks inside it are rare enough to ignore.
  const body = records.slice(headerIndex + 1)
  const meaningful = body.filter((cells) => cells.some((cell) => cell.trim()) && !isNoteRecord(cells))
  if (meaningful.length > MATERIAL_CATALOGUE_CSV_MAX_ROWS) {
    return { rows: [], errors: [MATERIAL_CATALOGUE_CSV_TOO_MANY_ROWS_MESSAGE], duplicateRows: [] }
  }
  const rows: MaterialCatalogueCsvRow[] = []
  const errors: string[] = []
  const duplicateRows: number[] = []
  const seen = new Set<string>()
  body.forEach((cells, offset) => {
    const rowNumber = headerIndex + offset + 2
    if (!cells.some((cell) => cell.trim()) || isNoteRecord(cells)) return
    const cell = (key: string) => (index[key] >= 0 ? plainCell(cells[index[key]]) : '')
    const name = cell('name')
    if (!name) return
    const fields = {
      id: cell('id'),
      name,
      category: cell('category'),
      brand: cell('brand'),
      productCode: cell('productCode'),
      orderUnit: cell('orderUnit'),
      contentAmount: cell('contentAmount'),
      contentMeasure: cell('contentMeasure'),
      size: cell('size'),
    }
    const tooLong = (Object.keys(fields) as Array<keyof typeof fields>).find(
      (key) => fields[key].length > MATERIAL_CATALOGUE_CSV_FIELD_MAX[key]
    )
    if (tooLong) {
      errors.push(`Row ${rowNumber}: ${tooLong === 'productCode' ? 'Product Code' : tooLong} is longer than ${MATERIAL_CATALOGUE_CSV_FIELD_MAX[tooLong]} characters.`)
      return
    }
    let orderUnit: MaterialOrderUnit
    let contentAmount: number | null = null
    let contentMeasure: MaterialContentMeasure | null = null
    if (fields.orderUnit) {
      const unit = normalizeMaterialOrderUnit(fields.orderUnit)
      if (!unit) {
        errors.push(`Row ${rowNumber}: Order unit "${fields.orderUnit}" is not one of Each, Box, Pack, Drum, Reel, Coil, Pallet, Length, Metre.`)
        return
      }
      orderUnit = unit
      if (fields.contentAmount && unit !== 'Metre') {
        const amount = documentNumber(fields.contentAmount)
        const measure = normalizeMaterialContentMeasure(fields.contentMeasure || 'm')
        if (amount == null || amount <= 0 || !measure) {
          errors.push(`Row ${rowNumber}: Contents amount must be a number above 0 with a measure of m, mm or pcs.`)
          return
        }
        const contentError = materialContentError(amount, measure, unit)
        if (contentError) {
          errors.push(`Row ${rowNumber}: ${contentError}`)
          return
        }
        const model = materialQuantityModel({ orderUnit: unit, contentAmount: amount, contentMeasure: measure })
        contentAmount = model.contentAmount
        contentMeasure = model.contentMeasure
      }
    } else {
      const model = materialQuantityModel({
        defaultUnit: index.legacyUnit >= 0 ? plainCell(cells[index.legacyUnit]) : '',
        length: index.length >= 0 ? plainCell(cells[index.length]) : '',
        lengthUnit: index.lengthUnit >= 0 ? plainCell(cells[index.lengthUnit]) : '',
      })
      orderUnit = model.orderUnit
      contentAmount = model.contentAmount
      contentMeasure = model.contentMeasure
    }
    const key = rowKey(name, fields.productCode)
    if (seen.has(key)) {
      duplicateRows.push(rowNumber)
      return
    }
    seen.add(key)
    rows.push({
      id: fields.id,
      name,
      category: fields.category || 'Other',
      brand: fields.brand,
      productCode: fields.productCode,
      orderUnit,
      contentAmount,
      contentMeasure,
      size: /^1(?:\.0+)?$/.test(fields.size) ? '' : fields.size,
      rowNumber,
    })
  })
  return { rows, errors, duplicateRows }
}

export type MaterialCatalogueCsvItem = {
  id: string
  name: string
  category?: string | null
  brand?: string | null
  productCode?: string | null
  orderUnit?: unknown
  contentAmount?: unknown
  contentMeasure?: unknown
  defaultUnit?: unknown
  length?: unknown
  lengthUnit?: unknown
  size?: string | null
}

/** The catalogue as CSV text in the 1.48.0 layout (an item without `orderUnit` is read from its old fields). */
export function materialCatalogueCsvExport(items: ReadonlyArray<MaterialCatalogueCsvItem>): string {
  const lines: string[] = [MATERIAL_CATALOGUE_CSV_HEADER]
  for (const item of items || []) {
    const model = materialQuantityModel(item as Record<string, unknown>)
    const legacy = materialQuantityWriteFields(model, { unitField: 'defaultUnit' })
    const size = typeof item.size === 'string' ? item.size.trim() : ''

    lines.push(
      [
        item.id,
        item.name,
        (item.category || '').trim() || 'Other',
        item.brand || '',
        item.productCode || '',
        model.orderUnit,
        model.contentAmount != null ? formatMaterialAmount(model.contentAmount) : '',
        model.contentMeasure ?? '',
        /^1(?:\.0+)?$/.test(size) ? '' : size,
        legacy.defaultUnit,
        legacy.length ?? '',
        legacy.lengthUnit ?? '',
      ]
        .map(materialCatalogueCsvCell)
        .join(',')
    )
  }
  return `${lines.join('\n')}\n`
}
