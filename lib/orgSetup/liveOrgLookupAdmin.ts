import { restFieldsToPlain } from '@/lib/owner/firestoreRest'
import { adminGoogleAccessToken, adminLookupAuthUserByEmail, firebaseAdminConfigured } from '@/lib/owner/identityToolkitAdmin'
import { evaluateLiveOrgLookup, type LiveOrgLookupOrgFact, type LiveOrgLookupResult } from '@/lib/orgSetup/liveOrgLookup'
import { subscriptionStatusFromOrgData } from '@/lib/orgSetup/pendingOrganizationReuse'

const MAX_ORGS = 12

type AdminSession = {
  token: string
  root: string
  headers: Record<string, string>
}

type RestDocument = {
  path: string
  plain: Record<string, unknown>
}

function projectFallback(): string {
  return process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || ''
}

function idFromName(name: string): string {
  const parts = name.split('/')
  return decodeURIComponent(parts[parts.length - 1] || '')
}

function pathFromName(name: string): string {
  const marker = '/documents/'
  const index = name.indexOf(marker)
  return index >= 0 ? name.slice(index + marker.length) : ''
}

async function datastoreSession(): Promise<AdminSession> {
  const { token, projectId } = await adminGoogleAccessToken(['https://www.googleapis.com/auth/datastore'])
  const project = projectId || projectFallback()
  if (!project) throw new Error('Firebase project id is missing.')
  return {
    token,
    root: `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(project)}/databases/(default)/documents`,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  }
}

async function adminGet(session: AdminSession, path: string): Promise<RestDocument | null> {
  const response = await fetch(`${session.root}/${path}`, { headers: session.headers, cache: 'no-store' })
  if (response.status === 404) return null
  if (!response.ok) throw new Error(`Could not read ${path}`)
  const document = (await response.json()) as { name?: string; fields?: Record<string, unknown> }
  return {
    path,
    plain: restFieldsToPlain(document.fields),
  }
}

async function adminList(session: AdminSession, collectionPath: string): Promise<RestDocument[]> {
  const rows: RestDocument[] = []
  const url = new URL(`${session.root}/${collectionPath}`)
  url.searchParams.set('pageSize', '50')
  const response = await fetch(url, { headers: session.headers, cache: 'no-store' })
  if (response.status === 404) return rows
  if (!response.ok) throw new Error(`Could not list ${collectionPath}`)
  const body = (await response.json()) as { documents?: { name?: string; fields?: Record<string, unknown> }[] }
  for (const document of body.documents || []) {
    const path = pathFromName(document.name || '')
    if (!path) continue
    rows.push({ path, plain: restFieldsToPlain(document.fields) })
  }
  return rows
}

function orgFact(id: string, org: RestDocument | null): LiveOrgLookupOrgFact {
  if (!org) return { id, exists: false }
  const members =
    org.plain.members && typeof org.plain.members === 'object'
      ? (org.plain.members as Record<string, unknown>)
      : {}
  return {
    id,
    exists: true,
    members,
    creatorUserId: typeof org.plain.creatorUserId === 'string' ? org.plain.creatorUserId : '',
    subscriptionStatus: subscriptionStatusFromOrgData(org.plain),
  }
}

export async function lookupLiveOrgForEmail(email: string): Promise<LiveOrgLookupResult> {
  const emailLower = email.trim().toLowerCase()
  if (!emailLower) return { hasLiveOrg: false, hasLogin: false }
  if (!firebaseAdminConfigured()) return { hasLiveOrg: false, hasLogin: false }

  let uid: string | null = null
  try {
    const authUser = await adminLookupAuthUserByEmail(emailLower)
    uid = authUser?.uid ?? null
  } catch {
    return { hasLiveOrg: false, hasLogin: false }
  }
  if (!uid) return { hasLiveOrg: false, hasLogin: false }

  try {
    const session = await datastoreSession()
    const user = await adminGet(session, `users/${uid}`)
    if (!user) {
      return evaluateLiveOrgLookup({
        authUid: uid,
        userDoc: null,
        membershipOrgIds: [],
        organizations: [],
      })
    }

    const memberships = await adminList(session, `users/${uid}/orgMemberships`)
    const membershipOrgIds = memberships.map((row) => idFromName(row.path)).filter(Boolean)
    const organizationId = typeof user.plain.organizationId === 'string' ? user.plain.organizationId : ''
    const candidateIds = [...new Set([organizationId, ...membershipOrgIds].map((id) => id.trim()).filter(Boolean))].slice(
      0,
      MAX_ORGS
    )
    const organizations = await Promise.all(candidateIds.map(async (id) => orgFact(id, await adminGet(session, `organizations/${id}`))))

    return evaluateLiveOrgLookup({
      authUid: uid,
      userDoc: {
        exists: true,
        isActive: user.plain.isActive === false ? false : true,
        organizationId,
      },
      membershipOrgIds,
      organizations,
    })
  } catch {
    return { hasLiveOrg: false, hasLogin: true }
  }
}
