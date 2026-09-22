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

/** Canonical Category-column names shown as a CSV note. Upload parser ignores these lines. */
export const CATALOGUE_CATEGORY_GUIDE = [
  'Electrical',
  'Lighting',
  'Cable',
  'Containment',
  'Tray',
  'Trunking',
  'Conduit',
  'Switchgear & Distribution',
  'Fire Alarm',
  'Security & Access Control',
  'Data & Communications',
  'AV & TV',
  'BMS & Controls',
  'Mechanical',
  'Pipework',
  'Valves & Fittings',
  'Heating',
  'Cooling',
  'Ventilation',
  'Air Conditioning / VRF',
  'Plumbing',
  'Sanitaryware',
  'Drainage',
  'Water Systems',
  'Gas',
  'Fire Protection',
  'Sprinklers',
  'Insulation',
  'Ductwork',
  'Building Management Systems',
  'Timber',
  'Doors & Ironmongery',
  'Windows & Glazing',
  'Roofing',
  'Cladding',
  'Brickwork & Blockwork',
  'Concrete & Cement',
  'Steelwork & Metalwork',
  'Drylining & Plasterboard',
  'Plaster & Render',
  'Flooring',
  'Ceilings',
  'Wall Finishes',
  'Decorating & Paint',
  'Tiling',
  'Kitchens',
  'Joinery',
  'Ironmongery',
  'Sealants & Adhesives',
  'Fixings & Fasteners',
  'Tools & Equipment',
  'Plant',
  'PPE & Safety',
  'Site Consumables',
  'Sundries',
  'Temporary Works',
  'Groundworks',
  'Drainage & Civils',
  'Landscaping',
  'External Works',
  'Access & Lifting',
  'Signage',
  'Fire Stopping',
  'Acoustic Materials',
  'Waterproofing',
  'Thermal Insulation',
  'Mechanical Insulation',
  'Electrical Accessories',
  'Heating Controls',
  'Plumbing Accessories',
  'Specialist Equipment',
  'White Goods & Appliances',
  'Furniture & Fittings',
  'Cleaning & Waste',
  'Solar PV',
  'EV Charging',
  'Renewable Energy',
  'Other',
] as const

const CATEGORY_GUIDE_CHUNK = 10

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

export function catalogueCategoryGuideLines(extraCategories: string[] = []): string[] {
  const lines = [
    '# Project Planner category guide (this row is ignored on upload). Use one of these names in the Category column, or type your own.',
  ]
  for (let index = 0; index < CATALOGUE_CATEGORY_GUIDE.length; index += CATEGORY_GUIDE_CHUNK) {
    const chunk = CATALOGUE_CATEGORY_GUIDE.slice(index, index + CATEGORY_GUIDE_CHUNK)
    const prefix = index === 0 ? '# Categories:' : '# Categories (cont.):'
    lines.push(`${prefix} ${chunk.join(' | ')}`)
  }
  const known = new Set(CATALOGUE_CATEGORY_GUIDE.map((name) => name.toLowerCase()))
  const extras = [...new Set(extraCategories.map((name) => name.trim()).filter(Boolean))]
    .filter((name) => !known.has(name.toLowerCase()))
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
  if (extras.length > 0) {
    lines.push(`# Also in your catalogue (ignored on upload): ${extras.join(' | ')}`)
  }
  return lines
}

export function catalogueCategoriesNote(categories: string[] = []): string {
  return catalogueCategoryGuideLines(categories).join('\n')
}

function isCsvNoteLine(line: string): boolean {
  const trimmed = line.trim().replace(/^"|"$/g, '')
  if (!trimmed) return true
  if (trimmed.startsWith('#') || trimmed.startsWith('//')) return true
  const first = (splitCsvLine(trimmed)[0] || '').replace(/^"|"$/g, '')
  if (first.startsWith('#') || first.startsWith('//')) return true
  const haystack = `${first} ${trimmed}`.toLowerCase()
  return haystack.includes('ignored on upload') || haystack.includes('project planner category guide')
}

export function exportCatalogueCsv(items: MaterialCatalogItem[]): string {
  const extras = items.map((item) => item.category || 'Other')
  const lines = [CATALOGUE_CSV_HEADER, ...catalogueCategoryGuideLines(extras)]
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

export function exportCatalogueTemplateCsv(extraCategories: string[] = []): string {
  return `${CATALOGUE_CSV_HEADER}\n${catalogueCategoryGuideLines(extraCategories).join('\n')}\n`
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
