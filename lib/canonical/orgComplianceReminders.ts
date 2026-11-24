/**
 * Rulebook 1.85.0 §31 (owner decision 24 Nov: "2 months / 1 month / 7 days, never twice"): the admins of an
 * organisation are emailed about its insurance & accreditations (§31, `orgCompliance.ts`) 2 months, 1 month and 7 days
 * before a document expires.
 *
 * - The thresholds are calendar months (clamped to the end of a shorter month: 31 May − 1 month = 30 Apr) and calendar
 *   days, counted back from the expiry day (`expiresOn`, the last valid day, an organisation-zone day key);
 *   `orgComplianceReminderDayKey`. "Today" is the organisation-zone day (`orgComplianceTodayKey`).
 * - A threshold is sent only when it was still ahead when the expiry date was set (or the document added): its day is
 *   after the day the expiry was set (`orgComplianceReminderSetDayKey`). Owner example: an expiry set 1 month and 2 days
 *   away gets no 2-month email, only the 1-month and the 7-day ones.
 * - One email per threshold per document per expiry, never twice: the server keeps a ledger
 *   (`organizations/{orgId}/orgCompliance/reminders`, server only — the security rules match only the `documents`
 *   document there and the organisation catch-all read leaves `orgCompliance` out). A changed expiry date starts again
 *   from the new date; a removed document is dropped from the ledger and gets nothing.
 * - Only the current band is sent (the most urgent threshold whose day has come, up to and including the expiry day),
 *   so a run that was off for a while never sends a stale "2 months" email next to a "7 days" one.
 *
 * Pure, JSON in / JSON out. The daily Cloud Function (`functions/orgComplianceReminders.js`) only reads, sends and
 * writes the ledger.
 */

import { calendarDaysBetween } from './dueDates'
import { holidayDocumentDayKey } from './holidayDocument'
import { companyActivityRecipients, type NotificationRosterMember } from './notificationRecipients'
import {
  ORG_COMPLIANCE_COLLECTION,
  ORG_COMPLIANCE_PAGE_TITLE,
  ORG_COMPLIANCE_SECTION_KEYS,
  orgComplianceDocTypeLabel,
  orgComplianceOrganizationId,
  orgComplianceSection,
  type OrgComplianceDocuments,
  type OrgComplianceEntry,
  type OrgComplianceSectionKey,
} from './orgCompliance'
import { normalizeDocumentId } from './scheduleSources'
import { subcontractorDocumentExpiryDateText } from './subcontractorDocuments'

export const ORG_COMPLIANCE_REMINDER_LEDGER_ID = 'reminders'

/** `organizations/{orgId}/orgCompliance/reminders`, or null for an unusable id. Written by the server only. */
export function orgComplianceReminderLedgerPath(organizationId: unknown): string | null {
  const org = orgComplianceOrganizationId(organizationId)
  return org ? `organizations/${org}/${ORG_COMPLIANCE_COLLECTION}/${ORG_COMPLIANCE_REMINDER_LEDGER_ID}` : null
}

/** `platformConfig/app` kill switch: nothing is sent or written unless exactly `true` (a logged dry run otherwise). */
export const ORG_COMPLIANCE_REMINDERS_SWITCH_FIELD = 'orgComplianceRemindersEnabled'

export function orgComplianceRemindersEnabled(config: unknown): boolean {
  return !!config && typeof config === 'object' && (config as Record<string, unknown>)[ORG_COMPLIANCE_REMINDERS_SWITCH_FIELD] === true
}

export type OrgComplianceReminderThresholdKey = 'twoMonths' | 'oneMonth' | 'sevenDays'

export type OrgComplianceReminderThreshold = {
  key: OrgComplianceReminderThresholdKey
  months: number
  days: number
  /** "2 months", "1 month", "7 days". */
  label: string
}

/** Least urgent first. */
export const ORG_COMPLIANCE_REMINDER_THRESHOLDS: readonly OrgComplianceReminderThreshold[] = [
  { key: 'twoMonths', months: 2, days: 0, label: '2 months' },
  { key: 'oneMonth', months: 1, days: 0, label: '1 month' },
  { key: 'sevenDays', months: 0, days: 7, label: '7 days' },
]

const THRESHOLD_KEYS = ORG_COMPLIANCE_REMINDER_THRESHOLDS.map((t) => t.key) as string[]

const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/

function validDayKey(value: unknown): value is string {
  if (typeof value !== 'string' || !DAY_KEY.test(value)) return false
  const [y, m, d] = value.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

/**
 * The day a threshold falls on: the expiry day less N calendar months (the day clamped to the last day of a shorter
 * month) or less N calendar days. Null for a bad key or threshold.
 */
export function orgComplianceReminderDayKey(expiresOn: unknown, threshold: OrgComplianceReminderThreshold | OrgComplianceReminderThresholdKey): string | null {
  if (!validDayKey(expiresOn)) return null
  const t = typeof threshold === 'string' ? ORG_COMPLIANCE_REMINDER_THRESHOLDS.find((row) => row.key === threshold) : threshold
  if (!t) return null
  const [y, m, d] = expiresOn.split('-').map(Number)
  if (t.months > 0) {
    const index = y * 12 + (m - 1) - t.months
    const ty = Math.floor(index / 12)
    const tm = (index % 12) + 1
    const lastDay = new Date(Date.UTC(ty, tm, 0)).getUTCDate()
    return `${ty}-${pad(tm)}-${pad(Math.min(d, lastDay))}`
  }
  return new Date(Date.UTC(y, m - 1, d - t.days)).toISOString().slice(0, 10)
}

// ── The ledger ──────────────────────────────────────────────────────────────────────────────────────────────────

export type OrgComplianceReminderLedgerEntry = {
  entryId: string
  section: OrgComplianceSectionKey
  /** The expiry this record is about; a different stored expiry starts a new record. */
  expiresOn: string
  /** The day the expiry was set, as first worked out (never moved by a later edit of another field). */
  setDayKey: string
  /** Threshold → the day its email was sent. */
  sent: Partial<Record<OrgComplianceReminderThresholdKey, string>>
}

export type OrgComplianceReminderLedger = { entries: Record<string, OrgComplianceReminderLedgerEntry> }

function ledgerKey(section: OrgComplianceSectionKey, entryId: string): string {
  return `${section}:${normalizeDocumentId(entryId)}`
}

/** Read the stored ledger (missing or junk → empty; a bad record is dropped, never fatal). */
export function parseOrgComplianceReminderLedger(data: unknown): OrgComplianceReminderLedger {
  const out: OrgComplianceReminderLedger = { entries: {} }
  const entries = record(record(data).entries)
  for (const [key, raw] of Object.entries(entries)) {
    const row = record(raw)
    const section = text(row.section) as OrgComplianceSectionKey
    const entryId = text(row.entryId)
    if (!(ORG_COMPLIANCE_SECTION_KEYS as readonly string[]).includes(section) || !entryId) continue
    if (!validDayKey(row.expiresOn) || !validDayKey(row.setDayKey)) continue
    const sent: OrgComplianceReminderLedgerEntry['sent'] = {}
    for (const [k, v] of Object.entries(record(row.sent))) {
      if (THRESHOLD_KEYS.includes(k) && validDayKey(v)) sent[k as OrgComplianceReminderThresholdKey] = v
    }
    out.entries[key] = { entryId, section, expiresOn: row.expiresOn, setDayKey: row.setDayKey, sent }
  }
  return out
}

/**
 * The day the entry's expiry was set: the ledger's day when it already knows this expiry; otherwise the
 * organisation-zone day of the entry's last write (`updatedAtMs`, else `uploadedAtMs`); with neither, today.
 */
export function orgComplianceReminderSetDayKey(input: {
  entry: Pick<OrgComplianceEntry, 'expiresOn' | 'updatedAtMs' | 'uploadedAtMs'>
  prior?: OrgComplianceReminderLedgerEntry | null
  todayKey: string
  timeZone?: string | null
}): string {
  const { entry, prior, todayKey, timeZone } = input
  if (prior && prior.expiresOn === entry.expiresOn && validDayKey(prior.setDayKey)) return prior.setDayKey
  const ms = entry.updatedAtMs ?? entry.uploadedAtMs
  const written = typeof ms === 'number' && Number.isFinite(ms) ? holidayDocumentDayKey(ms, timeZone) : ''
  if (validDayKey(written) && written <= todayKey) return written
  return todayKey
}

export type OrgComplianceReminderDue = {
  section: OrgComplianceSectionKey
  sectionTitle: string
  entryId: string
  title: string
  docTypeLabel: string
  expiresOn: string
  threshold: OrgComplianceReminderThresholdKey
  thresholdLabel: string
  /** Days from today to the expiry day (0 = expires today). */
  daysLeft: number
}

export type OrgComplianceRemindersResult = {
  due: OrgComplianceReminderDue[]
  /** The ledger to store when NONE of `due` was sent: every current expiry known, removed documents dropped. */
  ledger: OrgComplianceReminderLedger
}

/**
 * The reminders due today for one organisation, and its ledger before sending.
 *
 * For each document with an expiry, the current band is the most urgent threshold whose day is on or before today,
 * while today is on or before the expiry day. It is due when its day is after the day the expiry was set and the
 * ledger has not sent it for this expiry. Documents with no expiry, already expired, or removed get nothing.
 */
export function orgComplianceRemindersDue(input: {
  documents: OrgComplianceDocuments | null | undefined
  todayKey: string
  timeZone?: string | null
  sent?: OrgComplianceReminderLedger | Record<string, unknown> | null
}): OrgComplianceRemindersResult {
  const { documents, todayKey, timeZone } = input
  const prior = parseOrgComplianceReminderLedger(input.sent && 'entries' in record(input.sent) ? input.sent : { entries: {} })
  const ledger: OrgComplianceReminderLedger = { entries: {} }
  const due: OrgComplianceReminderDue[] = []
  if (!validDayKey(todayKey)) return { due, ledger: prior }
  for (const section of ORG_COMPLIANCE_SECTION_KEYS) {
    for (const entry of documents?.[section] ?? []) {
      if (!entry || !validDayKey(entry.expiresOn) || !text(entry.id)) continue
      const key = ledgerKey(section, entry.id)
      // Two stored entries with one id (any letter case): the first counts, as the reader keeps it.
      if (ledger.entries[key]) continue
      const before = prior.entries[key]
      const known = before && before.expiresOn === entry.expiresOn ? before : null
      const setDayKey = orgComplianceReminderSetDayKey({ entry, prior: known, todayKey, timeZone })
      const record: OrgComplianceReminderLedgerEntry = {
        entryId: entry.id,
        section,
        expiresOn: entry.expiresOn,
        setDayKey,
        sent: { ...(known?.sent ?? {}) },
      }
      ledger.entries[key] = record
      if (todayKey > entry.expiresOn) continue
      let current: OrgComplianceReminderThreshold | null = null
      for (const threshold of ORG_COMPLIANCE_REMINDER_THRESHOLDS) {
        const day = orgComplianceReminderDayKey(entry.expiresOn, threshold)
        if (day && day <= todayKey) current = threshold
      }
      if (!current) continue
      const currentDay = orgComplianceReminderDayKey(entry.expiresOn, current)!
      if (!(currentDay > setDayKey)) continue
      if (record.sent[current.key]) continue
      due.push({
        section,
        sectionTitle: orgComplianceSection(section)?.title ?? section,
        entryId: entry.id,
        title: entry.title || orgComplianceDocTypeLabel(section, entry.docType),
        docTypeLabel: orgComplianceDocTypeLabel(section, entry.docType),
        expiresOn: entry.expiresOn,
        threshold: current.key,
        thresholdLabel: current.label,
        daysLeft: calendarDaysBetween(todayKey, entry.expiresOn),
      })
    }
  }
  due.sort((a, b) => a.expiresOn.localeCompare(b.expiresOn) || a.title.localeCompare(b.title, 'en-GB', { sensitivity: 'base' }))
  return { due, ledger }
}

/** The ledger after `sent` reminders went out today (each marked on its document's record). */
export function orgComplianceReminderLedgerAfter(input: {
  ledger: OrgComplianceReminderLedger
  sent: readonly Pick<OrgComplianceReminderDue, 'section' | 'entryId' | 'threshold' | 'expiresOn'>[]
  todayKey: string
}): OrgComplianceReminderLedger {
  const out: OrgComplianceReminderLedger = { entries: {} }
  for (const [key, row] of Object.entries(input.ledger.entries)) out.entries[key] = { ...row, sent: { ...row.sent } }
  for (const reminder of input.sent) {
    const row = out.entries[ledgerKey(reminder.section, reminder.entryId)]
    if (row && row.expiresOn === reminder.expiresOn) row.sent[reminder.threshold] = input.todayKey
  }
  return out
}

/** The stored shape (plain JSON; the server adds `updatedAt`). */
export function orgComplianceReminderLedgerFields(ledger: OrgComplianceReminderLedger): Record<string, unknown> {
  const entries: Record<string, unknown> = {}
  for (const [key, row] of Object.entries(ledger.entries)) {
    entries[key] = { entryId: row.entryId, section: row.section, expiresOn: row.expiresOn, setDayKey: row.setDayKey, sent: { ...row.sent } }
  }
  return { entries }
}

// ── Who gets it and what it says ────────────────────────────────────────────────────────────────────────────────

export type OrgComplianceReminderRecipient = { userId: string; email: string; firstName: string }

/**
 * A short, stable tag of what one email lists (each document and threshold, sorted), for the sender's idempotency key:
 * a same-day re-run that lists other documents is a different email and never reads as "already sent".
 */
export function orgComplianceReminderBatchTag(reminders: readonly Pick<OrgComplianceReminderDue, 'section' | 'entryId' | 'threshold' | 'expiresOn'>[]): string {
  const parts = reminders.map((r) => `${r.section}:${normalizeDocumentId(r.entryId)}:${r.expiresOn}:${r.threshold}`).sort()
  // FNV-1a 32-bit, twice with different seeds: 16 hex characters.
  const hash = (seed: number) => {
    let h = seed >>> 0
    for (const ch of parts.join('|')) {
      h ^= ch.codePointAt(0) ?? 0
      h = Math.imul(h, 0x01000193) >>> 0
    }
    return h.toString(16).padStart(8, '0')
  }
  return `${hash(0x811c9dc5)}${hash(0x9747b28c)}`
}

/**
 * The organisation's active admins and super admins outside operative mode (`companyActivityRecipients`, signed-in
 * accounts), never a ghost or a pending invite (`passwordSet` false), one per email address (without case), with an email.
 */
export function orgComplianceReminderRecipients(
  roster: ReadonlyArray<NotificationRosterMember & { email?: string | null; displayName?: string | null; firstName?: string | null }> | null | undefined
): OrgComplianceReminderRecipient[] {
  const members = (roster || []).filter((m) => m && typeof m === 'object')
  const ids = companyActivityRecipients(null, members)
  const out: OrgComplianceReminderRecipient[] = []
  const seen = new Set<string>()
  for (const id of ids) {
    const member = members.find((m) => normalizeDocumentId(String(m.id ?? '')) === normalizeDocumentId(id))
    const email = text(member?.email).toLowerCase()
    if (!member || !email || !email.includes('@') || seen.has(email)) continue
    const extra = member as { passwordSet?: unknown; ghost?: unknown }
    if (extra.passwordSet === false || extra.ghost === true) continue
    seen.add(email)
    // Only a stored first name; none → the email greets with "Hello," (never an email address or a guess).
    const first = text(member.firstName)
    out.push({ userId: id, email, firstName: first })
  }
  return out
}

export type OrgComplianceReminderEmailRow = {
  title: string
  kind: string
  expiryText: string
  whenText: string
}

export type OrgComplianceReminderEmail = {
  subject: string
  heading: string
  intro: string
  rows: OrgComplianceReminderEmailRow[]
  buttonLabel: string
  /** Web path of the page (the app adds the site origin). */
  path: string
  footer: string
}

export const ORG_COMPLIANCE_PAGE_PATH = '/dashboard/settings/insurance-accreditations'

function whenText(daysLeft: number): string {
  if (daysLeft <= 0) return 'Expires today'
  if (daysLeft === 1) return 'Expires tomorrow'
  return `Expires in ${daysLeft} days`
}

/** The words of one organisation's reminder email (one email per admin per day, every due document listed). */
export function orgComplianceReminderEmail(input: { organizationName: string; reminders: readonly OrgComplianceReminderDue[] }): OrgComplianceReminderEmail | null {
  const reminders = input.reminders || []
  if (reminders.length === 0) return null
  const org = text(input.organizationName) || 'your organisation'
  const n = reminders.length
  const first = reminders[0]
  const subject =
    n === 1
      ? `${first.title} expires ${subcontractorDocumentExpiryDateText(first.expiresOn)} — ${org}`
      : `${n} insurance or accreditation documents expire soon — ${org}`
  return {
    subject,
    heading: n === 1 ? 'A certificate expires soon' : `${n} certificates expire soon`,
    intro: `These ${ORG_COMPLIANCE_PAGE_TITLE.toLowerCase()} documents for ${org} expire soon. Upload the renewed certificate in Project Planner so it stays ready to share.`,
    rows: reminders.map((r) => ({
      title: r.title,
      kind: `${r.sectionTitle} · ${r.docTypeLabel}`,
      expiryText: subcontractorDocumentExpiryDateText(r.expiresOn),
      whenText: whenText(r.daysLeft),
    })),
    buttonLabel: `Open ${ORG_COMPLIANCE_PAGE_TITLE}`,
    path: ORG_COMPLIANCE_PAGE_PATH,
    footer: `You get this email because you are an admin of ${org}. Reminders are sent 2 months, 1 month and 7 days before a document expires.`,
  }
}
