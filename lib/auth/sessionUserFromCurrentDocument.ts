import type { User } from '@/types'
import { parseAppUserDocument } from '@/lib/ios-parity/converters'

function organizationIdsMatch(lhs?: string | null, rhs?: string | null): boolean {
  const left = String(lhs || '').trim().toLowerCase()
  const right = String(rhs || '').trim().toLowerCase()
  return left.length > 0 && left === right
}

/** Who this person is: shown the same in every company they belong to. */
const PERSONAL_FIELDS = [
  'firstName',
  'surname',
  'mobileNumber',
  'profilePhotoURL',
  'tradeTypePreset',
  'tradeTypeCustom',
] as const

/** Session-only fields the listener never takes from the document. */
const SESSION_FIELDS = new Set<string>([
  'id',
  'organizationId',
  // The parser fills a missing createdAt with "now", which differs on every snapshot.
  'createdAt',
  // The private taxIds document fills these, not users/{uid}.
  'vatNumber',
  'utrNumber',
])

/** Changes in these alone do not republish the session (every visit writes lastSeenAt). */
const QUIET_FIELDS = new Set<string>(['updatedAt', 'lastSeenAt'])

function comparable(value: unknown): unknown {
  if (value instanceof Date) return value.getTime()
  if (Array.isArray(value)) return value.map(comparable)
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      out[key] = comparable((value as Record<string, unknown>)[key])
    }
    return out
  }
  return value
}

function signature(user: User): string {
  const out: Record<string, unknown> = {}
  for (const key of Object.keys(user).sort()) {
    if (QUIET_FIELDS.has(key)) continue
    const value = (user as unknown as Record<string, unknown>)[key]
    if (value === undefined) continue
    out[key] = comparable(value)
  }
  return JSON.stringify(out)
}

/**
 * iOS UserStore.startCurrentUserListener applies the shared user document to the session, so
 * a photo, name, mobile, line manager, rate, employment type or permission saved on iOS (or in
 * another tab) shows live.
 *
 * - An older write than the profile already in memory is ignored (stale-snapshot guard).
 * - While this browser has a different company open than the document's `organizationId`
 *   (the last iOS switch), only personal fields apply; company-scoped access, rates and line
 *   managers wait until the document names this company.
 * - Session fixes made at sign-in stay: the open company, an email when the document has none,
 *   `passwordSet` / `policyAccepted` / `accountConfirmed` once true, `createdAt`, and the private
 *   VAT / UTR values.
 * Returns null when the session should stay as it is.
 */
export function sessionUserFromCurrentDocument(
  current: User,
  data: Record<string, unknown>
): User | null {
  const parsed = parseAppUserDocument(current.id, data)
  if (!parsed.ok) return null
  const snapUpdated = parsed.value.updatedAt?.getTime() ?? 0
  const memoryUpdated = current.updatedAt?.getTime() ?? 0
  if (snapUpdated + 500 < memoryUpdated) return null

  const incoming = parsed.value as unknown as Record<string, unknown>
  const sameCompany = organizationIdsMatch(parsed.value.organizationId, current.organizationId)
  const next = { ...current } as unknown as Record<string, unknown>
  if (sameCompany) {
    for (const key of new Set([...Object.keys(current), ...Object.keys(incoming)])) {
      if (SESSION_FIELDS.has(key)) continue
      next[key] = incoming[key]
    }
    if (!parsed.value.email) next.email = current.email
    if (current.passwordSet) next.passwordSet = true
    // Accepted at sign-in this session (the write may not have landed): do not send them back to the policy screen.
    if (current.policyAccepted) next.policyAccepted = true
    if (current.accountConfirmed === true) next.accountConfirmed = true
    if (current.role === 'operative' || parsed.value.role === 'operative') {
      // Sign-in turns operativeMode on for operatives and writes it back; keep that until the write lands.
      const permissions = parsed.value.permissions
      if (parsed.value.role === 'operative' && !permissions.operativeMode) {
        next.permissions = { ...permissions, operativeMode: true }
      }
    }
    if (parsed.value.permissions.skills) {
      next.permissions = { ...(next.permissions as User['permissions']), skills: false }
    }
  } else {
    for (const key of PERSONAL_FIELDS) next[key] = incoming[key]
  }
  next.updatedAt = parsed.value.updatedAt || current.updatedAt
  const user = next as unknown as User
  if (signature(current) === signature(user)) return null
  return user
}
