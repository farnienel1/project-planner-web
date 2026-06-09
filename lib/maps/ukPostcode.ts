const UK_POSTCODE =
  /\b([A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})\b/i

export function extractUkPostcode(value: string): string | null {
  const match = value.match(UK_POSTCODE)
  if (!match?.[1]) return null
  return match[1].replace(/\s+/g, ' ').toUpperCase()
}

export function normalizeUkPostcode(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toUpperCase()
}
