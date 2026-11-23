/**
 * Assigned qualifications on an operative — write shape and merge.
 * iOS maps: qualifications[], qualificationExpiryDates, qualificationCertificateURLs.
 * Never delete-all + rewrite. A certificate upload must not wipe other quals.
 */

export const QUALIFICATION_CERTIFICATE_STORAGE_PATH =
  'organizations/{orgId}/operatives/{operativeId}/qualifications/{qualificationId}/certificates/{file}'

export type AssignedQualificationInput = {
  id?: unknown
  name?: unknown
  hasEndDate?: unknown
  createdAtIso?: unknown
  updatedAtIso?: unknown
  endDateIso?: unknown
  createdAt?: unknown
  updatedAt?: unknown
  endDate?: unknown
}

export type AssignedQualificationWrite = {
  id: string
  name: string
  hasEndDate: boolean
  createdAtIso: string
  updatedAtIso: string
  endDateIso?: string
}

export type OperativeQualificationMapsInput = {
  qualifications?: AssignedQualificationInput[]
  qualificationExpiryDates?: Record<string, unknown>
  qualificationCertificateURLs?: Record<string, string>
}

export type OperativeQualificationWrite = {
  qualifications: AssignedQualificationWrite[]
  qualificationExpiryDates: Record<string, string>
  qualificationCertificateURLs: Record<string, string>
}

function isoFromUnknown(value: unknown): string | undefined {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString()
  if (typeof value === 'string' && value.trim()) {
    const parsed = new Date(value)
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString()
  }
  return undefined
}

function trimId(value: unknown): string {
  return String(value || '').trim()
}

/** iOS assignment row: id, name, hasEndDate, timestamps, optional endDate. Library extras stay off this map. */
export function assignedQualificationWriteFields(
  row: AssignedQualificationInput | undefined
): AssignedQualificationWrite | null {
  if (!row) return null
  const id = trimId(row.id)
  const name = String(row.name || '').trim()
  if (!id || !name) return null
  const now = new Date().toISOString()
  const createdAtIso = isoFromUnknown(row.createdAtIso) || isoFromUnknown(row.createdAt) || now
  const updatedAtIso = isoFromUnknown(row.updatedAtIso) || isoFromUnknown(row.updatedAt) || createdAtIso
  const endDateIso = isoFromUnknown(row.endDateIso) || isoFromUnknown(row.endDate)
  const write: AssignedQualificationWrite = {
    id,
    name,
    hasEndDate: row.hasEndDate === true,
    createdAtIso,
    updatedAtIso,
  }
  if (endDateIso) write.endDateIso = endDateIso
  return write
}

/** iOS keys this map by qualification UUID. Match ignoring case so a stored URL still shows. */
export function qualificationCertificateUrl(
  urls: Record<string, string> | undefined,
  qualificationId: unknown
): string | undefined {
  if (!urls) return undefined
  const id = trimId(qualificationId)
  if (!id) return undefined
  const direct = urls[id]
  if (typeof direct === 'string' && direct.trim()) return direct
  const target = id.toLowerCase()
  for (const [key, value] of Object.entries(urls)) {
    if (key.toLowerCase() === target && typeof value === 'string' && value.trim()) return value
  }
  return undefined
}

export function mergeQualificationCertificateUrls(
  existing: Record<string, string> | undefined,
  uploaded: Record<string, string> | undefined,
  removedIds?: readonly string[]
): Record<string, string> {
  const next: Record<string, string> = {}
  for (const [key, value] of Object.entries(existing || {})) {
    if (typeof value === 'string' && value.trim()) next[key] = value
  }
  for (const [key, value] of Object.entries(uploaded || {})) {
    if (typeof value === 'string' && value.trim()) next[key] = value
  }
  for (const id of removedIds || []) {
    const target = trimId(id).toLowerCase()
    if (!target) continue
    for (const key of Object.keys(next)) {
      if (key.toLowerCase() === target) delete next[key]
    }
  }
  return next
}

/**
 * Which certificate URLs the editor cleared for qualifications it is saving.
 * URLs for other qualification ids stay; a missing draft must not wipe them.
 */
export function removedQualificationCertificateIds(
  previousUrls: Record<string, string> | undefined,
  nextUrls: Record<string, string> | undefined,
  assignedIds: readonly string[]
): string[] {
  const removed: string[] = []
  for (const id of assignedIds) {
    const key = trimId(id)
    if (!key) continue
    if (qualificationCertificateUrl(previousUrls, key) && !qualificationCertificateUrl(nextUrls, key)) {
      removed.push(key)
    }
  }
  return removed
}

function mergeExpiryDates(
  previous: Record<string, unknown> | undefined,
  next: Record<string, unknown> | undefined,
  nextAssignmentIds: readonly string[]
): Record<string, string> {
  const expiry: Record<string, string> = {}
  for (const [key, value] of Object.entries(previous || {})) {
    const iso = isoFromUnknown(value)
    if (iso) expiry[key] = iso
  }
  for (const id of nextAssignmentIds) {
    const target = id.toLowerCase()
    for (const key of Object.keys(expiry)) {
      if (key.toLowerCase() === target) delete expiry[key]
    }
  }
  for (const [key, value] of Object.entries(next || {})) {
    const iso = isoFromUnknown(value)
    if (iso) expiry[key] = iso
  }
  return expiry
}

/**
 * Merge an operative qualification write onto maps already stored.
 * Next assignments win on the same id. Previous assignments not in next are kept
 * so a partial draft cannot wipe other quals. Certificate URLs merge; removedIds
 * delete a URL only for qualifications this save is editing.
 */
export function mergeOperativeQualificationWrite(input: {
  previous?: OperativeQualificationMapsInput
  next: OperativeQualificationMapsInput & { removedCertificateIds?: readonly string[] }
}): OperativeQualificationWrite {
  const byId = new Map<string, AssignedQualificationWrite>()
  for (const row of input.previous?.qualifications || []) {
    const write = assignedQualificationWriteFields(row)
    if (write) byId.set(write.id, write)
  }
  const nextAssignmentIds: string[] = []
  for (const row of input.next.qualifications || []) {
    const write = assignedQualificationWriteFields(row)
    if (!write) continue
    byId.set(write.id, write)
    nextAssignmentIds.push(write.id)
  }
  return {
    qualifications: Array.from(byId.values()),
    qualificationExpiryDates: mergeExpiryDates(
      input.previous?.qualificationExpiryDates,
      input.next.qualificationExpiryDates,
      nextAssignmentIds
    ),
    qualificationCertificateURLs: mergeQualificationCertificateUrls(
      input.previous?.qualificationCertificateURLs,
      input.next.qualificationCertificateURLs,
      input.next.removedCertificateIds
    ),
  }
}

/** Storage object path. The file segment is `{uid}_{ts}_{sanitizedName}` on both apps. */
export function qualificationCertificateStoragePath(input: {
  organizationId?: unknown
  operativeId?: unknown
  qualificationId?: unknown
  fileName?: unknown
}): string | null {
  const organizationId = trimId(input.organizationId)
  const operativeId = trimId(input.operativeId)
  const qualificationId = trimId(input.qualificationId)
  const fileName = trimId(input.fileName)
  if (!organizationId || !operativeId || !qualificationId || !fileName) return null
  return `organizations/${organizationId}/operatives/${operativeId}/qualifications/${qualificationId}/certificates/${fileName}`
}

/**
 * Rulebook 1.73.0 (owner 23 Nov, gap 1): one qualification expiry rule for both apps (moved from web
 * `lib/qualifications/personQualifications.ts`, web #415). A qualification's expiry is
 * `qualificationExpiryDates[qualificationId]` — the exact key first, else the same id in another letter case (iOS
 * writes upper-case UUIDs) — read as a Date (a Date, an ISO string or epoch ms; anything else is no expiry). The
 * assignment row's own `endDate` is not an expiry. The profile page, the qualifications editor and the
 * qualification-expiry warnings (`qualificationExpiryRows` input) all read it this way.
 */
function expiryDateFromUnknown(value: unknown): Date | undefined {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? undefined : value
  if (typeof value === 'number' && Number.isFinite(value)) return new Date(value)
  if (typeof value === 'string' && value.trim()) {
    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? undefined : parsed
  }
  return undefined
}

export function qualificationExpiryDate(
  dates: Record<string, unknown> | null | undefined,
  qualificationId: unknown
): Date | undefined {
  if (!dates) return undefined
  const id = trimId(qualificationId)
  if (!id) return undefined
  const direct = expiryDateFromUnknown(dates[id])
  if (direct) return direct
  const target = id.toLowerCase()
  for (const [key, value] of Object.entries(dates)) {
    if (key.toLowerCase() === target) {
      const date = expiryDateFromUnknown(value)
      if (date) return date
    }
  }
  return undefined
}

/**
 * The expiry map after the editor sets (or clears) one qualification's date: every other spelling of that id is
 * removed, so a key stored in another letter case cannot keep showing the old date.
 */
export function withQualificationExpiry<T>(
  dates: Record<string, T> | null | undefined,
  qualificationId: unknown,
  date: T | null | undefined
): Record<string, T> {
  const id = trimId(qualificationId)
  const target = id.toLowerCase()
  const next: Record<string, T> = {}
  for (const [key, value] of Object.entries(dates || {})) {
    if (key.toLowerCase() !== target) next[key] = value
  }
  if (date && target) next[id] = date
  return next
}

/** One `operatives` row as the qualification rules read it. */
export type QualificationOperativeRow = {
  id: string
  isActive?: boolean | null
  qualifications?: ReadonlyArray<{ id?: unknown; name?: unknown } | null | undefined> | null
  qualificationExpiryDates?: Record<string, unknown> | null
  qualificationCertificateURLs?: Record<string, string> | null
}

/**
 * One row's assigned qualifications that have an expiry, one per qualification id (without case): the input the
 * expiry warnings give `qualificationExpiryRows` / `qualificationExpiryCount` / `myProfileSummary`.
 */
export function assignedQualificationExpiries(
  row: Pick<QualificationOperativeRow, 'qualifications' | 'qualificationExpiryDates'> | null | undefined
): { qualificationId: string; name: string; expiryIso: string }[] {
  if (!row) return []
  const seen = new Set<string>()
  return (row.qualifications || []).flatMap((qualification) => {
    const qualificationId = trimId(qualification?.id)
    const name = String(qualification?.name || '')
    if (!qualificationId || !name || seen.has(qualificationId.toLowerCase())) return []
    seen.add(qualificationId.toLowerCase())
    const expiry = qualificationExpiryDate(row.qualificationExpiryDates, qualificationId)
    if (!expiry) return []
    return [{ qualificationId, name, expiryIso: expiry.toISOString() }]
  })
}

export type PersonQualification = {
  id: string
  name: string
  expiry?: Date
  certificateUrl?: string
  /** The `operatives` row the qualification (or its certificate) was read from. */
  operativeId: string
}

function rowWeight(row: QualificationOperativeRow): number {
  return (
    (row.qualifications?.length ?? 0) +
    Object.keys(row.qualificationExpiryDates || {}).length +
    Object.keys(row.qualificationCertificateURLs || {}).length
  )
}

/**
 * A person's qualifications from every `operatives` row of theirs (the caller passes the rows of one person — the
 * rulebook's person fold, `taskPersonIndex`), one per qualification id without case. Rows are read in order — active
 * rows first (the expiry warnings read only those), then `preferredRowId` (the row the editor saves to), then the
 * row holding the most — and a qualification's expiry and certificate come from the first row that has them.
 */
export function personQualifications(input: {
  rows: ReadonlyArray<QualificationOperativeRow>
  preferredRowId?: string | null
}): PersonQualification[] {
  const preferred = trimId(input.preferredRowId).toLowerCase()
  const rows = [...(input.rows || [])]
    .filter((row) => row && trimId(row.id))
    .sort((a, b) => {
      if ((a.isActive !== false) !== (b.isActive !== false)) return a.isActive !== false ? -1 : 1
      const ap = trimId(a.id).toLowerCase() === preferred ? 1 : 0
      const bp = trimId(b.id).toLowerCase() === preferred ? 1 : 0
      if (ap !== bp) return bp - ap
      return rowWeight(b) - rowWeight(a)
    })
  const out = new Map<string, PersonQualification>()
  for (const row of rows) {
    for (const qual of row.qualifications || []) {
      const id = trimId(qual?.id)
      const key = id.toLowerCase()
      if (!key) continue
      const expiry = qualificationExpiryDate(row.qualificationExpiryDates, id)
      const certificateUrl = qualificationCertificateUrl(row.qualificationCertificateURLs || undefined, id)
      const current = out.get(key)
      if (!current) {
        out.set(key, { id, name: String(qual?.name ?? ''), expiry, certificateUrl, operativeId: row.id })
        continue
      }
      if (!current.expiry && expiry) current.expiry = expiry
      if (!current.certificateUrl && certificateUrl) {
        current.certificateUrl = certificateUrl
        current.operativeId = row.id
      }
    }
  }
  return [...out.values()]
}
