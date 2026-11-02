/**
 * Create shapes for the documents both apps create whole (rulebook §1, 1.9.0): an invitation, a new organisation,
 * and `users/{uid}/private/taxIds`. Before 1.9.0 each app built these itself (iOS with whole-document `setData`, web
 * with its own maps), so the fields differed and a re-save could overwrite what the other app wrote.
 *
 * Each function returns the fields to write once, at create. Later changes are partial updates (the invitation's
 * `invitationUsedWriteFields`, the organisation's settings writers, `sensitiveProfileWriteFields` for tax ids).
 * Instants pass through as given (each app adds its SDK timestamp). Pure, never throw.
 */

import { readStoredRates } from './payRate'
import { sensitiveProfileWriteFields } from './sensitiveProfile'

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function idList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  const out: string[] = []
  for (const entry of value) {
    const id = text(entry)
    if (!id || seen.has(id.toLowerCase())) continue
    seen.add(id.toLowerCase())
    out.push(id)
  }
  return out
}

function finite(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

// MARK: - invitations/{id}

export type InvitationCreateInput = {
  email: unknown
  organizationId: unknown
  invitedBy: unknown
  firstName: unknown
  surname: unknown
  /** `paye` or anything else → `self_employed`. */
  employmentType?: unknown
  /** The permissions map exactly as written on `users/{uid}.permissions`. */
  permissions: Record<string, unknown>
  createdAt: unknown
  mobileNumber?: unknown
  assignedManagerUserIds?: unknown
  assignedManagerUserId?: unknown
  hasNoLineManager?: boolean | null
  payBasis?: unknown
  dayRate?: unknown
  hourlyRate?: unknown
  tradeTypePreset?: unknown
  tradeTypeCustom?: unknown
  timesheetsEnabled?: boolean | null
  annualLeaveEnabled?: boolean | null
  annualLeaveDaysPerYear?: unknown
  annualLeaveYearStartMonth?: unknown
  annualLeaveYearEndMonth?: unknown
  annualLeaveCarriesOver?: boolean | null
  annualLeaveYearAllowance?: unknown
  annualLeaveYearAllowanceKey?: unknown
}

/**
 * A new `invitations/{id}` document (§11, 1.9.0). Always: `email` (lower case), `organizationId`, `invitedBy`,
 * `firstName`, `surname`, `employmentType` (`paye` | `self_employed`), `permissions`, `inviteType: 'new_user'`,
 * `createdAt`, `isUsed: false`. When given: `mobileNumber`; the line manager (`hasNoLineManager: true`, or
 * `assignedManagerUserIds` with `assignedManagerUserId` = the first and `hasNoLineManager: false`); one pay basis with
 * its amount (`readStoredRates`); `tradeTypePreset` / `tradeTypeCustom`; `timesheetsEnabled` for a manager or an
 * operative; the leave figures. Never UTR or VAT number (the invitation is readable by link; tax ids go to
 * `users/{uid}/private/taxIds`). Null without an email or organisation. Written once (a create), never merged over.
 */
export function invitationCreateFields(input: InvitationCreateInput): Record<string, unknown> | null {
  const email = text(input?.email).toLowerCase()
  const organizationId = text(input?.organizationId)
  if (!email || !organizationId) return null
  const permissions = input.permissions && typeof input.permissions === 'object' ? { ...input.permissions } : {}
  const out: Record<string, unknown> = {
    email,
    organizationId,
    invitedBy: text(input.invitedBy),
    firstName: text(input.firstName),
    surname: text(input.surname),
    employmentType: text(input.employmentType) === 'paye' ? 'paye' : 'self_employed',
    permissions,
    inviteType: 'new_user',
    createdAt: input.createdAt,
    isUsed: false,
  }
  const mobile = text(input.mobileNumber)
  if (mobile) out.mobileNumber = mobile
  let managers = idList(input.assignedManagerUserIds)
  if (managers.length === 0 && text(input.assignedManagerUserId)) managers = [text(input.assignedManagerUserId)]
  if (input.hasNoLineManager === true) {
    out.hasNoLineManager = true
  } else if (managers.length > 0) {
    out.assignedManagerUserIds = managers
    out.assignedManagerUserId = managers[0]
    out.hasNoLineManager = false
  }
  const rates = readStoredRates({
    payBasis: input.payBasis as never,
    dayRate: input.dayRate as never,
    hourlyRate: input.hourlyRate as never,
  })
  if (rates.payBasis === 'hourly' && rates.hourlyRate != null) {
    out.payBasis = 'hourly'
    out.hourlyRate = rates.hourlyRate
  } else if (rates.payBasis === 'day' && rates.dayRate != null) {
    out.payBasis = 'day'
    out.dayRate = rates.dayRate
  }
  if (text(input.tradeTypePreset)) out.tradeTypePreset = text(input.tradeTypePreset)
  if (text(input.tradeTypeCustom)) out.tradeTypeCustom = text(input.tradeTypeCustom)
  if (permissions.manager === true || permissions.operativeMode === true) {
    out.timesheetsEnabled = input.timesheetsEnabled === true
  }
  if (typeof input.annualLeaveEnabled === 'boolean') out.annualLeaveEnabled = input.annualLeaveEnabled
  const days = finite(input.annualLeaveDaysPerYear)
  if (days != null) out.annualLeaveDaysPerYear = days
  const start = finite(input.annualLeaveYearStartMonth)
  if (start != null) out.annualLeaveYearStartMonth = start
  const end = finite(input.annualLeaveYearEndMonth)
  if (end != null) out.annualLeaveYearEndMonth = end
  if (typeof input.annualLeaveCarriesOver === 'boolean') out.annualLeaveCarriesOver = input.annualLeaveCarriesOver
  const allowance = finite(input.annualLeaveYearAllowance)
  if (allowance != null) out.annualLeaveYearAllowance = allowance
  if (text(input.annualLeaveYearAllowanceKey)) out.annualLeaveYearAllowanceKey = text(input.annualLeaveYearAllowanceKey)
  return out
}

/** Marking an invitation used: `{ isUsed: true, usedAt }` as a partial update, never a rewrite of the invitation. */
export function invitationUsedWriteFields(usedAt: unknown): { set: { isUsed: true; usedAt: unknown } } {
  return { set: { isUsed: true, usedAt } }
}

// MARK: - organizations/{orgId}

export type OrganizationCreateInput = {
  name: unknown
  creatorUserId: unknown
  /** `month` | `year`. */
  planKey?: unknown
  createdAt: unknown
  /** Defaults to `createdAt` (a resumed pending organisation keeps its first `createdAt`). */
  updatedAt?: unknown
  /** Top-level setup fields (company details, payroll policy, warning detection, invoicing, leave defaults…). */
  setupFields?: Record<string, unknown> | null
  /** The nested `settings` map from guided setup. */
  settings?: Record<string, unknown> | null
}

/**
 * A new `organizations/{orgId}` document (§14, §16, 1.9.0): `name`, `creatorUserId`, `members: { [creator]: 'admin' }`,
 * `settings` (the setup map, or `{}`), `subscription { status: 'pending', planKey, createdAt }`, `billing { status:
 * 'pending', billingInterval, trialUsed: false, mrrPence: 0, updatedAt }` (written at create only — afterwards billing
 * is never written by an app), `teamOnboarding { status: 'pending_add_users', addUsersGuideShown: false }`,
 * `createdAt`, `updatedAt`, then the setup fields (which never override `members`, `creatorUserId`, `subscription`
 * or `billing`). Null without a name or creator. Written once; every later change is a partial update.
 */
export function organizationCreateFields(input: OrganizationCreateInput): Record<string, unknown> | null {
  const name = text(input?.name)
  const creatorUserId = text(input?.creatorUserId)
  if (!name || !creatorUserId) return null
  const planKey = text(input.planKey) === 'year' ? 'year' : 'month'
  const protectedKeys = new Set(['members', 'creatorUserId', 'subscription', 'billing', 'settings', 'name'])
  const setup: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(input.setupFields || {})) {
    if (value !== undefined && !protectedKeys.has(key)) setup[key] = value
  }
  return {
    name,
    members: { [creatorUserId]: 'admin' },
    settings: input.settings && typeof input.settings === 'object' ? { ...input.settings } : {},
    subscription: { status: 'pending', planKey: text(input.planKey) || planKey, createdAt: input.createdAt },
    billing: {
      status: 'pending',
      billingInterval: planKey,
      trialUsed: false,
      mrrPence: 0,
      updatedAt: input.updatedAt ?? input.createdAt,
    },
    teamOnboarding: { status: 'pending_add_users', addUsersGuideShown: false },
    createdAt: input.createdAt,
    updatedAt: input.updatedAt ?? input.createdAt,
    ...setup,
    creatorUserId,
  }
}

// MARK: - users/{uid}/private/taxIds

/**
 * The whole `users/{uid}/private/taxIds` document (§12, 1.9.0): `{ utrNumber, vatNumber, updatedByUserId }` from
 * `sensitiveProfileWriteFields` (blank clears; 20 characters at most). These are the document's only fields, so it
 * is written whole (a set without merge) with the app's `updatedAt`; nothing else is stored there. Null when the
 * input is refused (no signed-in user, or a value too long).
 */
export function taxIdsDocumentFields(input: {
  utrNumber?: string | null
  vatNumber?: string | null
  updatedByUserId: string
}): { utrNumber: string; vatNumber: string; updatedByUserId: string } | null {
  const result = sensitiveProfileWriteFields(input)
  return result.ok ? result.fields : null
}
