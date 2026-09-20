/**
 * iOS parity source: Core/OrganizationMembershipSupport.swift
 * Spec: docs/ios-parity/sections/26-switch-organisation.md
 */

export type OrgMembershipSummary = {
  id: string
  name: string
  roleInOrg: string
  isTrial: boolean
  trialAccessBlocked: boolean
  createdAt?: Date | null
}

export const TRIAL_BLOCKED_LOGIN_MESSAGE =
  'Email info@projectplanner.us to unlock this organisation.'

export function roleDisplayName(roleInOrg: string): string {
  switch (roleInOrg.toLowerCase()) {
    case 'admin':
      return 'Admin'
    case 'manager':
      return 'Manager'
    case 'member':
      return 'Member'
    default: {
      const trimmed = roleInOrg.trim()
      if (!trimmed) return 'Member'
      return trimmed.charAt(0).toUpperCase() + trimmed.slice(1)
    }
  }
}

export function isTrialOrganization(data: Record<string, unknown>): boolean {
  if (data.isTrial === true) return true
  if (String(data.subscriptionStatus || '').toLowerCase() === 'trial') return true
  if (String(data.billingStatus || '').toLowerCase() === 'trial') return true
  return false
}

export function isAccessBlocked(data: Record<string, unknown>): boolean {
  return data.trialAccessBlocked === true || data.accessBlocked === true
}

export function blockedMessage(data: Record<string, unknown>): string {
  const trialMessage = String(data.trialAccessBlockedMessage || '').trim()
  if (trialMessage) return trialMessage
  const accessMessage = String(data.accessBlockedMessage || '').trim()
  if (accessMessage) return accessMessage
  return TRIAL_BLOCKED_LOGIN_MESSAGE
}

export function membershipSummary(
  organizationId: string,
  orgData: Record<string, unknown>,
  roleInOrg: string
): OrgMembershipSummary {
  const name = String(orgData.name || '').trim()
  return {
    id: organizationId,
    name: name || 'Organisation',
    roleInOrg,
    isTrial: isTrialOrganization(orgData),
    trialAccessBlocked: isAccessBlocked(orgData),
    createdAt: orgData.createdAt instanceof Date ? orgData.createdAt : null,
  }
}

/** Blocks access when the org is explicitly locked, or when this trial is not the user's first trial membership. */
export function loginBlockMessage(input: {
  organizationId: string
  orgData: Record<string, unknown>
  memberships: OrgMembershipSummary[]
}): string | null {
  if (isAccessBlocked(input.orgData)) return blockedMessage(input.orgData)

  const trialMemberships = input.memberships.filter((row) => row.isTrial)
  if (trialMemberships.length <= 1 || !isTrialOrganization(input.orgData)) return null

  const sorted = [...trialMemberships].sort((lhs, rhs) => {
    const l = lhs.createdAt?.getTime() ?? Number.POSITIVE_INFINITY
    const r = rhs.createdAt?.getTime() ?? Number.POSITIVE_INFINITY
    if (l !== r) return l - r
    return lhs.id.localeCompare(rhs.id)
  })
  const firstTrial = sorted[0]
  if (!firstTrial || firstTrial.id === input.organizationId) return null
  return TRIAL_BLOCKED_LOGIN_MESSAGE
}

export function sortMemberships<T extends { id: string; name: string }>(
  rows: T[],
  activeOrgId?: string | null
): T[] {
  return [...rows].sort((lhs, rhs) => {
    if (activeOrgId) {
      if (lhs.id === activeOrgId) return -1
      if (rhs.id === activeOrgId) return 1
    }
    return lhs.name.localeCompare(rhs.name, undefined, { sensitivity: 'base' })
  })
}
