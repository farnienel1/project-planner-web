export const LIVE_ORG_ALREADY_MEMBER_CODE = 'pp/live-org-already-member'

export const LIVE_ORG_SETUP_TITLE = 'You are already part of an organisation'
export const LIVE_ORG_SETUP_BODY =
  'Please log in to this organisation, go to Settings, switch organisation, and then set up a new organisation from there. You will be redirected to the new organisation setup process.'
export const LEFTOVER_LOGIN_SETUP_COPY =
  'This email already has a login. Sign in, then open Set up an organisation.'

export class LiveOrgAlreadyMemberError extends Error {
  readonly code: typeof LIVE_ORG_ALREADY_MEMBER_CODE = LIVE_ORG_ALREADY_MEMBER_CODE

  constructor() {
    super('LIVE_ORG_ALREADY_MEMBER')
    this.name = 'LiveOrgAlreadyMemberError'
  }
}

export function isLiveOrgAlreadyMemberError(error: unknown): error is LiveOrgAlreadyMemberError {
  if (error instanceof LiveOrgAlreadyMemberError) return true
  return Boolean(
    error &&
      typeof error === 'object' &&
      'code' in error &&
      (error as { code?: unknown }).code === LIVE_ORG_ALREADY_MEMBER_CODE
  )
}

export type LiveOrgLookupResult = {
  hasLiveOrg: boolean
  hasLogin: boolean
}

export type LiveOrgLookupOrgFact = {
  id: string
  exists: boolean
  members?: Record<string, unknown>
  creatorUserId?: string
  subscriptionStatus?: string
}

export type LiveOrgLookupFacts = {
  authUid: string | null
  userDoc: {
    exists: boolean
    isActive?: boolean
    organizationId?: string
  } | null
  membershipOrgIds: string[]
  organizations: LiveOrgLookupOrgFact[]
}

export function liveOrgLoginHref(email: string): string {
  const trimmed = email.trim()
  if (!trimmed) return '/login'
  return `/login?email=${encodeURIComponent(trimmed)}`
}

export function liveOrgSetupModalCopy(email: string): {
  title: string
  paragraphs: string[]
  primaryLabel: string
  primaryHref: string
} {
  return {
    title: LIVE_ORG_SETUP_TITLE,
    paragraphs: [LIVE_ORG_SETUP_BODY],
    primaryLabel: 'Log in',
    primaryHref: liveOrgLoginHref(email),
  }
}

export function parseLiveOrgLookupResponse(data: unknown): LiveOrgLookupResult {
  const record = data && typeof data === 'object' ? (data as Record<string, unknown>) : {}
  return {
    hasLiveOrg: record.hasLiveOrg === true,
    hasLogin: record.hasLogin === true,
  }
}

function uniqueIds(values: readonly string[]): string[] {
  const seen = new Set<string>()
  const ids: string[] = []
  for (const value of values) {
    const id = String(value || '').trim()
    if (!id || seen.has(id)) continue
    seen.add(id)
    ids.push(id)
  }
  return ids
}

function userBelongsToOrg(
  uid: string,
  org: LiveOrgLookupOrgFact,
  facts: { membershipOrgIds: string[]; organizationId?: string }
): boolean {
  if (!org.exists) return false
  const memberRole = org.members?.[uid]
  if (memberRole != null && memberRole !== '') return true
  if (org.creatorUserId && org.creatorUserId === uid) return true
  if (facts.membershipOrgIds.includes(org.id)) return true
  if (facts.organizationId && facts.organizationId === org.id) return true
  return false
}

function isPendingSetupOrg(status: string | undefined): boolean {
  return String(status || '').trim().toLowerCase() === 'pending'
}

/**
 * Live-org dialog only when Auth, users/{uid}, an existing organisation, and
 * isActive !== false all hold. A leftover login or pending-only setup is not live.
 */
export function evaluateLiveOrgLookup(facts: LiveOrgLookupFacts): LiveOrgLookupResult {
  const uid = String(facts.authUid || '').trim()
  if (!uid) return { hasLiveOrg: false, hasLogin: false }
  if (!facts.userDoc?.exists) return { hasLiveOrg: false, hasLogin: true }
  if (facts.userDoc.isActive === false) return { hasLiveOrg: false, hasLogin: true }

  const organizationId = String(facts.userDoc.organizationId || '').trim()
  const candidateIds = uniqueIds([...facts.membershipOrgIds, organizationId])
  if (candidateIds.length === 0) return { hasLiveOrg: false, hasLogin: true }

  const orgById = new Map(facts.organizations.map((org) => [org.id, org]))
  for (const orgId of candidateIds) {
    const org = orgById.get(orgId)
    if (!org || !userBelongsToOrg(uid, org, { membershipOrgIds: facts.membershipOrgIds, organizationId })) {
      continue
    }
    if (isPendingSetupOrg(org.subscriptionStatus)) continue
    return { hasLiveOrg: true, hasLogin: true }
  }

  return { hasLiveOrg: false, hasLogin: true }
}
