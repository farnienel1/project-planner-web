/**
 * iOS parity source: Core/MaterialCatalogCSV.swift
 * Spec: docs/ios-parity/sections/07-material-catalogue.md
 */
import type { MaterialCatalogItem, MaterialLengthUnit, MaterialUnit } from '@/types'
import { duplicateKey } from '@/lib/materials/materialCatalogSearch'

export const CATALOGUE_CSV_HEADER =
  'Catalogue ID,Name,Category,Manufacturer/Brand,Product Code,Default Type (Length Drum Box Pallet or Number),Size,Length,Length Unit (M or MM)'

export const CATALOGUE_CSV_FILENAME = 'material_catalogue.csv'
export const CATALOGUE_TEMPLATE_FILENAME = 'material_catalogue_upload_template.csv'
export const CATALOGUE_CSV_MAX_BYTES = 5 * 1024 * 1024
export const CATALOGUE_CSV_MAX_ROWS = 5000

const UNITS: MaterialUnit[] = ['Number', 'Box', 'Length', 'Drum', 'Pallet']
const LENGTH_UNITS: MaterialLengthUnit[] = ['M', 'MM']

export type ParsedCatalogueRow = {
  id: string
  name: string
  category: string
  brand: string
  productCode?: string
  defaultUnit: MaterialUnit
  size?: string
  length?: string
  lengthUnit?: MaterialLengthUnit
}

export type CatalogueCsvParseResult = {
  rows: ParsedCatalogueRow[]
  errors: string[]
}

function splitCsvLine(line: string): string[] {
  const cells: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i]
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i += 1
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      cells.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }
  cells.push(current.trim())
  return cells
}

function csvCell(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`
  return value
}

function parseUnit(value: string): MaterialUnit {
  const match = UNITS.find((unit) => unit.toLowerCase() === value.trim().toLowerCase())
  return match || 'Number'
}

function parseLengthUnit(value: string): MaterialLengthUnit | undefined {
  const match = LENGTH_UNITS.find((unit) => unit.toLowerCase() === value.trim().toLowerCase())
  return match
}

export function catalogueCategoriesNote(categories: string[]): string {
  const names = [...new Set(categories.map((name) => name.trim()).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: 'base' })
  )
  if (names.length === 0) {
    return '# Categories: type your own in the Category column (for example Electrical). This note is ignored on upload.'
  }
  return `# Categories currently in this catalogue (ignored on upload): ${names.join(', ')}`
}

function isCsvNoteLine(line: string): boolean {
  const trimmed = line.trim()
  if (!trimmed) return true
  if (trimmed.startsWith('#') || trimmed.startsWith('//')) return true
  const first = splitCsvLine(trimmed)[0] || ''
  return first.startsWith('#') || first.startsWith('//')
}

export function exportCatalogueCsv(items: MaterialCatalogItem[]): string {
  const categories = items.map((item) => item.category || 'Other')
  const lines = [CATALOGUE_CSV_HEADER, catalogueCategoriesNote(categories)]
  for (const item of items) {
    lines.push(
      [
        item.id,
        item.name,
        item.category || 'Other',
        item.brand,
        item.productCode || '',
        item.defaultUnit,
        item.size || '',
        item.length || '',
        item.lengthUnit || '',
      ]
        .map((cell) => csvCell(String(cell)))
        .join(',')
    )
  }
  return `${lines.join('\n')}\n`
}

export function exportCatalogueTemplateCsv(categories: string[] = []): string {
  return `${CATALOGUE_CSV_HEADER}\n${catalogueCategoriesNote(categories)}\n`
}

export function parseCatalogueCsv(text: string): CatalogueCsvParseResult {
  const errors: string[] = []
  const rows: ParsedCatalogueRow[] = []
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/)
  const meaningful = lines.map((line, index) => ({ line, index })).filter((entry) => entry.line.trim())
  if (meaningful.length === 0) {
    return { rows, errors: ['Import error: the CSV is empty.'] }
  }

  const headerEntry = meaningful.find((entry) => {
    const candidate = entry.line.replace(/^"|"$/g, '').trim()
    return candidate.startsWith('Catalogue ID') && candidate.includes('Name')
  })
  if (!headerEntry) {
    const first = meaningful[0].line.replace(/^"|"$/g, '')
    if (!first.startsWith('Catalogue ID') || !first.includes('Name')) {
      errors.push('Import error: CSV header does not match the Material Catalogue template.')
    }
  }
  const bodyStart = headerEntry ? headerEntry.index + 1 : 1
  const body = lines
    .slice(bodyStart)
    .map((line, offset) => ({ line, rowNumber: bodyStart + offset + 1 }))
    .filter((entry) => entry.line.trim() && !isCsvNoteLine(entry.line))

  if (body.length > CATALOGUE_CSV_MAX_ROWS) {
    return { rows: [], errors: [`Import error: maximum ${CATALOGUE_CSV_MAX_ROWS} rows.`] }
  }

  const seen = new Set<string>()
  for (const entry of body) {
    const cells = splitCsvLine(entry.line)
    const name = (cells[1] || '').trim()
    const category = (cells[2] || '').trim() || 'Other'
    if (!name) continue
    if (!category) {
      errors.push(`Row ${entry.rowNumber}: Name and Category are required.`)
      continue
    }
    const brand = (cells[3] || '').trim() || 'Unknown'
    const productCode = (cells[4] || '').trim() || undefined
    const key = duplicateKey(name, productCode)
    if (seen.has(key)) continue
    seen.add(key)
    rows.push({
      id: (cells[0] || '').trim(),
      name,
      category,
      brand,
      productCode,
      defaultUnit: parseUnit(cells[5] || ''),
      size: (cells[6] || '').trim() || undefined,
      length: (cells[7] || '').trim() || undefined,
      lengthUnit: parseLengthUnit(cells[8] || ''),
    })
  }
  return { rows, errors }
}

export function downloadTextFile(filename: string, contents: string) {
  const blob = new Blob([contents], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
