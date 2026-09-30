import type { InterestRegistration } from '@/lib/interest/record'

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
      row.firstName,
      row.lastName,
      row.company,
      row.role,
      row.teamSize,
      row.email,
      row.phone,
      row.sectors.join(', '),
      row.currentTools,
      row.message,
      row.status,
      row.source,
      row.campaign,
      row.referrer,
      when ? new Date(when.getFullYear(), when.getMonth(), when.getDate()) : '',
      when ? when.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '',
      notes,
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
    lines.push([source, count])
  }
  lines.push([], ['Status', 'Count'])
  for (const [status, count] of [...byStatus.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    lines.push([status, count])
  }
  return lines
}
