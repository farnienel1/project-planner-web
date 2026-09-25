import type { VariationStatus } from '@/lib/variations/variationModel'

export function voNumeric(voNumber: string): number {
  const match = /(\d+)\s*$/.exec(voNumber.trim())
  return match ? Number(match[1]) : 0
}

export function formatVoNumber(sequence: number, prefix = 'VO-', padding = 3): string {
  const safe = Math.max(0, Math.floor(sequence))
  return `${prefix}${String(safe).padStart(Math.max(1, padding), '0')}`
}

/** Next label is one higher than any number already used, including closed and deleted. Gaps stay empty. */
export function nextFreeVoNumber(
  existing: Array<{ voNumber: string }>,
  prefix = 'VO-',
  padding = 3
): string {
  const max = existing.reduce((highest, row) => Math.max(highest, voNumeric(row.voNumber)), 0)
  return formatVoNumber(max + 1, prefix, padding)
}

export function voNumberTaken(existing: Array<{ id?: string; voNumber: string }>, voNumber: string, exceptId?: string): boolean {
  const needle = voNumber.trim().toLowerCase()
  return existing.some((row) => row.id !== exceptId && row.voNumber.trim().toLowerCase() === needle)
}

export function orderForTrackerEnable<T extends { voNumber: string; createdAt: Date }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const diff = voNumeric(a.voNumber) - voNumeric(b.voNumber)
    if (diff !== 0) return diff
    return a.createdAt.getTime() - b.createdAt.getTime()
  })
}

export type NumberPreview = {
  id: string
  from: string
  to: string
  changed: boolean
  status: VariationStatus
}

function isAnchored(status: VariationStatus): boolean {
  return status === 'submitted' || status === 'closed'
}

/**
 * Dragging does not write. This is the live preview.
 * lockSubmitted: submitted and closed keep their labels and act as anchors.
 * Open rows take the remaining numbers, lowest first, in visual order.
 * resequenceAll: top to bottom, 1…n.
 */
export function previewRenumber(
  visualOrder: Array<{ id: string; status: VariationStatus; voNumber: string }>,
  mode: 'lockSubmitted' | 'resequenceAll',
  prefix = 'VO-',
  padding = 3
): NumberPreview[] {
  if (mode === 'resequenceAll') {
    return visualOrder.map((row, index) => {
      const to = formatVoNumber(index + 1, prefix, padding)
      return { id: row.id, from: row.voNumber, to, changed: to !== row.voNumber, status: row.status }
    })
  }
  const anchored = new Set(
    visualOrder.filter((row) => isAnchored(row.status)).map((row) => row.voNumber)
  )
  const free = visualOrder
    .map((row) => row.voNumber)
    .filter((number) => !anchored.has(number))
    .sort((a, b) => voNumeric(a) - voNumeric(b))
  let cursor = 0
  return visualOrder.map((row) => {
    if (isAnchored(row.status)) {
      return { id: row.id, from: row.voNumber, to: row.voNumber, changed: false, status: row.status }
    }
    const to = free[cursor] || row.voNumber
    cursor += 1
    return { id: row.id, from: row.voNumber, to, changed: to !== row.voNumber, status: row.status }
  })
}
