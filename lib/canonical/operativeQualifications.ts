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
