/**
 * Reading and writing the people collections (rulebook §1 "Document readers", §8, §11).
 *
 * Every platform reads these documents only through the readers here, and saves them only with the
 * partial-update helpers here. Before 1.6.0 web and iOS each parsed them their own way:
 *   - `users/{uid}` missing leave fields: web used the organisation default, iOS a hard-coded 25.
 *   - an admin with a stray `operativeMode` flag: web dropped the flag, iOS kept it.
 *   - `operatives/{id}` `payBasis`: iOS ignored it and read an hourly operative as a day rate.
 *   - `operatives`, `clients` and `operativeDayRateHistory` ids that are not UUIDs: iOS randomised,
 *     upper-cased or dropped them.
 *   - `timesheetsEnabled` missing: web read false, iOS "operative or self-employed".
 *   - web Operative / Manager forms overwrote the whole `users/{uid}` document and merge-set the
 *     whole `operatives` / `managers` row; iOS saved clients with a full `setData`.
 *
 * Readers are pure, JSON in / JSON out, `(docId, data, options?)`. Stored instants may be a Firestore
 * Timestamp (`{seconds, nanoseconds}` or `{_seconds, _nanoseconds}`), an object with `toDate()`, a
 * Date, epoch milliseconds or seconds (above 10 000 000 000 is milliseconds), or an ISO string; they
 * come back as epoch milliseconds (`…Ms`) and, where a day matters, an organisation-zone day key.
 * Booleans accept true/false, 1/0 and "true"/"false"/"yes"/"no"/"1"/"0" (iOS `firestoreBool`).
 * Numbers accept a finite number or a numeric string. The record id is always the document id, in
 * its stored case — a stored `id` field never replaces it and a non-UUID id is kept.
 *
 * Writes: `documentWriteFields(before, next, options)` → `{ set, remove }`. Only fields whose value
 * differs from `before` are set; a `null` in `next` removes the field only when `before` has a value
 * (a field the local copy lacks is never deleted); `undefined` leaves the field alone. Fields in one
 * `together` group are written as a group when any of them changes (line manager ids with
 * `hasNoLineManager`; pay basis with both rates; employment type with its transition). The values in
 * `set` are the values the caller passed in `next` (a Firestore Timestamp stays a Timestamp), so each
 * app writes `set` plus its delete sentinel for `remove` as one partial update, and adds
 * `writeMetadataFields` and its server `updatedAt`. With `before` null (a new document) everything
 * non-null in `next` is set and nothing is removed.
 */

import { dayKeyInZone } from '../orgTime/zoneTime'
import { derivedRowId } from './derivedIds'
import { eachDayKey, zoneOrLondon } from './dayKeys'
import { isAdminOutsideOperativeMode } from './leaveRequests'
import { effectivePermissions, keepStoredLockedPermissions } from './permissionLevels'
import { DEFAULT_ANNUAL_LEAVE, parseAnnualLeaveDefaults, type OrgAnnualLeaveDefaults } from './organizationSettings'
import { readStoredRates, type PayBasis } from './payRate'
import { isAnonymisedDeletedProfile } from './userRosterSegment'
import {
  accountKindFromFlags,
  employmentTypeOnDay,
  normalizeEmploymentType,
  parseFormerUserIds,
  USER_PERMISSION_FIELDS,
  type AccountKind,
  type EmploymentType,
  type UserPermissionField,
} from './userProfile'

// MARK: - Value readers

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function firstText(row: Record<string, unknown>, keys: readonly string[]): string {
  for (const key of keys) {
    const value = text(row[key])
    if (value) return value
  }
  return ''
}

function optionalText(value: unknown): string | null {
  return text(value) || null
}

/** A stored boolean (iOS `firestoreBool`): true/false, 1/0, "true"/"false"/"yes"/"no"/"1"/"0". Else null. */
export function documentBool(value: unknown): boolean | null {
  if (value === true || value === false) return value
  if (typeof value === 'number' && Number.isFinite(value)) return value !== 0
  if (typeof value === 'string') {
    const token = value.trim().toLowerCase()
    if (token === 'true' || token === 'yes' || token === '1') return true
    if (token === 'false' || token === 'no' || token === '0') return false
  }
  return null
}

/** A stored number: a finite number or a numeric string. Else null. */
export function documentNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value.trim())
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

/** A stored instant as epoch milliseconds, or null. See the file header for the accepted shapes. */
export function documentInstantMs(raw: unknown): number | null {
  if (raw == null || raw === '') return null
  if (raw instanceof Date) return Number.isNaN(raw.getTime()) ? null : raw.getTime()
  if (typeof raw === 'number') {
    if (!Number.isFinite(raw) || raw <= 0) return null
    return raw > 10_000_000_000 ? raw : raw * 1000
  }
  if (typeof raw === 'string') {
    const value = raw.trim()
    if (!value) return null
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const ms = Date.parse(`${value}T12:00:00Z`)
      return Number.isNaN(ms) ? null : ms
    }
    const ms = Date.parse(value)
    return Number.isNaN(ms) ? null : ms
  }
  if (typeof raw === 'object') {
    const row = raw as Record<string, unknown> & { toDate?: unknown; toMillis?: unknown }
    const seconds =
      typeof row.seconds === 'number' ? row.seconds : typeof row._seconds === 'number' ? row._seconds : null
    if (seconds != null && Number.isFinite(seconds)) {
      const nanos =
        typeof row.nanoseconds === 'number' ? row.nanoseconds : typeof row._nanoseconds === 'number' ? row._nanoseconds : 0
      return seconds * 1000 + Math.floor((Number(nanos) || 0) / 1e6)
    }
    if (typeof row.toMillis === 'function') {
      try {
        const ms = (row.toMillis as () => unknown)()
        if (typeof ms === 'number' && Number.isFinite(ms)) return ms
      } catch {
        return null
      }
    }
    if (typeof row.toDate === 'function') {
      try {
        const date = (row.toDate as () => unknown)()
        if (date instanceof Date && !Number.isNaN(date.getTime())) return date.getTime()
      } catch {
        return null
      }
    }
  }
  return null
}

/**
 * A stored organisation reference as the organisation id (1.8.0). Accepts the id itself, a path
 * (`organizations/{id}` or `/organizations/{id}`, what some iOS builds stored), or a Firestore DocumentReference
 * (`{ id, path }`, or the SDK's `_key.path.segments`). Null when nothing readable is stored.
 */
export function documentOrganizationId(raw: unknown): string | null {
  if (raw == null) return null
  if (typeof raw === 'string') {
    const value = raw.trim()
    if (!value) return null
    const segments = value.split('/').filter(Boolean)
    const at = segments.lastIndexOf('organizations')
    if (at >= 0) return segments[at + 1] || null
    return segments.length === 1 ? segments[0] : segments[segments.length - 1] || null
  }
  if (typeof raw === 'object') {
    const row = raw as Record<string, unknown> & { _key?: { path?: { segments?: unknown } } }
    if (typeof row.path === 'string' && row.path.trim()) return documentOrganizationId(row.path)
    const segments = row._key?.path?.segments
    if (Array.isArray(segments) && segments.length > 0) {
      return documentOrganizationId(segments.map((part) => String(part)).join('/'))
    }
    if (typeof row.id === 'string' && row.id.trim()) return row.id.trim()
  }
  return null
}

function dayKeyOf(ms: number | null, zone: string): string | null {
  return ms == null ? null : dayKeyInZone(new Date(ms), zone)
}

function idList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const out: string[] = []
  const seen = new Set<string>()
  for (const entry of value) {
    const id = text(entry)
    if (!id || seen.has(id)) continue
    seen.add(id)
    out.push(id)
  }
  return out
}

function flagIn(data: Record<string, unknown>, key: string): boolean | null {
  const top = documentBool(data[key])
  if (top != null) return top
  const nested = data.permissions
  if (nested && typeof nested === 'object') return documentBool((nested as Record<string, unknown>)[key])
  return null
}

function splitName(full: string): { first: string; last: string } {
  const parts = full.trim().split(/\s+/)
  if (!parts[0]) return { first: '', last: '' }
  return { first: parts[0], last: parts.slice(1).join(' ') }
}

function storedPay(data: Record<string, unknown>): { payBasis: PayBasis | null; dayRate: number | null; hourlyRate: number | null } {
  return readStoredRates({
    payBasis: text(data.payBasis).toLowerCase() || null,
    dayRate: documentNumber(data.dayRate),
    hourlyRate: documentNumber(data.hourlyRate),
  })
}

// MARK: - users/{uid}

/** Stored keys read for each `users/{uid}` field, first non-empty wins (legacy keys either app wrote). */
export const USER_DOCUMENT_KEYS = {
  firstName: ['firstName', 'givenName'],
  surname: ['surname', 'lastName', 'familyName'],
  combinedName: ['displayName', 'name'],
  mobileNumber: ['mobileNumber', 'mobile', 'phone', 'phoneNumber'],
  profilePhotoURL: ['profilePhotoURL', 'photoURL'],
} as const

const ROLE_TOKENS = ['basic', 'admin', 'manager', 'operative', 'viewer'] as const
export type UserRoleToken = (typeof ROLE_TOKENS)[number]

/**
 * The stored `role` as one of `basic | admin | manager | operative | viewer`. An exact token wins; otherwise
 * "operat…" → operative, "…admin…" (super_admin, administrator) → admin, "manag…" → manager; else viewer.
 */
export function normalizeUserRoleToken(raw: unknown): UserRoleToken {
  const token = text(raw).toLowerCase()
  if ((ROLE_TOKENS as readonly string[]).includes(token)) return token as UserRoleToken
  if (token.includes('operat')) return 'operative'
  if (token.includes('admin')) return 'admin'
  if (token.includes('manag')) return 'manager'
  return 'viewer'
}

/**
 * Timesheets on or off when `users/{uid}.timesheetsEnabled` is not stored: operatives and self-employed
 * people take part; PAYE managers and admins do not. Same rule as Add User on both apps.
 */
export function defaultTimesheetsEnabled(input: { operativeMode?: boolean | null; employmentType?: unknown }): boolean {
  if (input.operativeMode === true) return true
  return normalizeEmploymentType(input.employmentType) === 'self_employed'
}

export type UserDocumentAnnualLeave = {
  daysPerYear: number | null
  startMonth: number | null
  endMonth: number | null
  carriesOver: boolean | null
}

export type UserDocument = {
  /** The Firestore document id, stored case. */
  id: string
  /** Stored email, trimmed (stored case). */
  email: string
  /** Trimmed lower-case email, for matching only. '' when none. */
  emailKey: string
  firstName: string
  surname: string
  /** "First Surname", or the stored displayName / name when there are no name parts. */
  displayName: string
  mobileNumber: string | null
  organizationId: string | null
  role: UserRoleToken
  isSuperAdmin: boolean
  /** The stored `operativeMode` flag (top level, else `permissions`). */
  operativeModeStored: boolean
  /**
   * Operative mode as the people lists and permission defaults use it: the stored flag, except that an
   * admin or super admin is never moved off the admin list by it (a stray flag on an admin is ignored).
   */
  operativeMode: boolean
  /** `admin` | `manager` | `operative` for people lists (`accountKindFromFlags`; admin wins). */
  accountKind: AccountKind
  /**
   * Admin or super admin outside operative mode as the approval rules and firestore.rules read it
   * (`isAdminOutsideOperativeMode` over the stored flags: the stored operativeMode flag counts).
   */
  adminOutsideOperativeMode: boolean
  permissions: Record<UserPermissionField, boolean>
  isActive: boolean
  /** Missing is an existing account (true); invites store false. */
  passwordSet: boolean
  status: string | null
  /** Line managers in stored order, de-duplicated; empty when `hasNoLineManager`. */
  assignedManagerUserIds: string[]
  assignedManagerUserId: string | null
  hasNoLineManager: boolean
  formerUserIds: string[]
  payBasis: PayBasis | null
  dayRate: number | null
  hourlyRate: number | null
  employmentType: EmploymentType
  employmentTypeTransitionFrom: EmploymentType | null
  employmentTypeEffectiveAtMs: number | null
  employmentTypeEffectiveDayKey: string | null
  annualLeaveEnabled: boolean
  /** Stored value, else the organisation `annualLeaveDefaults` (§4.4), else 25 / 1 / 12 / false. */
  annualLeaveDaysPerYear: number
  annualLeaveYearStartMonth: number
  annualLeaveYearEndMonth: number
  annualLeaveCarriesOver: boolean
  /**
   * 1.13.0 (Q4): `employmentStartDate`, the day the person started (an organisation-zone `YYYY-MM-DD`; an instant is
   * read as its day). Null when not set — then the leave year is never pro rata (the account's `createdAt` is not a
   * start date). `annualLeaveBalance` `employmentStartDayKey`.
   */
  employmentStartDayKey: string | null
  /** What is stored on the user document (null = not stored, the organisation default applies). */
  annualLeaveStored: UserDocumentAnnualLeave
  /**
   * True when a leave field is not stored on the user and no organisation `annualLeaveDefaults` was passed (the
   * organisation document had not loaded): the figures are the factory 25 / 1 / 12 / false, and the app re-parses
   * the user when the organisation settings arrive (1.8.0). Never save these figures onto the user.
   */
  annualLeaveDefaultsPending: boolean
  annualLeaveYearAllowance: number | null
  annualLeaveYearAllowanceKey: string | null
  /** Stored value, else `defaultTimesheetsEnabled`. */
  timesheetsEnabled: boolean
  timesheetsEnabledStored: boolean | null
  tradeTypePreset: string | null
  tradeTypeCustom: string | null
  profilePhotoURL: string | null
  profilePhotoUpdatedAtMs: number | null
  lastSeenAtMs: number | null
  policyAccepted: boolean
  policyAcceptedAtMs: number | null
  legalPackVersion: string | null
  createdAtMs: number | null
  updatedAtMs: number | null
  /** Empty email and "Deleted user" (`isAnonymisedDeletedProfile`). */
  isAnonymisedDeleted: boolean
}

export type ParseUserDocumentOptions = {
  timeZone?: string | null
  /** The organisation's `annualLeaveDefaults` map (raw or parsed). Missing → 25 / 1 / 12 / false. */
  annualLeaveDefaults?: Partial<OrgAnnualLeaveDefaults> | Record<string, unknown> | null
}

function wholeMonth(value: unknown): number | null {
  const n = documentNumber(value)
  if (n == null) return null
  const month = Math.trunc(n)
  return month >= 1 && month <= 12 ? month : null
}

/**
 * Read one `users/{uid}` document. Null only when there is no document id. Never throws.
 * Defaults (both apps): isActive true, passwordSet true, annualLeaveEnabled true, materials / dailyOverview /
 * siteAudit / wholesalersOrderHistory on, every other permission off; operative mode turns on projects and
 * small works and turns off operatives, qualifications and (unless stored) materials.
 */
export function parseUserDocument(
  docId: string,
  data: Record<string, unknown> | null | undefined,
  options?: ParseUserDocumentOptions | null
): UserDocument | null {
  const id = text(docId)
  if (!id) return null
  const row = data && typeof data === 'object' ? data : {}
  const zone = zoneOrLondon(options?.timeZone)
  const orgDefaults = options?.annualLeaveDefaults
    ? parseAnnualLeaveDefaults(options.annualLeaveDefaults as Record<string, unknown>)
    : { ...DEFAULT_ANNUAL_LEAVE }
  const leaveDefaults: OrgAnnualLeaveDefaults = {
    daysPerYear: Number.isFinite(orgDefaults.daysPerYear) ? orgDefaults.daysPerYear : DEFAULT_ANNUAL_LEAVE.daysPerYear,
    startMonth: wholeMonth(orgDefaults.startMonth) ?? DEFAULT_ANNUAL_LEAVE.startMonth,
    endMonth: wholeMonth(orgDefaults.endMonth) ?? DEFAULT_ANNUAL_LEAVE.endMonth,
    carriesOver: orgDefaults.carriesOver === true,
  }

  const email = text(row.email)
  let firstName = firstText(row, USER_DOCUMENT_KEYS.firstName)
  let surname = firstText(row, USER_DOCUMENT_KEYS.surname)
  const combined = firstText(row, USER_DOCUMENT_KEYS.combinedName)
  if (!firstName && !surname && combined) {
    const parts = splitName(combined)
    firstName = parts.first
    surname = parts.last
  }
  const displayName = `${firstName} ${surname}`.trim() || combined

  const role = normalizeUserRoleToken(row.role)
  const isSuperAdmin = flagIn(row, 'isSuperAdmin') === true
  const adminAccessStored = flagIn(row, 'adminAccess') === true
  const operativeModeStored = flagIn(row, 'operativeMode') === true
  const keepsAdmin = isSuperAdmin || adminAccessStored || role === 'admin'
  const operativeMode = operativeModeStored && !keepsAdmin
  const flag = (key: string, fallback: boolean) => {
    const value = flagIn(row, key)
    return value == null ? fallback : value
  }
  // 1.11.0: the toggles in effect (`effectivePermissions`): an admin's locked toggles read on, `operativeMode` off.
  const permissions = effectivePermissions(row) as Record<UserPermissionField, boolean>

  const hasNoLineManager = flagIn(row, 'hasNoLineManager') === true
  let managers = hasNoLineManager ? [] : idList(row.assignedManagerUserIds)
  if (!hasNoLineManager && managers.length === 0) {
    const legacy = text(row.assignedManagerUserId)
    if (legacy) managers = [legacy]
  }

  const pay = storedPay(row)
  const employmentType = normalizeEmploymentType(text(row.employmentType) || null)
  const transitionRaw = text(row.employmentTypeTransitionFrom)
  const effectiveAtMs = documentInstantMs(row.employmentTypeEffectiveAt)
  const transitionFrom = transitionRaw && effectiveAtMs != null ? normalizeEmploymentType(transitionRaw) : null

  const leaveStored: UserDocumentAnnualLeave = {
    daysPerYear: documentNumber(row.annualLeaveDaysPerYear),
    startMonth: wholeMonth(row.annualLeaveYearStartMonth),
    endMonth: wholeMonth(row.annualLeaveYearEndMonth),
    carriesOver: flagIn(row, 'annualLeaveCarriesOver'),
  }
  const timesheetsStored = flagIn(row, 'timesheetsEnabled')

  return {
    id,
    email,
    emailKey: email.toLowerCase(),
    firstName,
    surname,
    displayName,
    mobileNumber: firstText(row, USER_DOCUMENT_KEYS.mobileNumber) || null,
    organizationId: documentOrganizationId(row.organizationId),
    role: operativeMode ? 'operative' : role,
    isSuperAdmin: operativeMode ? false : isSuperAdmin,
    operativeModeStored,
    operativeMode,
    accountKind: accountKindFromFlags({ isSuperAdmin, role, adminAccess: adminAccessStored, operativeMode }),
    adminOutsideOperativeMode: isAdminOutsideOperativeMode({
      role,
      isSuperAdmin,
      adminAccess: adminAccessStored,
      operativeMode,
    }),
    permissions,
    isActive: documentBool(row.isActive) ?? true,
    passwordSet: flagIn(row, 'passwordSet') ?? true,
    status: optionalText(row.status),
    assignedManagerUserIds: managers,
    assignedManagerUserId: managers[0] ?? null,
    hasNoLineManager,
    formerUserIds: parseFormerUserIds(row),
    payBasis: pay.payBasis,
    dayRate: pay.payBasis === 'day' ? pay.dayRate : null,
    hourlyRate: pay.payBasis === 'hourly' ? pay.hourlyRate : null,
    employmentType,
    employmentTypeTransitionFrom: transitionFrom,
    employmentTypeEffectiveAtMs: transitionFrom ? effectiveAtMs : null,
    employmentTypeEffectiveDayKey: transitionFrom ? dayKeyOf(effectiveAtMs, zone) : null,
    annualLeaveEnabled: flagIn(row, 'annualLeaveEnabled') ?? true,
    annualLeaveDaysPerYear: leaveStored.daysPerYear ?? leaveDefaults.daysPerYear,
    annualLeaveYearStartMonth: leaveStored.startMonth ?? leaveDefaults.startMonth,
    annualLeaveYearEndMonth: leaveStored.endMonth ?? leaveDefaults.endMonth,
    annualLeaveCarriesOver: leaveStored.carriesOver ?? leaveDefaults.carriesOver,
    employmentStartDayKey: /^\d{4}-\d{2}-\d{2}$/.test(text(row.employmentStartDate))
      ? text(row.employmentStartDate)
      : dayKeyOf(documentInstantMs(row.employmentStartDate), zone),
    annualLeaveStored: leaveStored,
    annualLeaveDefaultsPending:
      !options?.annualLeaveDefaults &&
      (leaveStored.daysPerYear == null ||
        leaveStored.startMonth == null ||
        leaveStored.endMonth == null ||
        leaveStored.carriesOver == null),
    annualLeaveYearAllowance: documentNumber(row.annualLeaveYearAllowance),
    annualLeaveYearAllowanceKey: optionalText(row.annualLeaveYearAllowanceKey),
    timesheetsEnabled: timesheetsStored ?? defaultTimesheetsEnabled({ operativeMode, employmentType }),
    timesheetsEnabledStored: timesheetsStored,
    tradeTypePreset: optionalText(row.tradeTypePreset),
    tradeTypeCustom: optionalText(row.tradeTypeCustom),
    profilePhotoURL: firstText(row, USER_DOCUMENT_KEYS.profilePhotoURL) || null,
    profilePhotoUpdatedAtMs: documentInstantMs(row.profilePhotoUpdatedAt),
    lastSeenAtMs: documentInstantMs(row.lastSeenAt),
    policyAccepted: flagIn(row, 'policyAccepted') === true,
    policyAcceptedAtMs: documentInstantMs(row.policyAcceptedAt),
    legalPackVersion: optionalText(row.legalPackVersion),
    createdAtMs: documentInstantMs(row.createdAt),
    updatedAtMs: documentInstantMs(row.updatedAt),
    isAnonymisedDeleted: isAnonymisedDeletedProfile({
      email,
      firstName,
      surname,
      name: text(row.name),
      displayName: text(row.displayName),
    }),
  }
}

// MARK: - Roster rows: operatives/{id}, managers/{id}

export type DocumentQualification = {
  id: string
  name: string
  hasEndDate: boolean
  endDateMs: number | null
  createdAtMs: number | null
  updatedAtMs: number | null
}

export type OperativeDocument = {
  /** The Firestore document id, stored case (a non-UUID id is kept). */
  id: string
  firstName: string
  lastName: string
  name: string
  email: string
  emailKey: string
  phone: string | null
  /** The account this row belongs to, when stored (`linkedUserId` / `userId` / `uid`). */
  linkedUserId: string | null
  /** `startDate`, else `createdAt`, as an organisation-zone day key. Null when neither is readable. */
  startDayKey: string | null
  startDateMs: number | null
  /** Catalogue tokens (ids, else names); a map row gives its id, else its name. */
  skills: string[]
  qualifications: DocumentQualification[]
  qualificationExpiryDates: Record<string, number>
  qualificationCertificateURLs: Record<string, string>
  isActive: boolean
  /** `readStoredRates`: an hourly operative stays hourly. */
  payBasis: PayBasis | null
  dayRate: number | null
  hourlyRate: number | null
  currencySymbol: string | null
  notes: string | null
  tradeTypePreset: string | null
  tradeTypeCustom: string | null
  organizationId: string | null
  createdAtMs: number | null
  updatedAtMs: number | null
  /** Legacy seed rows (`INITIAL-PLACEHOLDER`, "placeholder" / "initial operative" names). Lists skip them. */
  isPlaceholder: boolean
}

export type ManagerDocument = {
  id: string
  firstName: string
  lastName: string
  name: string
  email: string
  emailKey: string
  /** `mobileNumber`, else `mobile`, else `phone`. */
  mobile: string | null
  phone: string | null
  linkedUserId: string | null
  department: string | null
  isActive: boolean
  payBasis: PayBasis | null
  dayRate: number | null
  hourlyRate: number | null
  notes: string | null
  tradeTypePreset: string | null
  tradeTypeCustom: string | null
  organizationId: string | null
  createdAtMs: number | null
  updatedAtMs: number | null
  isPlaceholder: boolean
}

export const ROSTER_DOCUMENT_KEYS = {
  lastName: ['lastName', 'surname'],
  phone: ['phone', 'mobileNumber', 'mobile', 'phoneNumber'],
  mobile: ['mobileNumber', 'mobile', 'phone', 'phoneNumber'],
  linkedUserId: ['linkedUserId', 'userId', 'uid'],
} as const

function rosterNames(row: Record<string, unknown>): { firstName: string; lastName: string; name: string } {
  let firstName = text(row.firstName)
  let lastName = firstText(row, ROSTER_DOCUMENT_KEYS.lastName)
  const stored = text(row.name) || text(row.displayName)
  if (!firstName && !lastName && stored) {
    const parts = splitName(stored)
    firstName = parts.first
    lastName = parts.last
  }
  return { firstName, lastName, name: `${firstName} ${lastName}`.trim() || stored }
}

function isPlaceholderRow(id: string, name: string, email: string): boolean {
  if (id === 'INITIAL-PLACEHOLDER') return true
  const n = name.toLowerCase()
  const e = email.toLowerCase()
  return n.includes('placeholder') || e.includes('placeholder') || n.includes('initial operative')
}

function parseQualifications(raw: unknown): DocumentQualification[] {
  if (!Array.isArray(raw)) return []
  const out: DocumentQualification[] = []
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue
    const row = entry as Record<string, unknown>
    const id = text(row.id)
    const name = text(row.name)
    if (!id || !name) continue
    out.push({
      id,
      name,
      hasEndDate: documentBool(row.hasEndDate) === true,
      endDateMs: documentInstantMs(row.endDate),
      createdAtMs: documentInstantMs(row.createdAt),
      updatedAtMs: documentInstantMs(row.updatedAt),
    })
  }
  return out
}

function parseInstantMap(raw: unknown): Record<string, number> {
  const out: Record<string, number> = {}
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const id = key.trim()
    const ms = documentInstantMs(value)
    if (id && ms != null) out[id] = ms
  }
  return out
}

function parseTextMap(raw: unknown): Record<string, string> {
  const out: Record<string, string> = {}
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const id = key.trim()
    const url = text(value)
    if (id && url) out[id] = url
  }
  return out
}

function parseSkillTokens(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  const out: string[] = []
  const seen = new Set<string>()
  for (const entry of raw) {
    let token = ''
    if (typeof entry === 'string') token = entry.trim()
    else if (entry && typeof entry === 'object') {
      const row = entry as Record<string, unknown>
      token = text(row.id) || text(row.name)
    }
    if (!token || seen.has(token)) continue
    seen.add(token)
    out.push(token)
  }
  return out
}

function rosterPay(row: Record<string, unknown>): { payBasis: PayBasis | null; dayRate: number | null; hourlyRate: number | null } {
  const pay = storedPay(row)
  return {
    payBasis: pay.payBasis,
    dayRate: pay.payBasis === 'day' ? pay.dayRate : null,
    hourlyRate: pay.payBasis === 'hourly' ? pay.hourlyRate : null,
  }
}

/**
 * Read one `organizations/{orgId}/operatives/{id}` row. Null when there is no document id, or the row has no
 * name and no email. A row without a start date or skills is kept (dropping it hid the person's bookings).
 */
export function parseOperativeDocument(
  docId: string,
  data: Record<string, unknown> | null | undefined,
  timeZone?: string | null
): OperativeDocument | null {
  const id = text(docId)
  if (!id) return null
  const row = data && typeof data === 'object' ? data : {}
  const zone = zoneOrLondon(timeZone)
  const names = rosterNames(row)
  const email = text(row.email)
  if (!names.name && !email) return null
  const startDateMs = documentInstantMs(row.startDate) ?? documentInstantMs(row.createdAt)
  const startRaw = text(row.startDate)
  const startDayKey = /^\d{4}-\d{2}-\d{2}$/.test(startRaw) ? startRaw : dayKeyOf(startDateMs, zone)
  return {
    id,
    ...names,
    email,
    emailKey: email.toLowerCase(),
    phone: firstText(row, ROSTER_DOCUMENT_KEYS.phone) || null,
    linkedUserId: firstText(row, ROSTER_DOCUMENT_KEYS.linkedUserId) || null,
    startDayKey,
    startDateMs,
    skills: parseSkillTokens(row.skills),
    qualifications: parseQualifications(row.qualifications),
    qualificationExpiryDates: parseInstantMap(row.qualificationExpiryDates),
    qualificationCertificateURLs: parseTextMap(row.qualificationCertificateURLs),
    isActive: documentBool(row.isActive) ?? true,
    ...rosterPay(row),
    currencySymbol: optionalText(row.currencySymbol),
    notes: optionalText(row.notes),
    tradeTypePreset: optionalText(row.tradeTypePreset),
    tradeTypeCustom: optionalText(row.tradeTypeCustom),
    organizationId: documentOrganizationId(row.organizationId),
    createdAtMs: documentInstantMs(row.createdAt),
    updatedAtMs: documentInstantMs(row.updatedAt),
    isPlaceholder: isPlaceholderRow(id, names.name, email),
  }
}

/** Read one `organizations/{orgId}/managers/{id}` row. Null when there is no document id, or no name and no email. */
export function parseManagerDocument(
  docId: string,
  data: Record<string, unknown> | null | undefined
): ManagerDocument | null {
  const id = text(docId)
  if (!id) return null
  const row = data && typeof data === 'object' ? data : {}
  const names = rosterNames(row)
  const email = text(row.email)
  if (!names.name && !email) return null
  return {
    id,
    ...names,
    email,
    emailKey: email.toLowerCase(),
    mobile: firstText(row, ROSTER_DOCUMENT_KEYS.mobile) || null,
    phone: firstText(row, ROSTER_DOCUMENT_KEYS.phone) || null,
    linkedUserId: firstText(row, ROSTER_DOCUMENT_KEYS.linkedUserId) || null,
    department: optionalText(row.department),
    isActive: documentBool(row.isActive) ?? true,
    ...rosterPay(row),
    notes: optionalText(row.notes),
    tradeTypePreset: optionalText(row.tradeTypePreset),
    tradeTypeCustom: optionalText(row.tradeTypeCustom),
    organizationId: documentOrganizationId(row.organizationId),
    createdAtMs: documentInstantMs(row.createdAt),
    updatedAtMs: documentInstantMs(row.updatedAt),
    isPlaceholder: isPlaceholderRow(id, names.name, email),
  }
}

// MARK: - operativeDayRateHistory

export type PayRateHistoryDocument = {
  /** Document id, stored case. */
  id: string
  /** Stored case; a non-UUID id is kept. */
  userId: string | null
  operativeId: string | null
  /** Amount per day or per hour; null on a "rate cleared" row. */
  dayRate: number | null
  cleared: boolean
  /** null on a cleared row; a missing basis on an old row is day. */
  payBasis: PayBasis | null
  /** Epoch ms; pass as `effectiveAt` / `createdAt` to `payRateOnDay`. */
  effectiveAt: number
  createdAt: number
  effectiveDayKey: string
}

/**
 * Read one `organizations/{orgId}/operativeDayRateHistory/{id}` row (§8). Null when it has no person id, no
 * readable `effectiveAt`, or a `dayRate` that is neither a number (numeric string included) nor an explicit null.
 */
export function parsePayRateHistoryDocument(
  docId: string,
  data: Record<string, unknown> | null | undefined,
  timeZone?: string | null
): PayRateHistoryDocument | null {
  const id = text(docId)
  if (!id) return null
  const row = data && typeof data === 'object' ? data : {}
  const cleared = row.dayRate === null
  const amount = documentNumber(row.dayRate)
  if (!cleared && amount == null) return null
  const effectiveAt = documentInstantMs(row.effectiveAt)
  if (effectiveAt == null) return null
  const userId = text(row.userId) || null
  const operativeId = text(row.operativeId) || null
  if (!userId && !operativeId) return null
  const basis = text(row.payBasis).toLowerCase()
  return {
    id,
    userId,
    operativeId,
    dayRate: cleared ? null : amount,
    cleared,
    payBasis: cleared ? null : basis === 'hourly' ? 'hourly' : 'day',
    effectiveAt,
    createdAt: documentInstantMs(row.createdAt) ?? effectiveAt,
    effectiveDayKey: dayKeyInZone(new Date(effectiveAt), zoneOrLondon(timeZone)),
  }
}

/** `parsePayRateHistoryDocument` over `{ id, data }` rows, unreadable rows dropped, sorted by effectiveAt then createdAt. */
export function parsePayRateHistoryDocuments(
  docs: ReadonlyArray<{ id: string; data: Record<string, unknown> | null | undefined }>,
  timeZone?: string | null
): PayRateHistoryDocument[] {
  const out: PayRateHistoryDocument[] = []
  for (const entry of docs || []) {
    const parsed = parsePayRateHistoryDocument(entry?.id, entry?.data, timeZone)
    if (parsed) out.push(parsed)
  }
  return out.sort((a, b) => a.effectiveAt - b.effectiveAt || a.createdAt - b.createdAt)
}

// MARK: - clients, subcontractors, skills

export type ClientDocument = {
  /** Document id, stored case (a non-UUID id is kept; a stored `id` field never replaces it). */
  id: string
  name: string
  contactPerson: string | null
  email: string | null
  phone: string | null
  address: string | null
  organizationId: string | null
  createdAtMs: number | null
  updatedAtMs: number | null
}

/** Read one `organizations/{orgId}/clients/{id}`. Null without a document id or a name. */
export function parseClientDocument(docId: string, data: Record<string, unknown> | null | undefined): ClientDocument | null {
  const id = text(docId)
  if (!id) return null
  const row = data && typeof data === 'object' ? data : {}
  const name = text(row.name)
  if (!name) return null
  return {
    id,
    name,
    contactPerson: optionalText(row.contactPerson),
    email: optionalText(row.email),
    phone: optionalText(row.phone),
    address: optionalText(row.address),
    organizationId: documentOrganizationId(row.organizationId),
    createdAtMs: documentInstantMs(row.createdAt),
    updatedAtMs: documentInstantMs(row.updatedAt),
  }
}

export type SubcontractorContactDocument = {
  /** Stored id (stored case), else `subcontractorContactId` (1.8.0). */
  id: string
  /** False when the id was derived (not stored yet); the next save writes it onto the contact. */
  idStored: boolean
  name: string
  email: string
  contactNumber: string
  /** Missing → "Installer". */
  position: string
  tradeType: string | null
  createdAtMs: number | null
}

export type SubcontractorDocument = {
  id: string
  name: string
  subcontractorType: string
  website: string | null
  address: string | null
  contacts: SubcontractorContactDocument[]
  createdAtMs: number | null
  updatedAtMs: number | null
}

/**
 * The id of a subcontractor contact stored without one (1.8.0): `derivedRowId` of the firm's document id, `contacts`,
 * the contact's position and its name and email — the same on every platform and read (iOS used
 * `{firmId}#contact-{index}`, web an empty id, so `bookedContactIds` never matched it).
 */
export function subcontractorContactId(firmDocId: unknown, index: number, contact: Record<string, unknown> | null | undefined): string {
  const row = contact && typeof contact === 'object' ? contact : {}
  return derivedRowId(firmDocId, 'contacts', index, [text(row.name), text(row.email).toLowerCase()])
}

/** Read one `organizations/{orgId}/subcontractors/{id}`. Null without a document id, a name or a type. */
export function parseSubcontractorDocument(
  docId: string,
  data: Record<string, unknown> | null | undefined
): SubcontractorDocument | null {
  const id = text(docId)
  if (!id) return null
  const row = data && typeof data === 'object' ? data : {}
  const name = text(row.name)
  const subcontractorType = text(row.subcontractorType)
  if (!name || !subcontractorType) return null
  const contacts: SubcontractorContactDocument[] = []
  if (Array.isArray(row.contacts)) {
    for (const [index, entry] of row.contacts.entries()) {
      if (!entry || typeof entry !== 'object') continue
      const contact = entry as Record<string, unknown>
      const contactName = text(contact.name)
      if (!contactName) continue
      const storedContactId = text(contact.id) || text(contact.uuid) || text(contact.contactId)
      contacts.push({
        id: storedContactId || subcontractorContactId(id, index, contact),
        idStored: Boolean(storedContactId),
        name: contactName,
        email: text(contact.email),
        contactNumber: text(contact.contactNumber),
        position: text(contact.position) || 'Installer',
        tradeType: optionalText(contact.tradeType),
        createdAtMs: documentInstantMs(contact.createdAt),
      })
    }
  }
  const createdAtMs = documentInstantMs(row.createdAt)
  return {
    id,
    name,
    subcontractorType,
    website: optionalText(row.website),
    address: optionalText(row.address),
    contacts,
    createdAtMs,
    updatedAtMs: documentInstantMs(row.updatedAt) ?? createdAtMs,
  }
}

export type SkillDocument = {
  id: string
  name: string
  /** Stored trade, '' when missing (web reading; iOS showed "General" — see the 1.6.0 changelog). */
  trade: string
  createdAtMs: number | null
  updatedAtMs: number | null
}

/** Read one `organizations/{orgId}/skills/{id}`. Null without a document id or a name. */
export function parseSkillDocument(docId: string, data: Record<string, unknown> | null | undefined): SkillDocument | null {
  const id = text(docId)
  if (!id) return null
  const row = data && typeof data === 'object' ? data : {}
  const name = text(row.name)
  if (!name) return null
  const createdAtMs = documentInstantMs(row.createdAt)
  return {
    id,
    name,
    trade: text(row.trade),
    createdAtMs,
    updatedAtMs: documentInstantMs(row.updatedAt) ?? createdAtMs,
  }
}

/**
 * Saving the skills catalogue: which documents to write and which to delete. A skill missing from the screen
 * list is deleted only when the list on screen came from a successful load (`loaded: true`) and is not empty;
 * an empty or failed load never deletes the catalogue (remove skills one at a time to empty it). Each skill is a
 * partial write of the name / trade that changed; an unchanged skill is not written.
 */
export function skillsCatalogueWrites(input: {
  stored: ReadonlyArray<{ id: string; name?: unknown; trade?: unknown }>
  next: ReadonlyArray<{ id: string; name: string; trade?: string | null }>
  loaded: boolean
}): { write: Array<{ id: string; set: Record<string, unknown> }>; remove: string[] } {
  const storedById = new Map<string, { name?: unknown; trade?: unknown }>()
  for (const row of input.stored || []) if (text(row?.id)) storedById.set(text(row.id), row)
  const nextIds = new Set<string>()
  const write: Array<{ id: string; set: Record<string, unknown> }> = []
  for (const skill of input.next || []) {
    const id = text(skill?.id)
    const name = text(skill?.name)
    if (!id || !name) continue
    nextIds.add(id)
    const trade = text(skill.trade)
    const before = storedById.get(id)
    const set: Record<string, unknown> = {}
    if (!before || text(before.name) !== name) set.name = name
    if (!before ? Boolean(trade) : text(before.trade) !== trade) set.trade = trade
    if (Object.keys(set).length > 0) write.push({ id, set })
  }
  const remove =
    input.loaded && nextIds.size > 0 ? [...storedById.keys()].filter((id) => !nextIds.has(id)) : []
  return { write, remove }
}

// MARK: - Partial writes

/** A comparable key for a stored or about-to-be-written value: instants by milliseconds, maps by sorted keys. */
export function documentValueKey(value: unknown): string {
  if (value === undefined) return 'undefined'
  if (value === null) return 'null'
  if (value instanceof Date) return `ts:${value.getTime()}`
  if (Array.isArray(value)) return `[${value.map(documentValueKey).join(',')}]`
  if (typeof value === 'object') {
    const row = value as Record<string, unknown>
    const looksLikeInstant =
      typeof row.seconds === 'number' ||
      typeof row._seconds === 'number' ||
      typeof (row as { toMillis?: unknown }).toMillis === 'function' ||
      typeof (row as { toDate?: unknown }).toDate === 'function'
    if (looksLikeInstant) {
      const ms = documentInstantMs(value)
      if (ms != null) return `ts:${ms}`
    }
    return `{${Object.keys(row)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${documentValueKey(row[key])}`)
      .join(',')}}`
  }
  return JSON.stringify(value) ?? String(value)
}

/** The four per-user leave figures and the `UserDocumentAnnualLeave` key each is stored under. */
export const USER_ANNUAL_LEAVE_FIGURE_FIELDS: ReadonlyArray<readonly [string, keyof UserDocumentAnnualLeave]> = [
  ['annualLeaveDaysPerYear', 'daysPerYear'],
  ['annualLeaveYearStartMonth', 'startMonth'],
  ['annualLeaveYearEndMonth', 'endMonth'],
  ['annualLeaveCarriesOver', 'carriesOver'],
]

/**
 * 1.9.0: the `users/{uid}` fields a save must leave out while `annualLeaveDefaultsPending` (the organisation's
 * `annualLeaveDefaults` had not loaded when the user was parsed): each leave figure the user document does not store
 * itself, so the factory 25 / 1 / 12 / false is never written onto the user. A figure the user stores, or one the
 * editor changed on purpose (`edited`), is not omitted. Empty when the defaults are not pending. Accepts a parsed
 * `UserDocument` (or just its `annualLeaveDefaultsPending` / `annualLeaveStored`).
 */
export function annualLeavePendingOmitFields(
  user: Pick<UserDocument, 'annualLeaveDefaultsPending' | 'annualLeaveStored'> | null | undefined,
  edited?: ReadonlyArray<string> | null
): string[] {
  if (!user?.annualLeaveDefaultsPending) return []
  const changed = new Set(edited || [])
  const stored = user.annualLeaveStored || ({} as Partial<UserDocumentAnnualLeave>)
  return USER_ANNUAL_LEAVE_FIGURE_FIELDS.filter(([field, key]) => stored[key] == null && !changed.has(field)).map(
    ([field]) => field
  )
}

export type DocumentWriteFields = {
  /** Fields to write, with the values passed in `next`. */
  set: Record<string, unknown>
  /** Fields to delete (each had a value in `before`). */
  remove: string[]
}

export type DocumentWriteOptions = {
  /** Fields written as a group when any one of them changes. */
  together?: ReadonlyArray<ReadonlyArray<string>>
  /** Fields never written on an update (only on create), e.g. createdAt, organizationId, id. */
  createOnly?: ReadonlyArray<string>
}

function hasValue(row: Record<string, unknown> | null | undefined, key: string): boolean {
  return Boolean(row) && row![key] !== undefined && row![key] !== null
}

/** See the file header. Never throws. */
export function documentWriteFields(
  before: Record<string, unknown> | null | undefined,
  next: Record<string, unknown>,
  options?: DocumentWriteOptions | null
): DocumentWriteFields {
  const set: Record<string, unknown> = {}
  const remove: string[] = []
  const source = next && typeof next === 'object' ? next : {}
  if (!before) {
    for (const [key, value] of Object.entries(source)) {
      if (value !== undefined && value !== null) set[key] = value
    }
    return { set, remove }
  }
  const createOnly = new Set(options?.createOnly || [])
  const changed = new Set<string>()
  for (const [key, value] of Object.entries(source)) {
    if (value === undefined || createOnly.has(key)) continue
    if (value === null) {
      if (hasValue(before, key)) changed.add(key)
      continue
    }
    if (documentValueKey(value) !== documentValueKey(before[key])) changed.add(key)
  }
  for (const group of options?.together || []) {
    if (!group.some((key) => changed.has(key))) continue
    for (const key of group) {
      if (createOnly.has(key) || source[key] === undefined) continue
      if (source[key] === null) {
        if (hasValue(before, key)) changed.add(key)
      } else changed.add(key)
    }
  }
  for (const key of Object.keys(source)) {
    if (!changed.has(key)) continue
    if (source[key] === null) remove.push(key)
    else set[key] = source[key]
  }
  return { set, remove }
}

/** Line manager ids and `hasNoLineManager` are one choice (§8): written together. */
export const LINE_MANAGER_WRITE_GROUP = ['assignedManagerUserIds', 'assignedManagerUserId', 'hasNoLineManager'] as const
/** One basis and its amount; the other amount is removed (§8). */
export const PAY_WRITE_GROUP = ['payBasis', 'dayRate', 'hourlyRate'] as const
export const EMPLOYMENT_WRITE_GROUP = ['employmentType', 'employmentTypeTransitionFrom', 'employmentTypeEffectiveAt'] as const
export const USER_NAME_WRITE_GROUP = ['firstName', 'surname', 'lastName', 'name', 'displayName'] as const
export const ROSTER_NAME_WRITE_GROUP = ['firstName', 'lastName', 'name'] as const
const CREATE_ONLY_FIELDS = ['id', 'createdAt', 'organizationId'] as const

/**
 * Partial update of `users/{uid}` (§1, §8, §11): `before` is the stored document (or the copy the editor
 * loaded), `next` the fields the save would write. Line manager ids with `hasNoLineManager`, pay basis with
 * both rates, employment type with its transition, and the name fields are each written as a group.
 * `createdAt` and `organizationId` are never rewritten.
 */
export function userProfileWriteFields(
  before: Record<string, unknown> | null | undefined,
  next: Record<string, unknown>
): DocumentWriteFields {
  // 1.11.0: an admin's locked permission toggles are never written (`keepStoredLockedPermissions`).
  return documentWriteFields(before, keepStoredLockedPermissions(before, next), {
    together: [LINE_MANAGER_WRITE_GROUP, PAY_WRITE_GROUP, EMPLOYMENT_WRITE_GROUP, USER_NAME_WRITE_GROUP],
    createOnly: ['createdAt', 'organizationId'],
  })
}

/** Partial update of `operatives/{id}` (§1). Pay basis with both rates and the name fields are groups. */
export function operativeRowWriteFields(
  before: Record<string, unknown> | null | undefined,
  next: Record<string, unknown>
): DocumentWriteFields {
  return documentWriteFields(before, next, {
    together: [PAY_WRITE_GROUP, ROSTER_NAME_WRITE_GROUP],
    createOnly: CREATE_ONLY_FIELDS,
  })
}

/** Partial update of `managers/{id}` (§1). Pay basis with both rates and the name fields are groups. */
export function managerRowWriteFields(
  before: Record<string, unknown> | null | undefined,
  next: Record<string, unknown>
): DocumentWriteFields {
  return documentWriteFields(before, next, {
    together: [PAY_WRITE_GROUP, ROSTER_NAME_WRITE_GROUP],
    createOnly: CREATE_ONLY_FIELDS,
  })
}

/** Partial update of `clients/{id}` (§1). */
export function clientWriteFields(
  before: Record<string, unknown> | null | undefined,
  next: Record<string, unknown>
): DocumentWriteFields {
  return documentWriteFields(before, next, { createOnly: CREATE_ONLY_FIELDS })
}

/** Partial update of `subcontractors/{id}` (§1). The contacts list is one field, written whole when it changes. */
export function subcontractorWriteFields(
  before: Record<string, unknown> | null | undefined,
  next: Record<string, unknown>
): DocumentWriteFields {
  return documentWriteFields(before, next, { createOnly: CREATE_ONLY_FIELDS })
}

// MARK: - Who takes part in timesheets (1.10.0 M6 / M12; 1.11.0 PAYE has no timesheet)

/** A person as the timesheet rules read them. */
export type TimesheetPerson = {
  isActive?: boolean | null
  email?: string | null
  name?: string | null
  employmentType?: string | null
  employmentTypeTransitionFrom?: string | null
  /** A Date, an ISO string, epoch ms or a Firestore Timestamp-like value. */
  employmentTypeEffectiveAt?: unknown
  /** Ignored from 1.11.0: a PAYE person has no timesheet whatever it says. Kept on the type for older callers. */
  timesheetsEnabled?: boolean | null
  operativeMode?: boolean | null
  permissions?: { operativeMode?: boolean | null } | null
}

/** A timesheet period as organisation-zone day keys, both ends included (`TimesheetPeriodIdentity`). */
export type TimesheetPeriodDays = { startDayKey: string; endDayKey: string }

const DAY_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/

function timesheetEmploymentOnDayKey(user: TimesheetPerson, dayKey: string, zone: string): EmploymentType {
  const current = normalizeEmploymentType(text(user.employmentType) || null)
  const from = text(user.employmentTypeTransitionFrom)
  const effectiveMs = documentInstantMs(user.employmentTypeEffectiveAt)
  if (!from || effectiveMs == null) return current
  return dayKey < dayKeyInZone(new Date(effectiveMs), zone) ? normalizeEmploymentType(from) : current
}

/**
 * The days of `period` that count on this person's timesheet (rulebook §8, 1.11.0, owner decisions round 3): every
 * organisation-zone day key from `startDayKey` to `endDayKey` on which the person is self-employed
 * (`employmentTypeOnDay`, effective-dated). A PAYE day never counts: it produces no timesheet line, no pay and no
 * invoice row (it is still a booking for warnings, Daily Overview and Weekly Report hours). Empty for an inactive
 * person, an anonymised deleted profile, or a period that is not two day keys in order.
 */
export function timesheetDaysForPerson(
  user: TimesheetPerson | null | undefined,
  period: TimesheetPeriodDays | null | undefined,
  timeZone?: string | null
): string[] {
  if (!user || user.isActive === false) return []
  if (isAnonymisedDeletedProfile({ email: user.email ?? '', name: user.name ?? '' })) return []
  const start = text(period?.startDayKey)
  const end = text(period?.endDayKey)
  if (!DAY_KEY_PATTERN.test(start) || !DAY_KEY_PATTERN.test(end) || start > end) return []
  const zone = zoneOrLondon(timeZone)
  return eachDayKey(start, end, zone).filter((day) => timesheetEmploymentOnDayKey(user, day, zone) === 'self_employed')
}

/**
 * Whether the person has a My Timesheets sheet for `period` (rulebook §8, 1.11.0): only when they are self-employed on
 * at least one day of it (`timesheetDaysForPerson` not empty). A PAYE person never sees My Timesheets, gets no
 * timesheet reminder, no own sheet and no invoice. Reviewing other people's sheets (User Timesheets) does not depend
 * on this.
 */
export function showsMyTimesheets(
  user: TimesheetPerson | null | undefined,
  period: TimesheetPeriodDays | null | undefined,
  timeZone?: string | null
): boolean {
  return timesheetDaysForPerson(user, period, timeZone).length > 0
}

/**
 * Whether a person takes part in timesheets (rulebook §8): the Weekly Report timesheet feed, the
 * `timesheet_submission_reminder` recipients, User Timesheets rows and the My Timesheets hub on every platform.
 * Given a period (`{ startDayKey, endDayKey }`) it is `showsMyTimesheets`; given a day, self-employed on that day.
 * Inactive people and anonymised deleted profiles never take part. 1.11.0: `timesheetsEnabled` and operative mode no
 * longer bring a PAYE person in — the PAYE timesheet path is removed (owner decisions round 3).
 */
export function timesheetParticipant(
  user: TimesheetPerson | null | undefined,
  dayOrPeriod: Date | string | number | TimesheetPeriodDays,
  timeZone?: string | null
): boolean {
  if (!user) return false
  const zone = zoneOrLondon(timeZone)
  if (dayOrPeriod && typeof dayOrPeriod === 'object' && !(dayOrPeriod instanceof Date)) {
    return showsMyTimesheets(user, dayOrPeriod, zone)
  }
  const when = dayOrPeriod instanceof Date ? dayOrPeriod : new Date(dayOrPeriod as string | number)
  if (Number.isNaN(when.getTime())) return false
  const key = dayKeyInZone(when, zone)
  return showsMyTimesheets(user, { startDayKey: key, endDayKey: key }, zone)
}
