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

export function exportCatalogueCsv(items: MaterialCatalogItem[]): string {
  const lines = [CATALOGUE_CSV_HEADER]
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

export function exportCatalogueTemplateCsv(): string {
  return `${CATALOGUE_CSV_HEADER}\n`
}

export function parseCatalogueCsv(text: string): CatalogueCsvParseResult {
  const errors: string[] = []
  const rows: ParsedCatalogueRow[] = []
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter((line) => line.trim())
  if (lines.length === 0) {
    return { rows, errors: ['Import error: the CSV is empty.'] }
  }
  const header = lines[0].replace(/^"|"$/g, '')
  if (!header.startsWith('Catalogue ID') || !header.includes('Name')) {
    errors.push('Import error: CSV header does not match the Material Catalogue template.')
  }
  const body = lines.slice(1)
  if (body.length > CATALOGUE_CSV_MAX_ROWS) {
    return { rows: [], errors: [`Import error: maximum ${CATALOGUE_CSV_MAX_ROWS} rows.`] }
  }

  const seen = new Set<string>()
  for (let index = 0; index < body.length; index += 1) {
    const cells = splitCsvLine(body[index])
    const name = (cells[1] || '').trim()
    const category = (cells[2] || '').trim() || 'Other'
    if (!name || !category) {
      errors.push(`Row ${index + 2}: Name and Category are required.`)
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
