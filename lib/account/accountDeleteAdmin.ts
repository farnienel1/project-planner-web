import { restFieldsToPlain } from '@/lib/owner/firestoreRest'
import {
  adminDeleteAuthUser,
  adminGoogleAccessToken,
  adminRevokeRefreshTokens,
  firebaseAdminConfigured,
} from '@/lib/owner/identityToolkitAdmin'
import { firestoreValue } from '@/lib/stripe/writeOrgBilling'
import {
  ACCOUNT_DELETE_JOB_EMAIL_FIELD,
  ACCOUNT_DELETE_JOB_TYPE,
  DELETED_PRODUCT_EVENT_USER_ID,
  DELETED_USER_DISPLAY_NAME,
  adminLikeFromUserFields,
  collectMembershipIds,
  changedAnonymisePatch,
  commentAnonymisePatch,
  findSoleAdminBlock,
  ideaAuthorAnonymisePatch,
  pickCreatorSuccessor,
  placeholderDeleteFallbackPatch,
  retryFinishesWithoutOrgScan,
  isUnusedInvitePlaceholder,
  resolveAccountDeleteEmail,
  unusedInvitationShouldDelete,
  rosterAnonymisePatch,
  timesheetSnapshotShouldStay,
  unsignedTimesheetAnonymisePatch,
  type OrgDeleteSnapshot,
  type SoleAdminBlock,
} from '@/lib/account/accountDelete'

type AdminSession = {
  token: string
  projectId: string
  root: string
  headers: Record<string, string>
}

type RestDocument = {
  path: string
  fields: Record<string, unknown>
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
    projectId: project,
    root: `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(project)}/databases/(default)/documents`,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  }
}

async function readError(response: Response): Promise<string> {
  const text = await response.text()
  return text.slice(0, 500) || `Firestore request failed (${response.status})`
}

async function adminGet(session: AdminSession, path: string): Promise<RestDocument | null> {
  const response = await fetch(`${session.root}/${path}`, { headers: session.headers, cache: 'no-store' })
  if (response.status === 404) return null
  if (!response.ok) throw new Error(await readError(response))
  const document = (await response.json()) as { name?: string; fields?: Record<string, unknown> }
  return {
    path,
    fields: document.fields || {},
    plain: restFieldsToPlain(document.fields),
  }
}

async function adminDelete(session: AdminSession, path: string): Promise<void> {
  const response = await fetch(`${session.root}/${path}`, { method: 'DELETE', headers: session.headers })
  if (!response.ok && response.status !== 404) throw new Error(await readError(response))
}

async function adminPatch(
  session: AdminSession,
  path: string,
  plain: Record<string, unknown>,
  fieldPaths: string[]
): Promise<void> {
  const encoded = firestoreValue(plain) as { mapValue?: { fields?: Record<string, unknown> } }
  const url = new URL(`${session.root}/${path}`)
  for (const name of fieldPaths) url.searchParams.append('updateMask.fieldPaths', name)
  const response = await fetch(url, {
    method: 'PATCH',
    headers: session.headers,
    body: JSON.stringify({ fields: encoded.mapValue?.fields || {} }),
  })
  if (!response.ok) throw new Error(await readError(response))
}

async function adminCreateNamed(
  session: AdminSession,
  collectionPath: string,
  documentId: string,
  plain: Record<string, unknown>
): Promise<'created' | 'exists'> {
  const encoded = firestoreValue(plain) as { mapValue?: { fields?: Record<string, unknown> } }
  const url = `${session.root}/${collectionPath}?documentId=${encodeURIComponent(documentId)}`
  const response = await fetch(url, {
    method: 'POST',
    headers: session.headers,
    body: JSON.stringify({ fields: encoded.mapValue?.fields || {} }),
  })
  if (response.status === 409) return 'exists'
  if (!response.ok) {
    const text = await response.text()
    if (text.includes('ALREADY_EXISTS')) return 'exists'
    throw new Error(text.slice(0, 500) || `Could not create ${collectionPath}/${documentId}`)
  }
  return 'created'
}

async function adminList(session: AdminSession, collectionPath: string): Promise<RestDocument[]> {
  const rows: RestDocument[] = []
  let pageToken = ''
  do {
    const url = new URL(`${session.root}/${collectionPath}`)
    url.searchParams.set('pageSize', '200')
    if (pageToken) url.searchParams.set('pageToken', pageToken)
    const response = await fetch(url, { headers: session.headers, cache: 'no-store' })
    if (response.status === 404) return rows
    if (!response.ok) throw new Error(await readError(response))
    const body = (await response.json()) as {
      documents?: { name?: string; fields?: Record<string, unknown> }[]
      nextPageToken?: string
    }
    for (const document of body.documents || []) {
      const path = pathFromName(document.name || '')
      if (!path) continue
      rows.push({ path, fields: document.fields || {}, plain: restFieldsToPlain(document.fields) })
    }
    pageToken = body.nextPageToken || ''
  } while (pageToken && rows.length < 2000)
  return rows
}

async function adminQueryEqual(
  session: AdminSession,
  parentPath: string,
  collectionId: string,
  field: string,
  value: string
): Promise<RestDocument[]> {
  const parent = parentPath ? `${session.root}/${parentPath}` : session.root
  const response = await fetch(`${parent}:runQuery`, {
    method: 'POST',
    headers: session.headers,
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId }],
        where: {
          fieldFilter: {
            field: { fieldPath: field },
            op: 'EQUAL',
            value: { stringValue: value },
          },
        },
        limit: 300,
      },
    }),
  })
  if (!response.ok) throw new Error(await readError(response))
  const hits = (await response.json().catch(() => [])) as { document?: { name?: string; fields?: Record<string, unknown> } }[]
  const rows: RestDocument[] = []
  for (const row of hits) {
    const path = pathFromName(row.document?.name || '')
    if (!path) continue
    rows.push({
      path,
      fields: row.document?.fields || {},
      plain: restFieldsToPlain(row.document?.fields),
    })
  }
  return rows
}

async function adminCommitUpdates(
  session: AdminSession,
  updates: { path: string; plain: Record<string, unknown>; fieldPaths: string[] }[]
): Promise<void> {
  const chunkSize = 400
  for (let index = 0; index < updates.length; index += chunkSize) {
    const writes = updates.slice(index, index + chunkSize).map((update) => {
      const encoded = firestoreValue(update.plain) as { mapValue?: { fields?: Record<string, unknown> } }
      return {
        update: {
          name: `projects/${session.projectId}/databases/(default)/documents/${update.path}`,
          fields: encoded.mapValue?.fields || {},
        },
        updateMask: { fieldPaths: update.fieldPaths },
      }
    })
    const response = await fetch(
      `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(session.projectId)}/databases/(default)/documents:commit`,
      {
        method: 'POST',
        headers: session.headers,
        body: JSON.stringify({ writes }),
      }
    )
    if (!response.ok) throw new Error(await readError(response))
  }
}

async function deleteStorageObject(path: string): Promise<void> {
  const bucket = (process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || '').trim()
  if (!bucket || !path) return
  try {
    const { token } = await adminGoogleAccessToken(['https://www.googleapis.com/auth/devstorage.full_control'])
    const response = await fetch(
      `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(bucket)}/o/${encodeURIComponent(path)}`,
      { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }
    )
    if (!response.ok && response.status !== 404) {
      console.warn('[account/delete] storage', path, response.status)
    }
  } catch (error) {
    console.warn('[account/delete] storage', path, error)
  }
}

function orgNameOf(plain: Record<string, unknown>): string {
  return typeof plain.name === 'string' && plain.name.trim() ? plain.name.trim() : ''
}

function membersMap(plain: Record<string, unknown>): Record<string, string> {
  const raw = plain.members
  if (!raw || typeof raw !== 'object') return {}
  return Object.fromEntries(
    Object.entries(raw as Record<string, unknown>).map(([key, value]) => [key, String(value || '')])
  )
}

async function loadOrgSnapshot(
  session: AdminSession,
  orgId: string,
  uid: string
): Promise<OrgDeleteSnapshot | null> {
  const org = await adminGet(session, `organizations/${orgId}`)
  if (!org) return null
  const members = membersMap(org.plain)
  const memberFlags = []
  const seen = new Set<string>()
  for (const memberUid of Object.keys(members)) {
    seen.add(memberUid)
    const user = await adminGet(session, `users/${memberUid}`)
    memberFlags.push({
      uid: memberUid,
      flags: adminLikeFromUserFields(user?.plain || {}, members[memberUid]),
    })
  }
  if (!seen.has(uid)) {
    const user = await adminGet(session, `users/${uid}`)
    memberFlags.push({
      uid,
      flags: adminLikeFromUserFields(user?.plain || {}, members[uid] || ''),
    })
  }
  return {
    orgId,
    orgName: orgNameOf(org.plain),
    creatorUserId: typeof org.plain.creatorUserId === 'string' ? org.plain.creatorUserId : '',
    members,
    memberFlags,
  }
}

async function discoverOrgIds(session: AdminSession, uid: string, userOrganizationId: string): Promise<string[]> {
  const memberships = await adminList(session, `users/${uid}/orgMemberships`)
  const asMember: string[] = []
  for (const role of ['admin', 'manager', 'operative'] as const) {
    try {
      const hits = await adminQueryEqual(session, '', 'organizations', `members.${uid}`, role)
      for (const row of hits) asMember.push(idFromName(row.path))
    } catch (error) {
      console.warn('[account/delete] members map query', role, error)
    }
  }
  const created = await adminQueryEqual(session, '', 'organizations', 'creatorUserId', uid).catch((error) => {
    console.warn('[account/delete] creator query', error)
    return [] as RestDocument[]
  })
  return collectMembershipIds({
    membershipDocIds: memberships.map((row) => idFromName(row.path)),
    userOrganizationId,
    memberMapOrgIds: asMember,
    creatorOrgIds: created.map((row) => idFromName(row.path)),
  })
}

async function anonymiseRosterDocs(
  session: AdminSession,
  orgId: string,
  uid: string,
  email: string
): Promise<void> {
  const collections = ['operatives', 'managers'] as const
  for (const collectionId of collections) {
    const seen = new Set<string>()
    const candidates: RestDocument[] = []
    const byId = await adminGet(session, `organizations/${orgId}/${collectionId}/${uid}`)
    if (byId) candidates.push(byId)
    if (email) {
      for (const row of await adminQueryEqual(session, `organizations/${orgId}`, collectionId, 'email', email)) {
        candidates.push(row)
      }
    }
    for (const row of await adminQueryEqual(session, `organizations/${orgId}`, collectionId, 'userId', uid)) {
      candidates.push(row)
    }
    for (const row of candidates) {
      if (seen.has(row.path)) continue
      seen.add(row.path)
      const patch = changedAnonymisePatch(row.plain, rosterAnonymisePatch(row.plain))
      if (Object.keys(patch).length === 0) continue
      await adminPatch(session, row.path, patch, Object.keys(patch))
    }
  }
}

async function anonymiseUnsignedTimesheets(session: AdminSession, orgId: string, uid: string): Promise<void> {
  const rows = await adminQueryEqual(session, `organizations/${orgId}`, 'settings', 'userId', uid)
  for (const row of rows) {
    if (!idFromName(row.path).startsWith('timesheet_')) continue
    if (timesheetSnapshotShouldStay(row.plain)) continue
    const patch = changedAnonymisePatch(row.plain, unsignedTimesheetAnonymisePatch(row.plain))
    if (Object.keys(patch).length === 0) continue
    await adminPatch(session, row.path, patch, Object.keys(patch))
  }
}

async function anonymiseVariations(session: AdminSession, orgId: string, uid: string): Promise<void> {
  const rows = await adminQueryEqual(session, `organizations/${orgId}`, 'variations', 'createdByUid', uid)
  for (const row of rows) {
    if (!('createdByName' in row.plain)) continue
    if (row.plain.createdByName === DELETED_USER_DISPLAY_NAME) continue
    await adminPatch(session, row.path, { createdByName: DELETED_USER_DISPLAY_NAME }, ['createdByName'])
  }
}

async function deleteQueryMatches(
  session: AdminSession,
  parentPath: string,
  collectionId: string,
  field: string,
  value: string
): Promise<void> {
  const rows = await adminQueryEqual(session, parentPath, collectionId, field, value)
  await Promise.all(rows.map((row) => adminDelete(session, row.path)))
}

async function leaveOrganisation(
  session: AdminSession,
  uid: string,
  email: string,
  snapshot: OrgDeleteSnapshot
): Promise<void> {
  const { orgId } = snapshot
  await anonymiseRosterDocs(session, orgId, uid, email)
  await anonymiseUnsignedTimesheets(session, orgId, uid)
  await anonymiseVariations(session, orgId, uid)
  await deleteQueryMatches(session, `organizations/${orgId}`, 'notifications', 'userId', uid)
  if (email) await adminDelete(session, `organizations/${orgId}/userEmails/${encodeURIComponent(email)}`)
  await adminDelete(session, `organizations/${orgId}/operativeProfiles/${uid}`)
  await adminDelete(session, `organizations/${orgId}/dashboardLayouts/${uid}`)
  await deleteStorageObject(`organizations/${orgId}/userProfiles/${uid}/profile.jpg`)
  if (snapshot.members[uid] != null) {
    await adminPatch(session, `organizations/${orgId}`, {}, [`members.${uid}`])
  }
  const successor = pickCreatorSuccessor(uid, snapshot)
  if (successor) {
    await adminPatch(session, `organizations/${orgId}`, { creatorUserId: successor }, ['creatorUserId'])
  }
  await adminDelete(session, `users/${uid}/orgMemberships/${orgId}`)
}

async function deleteUnusedInvitations(
  session: AdminSession,
  uid: string,
  email: string
): Promise<string[]> {
  const rows = [
    ...(await adminQueryEqual(session, '', 'invitations', 'invitedBy', uid)),
    ...(email ? await adminQueryEqual(session, '', 'invitations', 'email', email) : []),
  ]
  const seen = new Set<string>()
  const orgIds: string[] = []
  for (const row of rows) {
    if (seen.has(row.path)) continue
    seen.add(row.path)
    if (!unusedInvitationShouldDelete(row.plain)) continue
    const inviteEmail = typeof row.plain.email === 'string' ? row.plain.email.trim().toLowerCase() : ''
    const orgId = typeof row.plain.organizationId === 'string' ? row.plain.organizationId.trim() : ''
    if (email && inviteEmail === email && orgId) orgIds.push(orgId)
    await adminDelete(session, row.path)
  }
  return orgIds
}

async function scrubInvitePlaceholder(
  session: AdminSession,
  placeholderId: string,
  email: string,
  orgId: string
): Promise<void> {
  if (orgId) {
    await anonymiseRosterDocs(session, orgId, placeholderId, email)
    await anonymiseUnsignedTimesheets(session, orgId, placeholderId)
    await anonymiseVariations(session, orgId, placeholderId)
    await deleteQueryMatches(session, `organizations/${orgId}`, 'notifications', 'userId', placeholderId)
    await unlinkScrubbedOrg(session, placeholderId, email, orgId)
  }
  const user = await adminGet(session, `users/${placeholderId}`)
  if (user) {
    const patch = changedAnonymisePatch(user.plain, rosterAnonymisePatch(user.plain))
    if (Object.keys(patch).length > 0) await adminPatch(session, user.path, patch, Object.keys(patch))
  }
  try {
    await adminDelete(session, `users/${placeholderId}/private/taxIds`)
    await adminDelete(session, `users/${placeholderId}`)
  } catch (error) {
    console.warn('[account/delete] placeholder delete', placeholderId, error)
    const leftover = await adminGet(session, `users/${placeholderId}`)
    if (!leftover) return
    const patch = changedAnonymisePatch(leftover.plain, placeholderDeleteFallbackPatch(leftover.plain))
    if (Object.keys(patch).length > 0) await adminPatch(session, leftover.path, patch, Object.keys(patch))
  }
}

/** Unused invitations + passwordSet:false users/{uuid} that still hold this email. */
async function deleteUnusedInvitesAndPlaceholders(
  session: AdminSession,
  uid: string,
  email: string
): Promise<void> {
  const inviteOrgIds = await deleteUnusedInvitations(session, uid, email)
  if (!email) return
  const placeholders = await adminQueryEqual(session, '', 'users', 'email', email)
  const seenOrgs = new Set<string>()
  for (const row of placeholders) {
    const placeholderId = idFromName(row.path)
    if (
      !isUnusedInvitePlaceholder({
        userId: placeholderId,
        deletingUid: uid,
        email,
        userEmail: row.plain.email,
        passwordSet: row.plain.passwordSet,
      })
    ) {
      continue
    }
    const orgId = typeof row.plain.organizationId === 'string' ? row.plain.organizationId.trim() : ''
    if (orgId) seenOrgs.add(orgId)
    await scrubInvitePlaceholder(session, placeholderId, email, orgId)
  }
  for (const orgId of inviteOrgIds) {
    if (!orgId || seenOrgs.has(orgId)) continue
    await adminDelete(session, `organizations/${orgId}/userEmails/${encodeURIComponent(email)}`)
  }
}

async function anonymiseProductFeedback(session: AdminSession, uid: string): Promise<void> {
  await deleteQueryMatches(session, '', 'productFeedbackVotes', 'userId', uid)
  const comments = await adminQueryEqual(session, '', 'productFeedbackComments', 'authorUserId', uid)
  for (const row of comments) {
    const patch = changedAnonymisePatch(row.plain, commentAnonymisePatch(row.plain))
    if (Object.keys(patch).length === 0) continue
    await adminPatch(session, row.path, patch, Object.keys(patch))
  }
  const ideas = await adminQueryEqual(session, '', 'productFeedback', 'authorUserId', uid)
  for (const row of ideas) {
    const patch = changedAnonymisePatch(row.plain, ideaAuthorAnonymisePatch(row.plain))
    if (Object.keys(patch).length === 0) continue
    await adminPatch(session, row.path, patch, Object.keys(patch))
  }
}

async function anonymiseProductEvents(session: AdminSession, uid: string): Promise<void> {
  let guard = 0
  while (guard < 20) {
    guard += 1
    const rows = await adminQueryEqual(session, '', 'productEvents', 'userId', uid)
    const pending = rows.filter((row) => row.plain.userId !== DELETED_PRODUCT_EVENT_USER_ID)
    if (pending.length === 0) return
    await adminCommitUpdates(
      session,
      pending.map((row) => ({
        path: row.path,
        plain: { userId: DELETED_PRODUCT_EVENT_USER_ID },
        fieldPaths: ['userId'],
      }))
    )
    if (rows.length < 300) return
  }
}

async function writeAccountDeleteAudit(
  session: AdminSession,
  entry: { uid: string; orgIds: string[]; ip?: string }
): Promise<void> {
  const encoded = firestoreValue({
    action: 'accountDelete',
    actorUid: entry.uid,
    targetUserId: entry.uid,
    at: new Date(),
    reason: `self-serve account delete · orgs ${entry.orgIds.join(',') || 'none'}`,
    ip: entry.ip || '',
  }) as { mapValue?: { fields?: Record<string, unknown> } }
  const response = await fetch(`${session.root}/adminAuditLog`, {
    method: 'POST',
    headers: session.headers,
    body: JSON.stringify({ fields: encoded.mapValue?.fields || {} }),
  })
  if (!response.ok) console.warn('[account/delete] audit', await readError(response))
}

async function anonymiseRosterDocById(
  session: AdminSession,
  orgId: string,
  collectionId: 'operatives' | 'managers',
  uid: string
): Promise<void> {
  const row = await adminGet(session, `organizations/${orgId}/${collectionId}/${uid}`)
  if (!row) return
  const patch = changedAnonymisePatch(row.plain, rosterAnonymisePatch(row.plain))
  if (Object.keys(patch).length === 0) return
  await adminPatch(session, row.path, patch, Object.keys(patch))
}

/** Point deletes for one org. Does not list other people, bookings, qualifications, or events. */
async function unlinkScrubbedOrg(session: AdminSession, uid: string, email: string, orgId: string): Promise<void> {
  const org = await adminGet(session, `organizations/${orgId}`)
  const tasks: Promise<unknown>[] = [
    adminDelete(session, `organizations/${orgId}/operativeProfiles/${uid}`),
    adminDelete(session, `organizations/${orgId}/dashboardLayouts/${uid}`),
    adminDelete(session, `users/${uid}/orgMemberships/${orgId}`),
    anonymiseRosterDocById(session, orgId, 'operatives', uid),
    anonymiseRosterDocById(session, orgId, 'managers', uid),
    deleteStorageObject(`organizations/${orgId}/userProfiles/${uid}/profile.jpg`),
  ]
  if (email) {
    tasks.push(adminDelete(session, `organizations/${orgId}/userEmails/${encodeURIComponent(email)}`))
  }
  if (org && membersMap(org.plain)[uid] != null) {
    tasks.push(adminPatch(session, `organizations/${orgId}`, {}, [`members.${uid}`]))
  }
  await Promise.all(tasks)
}

async function persistAccountDeleteJob(
  session: AdminSession,
  input: { uid: string; email: string; status: 'running' | 'completed'; existing: RestDocument | null }
): Promise<void> {
  const jobPath = `adminJobs/${input.uid}`
  const fields: Record<string, unknown> = {
    type: ACCOUNT_DELETE_JOB_TYPE,
    status: input.status,
    uid: input.uid,
    [ACCOUNT_DELETE_JOB_EMAIL_FIELD]: input.email,
    updatedAt: new Date(),
  }
  const fieldPaths = ['type', 'status', 'uid', ACCOUNT_DELETE_JOB_EMAIL_FIELD, 'updatedAt']
  if (input.status === 'completed') {
    fields.completedAt = new Date()
    fieldPaths.push('completedAt')
  }
  if (input.existing) {
    await adminPatch(session, jobPath, fields, fieldPaths)
    return
  }
  await adminCreateNamed(session, 'adminJobs', input.uid, { ...fields, createdAt: new Date() })
}

async function markAccountDeleteCompleted(session: AdminSession, uid: string, email: string): Promise<void> {
  const jobPath = `adminJobs/${uid}`
  const existing = await adminGet(session, jobPath)
  await persistAccountDeleteJob(session, { uid, email, status: 'completed', existing })
}

export async function readAccountDeleteJobEmail(uid: string): Promise<string> {
  const session = await datastoreSession()
  const job = await adminGet(session, `adminJobs/${uid}`)
  if (!job || job.plain.type !== ACCOUNT_DELETE_JOB_TYPE) return ''
  return resolveAccountDeleteEmail({ storedEmail: job.plain[ACCOUNT_DELETE_JOB_EMAIL_FIELD] })
}

async function finishAlreadyScrubbedAccount(
  session: AdminSession,
  input: { uid: string; email: string; ip?: string },
  user: RestDocument
): Promise<void> {
  const organizationId = typeof user.plain.organizationId === 'string' ? user.plain.organizationId : ''
  const orgIds = await discoverOrgIds(session, input.uid, organizationId)
  const job = await adminGet(session, `adminJobs/${input.uid}`)
  const email = resolveAccountDeleteEmail({
    authEmail: input.email,
    storedEmail: job?.plain.type === ACCOUNT_DELETE_JOB_TYPE ? job.plain[ACCOUNT_DELETE_JOB_EMAIL_FIELD] : '',
    profileEmail: user.plain.email,
  })
  for (const orgId of orgIds) {
    await unlinkScrubbedOrg(session, input.uid, email, orgId)
  }
  await deleteUnusedInvitesAndPlaceholders(session, input.uid, email)
  await adminDelete(session, `users/${input.uid}/private/taxIds`)
  await adminDelete(session, `users/${input.uid}`)
  await markAccountDeleteCompleted(session, input.uid, email)
  await writeAccountDeleteAudit(session, { uid: input.uid, orgIds, ip: input.ip })
  await adminRevokeRefreshTokens(input.uid).catch(() => undefined)
  await adminDeleteAuthUser(input.uid)
}

export async function evaluateAccountOrgs(
  uid: string,
  userOrganizationId?: string
): Promise<{ block: SoleAdminBlock } | { snapshots: OrgDeleteSnapshot[] }> {
  if (!firebaseAdminConfigured()) throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON is not set on the server.')
  const session = await datastoreSession()
  const user = await adminGet(session, `users/${uid}`)
  const memberships = await adminList(session, `users/${uid}/orgMemberships`)
  if (user && retryFinishesWithoutOrgScan({ profile: user.plain, membershipCount: memberships.length })) {
    return { snapshots: [] }
  }
  const fromDoc =
    userOrganizationId ||
    (typeof user?.plain.organizationId === 'string' ? user.plain.organizationId : '')
  const orgIds = await discoverOrgIds(session, uid, fromDoc)
  const snapshots: OrgDeleteSnapshot[] = []
  for (const orgId of orgIds) {
    const snapshot = await loadOrgSnapshot(session, orgId, uid)
    if (snapshot) snapshots.push(snapshot)
  }
  const block = findSoleAdminBlock(uid, snapshots)
  if (block) return { block }
  return { snapshots }
}

export async function executeAccountDelete(input: {
  uid: string
  email: string
  snapshots: OrgDeleteSnapshot[]
  ip?: string
}): Promise<'completed' | 'already'> {
  if (!firebaseAdminConfigured()) throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON is not set on the server.')
  const session = await datastoreSession()
  const jobPath = `adminJobs/${input.uid}`
  const existing = await adminGet(session, jobPath)
  const user = await adminGet(session, `users/${input.uid}`)
  const storedEmail =
    existing?.plain.type === ACCOUNT_DELETE_JOB_TYPE ? existing.plain[ACCOUNT_DELETE_JOB_EMAIL_FIELD] : ''
  const email = resolveAccountDeleteEmail({
    authEmail: input.email,
    storedEmail,
    profileEmail: user?.plain.email,
  })

  if (email) {
    const status = existing?.plain.status === 'completed' ? 'completed' : 'running'
    await persistAccountDeleteJob(session, { uid: input.uid, email, status, existing })
  }

  if (existing?.plain.status === 'completed' && existing.plain.type === ACCOUNT_DELETE_JOB_TYPE) {
    await deleteUnusedInvitesAndPlaceholders(session, input.uid, email)
    await adminRevokeRefreshTokens(input.uid).catch(() => undefined)
    await adminDeleteAuthUser(input.uid)
    return 'already'
  }

  const memberships = await adminList(session, `users/${input.uid}/orgMemberships`)
  if (user && retryFinishesWithoutOrgScan({ profile: user.plain, membershipCount: memberships.length })) {
    await finishAlreadyScrubbedAccount(session, { uid: input.uid, email, ip: input.ip }, user)
    return 'already'
  }

  if (!existing && !email) {
    await adminCreateNamed(session, 'adminJobs', input.uid, {
      type: ACCOUNT_DELETE_JOB_TYPE,
      status: 'running',
      uid: input.uid,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
  }

  if (user) {
    const patch = changedAnonymisePatch(user.plain, rosterAnonymisePatch(user.plain))
    if (Object.keys(patch).length > 0) await adminPatch(session, user.path, patch, Object.keys(patch))
  }

  for (const snapshot of input.snapshots) {
    await leaveOrganisation(session, input.uid, email, snapshot)
  }
  await deleteUnusedInvitesAndPlaceholders(session, input.uid, email)
  await anonymiseProductFeedback(session, input.uid)
  await deleteQueryMatches(session, '', 'productSessions', 'userId', input.uid)
  await anonymiseProductEvents(session, input.uid)
  await adminDelete(session, `users/${input.uid}/private/taxIds`)
  await adminDelete(session, `users/${input.uid}`)

  await persistAccountDeleteJob(session, {
    uid: input.uid,
    email,
    status: 'completed',
    existing: (await adminGet(session, jobPath)) || existing,
  })
  await writeAccountDeleteAudit(session, {
    uid: input.uid,
    orgIds: input.snapshots.map((row) => row.orgId),
    ip: input.ip,
  })
  await adminRevokeRefreshTokens(input.uid).catch(() => undefined)
  await adminDeleteAuthUser(input.uid)
  return 'completed'
}
