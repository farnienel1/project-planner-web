import { NextRequest, NextResponse } from 'next/server'
import {
  isFirebaseUser,
  jsonError,
  requireFirebaseUser,
  type FirebaseAuthUser,
} from '@/lib/security/apiGuard'
import { bearerToken, firestoreGet, restFieldsToPlain } from '@/lib/owner/firestoreRest'
import { clampString, isValidUuid } from '@/lib/security/validation'

export type OrgAccessLevel = 'member' | 'staff' | 'admin'

export type OrgMemberRole = 'admin' | 'manager' | 'operative' | 'none'

export type OrgMembership = {
  role: OrgMemberRole
  isCreator: boolean
}

function asMemberRole(value: unknown): OrgMemberRole {
  if (value === 'admin' || value === 'manager' || value === 'operative') return value
  return 'none'
}

export function membershipFromOrgFields(orgPlain: Record<string, unknown>, uid: string): OrgMembership {
  const members =
    orgPlain.members && typeof orgPlain.members === 'object'
      ? (orgPlain.members as Record<string, unknown>)
      : {}
  const creator = typeof orgPlain.creatorUserId === 'string' ? orgPlain.creatorUserId.trim() : ''
  return {
    role: asMemberRole(members[uid]),
    isCreator: creator.length > 0 && creator === uid,
  }
}

export function membershipAllows(membership: OrgMembership, level: OrgAccessLevel): boolean {
  if (membership.isCreator) return true
  if (level === 'member') return membership.role !== 'none'
  if (level === 'staff') return membership.role === 'admin' || membership.role === 'manager'
  return membership.role === 'admin'
}

export function timestampMs(value: unknown): number | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.getTime()
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Date.parse(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

export function parseOrganizationId(value: unknown): string | null {
  const organizationId = clampString(value, 80)
  if (!organizationId || !isValidUuid(organizationId)) return null
  return organizationId
}

export async function requireOrgAccessForUser(
  request: NextRequest,
  user: FirebaseAuthUser,
  organizationId: string | null | undefined,
  level: OrgAccessLevel
): Promise<{ ok: true; membership: OrgMembership; organizationId: string } | { ok: false; response: NextResponse }> {
  const id = parseOrganizationId(organizationId)
  if (!id) return { ok: false, response: jsonError('organisation is required', 400) }

  const token = bearerToken(request)
  if (!token) return { ok: false, response: jsonError('Sign in required', 401) }

  try {
    const orgDoc = await firestoreGet(token, `organizations/${id}`)
    if (!orgDoc) return { ok: false, response: jsonError('Organisation not found', 404) }
    const membership = membershipFromOrgFields(restFieldsToPlain(orgDoc.fields), user.uid)
    if (!membershipAllows(membership, level)) {
      return { ok: false, response: jsonError('You do not have access to that organisation', 403) }
    }
    return { ok: true, membership, organizationId: id }
  } catch {
    return { ok: false, response: jsonError('Organisation not found', 404) }
  }
}

export async function requireOrgAccess(
  request: NextRequest,
  organizationId: string | null | undefined,
  level: OrgAccessLevel
): Promise<
  | { ok: true; user: FirebaseAuthUser; membership: OrgMembership; organizationId: string }
  | { ok: false; response: NextResponse }
> {
  const user = await requireFirebaseUser(request)
  if (!isFirebaseUser(user)) return { ok: false, response: user }
  const access = await requireOrgAccessForUser(request, user, organizationId, level)
  if (!access.ok) return access
  return { ok: true, user, membership: access.membership, organizationId: access.organizationId }
}
