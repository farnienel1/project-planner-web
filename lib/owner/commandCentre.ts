/**
 * Owner console Overview (spec §4.1, PLAN §8 PR 2). Pure functions over the directory rows the server already builds
 * (`ownerOrgRows`, `ownerPeopleRows`: people are one per email by the rulebook's `rosterPeople`; deletion is
 * `organizationDeletionState`; subscription access is `hasAccess`) and the newest audit log entries, so every figure
 * is unit-tested against the hand-worked seed (scripts/owner-console-seed/expected.json). Definitions:
 * lib/owner/metricContracts.ts.
 *
 * Left out on purpose (PR body, "Useful-only audit"): signed timesheet value and its 12-month chart (need the
 * rulebook's signedTimesheetValueOf and the rollups, PR 6); active people per day with the web / iOS split (needs the
 * daily record, PR 6, and D6's lastSeenFrom); items waiting on you and the top of Needs you (PR 3).
 */
import { hasAccess } from '@/lib/canonical/billingAccess'
import type { OwnerOrgRow, OwnerPersonRow, PlainDoc } from '@/lib/owner/directory'
import type { AttentionReasonKind } from '@/lib/owner/metricContracts'

const DAY_MS = 24 * 60 * 60 * 1000
export const QUIET_AFTER_DAYS = 14
export const TRIAL_ENDING_WITHIN_DAYS = 7
export const LIVE_FEED_LIMIT = 25
/** Audit entries read for the feed (reveals are skipped, so more than the feed holds). */
export const AUDIT_FEED_READ = 60

export type CommandCentreRange = { start: Date; end: Date; previousStart: Date; previousEnd: Date }

function inRange(ms: number | null | undefined, start: Date, end: Date): boolean {
  return ms != null && ms >= start.getTime() && ms <= end.getTime()
}

function timeMs(value: unknown): number | null {
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value.getTime() : null
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return value
  if (typeof value === 'string' && value.trim()) {
    const ms = Date.parse(value)
    return Number.isFinite(ms) ? ms : null
  }
  if (value && typeof value === 'object') {
    const rec = value as { seconds?: unknown; _seconds?: unknown }
    const seconds = typeof rec.seconds === 'number' ? rec.seconds : typeof rec._seconds === 'number' ? rec._seconds : null
    if (seconds != null && seconds > 0) return Math.round(seconds * 1000)
  }
  return null
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

// MARK: - Headline

export type HeadlineCount = { value: number }

export type MrrHeadline = {
  /** Sum of `billing.mrrPence` of paying organisations (active, or past_due within grace). */
  pence: number
  payingOrganisations: number
  /** Paying organisations with no `mrrPence` (missing or 0): listed, never filled in. */
  missing: { id: string; name: string }[]
  trials: number
}

export type CountWithPrevious = { value: number; previous: number }

export type CommandCentreHeadline = {
  activeOrganisations: HeadlineCount
  activePeople: HeadlineCount
  mrr: MrrHeadline
  newPeople: CountWithPrevious
  newOrganisations: CountWithPrevious
}

function visibleOrgs(orgRows: readonly OwnerOrgRow[], includeTestData: boolean): OwnerOrgRow[] {
  return orgRows.filter((row) => includeTestData || !row.isTest)
}

function visiblePeople(peopleRows: readonly OwnerPersonRow[], includeTestData: boolean): OwnerPersonRow[] {
  return peopleRows.filter((row) => includeTestData || !row.isTest)
}

/** True when the organisation is paying now: active, or past_due still within the grace (rulebook hasAccess). */
export function isPayingOrganisation(row: Pick<OwnerOrgRow, 'billingStatus' | 'lastPaymentFailedAtMs'>, nowMs: number): boolean {
  if (row.billingStatus === 'active') return true
  if (row.billingStatus === 'past_due') {
    return hasAccess({ status: 'past_due', lastPaymentFailedAt: row.lastPaymentFailedAtMs }, nowMs)
  }
  return false
}

export function commandCentreHeadline(input: {
  orgRows: readonly OwnerOrgRow[]
  peopleRows: readonly OwnerPersonRow[]
  range: CommandCentreRange
  includeTestData: boolean
  nowMs: number
}): CommandCentreHeadline {
  const { range, includeTestData, nowMs } = input
  const orgs = visibleOrgs(input.orgRows, includeTestData)
  const people = visiblePeople(input.peopleRows, includeTestData)
  const seen = people.filter((row) => inRange(row.lastSeenAtMs, range.start, range.end))
  const orgsWithActivePeople = new Set(seen.flatMap((row) => row.organizationIds))
  const activeOrganisations = orgs.filter((org) => org.deletion === 'active' && orgsWithActivePeople.has(org.id)).length

  let pence = 0
  let payingOrganisations = 0
  let trials = 0
  const missing: { id: string; name: string }[] = []
  for (const org of orgs) {
    if (org.billingStatus === 'trialing') trials += 1
    if (!isPayingOrganisation(org, nowMs)) continue
    payingOrganisations += 1
    if (org.mrrPence && org.mrrPence > 0) pence += org.mrrPence
    else missing.push({ id: org.id, name: org.name })
  }

  const createdIn = (start: Date, end: Date) => ({
    people: people.filter((row) => inRange(row.createdAtMs, start, end)).length,
    orgs: orgs.filter((row) => inRange(row.createdAtMs, start, end)).length,
  })
  const current = createdIn(range.start, range.end)
  // "To date" has an empty previous window (start = end): its comparison is 0, as the period selector defines it.
  const previous =
    range.previousEnd.getTime() > range.previousStart.getTime() ? createdIn(range.previousStart, range.previousEnd) : { people: 0, orgs: 0 }

  return {
    activeOrganisations: { value: activeOrganisations },
    activePeople: { value: seen.length },
    mrr: { pence, payingOrganisations, missing: missing.sort((a, b) => a.name.localeCompare(b.name)), trials },
    newPeople: { value: current.people, previous: previous.people },
    newOrganisations: { value: current.orgs, previous: previous.orgs },
  }
}

// MARK: - Organisations needing attention

export type AttentionReason = { kind: AttentionReasonKind; label: string }
export type AttentionRow = { orgId: string; name: string; reasons: AttentionReason[] }

const REASON_ORDER: AttentionReasonKind[] = ['scheduled', 'paymentFailed', 'lapsed', 'trialEnding', 'cancelling', 'unfinished', 'quiet']

function daysText(days: number): string {
  return `${days} day${days === 1 ? '' : 's'}`
}

/** The newest last-seen time of anyone in each organisation (every person, test or not: quiet is about real use). */
export function latestSeenByOrganisation(peopleRows: readonly OwnerPersonRow[]): Map<string, number> {
  const out = new Map<string, number>()
  for (const row of peopleRows) {
    if (row.lastSeenAtMs == null) continue
    for (const orgId of row.organizationIds) {
      const current = out.get(orgId)
      if (current == null || row.lastSeenAtMs > current) out.set(orgId, row.lastSeenAtMs)
    }
  }
  return out
}

export function attentionReasons(org: OwnerOrgRow, latestSeenMs: number | null, nowMs: number): AttentionReason[] {
  if (org.deletion === 'erased') return []
  if (org.deletion === 'scheduled') {
    // A company scheduled for deletion is listed for that alone: its subscription stopping is part of the deletion.
    const days = org.eraseAfterMs == null ? null : Math.max(0, Math.ceil((org.eraseAfterMs - nowMs) / DAY_MS))
    return [{ kind: 'scheduled', label: days == null ? 'Scheduled for deletion' : `Scheduled for deletion · erased in ${daysText(days)}` }]
  }
  const reasons: AttentionReason[] = []
  const status = org.billingStatus
  if (status === 'past_due' || status === 'unpaid') {
    const open = hasAccess({ status, lastPaymentFailedAt: org.lastPaymentFailedAtMs }, nowMs)
    reasons.push({ kind: 'paymentFailed', label: open ? 'Payment failed · in grace' : 'Payment failed · apps blocked' })
  } else if (org.lapsed) {
    reasons.push({ kind: 'lapsed', label: `Subscription ${status || 'lapsed'} · apps blocked` })
  }
  if (status === 'trialing' && org.trialEndMs != null) {
    const days = Math.ceil((org.trialEndMs - nowMs) / DAY_MS)
    if (days <= TRIAL_ENDING_WITHIN_DAYS) {
      reasons.push({ kind: 'trialEnding', label: days < 0 ? 'Trial ended' : days === 0 ? 'Trial ends today' : `Trial ends in ${daysText(days)}` })
    }
  }
  if (org.cancelAtPeriodEnd && !org.lapsed) reasons.push({ kind: 'cancelling', label: 'Cancels at the end of the paid period' })
  if (org.unfinished) {
    reasons.push({ kind: 'unfinished', label: 'Setup unfinished' })
  } else {
    const oldEnough = org.createdAtMs == null || nowMs - org.createdAtMs >= QUIET_AFTER_DAYS * DAY_MS
    const quietFor = latestSeenMs == null ? null : Math.floor((nowMs - latestSeenMs) / DAY_MS)
    if (oldEnough && (quietFor == null || quietFor >= QUIET_AFTER_DAYS)) {
      reasons.push({ kind: 'quiet', label: quietFor == null ? 'Quiet · nobody has been seen yet' : `Quiet · nobody seen for ${daysText(quietFor)}` })
    }
  }
  return reasons
}

/** Every organisation with at least one reason, the most urgent first (then by name). Test ones only when included. */
export function organisationsNeedingAttention(input: {
  orgRows: readonly OwnerOrgRow[]
  peopleRows: readonly OwnerPersonRow[]
  includeTestData: boolean
  nowMs: number
}): AttentionRow[] {
  const latest = latestSeenByOrganisation(input.peopleRows)
  const rows = visibleOrgs(input.orgRows, input.includeTestData)
    .map((org) => ({ orgId: org.id, name: org.name, reasons: attentionReasons(org, latest.get(org.id) ?? null, input.nowMs) }))
    .filter((row) => row.reasons.length > 0)
  const rank = (row: AttentionRow) => Math.min(...row.reasons.map((reason) => REASON_ORDER.indexOf(reason.kind)))
  return rows.sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }) || a.orgId.localeCompare(b.orgId))
}

// MARK: - Live feed

export type LiveFeedItem = {
  id: string
  kind: 'person' | 'organisation' | 'ownerAction'
  atMs: number
  title: string
  detail: string
  /** The organisation page it opens, when there is one. */
  orgId?: string
  /** The People list search it opens (by name), when it is about a person and no organisation. */
  personQuery?: string
}

/** Readable names of the owner actions the console writes (unknown names are shown as stored). */
const OWNER_ACTION_LABELS: Record<string, string> = {
  ownerMarkInternal: 'Marked internal / test',
  ownerRestoreOrganisation: 'Restored an organisation',
  ownerChangeUserEmail: 'Changed a login email',
  ownerSendPasswordReset: 'Sent a password reset',
  ownerDeleteUnfinishedUser: 'Deleted an unfinished sign-up',
  accountDelete: 'Account deleted by its owner',
}

/** Reveals are logged for the record but are not news; the Audit log page (PR 10) lists them. */
export function isRevealAction(action: string): boolean {
  return /^(owner)?reveal/i.test(action)
}

export function ownerActionLabel(action: string): string {
  return OWNER_ACTION_LABELS[action] || action
}

type AuditRow = { key: string; action: string; phase: string; atMs: number; targetOrgId: string; targetUserId: string }

/** One line per action: the latest step of each `requestId` (an entry without one stands alone). Reveals skipped. */
export function latestOwnerActions(entries: readonly PlainDoc[]): AuditRow[] {
  const byKey = new Map<string, AuditRow>()
  for (const entry of entries) {
    const data = entry.data || {}
    const action = text(data.action)
    const atMs = timeMs(data.at)
    if (!action || atMs == null || isRevealAction(action)) continue
    const key = text(data.requestId) || `doc:${entry.id}`
    const row: AuditRow = { key, action, phase: text(data.phase), atMs, targetOrgId: text(data.targetOrgId), targetUserId: text(data.targetUserId) }
    const current = byKey.get(key)
    if (!current || row.atMs > current.atMs || (row.atMs === current.atMs && current.phase === 'requested' && row.phase !== 'requested')) {
      byKey.set(key, row)
    }
  }
  return [...byKey.values()]
}

const PHASE_TEXT: Record<string, string> = { requested: 'started, not finished', completed: 'done', failed: 'failed' }

export function liveFeed(input: {
  orgRows: readonly OwnerOrgRow[]
  peopleRows: readonly OwnerPersonRow[]
  auditEntries: readonly PlainDoc[]
  includeTestData: boolean
  limit?: number
}): LiveFeedItem[] {
  const orgs = visibleOrgs(input.orgRows, input.includeTestData)
  const allOrgsById = new Map(input.orgRows.map((org) => [org.id, org]))
  const items: LiveFeedItem[] = []
  for (const person of visiblePeople(input.peopleRows, input.includeTestData)) {
    if (person.createdAtMs == null) continue
    const where = person.organizationNames.join(', ') || 'No organisation'
    items.push({
      id: `person:${person.id}`,
      kind: 'person',
      atMs: person.createdAtMs,
      title: person.segment === 'pending' ? `Invited: ${person.name}` : `New person: ${person.name}`,
      detail: person.segment === 'pending' ? `${where} · invite not accepted yet` : where,
      personQuery: person.name,
    })
  }
  for (const org of orgs) {
    if (org.createdAtMs == null) continue
    items.push({
      id: `org:${org.id}`,
      kind: 'organisation',
      atMs: org.createdAtMs,
      title: `New organisation: ${org.name}`,
      detail: org.unfinished ? 'Setup unfinished' : org.billingStatus ? `Billing: ${org.billingStatus}` : 'No billing yet',
      orgId: org.id,
    })
  }
  const personByUserId = new Map<string, OwnerPersonRow>()
  for (const person of input.peopleRows) for (const id of person.userIds) personByUserId.set(id, person)
  // Owner actions are the owner's own record: always shown, whatever the test-data choice.
  for (const action of latestOwnerActions(input.auditEntries)) {
    const org = action.targetOrgId ? allOrgsById.get(action.targetOrgId) : undefined
    const person = action.targetUserId ? personByUserId.get(action.targetUserId) : undefined
    const target = [org?.name || (action.targetOrgId ? 'Unknown organisation' : ''), person?.name || (action.targetUserId ? 'Unknown person' : '')]
      .filter(Boolean)
      .join(' · ')
    items.push({
      id: `audit:${action.key}`,
      kind: 'ownerAction',
      atMs: action.atMs,
      title: `Owner action: ${ownerActionLabel(action.action)}`,
      detail: [target, PHASE_TEXT[action.phase] || ''].filter(Boolean).join(' · '),
      ...(org ? { orgId: org.id } : person ? { personQuery: person.name } : {}),
    })
  }
  return items.sort((a, b) => b.atMs - a.atMs || a.id.localeCompare(b.id)).slice(0, input.limit ?? LIVE_FEED_LIMIT)
}

// MARK: - The whole page

export type CommandCentre = {
  headline: CommandCentreHeadline
  attention: AttentionRow[]
  feed: LiveFeedItem[]
}

export function commandCentre(input: {
  orgRows: readonly OwnerOrgRow[]
  peopleRows: readonly OwnerPersonRow[]
  auditEntries: readonly PlainDoc[]
  range: CommandCentreRange
  includeTestData: boolean
  nowMs: number
}): CommandCentre {
  return {
    headline: commandCentreHeadline(input),
    attention: organisationsNeedingAttention(input),
    feed: liveFeed(input),
  }
}
