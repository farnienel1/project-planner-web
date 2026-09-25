import type { Variation } from '@/lib/variations/variationModel'

function cell(value: string | number): string {
  const text = String(value ?? '')
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`
  return text
}

export function variationsToCsv(rows: Variation[]): string {
  const header = [
    'parentName',
    'voNumber',
    'heading',
    'status',
    'lineType',
    'description',
    'hours',
    'quantity',
    'raisedBy',
    'raisedOn',
    'evidenceCount',
  ]
  const lines = [header.join(',')]
  for (const row of rows) {
    if (row.isDeleted) continue
    const raisedOn = row.createdAt.toISOString()
    const base = [
      row.parentName,
      row.voNumber,
      row.heading,
      row.status,
    ]
    const tail = [row.createdByName, raisedOn, String(row.evidenceCount)]
    for (const labour of row.labour) {
      lines.push(
        [...base, 'labour', labour.trade, String(labour.hours), '', ...tail].map(cell).join(',')
      )
    }
    for (const material of row.materials) {
      lines.push(
        [...base, 'material', material.name, '', material.quantity, ...tail].map(cell).join(',')
      )
    }
  }
  return lines.join('\n')
}
