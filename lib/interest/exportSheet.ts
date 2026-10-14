import type { InterestRegistration } from '@/lib/interest/record'
import { neutralizeSpreadsheetFormula } from '@/lib/security/spreadsheetCell'

function sheetText(value: string): string {
  return neutralizeSpreadsheetFormula(value)
}

export const REGISTRATION_HEADERS = [
  'First name',
  'Last name',
  'Company',
  'Role',
  'Team size',
  'Email',
  'Phone',
  'Sectors',
  'Currently using',
  'Message',
  'Status',
  'Source',
  'Campaign',
  'Referrer',
  'Registered date',
  'Registered time',
  'Notes',
] as const

export function registrationSheetRows(rows: InterestRegistration[]): (string | Date)[][] {
  return rows.map((row) => {
    const when = row.createdAt
    const notes = row.notes.map((note) => `${note.authorName}: ${note.body}`).join('\n')
    return [
      sheetText(row.firstName),
      sheetText(row.lastName),
      sheetText(row.company),
      sheetText(row.role),
      sheetText(row.teamSize),
      sheetText(row.email),
      sheetText(row.phone),
      sheetText(row.sectors.join(', ')),
      sheetText(row.currentTools),
      sheetText(row.message),
      sheetText(row.status),
      sheetText(row.source),
      sheetText(row.campaign),
      sheetText(row.referrer),
      when ? new Date(when.getFullYear(), when.getMonth(), when.getDate()) : '',
      when ? when.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '',
      sheetText(notes),
    ]
  })
}

export function summarySheetRows(rows: InterestRegistration[]): (string | number)[][] {
  const bySource = new Map<string, number>()
  const byStatus = new Map<string, number>()
  for (const row of rows) {
    const source = row.source || 'direct'
    bySource.set(source, (bySource.get(source) || 0) + 1)
    byStatus.set(row.status, (byStatus.get(row.status) || 0) + 1)
  }
  const lines: (string | number)[][] = [
    ['Total', rows.length],
    [],
    ['Source', 'Count'],
  ]
  for (const [source, count] of [...bySource.entries()].sort((a, b) => b[1] - a[1])) {
    lines.push([sheetText(source), count])
  }
  lines.push([], ['Status', 'Count'])
  for (const [status, count] of [...byStatus.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    lines.push([sheetText(status), count])
  }
  return lines
}
