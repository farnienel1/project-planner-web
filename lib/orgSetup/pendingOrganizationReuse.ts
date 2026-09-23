/**
 * iOS parity source: Core/FirebaseBackend+OrganizationMembership.swift
 * Spec: docs/ios-parity/sections/26-switch-organisation.md
 *
 * Web-only: Activate used to mint a new pending org UUID on every retry and immediately
 * switch users.organizationId onto it. Same-name empties then crowded Switch organisation.
 */

export type PendingOrgCandidate = {
  id: string
  name: string
  creatorUserId?: string
  subscriptionStatus?: string
  createdAt?: Date | null
}

export function subscriptionStatusFromOrgData(orgData: Record<string, unknown>): string {
  const nested = orgData.subscription
  if (nested && typeof nested === 'object' && nested !== null && 'status' in nested) {
    return String((nested as { status?: unknown }).status || '').trim()
  }
  return String(orgData.subscriptionStatus || '').trim()
}

export function isSetupIncomplete(orgData: Record<string, unknown>): boolean {
  return subscriptionStatusFromOrgData(orgData).toLowerCase() === 'pending'
}

export function namesMatchOrganization(left: string, right: string): boolean {
  return left.trim().toLowerCase() === right.trim().toLowerCase()
}

/** Reuse the newest pending org this user already created under the same name. */
export function pickReusablePendingOrganization(
  orgs: PendingOrgCandidate[],
  userId: string,
  organizationName: string
): PendingOrgCandidate | null {
  const matches = orgs.filter(
    (org) =>
      org.creatorUserId === userId &&
      org.subscriptionStatus?.toLowerCase() === 'pending' &&
      namesMatchOrganization(org.name, organizationName)
  )
  matches.sort((lhs, rhs) => (rhs.createdAt?.getTime() ?? 0) - (lhs.createdAt?.getTime() ?? 0))
  return matches[0] ?? null
}

/** Prefer a specific pending org (Continue setup), else the newest same-name pending. */
export function pickPendingOrganizationToReuse(
  orgs: PendingOrgCandidate[],
  userId: string,
  organizationName: string,
  resumeOrganizationId?: string
): PendingOrgCandidate | null {
  const resumeId = String(resumeOrganizationId || '').trim()
  if (resumeId) {
    const exact = orgs.find(
      (org) =>
        org.id === resumeId &&
        org.creatorUserId === userId &&
        org.subscriptionStatus?.toLowerCase() === 'pending'
    )
    if (exact) return exact
  }
  return pickReusablePendingOrganization(orgs, userId, organizationName)
}

/**
 * Switch the signed-in user onto a newly created pending org only when they do not
 * already have a paid/complete organisation. Additional-org setup must not yank them
 * off the workspace that has their data.
 */
export function shouldSwitchUserToNewOrganization(input: {
  existingUser: { organizationId?: string } | null
  currentOrgSubscriptionStatus?: string | null
}): boolean {
  if (!input.existingUser) return true
  const currentId = String(input.existingUser.organizationId || '').trim()
  if (!currentId) return true
  return String(input.currentOrgSubscriptionStatus || '').toLowerCase() === 'pending'
}

export function shortOrganizationId(organizationId: string): string {
  const compact = organizationId.replace(/-/g, '')
  return compact.slice(0, 8).toUpperCase()
}

export function formatMembershipCreatedLabel(createdAt?: Date | null): string | null {
  if (!createdAt || Number.isNaN(createdAt.getTime())) return null
  return createdAt.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}
