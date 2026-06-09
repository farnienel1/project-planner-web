import { extractUkPostcode } from '@/lib/maps/ukPostcode'

export function buildGeocodeCandidates(input: {
  addressLine1?: string
  addressLine2?: string
  townCity?: string
  postcode?: string
  siteName?: string
  siteAddress?: string
}): string[] {
  const line1 = (input.addressLine1 || '').trim()
  const line2 = (input.addressLine2 || '').trim()
  const town = (input.townCity || '').trim()
  const postcodeField = (input.postcode || '').trim()
  const siteName = (input.siteName || '').trim()
  const storedSiteAddress = (input.siteAddress || '').trim()

  const structured = [line1, line2, town, postcodeField].filter(Boolean).join(', ')
  const postcode =
    extractUkPostcode(postcodeField) ||
    extractUkPostcode(storedSiteAddress) ||
    extractUkPostcode(structured) ||
    extractUkPostcode(line1)

  const seen = new Set<string>()
  const output: string[] = []

  const add = (candidate: string) => {
    const trimmed = candidate.trim()
    if (trimmed.length < 4) return
    const key = trimmed.toLowerCase()
    if (seen.has(key)) return
    seen.add(key)
    output.push(trimmed)
  }

  if (storedSiteAddress) {
    add(storedSiteAddress)
    if (siteName) add(`${siteName}, ${storedSiteAddress}`)
  }

  if (structured) {
    add(structured)
    if (siteName) add(`${siteName}, ${structured}`)
  }

  if (postcode) {
    add(postcode)
    add(`${postcode}, United Kingdom`)
    if (town) add(`${postcode}, ${town}, United Kingdom`)
    if (line1) add(`${line1}, ${postcode}, United Kingdom`)
    if (siteName) add(`${siteName}, ${postcode}, United Kingdom`)
  }

  if (siteName && town) add(`${siteName}, ${town}, United Kingdom`)
  if (line1 && town) add(`${line1}, ${town}, United Kingdom`)

  return output
}
