/**
 * Resolve named operatives on a sub contractor booking for tiles, daily overview, and reports.
 */

export type SubcontractorFirmContacts = {
  id: string
  name: string
  contacts?: { id: string; name: string }[]
}

export function normalizeRecordId(id: string | undefined | null): string {
  const raw = String(id || '').trim().toUpperCase()
  if (!raw) return ''
  const compact = raw.replace(/-/g, '')
  if (/^[0-9A-F]{32}$/.test(compact)) return compact
  return raw
}

export function idsMatch(a?: string | null, b?: string | null): boolean {
  const left = normalizeRecordId(a)
  const right = normalizeRecordId(b)
  return Boolean(left) && left === right
}

export function findSubcontractorFirm<T extends { id: string }>(
  firms: T[] | undefined,
  id?: string | null
): T | undefined {
  if (!firms?.length) return undefined
  return firms.find((row) => idsMatch(row.id, id))
}

export function parseBookedPeopleFields(data: Record<string, unknown> | undefined | null): {
  bookedContactIds: string[]
  bookedOperativeNames: string[]
} {
  if (!data) return { bookedContactIds: [], bookedOperativeNames: [] }
  return {
    bookedContactIds: parseIdList(
      data.bookedContactIds ?? data.contactIds ?? data.bookedContacts ?? data.operativeIds
    ),
    bookedOperativeNames: parseNameList(
      data.bookedOperativeNames ?? data.operativeNames ?? data.bookedNames ?? data.contactNames
    ),
  }
}

export function resolveSubcontractorBookingPeople(
  booking: { bookedContactIds?: string[]; bookedOperativeNames?: string[] },
  firm?: SubcontractorFirmContacts | null
): string[] {
  const fromNames = (booking.bookedOperativeNames || [])
    .map((name) => name.trim())
    .filter(Boolean)
  if (fromNames.length > 0) return uniqueNames(fromNames)

  const ids = booking.bookedContactIds || []
  if (!ids.length || !firm?.contacts?.length) return []
  const names: string[] = []
  for (const id of ids) {
    const contact = firm.contacts.find((row) => idsMatch(row.id, id))
    const name = contact?.name?.trim()
    if (name) names.push(name)
  }
  return uniqueNames(names)
}

export function formatSubcontractorBookingLabel(firmName: string, people: string[]): string {
  const firm = firmName.trim() || 'Sub contractor'
  if (people.length === 0) return firm
  return `${firm} · ${people.join(', ')}`
}

function parseIdList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const out: string[] = []
  for (const item of value) {
    if (typeof item === 'string' && item.trim()) {
      out.push(item.trim())
      continue
    }
    if (item && typeof item === 'object') {
      const record = item as Record<string, unknown>
      const id =
        (typeof record.id === 'string' && record.id.trim()) ||
        (typeof record.contactId === 'string' && record.contactId.trim()) ||
        ''
      if (id) out.push(id)
    }
  }
  return out
}

function parseNameList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const out: string[] = []
  for (const item of value) {
    if (typeof item === 'string' && item.trim()) {
      out.push(item.trim())
      continue
    }
    if (item && typeof item === 'object') {
      const record = item as Record<string, unknown>
      const name = typeof record.name === 'string' ? record.name.trim() : ''
      if (name) out.push(name)
    }
  }
  return uniqueNames(out)
}

function uniqueNames(names: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const name of names) {
    const key = name.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(name)
  }
  return out
}
