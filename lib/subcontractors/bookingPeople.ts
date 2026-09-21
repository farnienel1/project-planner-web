/**
 * Resolve named operatives on a sub contractor booking for tiles, daily overview, and reports.
 */

export type SubcontractorFirmContacts = {
  id: string
  name: string
  contacts?: { id: string; name: string }[]
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
    const contact = firm.contacts.find((row) => row.id === id)
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
