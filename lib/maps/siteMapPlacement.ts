/**
 * Where a job sits on the site map (display only, owner 24 Nov). Nothing here is written to Firestore: a job's
 * stored pin always wins; otherwise an address that is itself "lat, lng" text is used as the pin; otherwise the job's
 * UK postcode is looked up on postcodes.io (free, no key; only the postcode is sent, never a name or the rest of the
 * address) and remembered in this browser. A job with no postcode, or a postcode postcodes.io does not know, is not
 * placed: it is listed under "Jobs without an address" on the full map, where an admin sets its pin by hand.
 *
 * Which jobs are shown is the rulebook's job status (`jobWorkStatus` / `worksTab`, §21) on the day the map shows, in
 * the organisation zone: Active and Upcoming always, Completed only when the toggle is on or when someone is booked
 * on it that day (`siteMapPins`), inactive (`isLive` false) never (`siteMapPins` §21 counts no inactive job).
 */

import { jobWorkStatus, worksTab, type WorksListJob } from '@/lib/canonical'
import { formatSiteAddress, isMappableSiteAddress, resolveStoredCoordinates } from '@/lib/maps/siteAddress'
import { extractUkPostcode, formatUkPostcode } from '@/lib/maps/ukPostcode'

export type LatLng = { latitude: number; longitude: number }

export type SiteMapPlacementSite = {
  latitude?: number | null
  longitude?: number | null
  addressLine1?: string | null
  addressLine2?: string | null
  townCity?: string | null
  postcode?: string | null
  siteAddress?: string | null
  usesMapPinForLocation?: boolean | null
}

/** How a job got (or did not get) its place on the map. */
export type SiteMapPlacement =
  | { kind: 'stored'; coordinates: LatLng }
  | { kind: 'addressCoordinates'; coordinates: LatLng }
  | { kind: 'postcode'; coordinates: LatLng; postcode: string }
  | { kind: 'pending'; postcode: string }
  | { kind: 'postcodeNotFound'; postcode: string }
  /** The lookup could not be reached (network): not placed for now, never remembered as unknown. */
  | { kind: 'lookupFailed'; postcode: string }
  | { kind: 'noPostcode' }
  | { kind: 'noAddress' }

/** Placements that are not on the map and are listed for a manual pin. */
export function siteMapPlacementUnplaced(placement: SiteMapPlacement): boolean {
  return (
    placement.kind === 'postcodeNotFound' ||
    placement.kind === 'lookupFailed' ||
    placement.kind === 'noPostcode' ||
    placement.kind === 'noAddress'
  )
}

const COORDINATE_TEXT = /^\s*\(?\s*(-?\d{1,2}(?:\.\d+)?)\s*[,\s]\s*(-?\d{1,3}(?:\.\d+)?)\s*\)?\s*$/

/** An address typed or saved as "51.51278, -0.13805": those coordinates (latitude first), else null. */
export function coordinatesFromAddressText(text: string | null | undefined): LatLng | null {
  const match = COORDINATE_TEXT.exec(String(text ?? ''))
  if (!match) return null
  const latitude = Number(match[1])
  const longitude = Number(match[2])
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null
  if (latitude === 0 && longitude === 0) return null
  // Without a decimal point it is not a coordinate pair (e.g. "12 14").
  if (!match[1].includes('.') || !match[2].includes('.')) return null
  return { latitude, longitude }
}

/** The job's UK postcode in its stored form ("SW1X 9HR"), from the postcode field first, any case or spacing. */
export function siteMapPostcode(site: SiteMapPlacementSite): string | null {
  const sources = [site.postcode, site.siteAddress, formatSiteAddress(siteAddressInput(site))]
  // The postcode field alone may be typed with odd spacing ("SW1 X9HR"): read it with its spaces taken out.
  const field = String(site.postcode ?? '').replace(/\s+/g, '')
  const fromField = field ? extractUkPostcode(field) : null
  if (fromField) return formatUkPostcode(fromField)
  for (const source of sources) {
    const raw = String(source ?? '').trim()
    if (!raw) continue
    const found = extractUkPostcode(raw)
    if (found) return formatUkPostcode(found)
  }
  return null
}

export { formatUkPostcode }

function siteAddressInput(site: SiteMapPlacementSite) {
  return {
    addressLine1: site.addressLine1 ?? undefined,
    addressLine2: site.addressLine2 ?? undefined,
    townCity: site.townCity ?? undefined,
    postcode: site.postcode ?? undefined,
    siteAddress: site.siteAddress ?? undefined,
  }
}

/**
 * Where one job goes. `postcodes` holds the lookups done so far: a point, null for a postcode postcodes.io does not
 * know, missing for one not looked up yet (`pending`).
 */
export function siteMapPlacement(
  site: SiteMapPlacementSite,
  postcodes: ReadonlyMap<string, LatLng | null>,
  failedPostcodes: ReadonlySet<string> = new Set()
): SiteMapPlacement {
  const stored = resolveStoredCoordinates({
    latitude: site.latitude ?? undefined,
    longitude: site.longitude ?? undefined,
  })
  if (stored) return { kind: 'stored', coordinates: stored }
  const input = siteAddressInput(site)
  for (const text of [site.siteAddress, site.addressLine1, formatSiteAddress(input)]) {
    const fromText = coordinatesFromAddressText(text)
    if (fromText) return { kind: 'addressCoordinates', coordinates: fromText }
  }
  const postcode = siteMapPostcode(site)
  if (postcode) {
    if (!postcodes.has(postcode)) {
      return failedPostcodes.has(postcode) ? { kind: 'lookupFailed', postcode } : { kind: 'pending', postcode }
    }
    const point = postcodes.get(postcode)
    return point ? { kind: 'postcode', coordinates: point, postcode } : { kind: 'postcodeNotFound', postcode }
  }
  return isMappableSiteAddress(formatSiteAddress(input)) ? { kind: 'noPostcode' } : { kind: 'noAddress' }
}

export const SITE_MAP_LOOKUP_FAILED_TEXT = 'Couldn’t reach the postcode lookup — retry'

/** The reason shown beside a job that could not be placed. */
export function siteMapUnplacedReason(placement: SiteMapPlacement): string {
  if (placement.kind === 'noAddress') return 'No address'
  if (placement.kind === 'noPostcode') return 'No postcode in the address'
  if (placement.kind === 'postcodeNotFound') return `Postcode ${placement.postcode} not found`
  if (placement.kind === 'lookupFailed') return SITE_MAP_LOOKUP_FAILED_TEXT
  return ''
}

/**
 * Whether a job is on the map on `dayKey`: Active and Upcoming always, Completed only with `includeCompleted` or when
 * someone is booked on it that day (`bookedThatDay`, from `siteMapPins`: a job past its end date still being worked
 * on is never hidden), inactive never. Status is the rulebook's (`jobWorkStatus`, `worksTab`) in the organisation zone.
 */
export function siteMapJobShown(
  job: WorksListJob,
  options: { includeCompleted: boolean; dayKey: string; timeZone: string; bookedThatDay?: boolean }
): boolean {
  if (job.isLive === false) return false
  if (options.bookedThatDay) return true
  const tab = worksTab(jobWorkStatus(job, options.dayKey, options.timeZone))
  return tab === 'completed' ? options.includeCompleted : true
}

function plural(count: number, one: string, many: string): string {
  return count === 1 ? one : many.replace('{n}', String(count))
}

/**
 * The Home card line for jobs that are not on the map, or null when every job is placed. Jobs whose postcode lookup
 * could not be reached are counted apart (they are placed once the lookup answers).
 */
export function siteMapUnplacedText(count: number, lookupFailedCount = 0): string | null {
  const unplaced = Number.isFinite(count) && count > 0 ? Math.floor(count) : 0
  const failed = Number.isFinite(lookupFailedCount) && lookupFailedCount > 0 ? Math.floor(lookupFailedCount) : 0
  const parts: string[] = []
  if (unplaced > 0) parts.push(plural(unplaced, '1 job could not be placed on the map.', '{n} jobs could not be placed on the map.'))
  if (failed > 0) {
    parts.push(
      plural(failed, '1 job is waiting for the postcode lookup — retry.', '{n} jobs are waiting for the postcode lookup — retry.')
    )
  }
  return parts.length > 0 ? parts.join(' ') : null
}

// MARK: - postcodes.io lookups (browser)

export const POSTCODES_IO_BULK_URL = 'https://api.postcodes.io/postcodes'
/** postcodes.io takes at most 100 postcodes per bulk request. */
export const POSTCODES_IO_BULK_LIMIT = 100
const POSTCODE_CACHE_KEY = 'pp.siteMap.postcodes.v1'
const POSTCODE_MISS_KEY = 'pp.siteMap.postcodeMisses.v1'

type PostcodesIoBulkResponse = {
  result?: Array<{ query?: string; result?: { latitude?: number; longitude?: number } | null }>
}

/** Reads a postcodes.io bulk answer: each queried postcode to its point, or null when unknown. */
export function parsePostcodesIoBulk(data: unknown): Map<string, LatLng | null> {
  const out = new Map<string, LatLng | null>()
  const rows = (data as PostcodesIoBulkResponse | null)?.result
  if (!Array.isArray(rows)) return out
  for (const row of rows) {
    if (!row || typeof row.query !== 'string') continue
    const key = formatUkPostcode(row.query)
    const lat = row.result?.latitude
    const lng = row.result?.longitude
    out.set(
      key,
      typeof lat === 'number' && typeof lng === 'number' && Number.isFinite(lat) && Number.isFinite(lng)
        ? { latitude: lat, longitude: lng }
        : null
    )
  }
  return out
}

function readStorage(storage: 'local' | 'session', key: string): Record<string, unknown> {
  try {
    const store = storage === 'local' ? window.localStorage : window.sessionStorage
    const raw = store.getItem(key)
    const parsed: unknown = raw ? JSON.parse(raw) : {}
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

function writeStorage(storage: 'local' | 'session', key: string, value: Record<string, unknown>): void {
  try {
    const store = storage === 'local' ? window.localStorage : window.sessionStorage
    store.setItem(key, JSON.stringify(value))
  } catch {
    // storage blocked or full: looked up again next time
  }
}

/** This browser's remembered lookups: found postcodes (kept) and unknown ones (this tab only, so a fix is retried). */
export function readCachedPostcodes(): Map<string, LatLng | null> {
  const out = new Map<string, LatLng | null>()
  if (typeof window === 'undefined') return out
  for (const [key, value] of Object.entries(readStorage('local', POSTCODE_CACHE_KEY))) {
    const point = value as Partial<LatLng> | null
    if (point && typeof point.latitude === 'number' && typeof point.longitude === 'number') {
      out.set(key, { latitude: point.latitude, longitude: point.longitude })
    }
  }
  for (const key of Object.keys(readStorage('session', POSTCODE_MISS_KEY))) {
    if (!out.has(key)) out.set(key, null)
  }
  return out
}

function rememberPostcodes(found: Map<string, LatLng | null>): void {
  if (typeof window === 'undefined') return
  const hits = readStorage('local', POSTCODE_CACHE_KEY)
  const misses = readStorage('session', POSTCODE_MISS_KEY)
  for (const [key, point] of found) {
    if (point) hits[key] = point
    else misses[key] = true
  }
  writeStorage('local', POSTCODE_CACHE_KEY, hits)
  writeStorage('session', POSTCODE_MISS_KEY, misses)
}

/**
 * Looks up postcodes on postcodes.io (bulk, 100 at a time), remembering and handing over each batch's answers as it
 * arrives (`onBatch`). A batch that cannot be reached (network or a server error) is returned in `failed`, never
 * remembered as unknown, so it is asked again later.
 */
export async function lookupPostcodes(
  postcodes: ReadonlyArray<string>,
  options: { fetchImpl?: typeof fetch; onBatch?: (found: Map<string, LatLng | null>) => void } = {}
): Promise<{ found: Map<string, LatLng | null>; failed: string[] }> {
  const fetchImpl = options.fetchImpl ?? fetch
  const unique = [...new Set(postcodes.map(formatUkPostcode))].filter(Boolean)
  const found = new Map<string, LatLng | null>()
  const failed: string[] = []
  for (let i = 0; i < unique.length; i += POSTCODES_IO_BULK_LIMIT) {
    const batch = unique.slice(i, i + POSTCODES_IO_BULK_LIMIT)
    let answers: Map<string, LatLng | null>
    try {
      const response = await fetchImpl(POSTCODES_IO_BULK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ postcodes: batch }),
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
      })
      if (!response.ok) throw new Error(`postcodes.io ${response.status}`)
      const parsed = parsePostcodesIoBulk(await response.json())
      answers = new Map(batch.map((postcode) => [postcode, parsed.get(postcode) ?? null] as const))
    } catch {
      failed.push(...batch)
      continue
    }
    rememberPostcodes(answers)
    for (const [key, value] of answers) found.set(key, value)
    options.onBatch?.(answers)
  }
  return { found, failed }
}
