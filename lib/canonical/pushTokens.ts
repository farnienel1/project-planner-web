/**
 * Device push tokens and the push payload (rulebook 1.16.0, §13).
 *
 * A device token belongs to exactly one account: the last one to register it. When a token is added to
 * `users/{uid}.pushTokens`, the server removes it from every other users document (`pushTokenOwnerWrites`); a one-off
 * clean-up keeps each token only on the signed-in account that registered it most recently (`pushTokenDedupePlan`).
 * 1.17.0: a token never belongs to an invite placeholder users document (a UUID-shaped id, `isPushTokenPlaceholderUserId`;
 * Firebase Auth uids are never UUID-shaped): placeholders always lose their tokens. The push function
 * also never sends to a token that is on the actor's own users document (`pushTokensExcludingActor`), so a phone
 * shared between accounts never hears about what its own user did.
 *
 * The push data payload is one shape for every platform (`pushPayloadFields`).
 */

import { isBookingUuid } from './bookings'

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

/**
 * Rulebook 1.17.0 §13: true when a users document id is UUID-shaped (any letter case) — an invite / placeholder
 * document, never a Firebase Auth uid (28 characters, no dashes). A device push token is never kept on one.
 */
export function isPushTokenPlaceholderUserId(userId: unknown): boolean {
  return isBookingUuid(text(userId))
}

/** A stored `pushTokens` value as a de-duplicated list (an array, or one legacy string). */
export function pushTokenList(raw: unknown): string[] {
  const list = Array.isArray(raw) ? raw : [raw]
  const out: string[] = []
  for (const value of list as unknown[]) {
    const token = text(value)
    if (token && !out.includes(token)) out.push(token)
  }
  return out
}

/** Tokens in `after` that were not in `before` (a users document write). */
export function addedPushTokens(before: unknown, after: unknown): string[] {
  const old = new Set(pushTokenList(before))
  return pushTokenList(after).filter((token) => !old.has(token))
}

export type PushTokenHolder = { id: string; pushTokens?: unknown }

/**
 * The removals that make `token` belong only to `ownerUid`: one `{ userId, remove: [token] }` per other users
 * document that holds it (ids compared as stored; Firestore document ids are case-sensitive). The server applies
 * each as an `arrayRemove`. 1.17.0: when `ownerUid` is a placeholder (`isPushTokenPlaceholderUserId`) it is never the
 * owner — the only write removes the token from that placeholder, and the signed-in accounts keep it.
 */
export function pushTokenOwnerWrites(
  token: unknown,
  ownerUid: unknown,
  holders: ReadonlyArray<PushTokenHolder> | null | undefined
): Array<{ userId: string; remove: string[] }> {
  const value = text(token)
  const owner = text(ownerUid)
  if (!value || !owner) return []
  if (isPushTokenPlaceholderUserId(owner)) return [{ userId: owner, remove: [value] }]
  const out: Array<{ userId: string; remove: string[] }> = []
  const seen = new Set<string>()
  for (const holder of holders || []) {
    const id = text(holder?.id)
    if (!id || id === owner || seen.has(id)) continue
    if (!pushTokenList(holder.pushTokens).includes(value)) continue
    seen.add(id)
    out.push({ userId: id, remove: [value] })
  }
  return out
}

export type PushTokenDocument = PushTokenHolder & {
  /** When this document last registered a token (ms, Date, Timestamp, ISO). */
  pushTokenUpdatedAt?: unknown
  updatedAt?: unknown
}

function instantMs(value: unknown): number {
  if (value == null) return 0
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? 0 : value.getTime()
  if (typeof value === 'string') {
    const ms = Date.parse(value)
    return Number.isNaN(ms) ? 0 : ms
  }
  if (typeof value === 'object') {
    const row = value as Record<string, unknown>
    if (typeof row.toMillis === 'function') return Number((row.toMillis as () => number)()) || 0
    const seconds = Number(row.seconds ?? row._seconds)
    if (Number.isFinite(seconds)) return seconds * 1000
  }
  return 0
}

/**
 * The one-off clean-up (1.17.0). A placeholder users document (`isPushTokenPlaceholderUserId`) always loses its
 * tokens. A token on more than one signed-in account is kept on the account that registered it most recently by
 * `pushTokenUpdatedAt`; `updatedAt` is compared only when none of those accounts has a `pushTokenUpdatedAt` (a tie keeps
 * the first given). A token that sits only on placeholders is removed everywhere (`keptOn` is null) — the phone
 * registers it again on its signed-in uid at next launch. Returns one `{ userId, remove, keptOn }` per document that
 * loses tokens, in input order.
 */
export function pushTokenDedupePlan(
  documents: ReadonlyArray<PushTokenDocument> | null | undefined
): Array<{ userId: string; remove: string[]; keptOn: Record<string, string | null> }> {
  const docs = (documents || []).filter((doc) => doc && text(doc.id))
  const holders = new Map<string, PushTokenDocument[]>()
  for (const doc of docs) {
    if (isPushTokenPlaceholderUserId(doc.id)) continue
    for (const token of pushTokenList(doc.pushTokens)) {
      const list = holders.get(token) ?? []
      list.push(doc)
      holders.set(token, list)
    }
  }
  const keeper = new Map<string, string>()
  for (const [token, list] of holders) {
    const byTokenTime = list.some((doc) => instantMs(doc.pushTokenUpdatedAt) > 0)
    let best: { id: string; ms: number } | null = null
    for (const doc of list) {
      const ms = byTokenTime ? instantMs(doc.pushTokenUpdatedAt) : instantMs(doc.updatedAt)
      if (!best || ms > best.ms) best = { id: text(doc.id), ms }
    }
    if (best) keeper.set(token, best.id)
  }
  const out: Array<{ userId: string; remove: string[]; keptOn: Record<string, string | null> }> = []
  for (const doc of docs) {
    const id = text(doc.id)
    const remove: string[] = []
    const keptOn: Record<string, string | null> = {}
    for (const token of pushTokenList(doc.pushTokens)) {
      const kept = keeper.get(token) ?? null
      if (kept !== id) {
        remove.push(token)
        keptOn[token] = kept
      }
    }
    if (remove.length > 0) out.push({ userId: id, remove, keptOn })
  }
  return out
}

/** The recipient's tokens without any token also on the actor's users document. */
export function pushTokensExcludingActor(recipientTokens: unknown, actorTokens: unknown): string[] {
  const actor = new Set(pushTokenList(actorTokens))
  return pushTokenList(recipientTokens).filter((token) => !actor.has(token))
}

export type PushPayloadRow = {
  notificationId?: unknown
  id?: unknown
  type?: unknown
  relatedId?: unknown
  dayKey?: unknown
  catalogue?: unknown
  userId?: unknown
  organizationId?: unknown
}

/** The keys of the push data payload, in order. */
export const PUSH_PAYLOAD_KEYS = ['notificationId', 'type', 'relatedId', 'dayKey', 'catalogue', 'userId', 'organizationId'] as const

/**
 * The device push data payload for an inbox row: `notificationId`, `type`, `relatedId`, `dayKey`, `catalogue`,
 * `userId`, `organizationId` — string values only (FCM data), a missing value left out. A tapped push routes with the
 * same fields as tapping the row in the notification centre, and `organizationId` names the row's company
 * (`notificationOrganizationSwitch`).
 */
export function pushPayloadFields(row: PushPayloadRow | null | undefined): Record<string, string> {
  const source = row || {}
  const values: Record<string, string> = {
    notificationId: text(source.notificationId) || text(source.id),
    type: text(source.type),
    relatedId: text(source.relatedId),
    dayKey: /^\d{4}-\d{2}-\d{2}$/.test(text(source.dayKey)) ? text(source.dayKey) : '',
    catalogue: text(source.catalogue) === 'projects' || text(source.catalogue) === 'smallWorks' ? text(source.catalogue) : '',
    userId: text(source.userId),
    organizationId: text(source.organizationId),
  }
  const out: Record<string, string> = {}
  for (const key of PUSH_PAYLOAD_KEYS) if (values[key]) out[key] = values[key]
  return out
}

/**
 * Rows in another company (1.16.0, interim product rule): tapping a push or row whose `organizationId` is not the
 * open organisation switches to that organisation first when the person is a member of it (`membershipIds`, from
 * `sessionMembershipIds`), then routes. Returns the organisation id to switch to, or null (same company, unknown
 * company, or not a member — then the app routes in the open company or shows the inbox).
 */
export function notificationOrganizationSwitch(input: {
  rowOrganizationId?: unknown
  openOrganizationId?: unknown
  membershipIds?: ReadonlyArray<string> | null
}): string | null {
  const row = text(input?.rowOrganizationId)
  const open = text(input?.openOrganizationId)
  if (!row || row.toLowerCase() === open.toLowerCase()) return null
  const member = (input.membershipIds || []).some((id) => text(id).toLowerCase() === row.toLowerCase())
  return member ? row : null
}
