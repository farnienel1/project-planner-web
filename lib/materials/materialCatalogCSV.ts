/**
 * Material catalogue CSV on web. The columns, parsing, limits and formula neutralising are the rulebook's
 * (`lib/canonical/materialCatalogueCsv.ts`, rulebook 1.48.0 §28), shared with iOS; this file only reads the chosen
 * file in the browser and downloads text. The file is never uploaded anywhere: it is read with `File.arrayBuffer()`
 * and parsed here.
 */
import {
  MATERIAL_CATALOGUE_CSV_BINARY_MESSAGE,
  MATERIAL_CATALOGUE_CSV_ENCODING_MESSAGE,
  MATERIAL_CATALOGUE_CSV_HEADER,
  MATERIAL_CATALOGUE_CSV_MAX_BYTES,
  MATERIAL_CATALOGUE_CSV_MAX_ROWS,
  materialCatalogueCsvExport,
  materialCatalogueCsvFileError,
  materialCatalogueCsvTextError,
  parseMaterialCatalogueCsv,
  type MaterialCatalogueCsvParse,
} from '@/lib/canonical'
import type { MaterialCatalogItem } from '@/types'

export const CATALOGUE_CSV_HEADER = MATERIAL_CATALOGUE_CSV_HEADER
export const CATALOGUE_CSV_FILENAME = 'material_catalogue.csv'
export const CATALOGUE_TEMPLATE_FILENAME = 'material_catalogue_upload_template.csv'
export const CATALOGUE_CSV_MAX_BYTES = MATERIAL_CATALOGUE_CSV_MAX_BYTES
export const CATALOGUE_CSV_MAX_ROWS = MATERIAL_CATALOGUE_CSV_MAX_ROWS

export function exportCatalogueCsv(items: MaterialCatalogItem[]): string {
  return materialCatalogueCsvExport([...items].sort((a, b) => a.name.localeCompare(b.name)))
}

export function exportCatalogueTemplateCsv(): string {
  return `${MATERIAL_CATALOGUE_CSV_HEADER}\n`
}

export function parseCatalogueCsv(text: string): MaterialCatalogueCsvParse {
  return parseMaterialCatalogueCsv(text)
}

/**
 * Bytes of a chosen file as CSV text, or the reason it is refused: a NUL byte (binary, e.g. an .xlsx renamed .csv)
 * or bytes that are not UTF-8 (`TextDecoder` with `fatal`), then the rulebook text check.
 */
export function catalogueCsvTextFromBytes(bytes: Uint8Array): { text: string } | { error: string } {
  if (bytes.includes(0)) return { error: MATERIAL_CATALOGUE_CSV_BINARY_MESSAGE }
  let text: string
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    return { error: MATERIAL_CATALOGUE_CSV_ENCODING_MESSAGE }
  }
  const refused = materialCatalogueCsvTextError(text)
  return refused ? { error: refused } : { text }
}

/** Read a chosen file in the browser (never uploaded): the name and size check first, then the bytes. */
export async function readCatalogueCsvFile(file: File): Promise<{ text: string } | { error: string }> {
  const refused = materialCatalogueCsvFileError({ fileName: file.name, byteLength: file.size })
  if (refused) return { error: refused }
  const bytes = new Uint8Array(await file.arrayBuffer())
  return catalogueCsvTextFromBytes(bytes)
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
