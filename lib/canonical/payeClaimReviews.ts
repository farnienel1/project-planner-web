/**
 * PAYE price work and expenses review (rulebook §26, 1.32.0, owner decisions 4 Nov): the review screen matches the
 * overtime review (§25) — ✓ or ✕ on each item, one Approve button, "Approved X of Y" — with the same all-records-per-
 * person check (`overtimePersonIds`).
 *
 * Who reviews: the person's active line managers and the active admins outside operative mode, never the person under
 * any of their ids (`canReviewPayeClaims`, the same people as `canDecideOvertimeRequest`). A review is one document per
 * item, `payeClaimReviews/{kind}_{itemId}` (`payeClaimReviewDocId`): `{ userId, itemId, kind, decision: approved |
 * rejected, fingerprint, reviewedBy, reviewedAt }`. The fingerprint (`payeClaimFingerprint`) is the item's name, job
 * number, dates, figure, currency and evidence count, so an item the person changes after a review needs review again.
 * Items are never rewritten by a reviewer: only the person writes their items (`canWritePayeClaim`).
 *
 * Owner decision A (as for overtime): an item filed under another of the person's ids — an older users id (a former
 * invite id or a same-email document) — is reviewed by admins only; the line manager sees "Needs an admin", because the
 * security rules match a line manager through the users document named on the item.
 *
 * A review informs the person's accounts team; the report (`payeClaimReportReady`) does not wait for it.
 */

import { reviewApprovalMessage, OVERTIME_NEEDS_ADMIN_LABEL } from './payeOvertime'
import { isAdminOutsideOperativeMode, lineManagerIds, type LeaveSelfBookUser } from './leaveRequests'
import { idKey, idText, personIdSet } from './personIds'
import type { NotificationRosterMember } from './notificationRecipients'
import type { PayeClaimItem, PayeClaimKind } from './payeClaims'

export const PAYE_CLAIM_REVIEWS_COLLECTION = 'payeClaimReviews'
export const PAYE_CLAIM_REVIEW_DECISIONS = ['approved', 'rejected'] as const
export type PayeClaimReviewDecision = (typeof PAYE_CLAIM_REVIEW_DECISIONS)[number]

export const PAYE_CLAIM_REVIEW_STATES = ['needsReview', 'approved', 'rejected'] as const
export type PayeClaimReviewState = (typeof PAYE_CLAIM_REVIEW_STATES)[number]
export const PAYE_CLAIM_REVIEW_STATE_LABELS: Readonly<Record<PayeClaimReviewState, string>> = {
  needsReview: 'Needs review',
  approved: 'Approved',
  rejected: 'Rejected',
}

export type PayeClaimReviewRecord = {
  id: string
  userId: string
  itemId: string
  kind: PayeClaimKind
  decision: PayeClaimReviewDecision
  fingerprint: string
  reviewedBy: string | null
  reviewedAtMs: number | null
}

function text(value: unknown): string {
  return value == null ? '' : String(value).trim()
}

function instantMs(raw: unknown): number | null {
  if (raw == null || raw === '') return null
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null
  if (raw instanceof Date) return Number.isNaN(raw.getTime()) ? null : raw.getTime()
  if (typeof raw === 'object') {
    const row = raw as Record<string, unknown>
    if (typeof row.toMillis === 'function') {
      const ms = Number((row.toMillis as () => number)())
      return Number.isFinite(ms) ? ms : null
    }
    const seconds = Number(row.seconds ?? row._seconds)
    return Number.isFinite(seconds) ? seconds * 1000 : null
  }
  if (typeof raw === 'string') {
    const ms = Date.parse(raw)
    return Number.isNaN(ms) ? null : ms
  }
  return null
}

/** `{kind}_{itemId}` as stored. */
export function payeClaimReviewDocId(kind: PayeClaimKind, itemId: string): string {
  return `${kind === 'expense' ? 'expense' : 'priceWork'}_${text(itemId)}`
}

/** The item's fingerprint: kind, name, job number, dates, figure (2 dp), currency and evidence count. */
export function payeClaimFingerprint(item: PayeClaimItem | null | undefined): string {
  if (!item) return ''
  const dates = item.kind === 'priceWork' ? `${text(item.startDate)}~${text(item.endDate)}` : text(item.date)
  const amount = (Math.round((Number(item.amount) || 0) * 100) / 100).toFixed(2)
  return [item.kind, text(item.title), text(item.jobNumber), dates, amount, text(item.currency).toUpperCase(), String((item.evidence || []).length)].join('|')
}

/** Reads `organizations/{orgId}/payeClaimReviews/{kind}_{itemId}`. Never throws; an unknown decision reads as rejected. */
export function parsePayeClaimReviewDocument(docId: string, data: Record<string, unknown> | null | undefined): PayeClaimReviewRecord {
  const row = data && typeof data === 'object' ? data : {}
  return {
    id: text(docId),
    userId: text(row.userId),
    itemId: text(row.itemId),
    kind: text(row.kind) === 'expense' ? 'expense' : 'priceWork',
    decision: text(row.decision) === 'approved' ? 'approved' : 'rejected',
    fingerprint: text(row.fingerprint),
    reviewedBy: text(row.reviewedBy) || null,
    reviewedAtMs: instantMs(row.reviewedAt),
  }
}

/** An item's state: the review whose fingerprint is the item's current one, else Needs review. */
export function payeClaimReviewState(
  item: PayeClaimItem,
  reviews: ReadonlyArray<PayeClaimReviewRecord> | null | undefined
): { state: PayeClaimReviewState; label: string; review: PayeClaimReviewRecord | null } {
  const review =
    (reviews || []).find((row) => row.kind === item.kind && idKey(row.itemId) === idKey(item.id) && row.fingerprint === payeClaimFingerprint(item)) ?? null
  const state: PayeClaimReviewState = review ? review.decision : 'needsReview'
  return { state, label: PAYE_CLAIM_REVIEW_STATE_LABELS[state], review }
}

type ClaimPerson = LeaveSelfBookUser & { id?: string | null; isActive?: boolean | null }

/** Who reviews a person's price work and expenses: their active line managers and active admins, never themself. */
export function canReviewPayeClaims(
  viewer: ClaimPerson | null | undefined,
  subject: ClaimPerson | null | undefined,
  roster?: ReadonlyArray<NotificationRosterMember> | null
): boolean {
  if (!viewer || !subject || !idText(viewer.id) || !idText(subject.id)) return false
  if (viewer.isActive === false) return false
  const members = (roster || []) as NotificationRosterMember[]
  const subjectIds = new Set(personIdSet(subject as never, members).map(idKey))
  const viewerIds = personIdSet(viewer as never, members).map(idKey)
  if (viewerIds.some((id) => subjectIds.has(id))) return false
  if (isAdminOutsideOperativeMode(viewer)) return true
  const managers = new Set(lineManagerIds(subject, members).map(idKey))
  return viewerIds.some((id) => managers.has(id))
}

export type PayeClaimReviewOutcome = 'applied' | 'undecided' | 'needsAdmin' | 'foreign' | 'unchanged'

/**
 * Approve on Price work / Expenses (1.32.0): one review write per decided item the reviewer may write. An item on none
 * of `personIds` is left out (`foreign`); an item filed under another of the person's ids than `subjectUserId` needs an
 * admin when the reviewer is not one (`needsAdmin`, owner decision A); an item already reviewed the same way at its
 * current fingerprint is `unchanged`; an item without a ✓ or ✕ stays `undecided`. `message` is
 * `reviewApprovalMessage` ("Approved 2 of 5. 1 rejected; 1 needs an admin; 1 not decided yet."). The app adds
 * `reviewedAt` (server time) and write metadata, and writes every review in one batch.
 */
export function payeClaimReviewWrites(input: {
  items: ReadonlyArray<PayeClaimItem>
  decisions: Record<string, PayeClaimReviewDecision | null | undefined>
  reviews?: ReadonlyArray<PayeClaimReviewRecord> | null
  /** The person's users id (the id the rules match a line manager through). */
  subjectUserId: string
  /** Every id the person goes by (`overtimePersonIds`). */
  personIds: ReadonlyArray<string>
  reviewerId: string
  reviewerIsAdmin: boolean
}): {
  writes: Array<{ docId: string; fields: Record<string, unknown> }>
  outcomes: Record<string, PayeClaimReviewOutcome>
  approved: number
  rejected: number
  message: string
} {
  const ids = new Set((input.personIds || []).map(idKey).filter(Boolean))
  const decisions = new Map(Object.entries(input.decisions || {}).map(([key, value]) => [idKey(key), value]))
  const writes: Array<{ docId: string; fields: Record<string, unknown> }> = []
  const outcomes: Record<string, PayeClaimReviewOutcome> = {}
  let approved = 0
  let rejected = 0
  let needsAdmin = 0
  let undecided = 0
  let foreign = 0
  for (const item of input.items || []) {
    if (!ids.has(idKey(item.userId))) {
      outcomes[item.id] = 'foreign'
      foreign += 1
      continue
    }
    const decision = decisions.get(idKey(item.id))
    if (decision !== 'approved' && decision !== 'rejected') {
      outcomes[item.id] = 'undecided'
      undecided += 1
      continue
    }
    if (!input.reviewerIsAdmin && idKey(item.userId) !== idKey(input.subjectUserId)) {
      outcomes[item.id] = 'needsAdmin'
      needsAdmin += 1
      continue
    }
    const current = payeClaimReviewState(item, input.reviews)
    if (current.review && current.review.decision === decision) {
      outcomes[item.id] = 'unchanged'
    } else {
      writes.push({
        docId: payeClaimReviewDocId(item.kind, item.id),
        fields: {
          userId: text(item.userId),
          itemId: text(item.id),
          kind: item.kind,
          decision,
          fingerprint: payeClaimFingerprint(item),
          reviewedBy: text(input.reviewerId),
        },
      })
      outcomes[item.id] = 'applied'
    }
    if (decision === 'approved') approved += 1
    else rejected += 1
  }
  const total = (input.items || []).length - foreign
  const message = reviewApprovalMessage({ approved, total, counts: { rejected, needsAdmin, undecided } })
  return { writes, outcomes, approved, rejected, message }
}

/** The per-item label for an item the reviewer cannot apply ("Needs an admin"); null otherwise. */
export function payeClaimReviewOutcomeLabel(outcome: PayeClaimReviewOutcome | null | undefined): string | null {
  return outcome === 'needsAdmin' ? OVERTIME_NEEDS_ADMIN_LABEL : outcome === 'foreign' ? 'Not theirs — left out.' : null
}
