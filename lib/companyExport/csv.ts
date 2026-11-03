/**
 * Company data export (launch checklist 2.1): CSV files that open cleanly in Excel.
 *
 * - UTF-8 with a byte-order mark (`CSV_BOM`), so Excel reads accents and £ correctly.
 * - Nested maps become dotted columns (`address.city`); arrays are joined with "; " (a map inside an array is its
 *   JSON text).
 * - A cell with a comma, quote, CR or LF is quoted, and quotes are doubled (RFC 4180). Rows end with CRLF.
 * - A cell that starts with = or @ (or a tab / CR), or with + / - followed by letters, brackets, = ! or |, is
 *   prefixed with a single quote so a spreadsheet never runs it as a formula (CSV injection). Phone numbers
 *   ("+44 7700 900123") and negative numbers are left alone.
 * - Numbers stay plain numbers (money too); the currency is its own column, added by the caller.
 * - A file with more than `MAX_CSV_COLUMNS` columns (maps keyed by ids, e.g. review maps keyed by entry id) keeps
 *   its widest top-level maps as one JSON column each until it fits. `export.json` always has the full shape.
 */
import type { ExportValue } from './values'

export const CSV_BOM = '﻿'
export const CSV_ARRAY_SEPARATOR = '; '
export const MAX_CSV_COLUMNS = 400

type Row = Record<string, ExportValue>

function isMap(value: ExportValue): value is { [key: string]: ExportValue } {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

/** One value as cell text (before CSV quoting). */
export function cellText(value: ExportValue | undefined): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (Array.isArray(value)) {
    return value
      .map((entry) => (entry !== null && typeof entry === 'object' ? JSON.stringify(entry) : cellText(entry)))
      .join(CSV_ARRAY_SEPARATOR)
  }
  return JSON.stringify(value)
}

/**
 * Flattens a document to dotted columns. A map listed in `asJson` (by its top-level key) is kept as one JSON
 * column; an empty map is one empty column so the key still shows.
 */
export function flattenRow(row: Row, asJson: ReadonlySet<string> = new Set()): Record<string, ExportValue> {
  const out: Record<string, ExportValue> = {}
  const walk = (value: ExportValue, prefix: string, depth: number) => {
    if (isMap(value) && !(depth === 0 && asJson.has(prefix))) {
      const keys = Object.keys(value)
      if (keys.length === 0) {
        out[prefix] = ''
        return
      }
      for (const key of keys) walk(value[key], prefix ? `${prefix}.${key}` : key, depth + 1)
      return
    }
    out[prefix] = value
  }
  for (const key of Object.keys(row)) walk(row[key], key, 0)
  return out
}

/** RFC 4180 quoting plus the formula guard. */
export function escapeCsvCell(text: string): string {
  let safe = text
  if (/^[=@\t\r]/.test(safe) || (/^[+-]/.test(safe) && /[A-Za-z(=!|]/.test(safe))) safe = `'${safe}`
  if (/[",\r\n]/.test(safe)) return `"${safe.replace(/"/g, '""')}"`
  return safe
}

/**
 * The CSV text (with BOM) for `rows`. `leading` columns come first in that order when any row has them; every other
 * column follows sorted.
 */
export function toCsv(
  rows: readonly Row[],
  options: { leading?: readonly string[]; maxColumns?: number } = {}
): string {
  const leading = options.leading ?? []
  const maxColumns = options.maxColumns ?? MAX_CSV_COLUMNS
  const asJson = new Set<string>()
  let flat = rows.map((row) => flattenRow(row, asJson))
  let columns = columnsOf(flat)
  while (columns.length > maxColumns) {
    // The top-level map that adds the most columns becomes one JSON column.
    const counts = new Map<string, number>()
    for (const column of columns) {
      const top = column.split('.')[0]
      if (column.includes('.') && !asJson.has(top)) counts.set(top, (counts.get(top) ?? 0) + 1)
    }
    const widest = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]
    if (!widest) break
    asJson.add(widest[0])
    flat = rows.map((row) => flattenRow(row, asJson))
    columns = columnsOf(flat)
  }
  const present = new Set(columns)
  const head = leading.filter((column) => present.has(column))
  const rest = columns.filter((column) => !head.includes(column)).sort()
  const ordered = [...head, ...rest]
  const lines = [ordered.map(escapeCsvCell).join(',')]
  for (const row of flat) lines.push(ordered.map((column) => escapeCsvCell(cellText(row[column]))).join(','))
  return `${CSV_BOM}${lines.join('\r\n')}\r\n`
}

function columnsOf(flat: readonly Record<string, ExportValue>[]): string[] {
  const seen = new Set<string>()
  for (const row of flat) for (const key of Object.keys(row)) seen.add(key)
  return [...seen]
}
