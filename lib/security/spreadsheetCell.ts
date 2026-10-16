/** Prefix formula-leading cells so Excel/Sheets does not execute user text. */
const FORMULA_PREFIX = /^[=+\-@\t\r]/

export function neutralizeSpreadsheetFormula(value: string): string {
  if (!value || !FORMULA_PREFIX.test(value)) return value
  return `'${value}`
}

export function csvEscapeCell(value: string | number | Date | null | undefined): string {
  const text = value instanceof Date ? value.toISOString() : String(value ?? '')
  const safe = neutralizeSpreadsheetFormula(text)
  if (/[",\n\r]/.test(safe)) return `"${safe.replace(/"/g, '""')}"`
  return safe
}
