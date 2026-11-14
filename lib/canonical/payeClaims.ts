/**
 * PAYE price work and expenses (rulebook §26, 1.30.0, owner decisions 4 Nov; spec "PAYE overtime, price work and
 * expenses", sections "Price work & expenses", "Who sees what", "Firebase data", "Security rules").
 *
 * A PAYE person records price work and expenses under Timesheets → Overtime, Expenses & Price Work → My …. Each has the
 * same three range buttons as Overtime (Current PAYE payrun / Past PAYE payruns / Custom date range, the payruns of
 * `payePayrun.ts`) plus Add. There is no line-manager approval: the person generates a report (PDF) and sends it to
 * payroll themselves; accounts approve on their side. Their line managers (for their reports) and admins (everyone) see
 * the items read-only under Users' …. A self-employed person's price work and expenses stay on their timesheet (§8);
 * Users' shows those timesheet entries read-only (`timesheetClaimRows`).
 *
 *   - Price work (`priceWorkItems/{id}`): name, description, dates from–to (one day allowed), the approver — required,
 *     picked from the active admins and managers (`priceWorkApproverCandidates`: never an operative, never the person,
 *     no free text; the approver is not notified) — the figure in the organisation currency and optional evidence.
 *   - Expenses (`expenseItems/{id}`): the fields of a timesheet expense entry (name, description, job number, date,
 *     amount) and at least one piece of evidence (`EXPENSE_EVIDENCE_REQUIRED_MESSAGE`); more are allowed.
 *   - Evidence is a file or photo the person uploads, or a frozen PDF copy of one of their personal site audits
 *     (`personalSiteAudits.ts`), stored under the person's own claim folder (`payeClaimEvidencePath`) — so their line
 *     managers and admins can see the copy without ever seeing the private audit list.
 *   - Reports: Generate price work report / Generate expenses report is enabled once one item is in the range
 *     (`payeClaimReportReady`). It saves a copy (`payeClaimReportSnapshot` → `payeClaimReports/{id}`, written once and
 *     never changed) and the PDF is built from that copy: a summary page (company, person, every item, the total) and,
 *     for expenses and price work with evidence, one page per piece of evidence (`payeClaimReportRows`,
 *     `payeClaimEvidencePages`).
 *
 * Money is the organisation currency (`resolveOrganizationCurrency`, shown with `formatMoney`). Dates are
 * organisation-zone day keys. Online only.
 */

import { dayKeyInZone } from '../orgTime/zoneTime'
import { zoneOrLondon } from './dayKeys'
import { isAdminOutsideOperativeMode, lineManagerIds, type LeaveSelfBookUser } from './leaveRequests'
import { lineManagerCandidates, type LineManagerCandidate, type LineManagerRosterPerson, type LineManagerSubject } from './lineManagers'
import { formatMoney, normalizeCurrencyCode } from './money'
import { formatPaymentRunDay } from './paymentRuns'
import { documentInstantMs } from './peopleDocuments'
import { idKey, idText, personIdSet, rosterMemberActive } from './personIds'
import { fileDeletePermission, storedFileKind, storedFileObjectName } from './storedFiles'
import type { NotificationRosterMember } from './notificationRecipients'
import { priceWorkJobNumberError, priceWorkJobNumberText, PRICE_WORK_JOB_NUMBER_MAX } from './priceWorkJobNumber'
import type { TimesheetEntriesDocument } from './workDocumentReaders'
import { reportGeneratedText } from './reportHeader'

// MARK: - Constants and copy

export const PRICE_WORK_ITEMS_COLLECTION = 'priceWorkItems'
export const EXPENSE_ITEMS_COLLECTION = 'expenseItems'
export const PAYE_CLAIM_REPORTS_COLLECTION = 'payeClaimReports'
/** Storage folder of claim evidence: `organizations/{orgId}/payeClaims/{userId}/{uid}_{ms}.{ext}`. */
export const PAYE_CLAIM_EVIDENCE_FOLDER = 'payeClaims'

export type PayeClaimKind = 'priceWork' | 'expense'
export const PAYE_CLAIM_KINDS: ReadonlyArray<PayeClaimKind> = ['priceWork', 'expense']

export const PRICE_WORK_ADD_LABEL = 'Add Price Work'
export const EXPENSE_ADD_LABEL = 'Add Expense'
export const PRICE_WORK_GENERATE_REPORT_LABEL = 'Generate price work report'
export const EXPENSES_GENERATE_REPORT_LABEL = 'Generate expenses report'
export const PRICE_WORK_REPORT_TITLE = 'Price work report'
export const EXPENSES_REPORT_TITLE = 'Expenses report'
export const PRICE_WORK_TOTAL_LABEL = 'Total price work'
export const EXPENSES_TOTAL_LABEL = 'Total expenses'
export const PRICE_WORK_EMPTY_MESSAGE = 'No price work in this range.'
export const EXPENSES_EMPTY_MESSAGE = 'No expenses in this range.'

export const PAYE_CLAIM_TITLE_MESSAGE = 'Enter a name.'
export const PAYE_CLAIM_AMOUNT_MESSAGE = 'Enter an amount greater than zero.'
export const PAYE_CLAIM_DATE_MESSAGE = 'Choose a date.'
export const PRICE_WORK_DATES_MESSAGE = 'Choose the dates from and to (the same day is allowed).'
export const PRICE_WORK_APPROVER_REQUIRED_MESSAGE = 'Choose who approved this price work.'
export const PRICE_WORK_APPROVER_INVALID_MESSAGE = 'Choose an active admin or manager other than yourself.'
export const EXPENSE_EVIDENCE_REQUIRED_MESSAGE = 'Add at least one piece of evidence (a file, photo or personal site audit).'
export const PAYE_CLAIM_EVIDENCE_LIMIT_MESSAGE = 'Up to 20 pieces of evidence.'
export const PAYE_CLAIM_EVIDENCE_INVALID_MESSAGE = 'Evidence must be uploaded to your own claim folder.'
export const PAYE_CLAIM_APPROVER_NOT_NOTIFIED_NOTE = 'They are not notified; the report names them.'
/** A piece of evidence the PDF cannot draw (not a JPEG, PNG or PDF), listed with this note instead. */
export const PAYE_CLAIM_EVIDENCE_NOT_DRAWN_NOTE = 'This file type cannot be shown in the PDF. Open it in the app.'
export const PAYE_CLAIM_EVIDENCE_UNREADABLE_NOTE = 'This file could not be read when the report was made. Open it in the app.'

export const PAYE_CLAIM_EVIDENCE_MAX = 20
export const PAYE_CLAIM_TITLE_MAX = 200
export const PAYE_CLAIM_DETAILS_MAX = 4000
/** The largest figure a claim may carry (sanity bound; rules hold the same). */
export const PAYE_CLAIM_AMOUNT_MAX = 1_000_000

export type PayeClaimEvidenceKind = 'file' | 'photo' | 'personalSiteAudit'
export const PAYE_CLAIM_EVIDENCE_KINDS: ReadonlyArray<PayeClaimEvidenceKind> = ['file', 'photo', 'personalSiteAudit']

/** One piece of evidence: the Storage path in the person's claim folder, a display name and its kind. */
export type PayeClaimEvidence = {
  path: string
  name: string
  kind: PayeClaimEvidenceKind
  /** MIME type as uploaded (`image/jpeg`, `application/pdf`, …); empty when unknown. */
  contentType: string
  /** For a personal site audit copy: the audit it was frozen from (the copy never changes after). */
  auditId: string | null
}

export type PayeClaimBase = {
  id: string
  userId: string
  title: string
  details: string
  amount: number
  currency: string
  evidence: PayeClaimEvidence[]
  createdAtMs: number | null
  createdBy: string
  /**
   * 1.33.0: the person's current users id (`payeClaimPersonFields`): written on create (= the creator) and by
   * `scripts/backfill-paye-claim-person-user-id.mjs` on older items, so the security rules let the person's line manager
   * read an item filed under another of their ids. Null when not stored.
   */
  personUserId?: string | null
}

export type PriceWorkItem = PayeClaimBase & {
  kind: 'priceWork'
  /** 1.30.1: free text, required on new items; '' on items stored before (shown "—", `priceWorkJobNumberText`). */
  jobNumber: string
  startDate: string
  endDate: string
  approvedByUserId: string
  approvedByName: string
}

export type ExpenseItem = PayeClaimBase & {
  kind: 'expense'
  jobNumber: string
  date: string
}

export type PayeClaimItem = PriceWorkItem | ExpenseItem

// MARK: - Value helpers

const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/

function text(value: unknown): string {
  return value == null ? '' : String(value).trim()
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

function round2(value: number): number {
  return Math.round((Number(value) || 0) * 100) / 100
}

function amountOf(value: unknown): number | null {
  if (value == null || value === '') return null
  const n = typeof value === 'string' ? Number(value.replace(/[^0-9.-]/g, '')) : Number(value)
  return Number.isFinite(n) ? round2(n) : null
}

function isDayKey(value: unknown): value is string {
  if (typeof value !== 'string' || !DAY_KEY.test(value)) return false
  const [y, m, d] = value.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d
}

/** A stored date: a `YYYY-MM-DD` day key as it is, else an instant (Timestamp, ms, ISO) as its organisation-zone day. */
function storedDayKey(value: unknown, timeZone: string): string {
  if (isDayKey(text(value))) return text(value)
  const ms = documentInstantMs(value)
  return ms == null ? '' : dayKeyInZone(new Date(ms), timeZone)
}

function jobNumberText(value: unknown): string {
  return typeof value === 'number' && Number.isFinite(value) ? String(value) : text(value)
}

function sameText(a: unknown, b: unknown): boolean {
  return idKey(a) === idKey(b) && idKey(a) !== ''
}

// MARK: - Evidence

/**
 * The Storage path of a new piece of claim evidence: `organizations/{orgId}/payeClaims/{userId}/{uid}_{ms}.{ext}`
 * (§24 object name, `storedFileObjectName`). Only the person uploads into their own folder (`userId` is their uid), so
 * the uploader in the name is the person. Null when an id is unusable.
 */
export function payeClaimEvidencePath(input: {
  organizationId: string
  userId: string
  unixMs: number
  extension?: string | null
}): string | null {
  const org = text(input.organizationId)
  const user = text(input.userId)
  if (!org || !user || org.includes('/') || user.includes('/')) return null
  const name = storedFileObjectName({ uid: user, unixMs: input.unixMs, extension: input.extension })
  return name ? `organizations/${org}/${PAYE_CLAIM_EVIDENCE_FOLDER}/${user}/${name}` : null
}

/** True when `path` is a claim evidence file of `userId` in `organizationId` (case-sensitive uid, as Storage is). */
export function payeClaimEvidencePathBelongsTo(path: unknown, organizationId: unknown, userId: unknown): boolean {
  const parsed = storedFileKind(text(path))
  if (!parsed || parsed.kind !== 'paye_claim_evidence') return false
  return parsed.organizationId === text(organizationId) && parsed.ownerUserId === text(userId)
}

function evidenceKind(value: unknown): PayeClaimEvidenceKind {
  const raw = text(value)
  return raw === 'photo' || raw === 'personalSiteAudit' ? raw : 'file'
}

/**
 * Reads a stored `evidence` list; order is kept. Never throws. Given `userId` (1.30.0 review), only entries whose path
 * is a claim evidence file in that person's own folder are kept (`payeClaimEvidencePathBelongsTo`; also the
 * organisation when given) — another person's file, a personal site audit photo, a URL or junk is dropped, so a viewer
 * never opens it. Without `userId` (an older caller) entries without a path are dropped.
 */
export function parsePayeClaimEvidence(value: unknown, owner?: { userId?: unknown; organizationId?: unknown } | null): PayeClaimEvidence[] {
  const list = Array.isArray(value) ? value : []
  const out: PayeClaimEvidence[] = []
  const userId = text(owner?.userId)
  const organizationId = text(owner?.organizationId)
  for (const raw of list) {
    const row = record(raw)
    const path = text(row.path)
    if (!path) continue
    if (owner) {
      const parsed = storedFileKind(path)
      if (!userId || !parsed || parsed.kind !== 'paye_claim_evidence' || parsed.ownerUserId !== userId) continue
      if (organizationId && parsed.organizationId !== organizationId) continue
    }
    out.push({
      path,
      name: text(row.name) || path.split('/').pop() || 'Evidence',
      kind: evidenceKind(row.kind),
      contentType: text(row.contentType),
      auditId: text(row.auditId) || null,
    })
  }
  return out
}

/** The stored shape of one evidence entry (no empty optional fields). */
export function payeClaimEvidenceWriteFields(entry: Partial<PayeClaimEvidence>): Record<string, unknown> {
  const out: Record<string, unknown> = {
    path: text(entry.path),
    name: text(entry.name).slice(0, PAYE_CLAIM_TITLE_MAX) || text(entry.path).split('/').pop() || 'Evidence',
    kind: evidenceKind(entry.kind),
  }
  if (text(entry.contentType)) out.contentType = text(entry.contentType)
  if (text(entry.auditId)) out.auditId = text(entry.auditId)
  return out
}

/** Whether the report PDF can draw this evidence as a page: `image` (JPEG / PNG), `pdf` (pages appended) or `listed`. */
export function payeClaimEvidenceDrawAs(entry: Pick<PayeClaimEvidence, 'contentType' | 'path' | 'name'>): 'image' | 'pdf' | 'listed' {
  const type = text(entry.contentType).toLowerCase()
  const name = `${text(entry.name)} ${text(entry.path)}`.toLowerCase()
  if (type === 'application/pdf' || /\.pdf(\s|$)/.test(name)) return 'pdf'
  if (type === 'image/jpeg' || type === 'image/jpg' || type === 'image/pjpeg' || type === 'image/png') return 'image'
  if (!type && /\.(jpe?g|png)(\s|$)/.test(name)) return 'image'
  return 'listed'
}

/**
 * Which of the person's own claim evidence files are deleted, not kept (§24, 1.30.0 review): only those the person
 * uploaded within the undo window (`fileDeletePermission` as the uploader — `uploader_undo`). Used when an add fails
 * after its uploads (so no orphaned copy is left where line managers and admins can read it) and when the person
 * removes an item; every other file is kept for recovery (`FILE_KEPT_ON_REMOVE_COPY`).
 */
export function payeClaimEvidenceToDelete(
  evidence: ReadonlyArray<Pick<PayeClaimEvidence, 'path'>> | null | undefined,
  input: { organizationId: string; viewerUserId: string; nowMs: number; uploadedAtMs?: Record<string, number | null | undefined> | null }
): string[] {
  const out: string[] = []
  for (const entry of evidence || []) {
    const path = text(entry?.path)
    if (!path || !payeClaimEvidencePathBelongsTo(path, input.organizationId, input.viewerUserId) || out.includes(path)) continue
    const permission = fileDeletePermission({
      storagePath: path,
      organizationId: input.organizationId,
      viewerUserId: input.viewerUserId,
      viewerRole: null as never,
      nowMs: input.nowMs,
      uploadedAtMs: input.uploadedAtMs?.[path] ?? null,
    })
    if (permission.allowed && permission.reason === 'uploader_undo') out.push(path)
  }
  return out
}

// MARK: - Approver candidates

/**
 * Who may be named as the approver of price work: the active admins and managers of the organisation (never an
 * operative, never a pending invite or a deleted profile), never the person under any of their ids
 * (`personIdSet`). The same people `lineManagerCandidates` offers, sorted by name. No free text.
 */
export function priceWorkApproverCandidates(
  person: LineManagerSubject | null | undefined,
  roster: ReadonlyArray<LineManagerRosterPerson> | null | undefined,
  options?: { organizationId?: string | null } | null
): LineManagerCandidate[] {
  if (!person || !idText(person.id)) return []
  const rows = roster || []
  const org = text(options?.organizationId)
  return lineManagerCandidates(person, rows).filter((candidate) => {
    const row = rows.find((member) => idText(member?.id) === candidate.id)
    if (!row) return false
    // 1.30.0 review: the same test as the security rules' price work approver check — the approver's users document
    // names this organisation, and they are an admin or carry the manager flag / role (a flagless "member" is not).
    if (org && !homeOrganizationIs(record(row).organizationId, org)) return false
    return candidate.level === 'admin' || storedManager(row)
  })
}

export const AGREED_MANAGER_SUGGESTIONS_MAX = 6

/**
 * Rulebook 1.43.0 §8 (timesheet price work "Manager who agreed this"): the names offered as the person types — the
 * same people `priceWorkApproverCandidates` offers (active admins and managers of the organisation, one per person,
 * never the person themself), whose name contains the typed text anywhere, without case. At most
 * `AGREED_MANAGER_SUGGESTIONS_MAX` (6), in the candidates' order; nothing for an empty query, and a name typed exactly
 * is not offered again. The field stays free text: a suggestion only fills it.
 */
export function agreedManagerSuggestions(
  query: string | null | undefined,
  person: LineManagerSubject | null | undefined,
  roster: ReadonlyArray<LineManagerRosterPerson> | null | undefined,
  options?: { organizationId?: string | null } | null
): string[] {
  const needle = text(query).toLowerCase()
  if (!needle) return []
  const names: string[] = []
  const seen = new Set<string>()
  for (const candidate of priceWorkApproverCandidates(person, roster, options)) {
    const name = text(candidate.name)
    const key = name.toLowerCase()
    if (!name || key === needle || seen.has(key) || !key.includes(needle)) continue
    seen.add(key)
    names.push(name)
    if (names.length >= AGREED_MANAGER_SUGGESTIONS_MAX) break
  }
  return names
}

/** A stored organisation reference (id, `organizations/{id}` path) names `organizationId` (without case). */
function homeOrganizationIs(value: unknown, organizationId: string): boolean {
  const raw = typeof value === 'string' ? value : value && typeof value === 'object' && 'path' in (value as object) ? String((value as { path: unknown }).path) : ''
  const v = raw.trim().toLowerCase()
  const org = organizationId.toLowerCase()
  return v === org || v.endsWith(`organizations/${org}`)
}

/** The manager flag (top level or `permissions`) or the `manager` role, as the rules read it. */
function storedManager(row: unknown): boolean {
  const data = record(row)
  const on = (value: unknown) => value === true || value === 1
  const role = typeof data.role === 'string' ? data.role.trim().toLowerCase() : record(data.role).isManager === true ? 'manager' : ''
  return on(data.manager) || on(record(data.permissions).manager) || role === 'manager'
}

// MARK: - Validation

export type PriceWorkDraft = {
  title?: unknown
  details?: unknown
  jobNumber?: unknown
  startDate?: unknown
  endDate?: unknown
  approvedByUserId?: unknown
  amount?: unknown
  evidence?: ReadonlyArray<Partial<PayeClaimEvidence>> | null
}

export type ExpenseDraft = {
  title?: unknown
  details?: unknown
  jobNumber?: unknown
  date?: unknown
  amount?: unknown
  evidence?: ReadonlyArray<Partial<PayeClaimEvidence>> | null
}

function amountError(value: unknown): string | null {
  const amount = amountOf(value)
  return amount == null || amount <= 0 || amount > PAYE_CLAIM_AMOUNT_MAX ? PAYE_CLAIM_AMOUNT_MESSAGE : null
}

function evidenceError(
  evidence: ReadonlyArray<Partial<PayeClaimEvidence>> | null | undefined,
  context: { organizationId?: unknown; userId?: unknown }
): string | null {
  const list = evidence || []
  if (list.length > PAYE_CLAIM_EVIDENCE_MAX) return PAYE_CLAIM_EVIDENCE_LIMIT_MESSAGE
  if (context.organizationId != null && context.userId != null) {
    for (const entry of list) {
      if (!payeClaimEvidencePathBelongsTo(entry?.path, context.organizationId, context.userId)) return PAYE_CLAIM_EVIDENCE_INVALID_MESSAGE
    }
  }
  return null
}

/**
 * Null when the price work can be added, else the first message: a name; a job number (1.30.1,
 * `priceWorkJobNumberError`: trimmed, 1–60 characters, `PRICE_WORK_JOB_NUMBER_REQUIRED_MESSAGE`); dates from–to (`startDate` ≤ `endDate`, the
 * same day allowed); an approver from `priceWorkApproverCandidates` (required); an amount above zero; at most
 * `PAYE_CLAIM_EVIDENCE_MAX` pieces of evidence, each in the person's own claim folder (when `organizationId` is given).
 */
export function priceWorkValidationError(
  draft: PriceWorkDraft,
  context: {
    person: LineManagerSubject | null | undefined
    roster: ReadonlyArray<LineManagerRosterPerson> | null | undefined
    organizationId?: string | null
  }
): string | null {
  if (!text(draft.title)) return PAYE_CLAIM_TITLE_MESSAGE
  const job = priceWorkJobNumberError(draft.jobNumber)
  if (job) return job
  const start = text(draft.startDate)
  const end = text(draft.endDate) || start
  if (!isDayKey(start) || !isDayKey(end) || end < start) return PRICE_WORK_DATES_MESSAGE
  const approver = text(draft.approvedByUserId)
  if (!approver) return PRICE_WORK_APPROVER_REQUIRED_MESSAGE
  const candidates = priceWorkApproverCandidates(context.person, context.roster, { organizationId: context.organizationId })
  if (!candidates.some((row) => row.id === approver)) return PRICE_WORK_APPROVER_INVALID_MESSAGE
  const money = amountError(draft.amount)
  if (money) return money
  return evidenceError(draft.evidence, { organizationId: context.organizationId ?? undefined, userId: context.organizationId != null ? context.person?.id : undefined })
}

/**
 * Null when the expense can be added, else the first message: a name; a date; an amount above zero; at least one piece
 * of evidence (`EXPENSE_EVIDENCE_REQUIRED_MESSAGE`) and at most `PAYE_CLAIM_EVIDENCE_MAX`, each in the person's own
 * claim folder (when `organizationId` and `userId` are given).
 */
export function expenseValidationError(
  draft: ExpenseDraft,
  context?: { organizationId?: string | null; userId?: string | null } | null
): string | null {
  if (!text(draft.title)) return PAYE_CLAIM_TITLE_MESSAGE
  if (!isDayKey(text(draft.date))) return PAYE_CLAIM_DATE_MESSAGE
  const money = amountError(draft.amount)
  if (money) return money
  if (!draft.evidence || draft.evidence.length === 0) return EXPENSE_EVIDENCE_REQUIRED_MESSAGE
  return evidenceError(draft.evidence, { organizationId: context?.organizationId ?? undefined, userId: context?.userId ?? undefined })
}

// MARK: - Write fields

/**
 * 1.33.0 (line manager can always review, owner 6 Nov): the person field every new `priceWorkItems` / `expenseItems`
 * document carries — `personUserId`, the creator's current users id (the same as `userId` on a create; the rules
 * require it to be the signed-in account). The person's line manager reads items through it, so an item still filed
 * under a former id is readable once `payeClaimPersonUserIdBackfill` has stamped it.
 */
export function payeClaimPersonFields(creatorUserId: unknown): { personUserId: string } | Record<string, never> {
  const id = text(creatorUserId)
  return id ? { personUserId: id } : {}
}

/**
 * 1.33.0: the `personUserId` an item stored before 1.33.0 should get (the backfill script; dry run by default). The
 * users document whose id is the item's `userId`, else the one listing it in `formerUserIds` or `sameEmailUserIds`
 * (without case). Null when the item already has one, nobody matches, or more than one users document claims the id
 * (left for an admin to sort out, never guessed).
 */
export function payeClaimPersonUserIdBackfill(input: {
  item: { userId?: unknown; personUserId?: unknown } | null | undefined
  users: ReadonlyArray<{ id?: unknown; formerUserIds?: unknown; sameEmailUserIds?: unknown }> | null | undefined
}): { personUserId: string } | null {
  const item = input.item
  if (!item || text(item.personUserId)) return null
  const key = idKey(item.userId)
  if (!key) return null
  const users = (input.users || []).filter((row) => row && text(row.id))
  const own = users.find((row) => idKey(row.id) === key)
  if (own) return { personUserId: text(own.id) }
  const listed = (value: unknown) => (Array.isArray(value) ? value.some((id) => idKey(id) === key) : false)
  const claims = users.filter((row) => listed(row.formerUserIds) || listed(row.sameEmailUserIds))
  const ids = Array.from(new Set(claims.map((row) => text(row.id))))
  return ids.length === 1 ? { personUserId: ids[0] } : null
}

/**
 * The fields of a new `priceWorkItems/{id}` document (a create; the app adds `createdAt` as server time and the write
 * metadata). The approver's name is stored beside the id so the report names them even after they leave. Null when
 * `priceWorkValidationError` refuses the draft.
 */
export function priceWorkWriteFields(input: {
  userId: string
  draft: PriceWorkDraft
  person: LineManagerSubject | null | undefined
  roster: ReadonlyArray<LineManagerRosterPerson> | null | undefined
  currency: unknown
  organizationId?: string | null
}): Record<string, unknown> | null {
  const userId = text(input.userId)
  if (!userId || idText(input.person?.id) !== userId) return null
  if (priceWorkValidationError(input.draft, { person: input.person, roster: input.roster, organizationId: input.organizationId })) return null
  const start = text(input.draft.startDate)
  const end = text(input.draft.endDate) || start
  const approver = priceWorkApproverCandidates(input.person, input.roster, { organizationId: input.organizationId }).find((row) => row.id === text(input.draft.approvedByUserId))
  return {
    userId,
    title: text(input.draft.title).slice(0, PAYE_CLAIM_TITLE_MAX),
    details: text(input.draft.details).slice(0, PAYE_CLAIM_DETAILS_MAX),
    jobNumber: text(input.draft.jobNumber).slice(0, PRICE_WORK_JOB_NUMBER_MAX),
    startDate: start,
    endDate: end,
    approvedByUserId: approver?.id ?? '',
    approvedByName: approver?.name ?? '',
    amount: amountOf(input.draft.amount),
    currency: normalizeCurrencyCode(input.currency) ?? 'GBP',
    evidence: (input.draft.evidence || []).map(payeClaimEvidenceWriteFields),
    createdBy: userId,
    ...payeClaimPersonFields(userId),
  }
}

/**
 * The fields of a new `expenseItems/{id}` document — the fields of a timesheet expense entry (`title`, `details`,
 * `jobNumber`, `date`, `amount`) plus the currency and the evidence list (at least one). The app adds `createdAt`.
 * Null when `expenseValidationError` refuses the draft.
 */
export function expenseWriteFields(input: {
  userId: string
  draft: ExpenseDraft
  currency: unknown
  organizationId?: string | null
}): Record<string, unknown> | null {
  const userId = text(input.userId)
  if (!userId) return null
  if (expenseValidationError(input.draft, { organizationId: input.organizationId, userId })) return null
  return {
    userId,
    title: text(input.draft.title).slice(0, PAYE_CLAIM_TITLE_MAX),
    details: text(input.draft.details).slice(0, PAYE_CLAIM_DETAILS_MAX),
    jobNumber: text(input.draft.jobNumber).slice(0, 60),
    date: text(input.draft.date),
    amount: amountOf(input.draft.amount),
    currency: normalizeCurrencyCode(input.currency) ?? 'GBP',
    evidence: (input.draft.evidence || []).map(payeClaimEvidenceWriteFields),
    createdBy: userId,
    ...payeClaimPersonFields(userId),
  }
}

// MARK: - Readers

function baseOf(docId: string, row: Record<string, unknown>, organizationId?: string | null): PayeClaimBase {
  return {
    id: text(docId),
    userId: text(row.userId),
    title: text(row.title),
    details: text(row.details),
    amount: amountOf(row.amount) ?? 0,
    currency: normalizeCurrencyCode(row.currency) ?? '',
    evidence: parsePayeClaimEvidence(row.evidence, { userId: row.userId, organizationId }),
    createdAtMs: documentInstantMs(row.createdAt),
    createdBy: text(row.createdBy),
    personUserId: text(row.personUserId) || null,
  }
}

/**
 * Reads `priceWorkItems/{id}`. Dates are organisation-zone day keys (a stored instant is converted); a missing end is
 * the start. `jobNumber` is the stored text (a number is read as text); '' for an item stored before 1.30.1, which stays
 * valid and is never rewritten.
 */
export function parsePriceWorkDocument(
  docId: string,
  data: Record<string, unknown> | null | undefined,
  options?: { timeZone?: string | null; organizationId?: string | null } | null
): PriceWorkItem {
  const row = record(data)
  const zone = zoneOrLondon(options?.timeZone)
  const startDate = storedDayKey(row.startDate, zone)
  const endRaw = storedDayKey(row.endDate, zone) || startDate
  const [a, b] = startDate && endRaw && endRaw < startDate ? [endRaw, startDate] : [startDate, endRaw]
  return {
    ...baseOf(docId, row, options?.organizationId),
    kind: 'priceWork',
    jobNumber: jobNumberText(row.jobNumber),
    startDate: a,
    endDate: b,
    approvedByUserId: text(row.approvedByUserId),
    approvedByName: text(row.approvedByName),
  }
}

/** Reads `expenseItems/{id}`. The date is an organisation-zone day key (a stored instant is converted). */
export function parseExpenseDocument(
  docId: string,
  data: Record<string, unknown> | null | undefined,
  options?: { timeZone?: string | null; organizationId?: string | null } | null
): ExpenseItem {
  const row = record(data)
  const zone = zoneOrLondon(options?.timeZone)
  return {
    ...baseOf(docId, row, options?.organizationId),
    kind: 'expense',
    jobNumber: text(row.jobNumber),
    date: storedDayKey(row.date, zone),
  }
}

// MARK: - Ranges, totals and readiness

/** The day an item is listed under: an expense's date, price work's start. */
export function payeClaimDayKey(item: Pick<ExpenseItem, 'kind' | 'date'> | Pick<PriceWorkItem, 'kind' | 'startDate'>): string {
  return item.kind === 'expense' ? (item as ExpenseItem).date : (item as PriceWorkItem).startDate
}

/**
 * The items of a range, oldest first (ties by name, then id): an expense whose date is in the range; price work whose
 * from–to dates overlap it. Items with no readable date are left out.
 */
export function payeClaimsInRange<T extends PayeClaimItem>(items: ReadonlyArray<T> | null | undefined, range: { start: string; end: string } | null | undefined): T[] {
  if (!range || !isDayKey(range.start) || !isDayKey(range.end)) return []
  const out = (items || []).filter((item) => {
    if (item.kind === 'expense') return isDayKey(item.date) && item.date >= range.start && item.date <= range.end
    const start = item.startDate
    const end = item.endDate || start
    return isDayKey(start) && start <= range.end && end >= range.start
  })
  return out.sort(
    (a, b) =>
      payeClaimDayKey(a).localeCompare(payeClaimDayKey(b)) ||
      a.title.localeCompare(b.title, 'en', { sensitivity: 'base' }) ||
      a.id.localeCompare(b.id)
  )
}

/** The sum of the items' amounts, to the penny. */
export function payeClaimsTotal(items: ReadonlyArray<Pick<PayeClaimBase, 'amount'>> | null | undefined): number {
  return round2((items || []).reduce((sum, item) => sum + (Number(item.amount) || 0), 0))
}

/** Generate price work / expenses report is enabled once at least one item is in the range. */
export function payeClaimReportReady(items: ReadonlyArray<unknown> | null | undefined): boolean {
  return (items || []).length > 0
}

/**
 * The list row: the name and the figure (`formatMoney` in the organisation currency), and the date text under it — an
 * expense's date and job number; price work's dates, its job number ("—" when an older item has none,
 * `priceWorkJobNumberText`, 1.30.1) and approver.
 */
export function payeClaimListRow(item: PayeClaimItem, currency: unknown): { title: string; figure: string; subtitle: string } {
  const code = item.currency || currency
  const subtitle =
    item.kind === 'expense'
      ? [formatPaymentRunDay(item.date), item.jobNumber].filter(Boolean).join(' · ')
      : [
          item.startDate === item.endDate || !item.endDate
            ? formatPaymentRunDay(item.startDate)
            : `${formatPaymentRunDay(item.startDate)} – ${formatPaymentRunDay(item.endDate)}`,
          priceWorkJobNumberText(item.jobNumber),
          item.approvedByName ? `Approved by ${item.approvedByName}` : '',
        ]
          .filter(Boolean)
          .join(' · ')
  return { title: item.title || 'Untitled', figure: formatMoney(item.amount, code), subtitle }
}

// MARK: - Who sees whose items

type ClaimViewer = LeaveSelfBookUser & { id?: string | null; isActive?: boolean | null }

/**
 * Whether `viewer` may read `subject`'s price work, expenses and saved claim reports: the person themself, their
 * active line managers (`lineManagerIds`, users documents) and active admins outside operative mode. Read-only for
 * everyone but the person. The security rules hold the same (`payeClaimViewer`).
 */
export function canViewPayeClaims(
  viewer: ClaimViewer | null | undefined,
  subject: ClaimViewer | null | undefined,
  roster?: ReadonlyArray<NotificationRosterMember> | null
): boolean {
  if (!viewer || !subject || !idText(viewer.id) || !idText(subject.id)) return false
  if (viewer.isActive === false) return false
  const members = (roster || []) as NotificationRosterMember[]
  const viewerIds = new Set(personIdSet(viewer as never, members).map(idKey))
  if (viewerIds.has(idKey(subject.id))) return true
  if (isAdminOutsideOperativeMode(viewer)) return true
  const managers = lineManagerIds(subject, members).map(idKey)
  if (!managers.some((id) => viewerIds.has(id))) return false
  const member = members.find((row) => sameText(row.id, viewer.id))
  return member ? rosterMemberActive(member) : true
}

/** Only the person adds, changes or removes their own items (online only); nobody else ever writes them. */
export function canWritePayeClaim(viewerId: unknown, item: Pick<PayeClaimBase, 'userId'> | null | undefined): boolean {
  const viewer = text(viewerId)
  return Boolean(viewer) && Boolean(item) && text(item?.userId) === viewer
}

// MARK: - Self-employed: their timesheet entries, read-only

/** One read-only row from a self-employed person's timesheet (§8), shown under Users' … → Expenses / Price work. */
export type TimesheetClaimRow = {
  id: string
  sheetId: string
  kind: PayeClaimKind
  title: string
  details: string
  jobNumber: string
  amount: number
  startDate: string
  endDate: string
  approvedByName: string
  receiptName: string | null
  managerDecision: string
}

/**
 * A self-employed person's price work or expense entries from their timesheets (`parseTimesheetEntries` per sheet),
 * in the same row shape, for the range (expenses by date; price work by overlap of start–end), oldest first. Read-only:
 * their figures stay on My Timesheets.
 */
export function timesheetClaimRows(
  sheets: ReadonlyArray<{ id: string; entries: TimesheetEntriesDocument }> | null | undefined,
  kind: PayeClaimKind,
  range: { start: string; end: string } | null | undefined
): TimesheetClaimRow[] {
  if (!range || !isDayKey(range.start) || !isDayKey(range.end)) return []
  const out: TimesheetClaimRow[] = []
  const seen = new Set<string>()
  for (const sheet of sheets || []) {
    if (kind === 'expense') {
      for (const entry of sheet.entries.expenseEntries) {
        const day = entry.dayKey || ''
        if (!day || day < range.start || day > range.end || seen.has(idKey(entry.id))) continue
        seen.add(idKey(entry.id))
        out.push({
          id: entry.id,
          sheetId: text(sheet.id),
          kind,
          title: entry.title,
          details: entry.details,
          jobNumber: entry.jobNumber,
          amount: round2(entry.managerRevisedAmount ?? entry.amount),
          startDate: day,
          endDate: day,
          approvedByName: '',
          receiptName: entry.receiptName,
          managerDecision: entry.managerDecision,
        })
      }
    } else {
      for (const entry of sheet.entries.priceWorkEntries) {
        const start = entry.startDayKey || ''
        const end = entry.endDayKey && entry.endDayKey >= start ? entry.endDayKey : start
        if (!start || start > range.end || end < range.start || seen.has(idKey(entry.id))) continue
        seen.add(idKey(entry.id))
        out.push({
          id: entry.id,
          sheetId: text(sheet.id),
          kind,
          title: entry.title,
          details: entry.details,
          jobNumber: entry.jobNumber,
          amount: round2(entry.managerRevisedAmount ?? entry.amount),
          startDate: start,
          endDate: end,
          approvedByName: entry.agreedManagerName,
          receiptName: null,
          managerDecision: entry.managerDecision,
        })
      }
    }
  }
  return out.sort((a, b) => a.startDate.localeCompare(b.startDate) || a.title.localeCompare(b.title) || a.id.localeCompare(b.id))
}

// MARK: - Reports

export type PayeClaimReportItem = {
  id: string
  title: string
  details: string
  jobNumber: string
  startDate: string
  endDate: string
  approvedByName: string
  amount: number
  evidence: PayeClaimEvidence[]
}

export type PayeClaimReportSnapshot = {
  userId: string
  userName: string
  companyName: string
  kind: PayeClaimKind
  rangeStart: string
  rangeEnd: string
  currency: string
  items: PayeClaimReportItem[]
  totals: { amount: number; itemCount: number; evidenceCount: number }
  generatedBy: string
}

/**
 * The saved copy of a price work or expenses report (`payeClaimReports/{id}`, created once by the person, never
 * changed): who, the kind, the range, the currency, every item with its evidence list as it was, and the totals. The
 * app adds `generatedAt` (server time). The PDF is built from this copy (`payeClaimReportRows`,
 * `payeClaimEvidencePages`), so it never changes after it is sent.
 */
export function payeClaimReportSnapshot(input: {
  kind: PayeClaimKind
  userId: string
  userName: string
  companyName?: string | null
  currency: unknown
  rangeStart: string
  rangeEnd: string
  items: ReadonlyArray<PayeClaimItem>
  generatedBy: string
}): PayeClaimReportSnapshot {
  const items: PayeClaimReportItem[] = input.items
    .filter((item) => item.kind === input.kind)
    .map((item) => ({
      id: item.id,
      title: item.title,
      details: item.details,
      jobNumber: item.jobNumber,
      startDate: item.kind === 'expense' ? item.date : item.startDate,
      endDate: item.kind === 'expense' ? item.date : item.endDate || item.startDate,
      approvedByName: item.kind === 'priceWork' ? item.approvedByName : '',
      amount: round2(item.amount),
      evidence: item.evidence.map((entry) => ({ ...entry })),
    }))
  return {
    userId: text(input.userId),
    userName: text(input.userName),
    companyName: text(input.companyName),
    kind: input.kind,
    rangeStart: text(input.rangeStart),
    rangeEnd: text(input.rangeEnd),
    currency: normalizeCurrencyCode(input.currency) ?? 'GBP',
    items,
    totals: {
      amount: payeClaimsTotal(items),
      itemCount: items.length,
      evidenceCount: items.reduce((sum, item) => sum + item.evidence.length, 0),
    },
    generatedBy: text(input.generatedBy),
  }
}

/** Reads `payeClaimReports/{id}` back into a snapshot (plus `id` and `generatedAtMs`). Never throws. */
export function parsePayeClaimReportDocument(
  docId: string,
  data: Record<string, unknown> | null | undefined
): PayeClaimReportSnapshot & { id: string; generatedAtMs: number | null } {
  const row = record(data)
  const kind: PayeClaimKind = text(row.kind) === 'priceWork' ? 'priceWork' : 'expense'
  const owner = { userId: row.userId }
  const items: PayeClaimReportItem[] = (Array.isArray(row.items) ? row.items : []).map((raw) => {
    const r = record(raw)
    const start = isDayKey(text(r.startDate)) ? text(r.startDate) : ''
    return {
      id: text(r.id),
      title: text(r.title),
      details: text(r.details),
      jobNumber: text(r.jobNumber),
      startDate: start,
      endDate: isDayKey(text(r.endDate)) ? text(r.endDate) : start,
      approvedByName: text(r.approvedByName),
      amount: amountOf(r.amount) ?? 0,
      evidence: parsePayeClaimEvidence(r.evidence, owner),
    }
  })
  const totals = record(row.totals)
  return {
    id: text(docId),
    userId: text(row.userId),
    userName: text(row.userName),
    companyName: text(row.companyName),
    kind,
    rangeStart: isDayKey(text(row.rangeStart)) ? text(row.rangeStart) : '',
    rangeEnd: isDayKey(text(row.rangeEnd)) ? text(row.rangeEnd) : '',
    currency: normalizeCurrencyCode(row.currency) ?? 'GBP',
    items,
    totals: {
      amount: amountOf(totals.amount) ?? payeClaimsTotal(items),
      itemCount: Number(totals.itemCount) || items.length,
      evidenceCount: Number(totals.evidenceCount) || items.reduce((sum, item) => sum + item.evidence.length, 0),
    },
    generatedBy: text(row.generatedBy),
    generatedAtMs: documentInstantMs(row.generatedAt),
  }
}

function dateText(start: string, end: string): string {
  if (!start) return ''
  return !end || end === start ? formatPaymentRunDay(start) : `${formatPaymentRunDay(start)} – ${formatPaymentRunDay(end)}`
}

/** 1.33.0: the summary table's columns, in drawing order (price work adds who approved it). */
export const PRICE_WORK_REPORT_COLUMNS: ReadonlyArray<string> = ['From – To', 'Job number', 'Name', 'Approved by', 'Amount']
export const EXPENSES_REPORT_COLUMNS: ReadonlyArray<string> = ['Date', 'Job number', 'Name', 'Amount']

/** One summary row: the old joined text (`heading`, `figure`, `lines`) and, from 1.33.0, each column on its own. */
export type PayeClaimReportRow = {
  heading: string
  figure: string
  lines: string[]
  itemId: string
  /** `formatPaymentRunDay` of the day, or "from – to" for price work over several days. */
  date: string
  /** Price work: `priceWorkJobNumberText` ("—" before 1.30.1). Expense: as stored. */
  jobNumber: string
  name: string
  /** Price work only: who approved it. */
  approvedBy: string
  /** `formatMoney` in the report's currency. */
  amount: string
  description: string
  /** "Evidence: 2 (a.jpg, b.pdf)", or "". */
  evidenceNote: string
}

type ClaimReportHeaderExtras = {
  userId?: string | null
  companyName?: string | null
  generatedBy?: string | null
  generatedAtMs?: number | null
}

/**
 * The summary page's content (1.33.0, owner 6 Nov: laid out like the invoice / timesheet report). Kept for older
 * readers: `title` ("Expenses report · Sam Smith"), `subtitle` (the range), `rows` (`heading` date · job · name,
 * `figure`, `lines` description / approver / evidence count), `total`, `empty`. 1.33.0 adds the header
 * (`documentTitle`, `companyName`, `personName`, `period`, `generatedAt` / `generatedBy` / `generated` in the
 * organisation zone, `reportGeneratedText`), `columns`, each row's columns on their own, `totalLabel` /
 * `totalAmount`, `itemCount` / `evidenceCount` and `footer`. Money in the report's currency. Field names match iOS
 * `PayeClaimReportLayout`.
 */
export function payeClaimReportRows(
  snapshot: Pick<PayeClaimReportSnapshot, 'kind' | 'userName' | 'rangeStart' | 'rangeEnd' | 'currency' | 'items' | 'totals'> & ClaimReportHeaderExtras,
  options?: { timeZone?: string | null; generatedByName?: string | null; nowMs?: number | null } | null
): {
  title: string
  subtitle: string
  rows: PayeClaimReportRow[]
  total: string
  empty: string
  documentTitle: string
  companyName: string
  personName: string
  period: string
  generatedAt: string
  generatedBy: string
  generated: string
  columns: string[]
  totalLabel: string
  totalAmount: string
  itemCount: number
  evidenceCount: number
  footer: string
} {
  const priceWork = snapshot.kind === 'priceWork'
  const rows: PayeClaimReportRow[] = snapshot.items.map((item) => {
    const date = dateText(item.startDate, item.endDate)
    const jobNumber = priceWork ? priceWorkJobNumberText(item.jobNumber) : text(item.jobNumber)
    const approvedBy = priceWork ? text(item.approvedByName) : ''
    const evidenceNote = item.evidence.length > 0 ? `Evidence: ${item.evidence.length} (${item.evidence.map((entry) => entry.name).join(', ')})` : ''
    const amount = formatMoney(item.amount, snapshot.currency)
    return {
      heading: [date, jobNumber, item.title].filter(Boolean).join(' · '),
      figure: amount,
      lines: [item.details, approvedBy ? `Approved by ${approvedBy}` : '', evidenceNote].filter(Boolean),
      itemId: text(item.id),
      date,
      jobNumber,
      name: text(item.title),
      approvedBy,
      amount,
      description: text(item.details),
      evidenceNote,
    }
  })
  const documentTitle = priceWork ? PRICE_WORK_REPORT_TITLE : EXPENSES_REPORT_TITLE
  const totalLabel = priceWork ? PRICE_WORK_TOTAL_LABEL : EXPENSES_TOTAL_LABEL
  const totalAmount = formatMoney(snapshot.totals.amount, snapshot.currency)
  const period = `${formatPaymentRunDay(snapshot.rangeStart)} – ${formatPaymentRunDay(snapshot.rangeEnd)}`
  const companyName = text(snapshot.companyName)
  const personName = text(snapshot.userName)
  return {
    title: `${documentTitle} · ${personName}`,
    subtitle: period,
    rows,
    total: `${totalLabel}: ${totalAmount}`,
    empty: priceWork ? PRICE_WORK_EMPTY_MESSAGE : EXPENSES_EMPTY_MESSAGE,
    documentTitle,
    companyName,
    personName,
    period,
    ...reportGeneratedText({
      generatedAtMs: snapshot.generatedAtMs,
      nowMs: options?.nowMs,
      timeZone: options?.timeZone,
      generatedBy: snapshot.generatedBy,
      userId: snapshot.userId,
      userName: snapshot.userName,
      generatedByName: options?.generatedByName,
    }),
    columns: [...(priceWork ? PRICE_WORK_REPORT_COLUMNS : EXPENSES_REPORT_COLUMNS)],
    totalLabel,
    totalAmount,
    itemCount: Number(snapshot.totals.itemCount) || snapshot.items.length,
    evidenceCount: Number(snapshot.totals.evidenceCount) || snapshot.items.reduce((sum, item) => sum + item.evidence.length, 0),
    footer: [companyName, documentTitle, personName].filter(Boolean).join(' · '),
  }
}

/** One evidence page: the old `heading` / `details` and, from 1.33.0, the item's own fields for the page header. */
export type PayeClaimEvidencePage = {
  itemId: string
  heading: string
  details: string[]
  path: string
  name: string
  contentType: string
  drawAs: 'image' | 'pdf' | 'listed'
  /** The item's name (the page title). */
  itemName: string
  date: string
  jobNumber: string
  /** Price work only. */
  approvedBy: string
  amount: string
  /** The evidence's own title: "Evidence 2 of 3: receipt.jpg" (" (personal site audit copy)" for an audit). */
  evidenceTitle: string
  /** The item's description, when it has one. */
  notes: string[]
}

/**
 * The evidence pages after the summary, in item order: one per piece of evidence, headed by its item (name, date, job
 * number, amount, and for price work who approved it) and the evidence's own title, then the item's description, and
 * how the PDF draws it (`payeClaimEvidenceDrawAs`: an image full size, a PDF's pages appended, otherwise listed with
 * `PAYE_CLAIM_EVIDENCE_NOT_DRAWN_NOTE`). `heading` / `details` keep the pre-1.33.0 joined text.
 */
export function payeClaimEvidencePages(
  snapshot: Pick<PayeClaimReportSnapshot, 'items' | 'currency'> & { kind?: PayeClaimKind | null }
): PayeClaimEvidencePage[] {
  const priceWork = snapshot.kind === 'priceWork'
  const out: PayeClaimEvidencePage[] = []
  for (const item of snapshot.items) {
    const date = dateText(item.startDate, item.endDate)
    const amount = formatMoney(item.amount, snapshot.currency)
    item.evidence.forEach((entry, index) => {
      const evidenceTitle = `Evidence ${index + 1} of ${item.evidence.length}: ${entry.name}${entry.kind === 'personalSiteAudit' ? ' (personal site audit copy)' : ''}`
      out.push({
        itemId: item.id,
        heading: [item.title, date, amount].filter(Boolean).join(' · '),
        details: [evidenceTitle, item.details].filter(Boolean),
        path: entry.path,
        name: entry.name,
        contentType: entry.contentType,
        drawAs: payeClaimEvidenceDrawAs(entry),
        itemName: text(item.title) || 'Untitled',
        date,
        jobNumber: priceWork ? priceWorkJobNumberText(item.jobNumber) : text(item.jobNumber),
        approvedBy: priceWork ? text(item.approvedByName) : '',
        amount,
        evidenceTitle,
        notes: [text(item.details)].filter(Boolean),
      })
    })
  }
  return out
}

/** Saved reports of one kind, newest first (by `generatedAtMs`, then range end). */
export function payeClaimReportsOfKind<T extends Pick<PayeClaimReportSnapshot, 'kind' | 'rangeEnd'> & { generatedAtMs: number | null }>(
  reports: ReadonlyArray<T> | null | undefined,
  kind: PayeClaimKind
): T[] {
  return (reports || [])
    .filter((row) => row.kind === kind)
    .sort((a, b) => (b.generatedAtMs ?? 0) - (a.generatedAtMs ?? 0) || b.rangeEnd.localeCompare(a.rangeEnd))
}
