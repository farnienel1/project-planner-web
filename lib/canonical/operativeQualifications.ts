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

import { taskPersonIndex, type TaskPersonRosterRow } from './taskPeople'

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
  if (typeof value === 'number') {
    // Epoch milliseconds. Zero or below (a cleared or default field) and anything a Date cannot hold are no date.
    if (!Number.isFinite(value) || value <= 0) return undefined
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? undefined : date
  }
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
  /** The same expiry as ISO text (what iOS reads through the packed script). */
  expiryIso?: string
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
        out.set(key, {
          id,
          name: String(qual?.name ?? ''),
          expiry,
          expiryIso: expiry?.toISOString(),
          certificateUrl,
          operativeId: row.id,
        })
        continue
      }
      if (!current.expiry && expiry) {
        current.expiry = expiry
        current.expiryIso = expiry.toISOString()
      }
      if (!current.certificateUrl && certificateUrl) {
        current.certificateUrl = certificateUrl
        current.operativeId = row.id
      }
    }
  }
  return [...out.values()]
}

/**
 * Rulebook 1.73.0 (review of #418, guardrail 1): a placeholder `operatives` row — a name or email containing
 * "placeholder", or a name containing "initial" (the starter rows older builds wrote) — is never a person.
 */
export function isPlaceholderOperativeRow(
  row: { firstName?: unknown; lastName?: unknown; email?: unknown } | null | undefined
): boolean {
  if (!row) return false
  const name = `${String(row.firstName ?? '')} ${String(row.lastName ?? '')}`.trim().toLowerCase()
  const email = String(row.email ?? '').toLowerCase()
  return name.includes('placeholder') || email.includes('placeholder') || name.includes('initial')
}

/**
 * Rulebook 1.73.0 (review of #418, guardrail 1): every `operatives` row that is this person, by the rulebook's person
 * fold (`taskPersonIndex`: every users document of the person by `personIdSet`, their emails, and the rows on those
 * emails or ids or linked to those accounts through `linkedUserId` / `userId` / `uid`). Placeholder rows
 * (`isPlaceholderOperativeRow`) are left out. Never one row picked by email. Rows keep their stored shape.
 */
export function operativeRowsForPerson<T extends { id: string; email?: string | null; linkedUserId?: string | null }>(
  input: {
    person: { id: string; email?: string | null }
    operatives: ReadonlyArray<T>
    roster?: ReadonlyArray<TaskPersonRosterRow> | null
  }
): T[] {
  const personId = trimId(input.person?.id)
  if (!personId) return []
  const roster: TaskPersonRosterRow[] = [...(input.roster || [])]
  if (!roster.some((row) => trimId(row?.id).toLowerCase() === personId.toLowerCase())) {
    roster.push({ id: personId, email: input.person.email ?? '' })
  }
  const rows = (input.operatives || []).filter(
    (row) => row && trimId(row.id) && !isPlaceholderOperativeRow(row as Record<string, unknown>)
  )
  const index = taskPersonIndex({ managers: [], operatives: rows, roster })
  const personKey = index.keyOf('operative', personId)
  return rows.filter((row) => index.keyOf('operative', row.id) === personKey)
}

import { taskPersonKeys } from './taskPeople'
import { isAnonymisedDeletedProfile } from './userRosterSegment'

/** A qualification library entry (`organizations/{orgId}/qualifications/{id}`) as this check reads it. */
export type QualificationLibraryEntry = {
  id: string
  name?: unknown
  hasEndDate?: unknown
  endDate?: unknown
}

/** One `operatives` row as the missing-own-expiry check reads it. */
export type QualificationMissingOwnExpiryOperativeRow = QualificationOperativeRow & {
  email?: string | null
  linkedUserId?: string | null
  userId?: string | null
  uid?: string | null
  firstName?: unknown
  lastName?: unknown
}

export type QualificationMissingOwnExpiryRow = {
  /** The person's key from the rulebook person fold (`taskPersonKeys`): the same for every record of them. */
  personKey: string
  /** The person's users id (as stored) when one of their users documents is on the roster, else null. */
  userId: string | null
  /** The `operatives` row the qualification is on (the first of the person's rows holding it). */
  operativeId: string
  /** The person's name as stored (roster first name and surname, else the row's, else the email), '' when none. */
  personName: string
  /** Whether any of the person's rows (or their users document) is active. */
  active: boolean
  qualificationId: string
  qualificationName: string
}

function hasLibraryEndDate(entry: { hasEndDate?: unknown; endDate?: unknown } | null | undefined): boolean {
  if (!entry) return false
  // A stored boolean `hasEndDate` decides; `endDate` is read only when `hasEndDate` is missing (review of #426).
  if (typeof entry.hasEndDate === 'boolean') return entry.hasEndDate
  const end = entry.endDate as unknown
  if (end && typeof end === 'object' && typeof (end as { toDate?: unknown }).toDate === 'function') return true
  if (end && typeof end === 'object' && typeof (end as { seconds?: unknown }).seconds === 'number') return true
  return Boolean(expiryDateFromUnknown(end))
}

function nameText(first: unknown, last: unknown): string {
  return `${typeof first === 'string' ? first.trim() : ''} ${typeof last === 'string' ? last.trim() : ''}`.trim()
}

/**
 * Rulebook 1.76.0 §5 (owner 23 Nov, C12): people who hold a qualification whose library entry has an end date
 * (`hasEndDate` true or an `endDate`) but who have no expiry of their own for it (`qualificationExpiryDate` gives none
 * on every `operatives` row of theirs). The library entry's own end date is a template and never an expiry (1.73.0),
 * so these people get no qualification-expiry warning or reminder until their own date is set.
 *
 * - People are folded with the rulebook person fold (`taskPersonKeys` over the roster and the rows — every users
 *   document by `personIdSet`, emails, `linkedUserId` / `userId` / `uid`), named by their live users document (the
 *   `rosterPersonGroups` order). They are judged on their active rows (as the warnings and iOS reminders read them),
 *   or all rows when every row is inactive; an own expiry on any judged row counts (`personQualifications`).
 *   Placeholder rows and anonymised deleted profiles are left out; blank-named qualifications are skipped.
 * - A stored boolean `hasEndDate` decides whether the library entry has an end date; `endDate` only when it is missing.
 * - The library entry is matched by qualification id without case, else by name without case; a qualification whose
 *   library entry is missing reads the assignment row's own copy (`hasEndDate` / `endDate`).
 * - Inactive people are listed too (marked `active: false`); nothing is hidden. One row per person + qualification,
 *   sorted by person name then qualification name. Read only.
 */
export function qualificationsMissingOwnExpiry(input: {
  operatives: ReadonlyArray<QualificationMissingOwnExpiryOperativeRow>
  qualifications?: ReadonlyArray<QualificationLibraryEntry> | null
  roster?: ReadonlyArray<TaskPersonRosterRow & { firstName?: unknown; lastName?: unknown }> | null
}): QualificationMissingOwnExpiryRow[] {
  const rows = (input?.operatives || []).filter(
    (row) =>
      row &&
      trimId(row.id) &&
      !isPlaceholderOperativeRow(row as Record<string, unknown>) &&
      // As the expiry warnings (`qualificationExpiryRowsUnscoped`): an anonymised deleted profile is never listed.
      !isAnonymisedDeletedProfile({
        email: row.email ?? '',
        firstName: row.firstName as string | undefined,
        lastName: row.lastName as string | undefined,
      } as never)
  )
  const roster = (input?.roster || []).filter((row) => row && trimId(row.id))
  const library = (input?.qualifications || []).filter((entry) => entry && trimId(entry.id))
  const libraryById = new Map(library.map((entry) => [trimId(entry.id).toLowerCase(), entry]))
  const libraryByName = new Map<string, QualificationLibraryEntry>()
  for (const entry of library) {
    const name = String(entry.name ?? '').trim().toLowerCase()
    if (name && !libraryByName.has(name)) libraryByName.set(name, entry)
  }
  const { keys } = taskPersonKeys({ managers: [], operatives: rows, roster })
  const keyOf = (id: string) => keys[id.toLowerCase()] || `id:${id.toLowerCase()}`
  const groups = new Map<string, QualificationMissingOwnExpiryOperativeRow[]>()
  for (const row of rows) {
    const k = keyOf(trimId(row.id))
    const list = groups.get(k)
    if (list) list.push(row)
    else groups.set(k, [row])
  }
  const rosterByKey = new Map<string, (typeof roster)[number][]>()
  for (const person of roster) {
    const k = keyOf(trimId(person.id))
    const list = rosterByKey.get(k)
    if (list) list.push(person)
    else rosterByKey.set(k, [person])
  }
  const out: QualificationMissingOwnExpiryRow[] = []
  for (const [personKey, personRows] of groups) {
    const accounts = rosterByKey.get(personKey) || []
    // The person's live document speaks for them (as `rosterPersonGroups`): active and not anonymised first, then
    // signed up (`passwordSet` not false), then not listed as another document's former / same-email id; ties go to
    // the smallest id (review of #426).
    const aliasKeys = new Set<string>()
    for (const member of accounts) {
      for (const alias of [...(member.formerUserIds || []), ...(member.sameEmailUserIds || [])]) {
        if (trimId(alias).toLowerCase() !== trimId(member.id).toLowerCase()) aliasKeys.add(trimId(alias).toLowerCase())
      }
    }
    const rank = (member: (typeof accounts)[number]) =>
      (member.isActive !== false && !isAnonymisedDeletedProfile(member as never) ? 0 : 4) +
      ((member as { passwordSet?: unknown }).passwordSet === false ? 2 : 0) +
      (aliasKeys.has(trimId(member.id).toLowerCase()) ? 1 : 0)
    const account = [...accounts].sort(
      (a, b) => rank(a) - rank(b) || trimId(a.id).toLowerCase().localeCompare(trimId(b.id).toLowerCase())
    )[0]
    if (account && accounts.every((member) => isAnonymisedDeletedProfile(member as never))) continue
    const personName =
      (account && nameText(account.firstName, account.lastName)) ||
      personRows.map((row) => nameText(row.firstName, row.lastName)).find(Boolean) ||
      trimId(account?.email) ||
      personRows.map((row) => trimId(row.email)).find(Boolean) ||
      ''
    const active =
      personRows.some((row) => row.isActive !== false) && (accounts.length === 0 || accounts.some((a) => a.isActive !== false))
    // As the expiry warnings and iOS reminders (active rows only): a person with any active row is judged on their
    // active rows; a fully inactive person on all their rows (review of #426).
    const activeRows = personRows.filter((row) => row.isActive !== false)
    const judgedRows = activeRows.length > 0 ? activeRows : personRows
    // The person's qualifications with an expiry from any judged row (personQualifications merges them).
    const merged = personQualifications({ rows: judgedRows })
    for (const qual of merged) {
      if (qual.expiry) continue
      if (!String(qual.name ?? '').trim()) continue
      const id = trimId(qual.id)
      const libraryEntry = libraryById.get(id.toLowerCase()) || libraryByName.get(qual.name.trim().toLowerCase())
      let templated = hasLibraryEndDate(libraryEntry)
      if (!libraryEntry) {
        for (const row of judgedRows) {
          const assignment = (row.qualifications || []).find((entry) => trimId(entry?.id).toLowerCase() === id.toLowerCase())
          if (hasLibraryEndDate(assignment as { hasEndDate?: unknown; endDate?: unknown } | undefined)) {
            templated = true
            break
          }
        }
      }
      if (!templated) continue
      const holder =
        judgedRows.find((row) => (row.qualifications || []).some((entry) => trimId(entry?.id).toLowerCase() === id.toLowerCase())) ||
        judgedRows[0]
      out.push({
        personKey,
        userId: account ? trimId(account.id) : null,
        operativeId: trimId(holder.id),
        personName,
        active,
        qualificationId: id,
        qualificationName: qual.name.trim(),
      })
    }
  }
  return out.sort(
    (a, b) =>
      a.personName.localeCompare(b.personName) ||
      a.personKey.localeCompare(b.personKey) ||
      a.qualificationName.localeCompare(b.qualificationName)
  )
}
