import { generateKeyPairSync } from 'node:crypto'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { evaluateAccountOrgs, executeAccountDelete } from './accountDeleteAdmin.ts'

const uid = 'QAlPe29vLLP4spK554UtpaBLW7N2'
const orgId = '2C67391E-D1FE-4F9F-8055-7149ACDE1F96'
const otherUserId = '57CC31FC-2115-4083-AD1F-58D9D44FE5B5'
const superAdminUid = 'dul1tDjfQfMX6ruXPHb8kJX5P7g2'
const projectId = 'demo-project'

type Call = { method: string; url: string; body: string }

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function userDocument() {
  return {
    name: `projects/${projectId}/databases/(default)/documents/users/${uid}`,
    fields: {
      email: { stringValue: '' },
      name: { stringValue: 'Deleted user' },
      displayName: { stringValue: 'Deleted user' },
      firstName: { stringValue: 'Deleted' },
      isActive: { booleanValue: true },
      passwordSet: { booleanValue: true },
      role: { stringValue: 'operative' },
      organizationId: { stringValue: orgId },
    },
  }
}

test('a scrubbed retry deletes the auth user without scanning events or other people', async () => {
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
  const previousEnv = {
    FIREBASE_SERVICE_ACCOUNT_JSON: process.env.FIREBASE_SERVICE_ACCOUNT_JSON,
    GOOGLE_APPLICATION_CREDENTIALS: process.env.GOOGLE_APPLICATION_CREDENTIALS,
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  }
  const previousFetch = globalThis.fetch
  const calls: Call[] = []
  process.env.FIREBASE_SERVICE_ACCOUNT_JSON = JSON.stringify({
    client_email: 'delete-test@demo-project.iam.gserviceaccount.com',
    private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
    project_id: projectId,
  })
  delete process.env.GOOGLE_APPLICATION_CREDENTIALS
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = projectId
  delete process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET

  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    const method = init?.method || 'GET'
    const body = typeof init?.body === 'string' ? init.body : ''
    calls.push({ method, url, body })
    if (url.startsWith('https://oauth2.googleapis.com/token')) {
      return jsonResponse(200, { access_token: 'ya29.test' })
    }
    if (url.includes('/accounts:revokeRefreshTokens') || url.includes('/accounts:delete')) {
      return jsonResponse(200, {})
    }
    if (url.includes(':runQuery')) {
      return jsonResponse(200, [])
    }
    if (url.includes(':commit') || url.includes('productEvents')) {
      return jsonResponse(500, { error: { message: 'scrubbed retry must not scan product events' } })
    }
    if (method === 'GET' && url.includes(`/documents/users/${uid}`) && !url.includes('/orgMemberships')) {
      return jsonResponse(200, userDocument())
    }
    if (method === 'GET' && url.includes(`/documents/users/${uid}/orgMemberships`)) {
      return jsonResponse(200, { documents: [] })
    }
    if (method === 'GET' && url.includes(`/documents/adminJobs/${uid}`)) {
      return jsonResponse(200, {
        name: `projects/${projectId}/databases/(default)/documents/adminJobs/${uid}`,
        fields: {
          type: { stringValue: 'accountDelete' },
          status: { stringValue: 'running' },
          uid: { stringValue: uid },
        },
      })
    }
    if (method === 'GET' && url.includes(`/documents/organizations/${orgId}?`)) {
      return jsonResponse(404, {})
    }
    if (method === 'GET' && url.includes(`/documents/organizations/${orgId}`) && !url.includes('/operatives/') && !url.includes('/managers/') && !url.includes('/userEmails/') && !url.includes('/operativeProfiles/') && !url.includes('/dashboardLayouts/')) {
      return jsonResponse(200, {
        name: `projects/${projectId}/databases/(default)/documents/organizations/${orgId}`,
        fields: {
          name: { stringValue: 'Raccord MEP' },
          members: { mapValue: { fields: { [uid]: { stringValue: 'operative' } } } },
        },
      })
    }
    if (method === 'GET') return jsonResponse(404, {})
    if (method === 'DELETE' || method === 'PATCH' || method === 'POST') return jsonResponse(200, {})
    return jsonResponse(500, { error: { message: `unexpected ${method} ${url}` } })
  }

  try {
    const evaluation = await evaluateAccountOrgs(uid)
    assert.deepEqual(evaluation, { snapshots: [] })
    assert.equal(calls.some((call) => call.url.includes(':runQuery')), false)
    const afterEvaluate = calls.length

    const result = await executeAccountDelete({
      uid,
      email: 'farnienel@hotmail.com',
      snapshots: [],
    })
    assert.equal(result, 'already')

    const duringExecute = calls.slice(afterEvaluate)
    const queries = duringExecute.filter((call) => call.url.includes(':runQuery'))
    assert.ok(queries.length > 0)
    const allowedQueryCollections = new Set(['organizations', 'invitations', 'users', 'settings', 'operatives', 'managers'])
    for (const query of queries) {
      const parsed = JSON.parse(query.body) as { structuredQuery: { from: { collectionId: string }[] } }
      const collectionId = parsed.structuredQuery.from[0]?.collectionId || ''
      assert.equal(allowedQueryCollections.has(collectionId), true, collectionId)
    }
    assert.equal(duringExecute.some((call) => call.url.includes('/documents/invitations') || call.body.includes('"invitations"')), true)
    assert.equal(duringExecute.some((call) => call.url.includes('productEvents')), false)
    assert.equal(duringExecute.some((call) => call.url.includes(':commit')), false)
    assert.equal(
      duringExecute.some((call) => call.method === 'PATCH' && call.url.includes(`/adminJobs/${uid}`)),
      true
    )
    const authDelete = duringExecute.find((call) => call.url.includes('/accounts:delete'))
    assert.ok(authDelete)
    assert.equal(JSON.parse(authDelete!.body).localId, uid)

    const blob = calls.map((call) => `${call.method} ${call.url}\n${call.body}`).join('\n')
    assert.equal(blob.includes(otherUserId), false)
    assert.equal(blob.includes(superAdminUid), false)
    assert.equal(blob.includes('bookings'), false)
    assert.equal(blob.includes('qualifications'), false)
    assert.equal(blob.includes('variations'), false)
  } finally {
    globalThis.fetch = previousFetch
    for (const [key, value] of Object.entries(previousEnv)) {
      if (value == null) delete process.env[key]
      else process.env[key] = value
    }
  }
})

function queryFilter(body: string): { collectionId: string; field: string; value: string } {
  const parsed = JSON.parse(body || '{}') as {
    structuredQuery?: {
      from?: { collectionId?: string }[]
      where?: { fieldFilter?: { field?: { fieldPath?: string }; value?: { stringValue?: string } } }
    }
  }
  const query = parsed.structuredQuery || {}
  return {
    collectionId: query.from?.[0]?.collectionId || '',
    field: query.where?.fieldFilter?.field?.fieldPath || '',
    value: query.where?.fieldFilter?.value?.stringValue || '',
  }
}

function queryHit(path: string, fields: Record<string, unknown>) {
  return {
    document: {
      name: `projects/${projectId}/databases/(default)/documents/${path}`,
      fields,
    },
  }
}

test('unused invitations and passwordSet false placeholders lose the live email; signed timesheets stay', async () => {
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
  const previousEnv = {
    FIREBASE_SERVICE_ACCOUNT_JSON: process.env.FIREBASE_SERVICE_ACCOUNT_JSON,
    GOOGLE_APPLICATION_CREDENTIALS: process.env.GOOGLE_APPLICATION_CREDENTIALS,
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  }
  const previousFetch = globalThis.fetch
  const calls: Call[] = []
  const placeholderId = 'AAAAAAAA-BBBB-CCCC-DDDD-EEEEEEEEEEEE'
  const inviteOrgId = 'ORG-INVITE-OTHER'
  const unusedInviteId = 'invite-unused-hotmail'
  const usedInviteId = 'invite-used-hotmail'
  const decoyLiveId = 'liveDecoyUidNotDeleted12'
  const email = 'farnienel@hotmail.com'
  const signedTimesheet = `organizations/${inviteOrgId}/settings/timesheet_${placeholderId}_111`
  const unsignedTimesheet = `organizations/${inviteOrgId}/settings/timesheet_${placeholderId}_222`

  process.env.FIREBASE_SERVICE_ACCOUNT_JSON = JSON.stringify({
    client_email: 'delete-test@demo-project.iam.gserviceaccount.com',
    private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
    project_id: projectId,
  })
  delete process.env.GOOGLE_APPLICATION_CREDENTIALS
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = projectId
  delete process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET

  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    const method = init?.method || 'GET'
    const body = typeof init?.body === 'string' ? init.body : ''
    calls.push({ method, url, body })
    if (url.startsWith('https://oauth2.googleapis.com/token')) {
      return jsonResponse(200, { access_token: 'ya29.test' })
    }
    if (url.includes('/accounts:revokeRefreshTokens') || url.includes('/accounts:delete')) {
      return jsonResponse(200, {})
    }
    if (url.includes(':runQuery')) {
      const filter = queryFilter(body)
      if (filter.collectionId === 'invitations' && filter.field === 'email' && filter.value === email) {
        return jsonResponse(200, [
          queryHit(`invitations/${unusedInviteId}`, {
            email: { stringValue: email },
            organizationId: { stringValue: inviteOrgId },
            isUsed: { booleanValue: false },
          }),
          queryHit(`invitations/${usedInviteId}`, {
            email: { stringValue: email },
            organizationId: { stringValue: inviteOrgId },
            isUsed: { booleanValue: true },
          }),
        ])
      }
      if (filter.collectionId === 'users' && filter.field === 'email' && filter.value === email) {
        return jsonResponse(200, [
          queryHit(`users/${placeholderId}`, {
            email: { stringValue: email },
            organizationId: { stringValue: inviteOrgId },
            passwordSet: { booleanValue: false },
            firstName: { stringValue: 'Farnie' },
            surname: { stringValue: 'Nel' },
          }),
          queryHit(`users/${decoyLiveId}`, {
            email: { stringValue: email },
            organizationId: { stringValue: inviteOrgId },
            passwordSet: { booleanValue: true },
            firstName: { stringValue: 'Live' },
          }),
        ])
      }
      if (filter.collectionId === 'settings' && filter.field === 'userId' && filter.value === placeholderId) {
        return jsonResponse(200, [
          queryHit(signedTimesheet, {
            userId: { stringValue: placeholderId },
            firstName: { stringValue: 'Farnie' },
            email: { stringValue: email },
            operativeSignedAt: { stringValue: '2026-10-01T09:00:00.000Z' },
          }),
          queryHit(unsignedTimesheet, {
            userId: { stringValue: placeholderId },
            firstName: { stringValue: 'Farnie' },
            email: { stringValue: email },
          }),
        ])
      }
      return jsonResponse(200, [])
    }
    if (method === 'GET' && url.includes(`/documents/users/${placeholderId}`) && !url.includes('/orgMemberships')) {
      return jsonResponse(200, {
        name: `projects/${projectId}/databases/(default)/documents/users/${placeholderId}`,
        fields: {
          email: { stringValue: email },
          organizationId: { stringValue: inviteOrgId },
          passwordSet: { booleanValue: false },
          firstName: { stringValue: 'Farnie' },
          surname: { stringValue: 'Nel' },
        },
      })
    }
    if (method === 'GET' && url.includes(`/documents/users/${uid}`) && !url.includes('/orgMemberships')) {
      return jsonResponse(200, {
        name: `projects/${projectId}/databases/(default)/documents/users/${uid}`,
        fields: {
          email: { stringValue: email },
          name: { stringValue: 'Test Operative' },
          displayName: { stringValue: 'Test Operative' },
          firstName: { stringValue: 'Test' },
          passwordSet: { booleanValue: true },
          role: { stringValue: 'operative' },
        },
      })
    }
    if (method === 'GET' && url.includes(`/documents/users/${uid}/orgMemberships`)) {
      return jsonResponse(200, { documents: [] })
    }
    if (method === 'GET' && url.includes(`/documents/organizations/${inviteOrgId}`) && !url.includes('/operatives/') && !url.includes('/managers/') && !url.includes('/userEmails/') && !url.includes('/operativeProfiles/') && !url.includes('/dashboardLayouts/') && !url.includes('/settings/')) {
      return jsonResponse(200, {
        name: `projects/${projectId}/databases/(default)/documents/organizations/${inviteOrgId}`,
        fields: {
          name: { stringValue: 'Other Ltd' },
          members: { mapValue: { fields: { [placeholderId]: { stringValue: 'operative' } } } },
        },
      })
    }
    if (method === 'GET') return jsonResponse(404, {})
    if (method === 'DELETE' || method === 'PATCH' || method === 'POST') return jsonResponse(200, {})
    return jsonResponse(500, { error: { message: `unexpected ${method} ${url}` } })
  }

  try {
    const result = await executeAccountDelete({
      uid,
      email,
      snapshots: [],
    })
    assert.equal(result, 'completed')

    const deleted = calls.filter((call) => call.method === 'DELETE').map((call) => call.url)
    assert.equal(deleted.some((url) => url.includes(`/invitations/${unusedInviteId}`)), true)
    assert.equal(deleted.some((url) => url.includes(`/invitations/${usedInviteId}`)), false)
    assert.equal(deleted.some((url) => url.includes(`/users/${placeholderId}`)), true)
    assert.equal(deleted.some((url) => url.includes(`/users/${decoyLiveId}`)), false)
    assert.equal(
      deleted.some((url) => url.includes(`/organizations/${inviteOrgId}/userEmails/${encodeURIComponent(email)}`)),
      true
    )

    const patches = calls.filter((call) => call.method === 'PATCH')
    assert.equal(patches.some((call) => call.url.includes(signedTimesheet)), false)
    assert.equal(patches.some((call) => call.url.includes(unsignedTimesheet)), true)
    assert.equal(patches.some((call) => call.url.includes(`/documents/users/${decoyLiveId}`)), false)
  } finally {
    globalThis.fetch = previousFetch
    for (const [key, value] of Object.entries(previousEnv)) {
      if (value == null) delete process.env[key]
      else process.env[key] = value
    }
  }
})

test('a scrubbed retry uses the email stored on the admin job', async () => {
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
  const previousEnv = {
    FIREBASE_SERVICE_ACCOUNT_JSON: process.env.FIREBASE_SERVICE_ACCOUNT_JSON,
    GOOGLE_APPLICATION_CREDENTIALS: process.env.GOOGLE_APPLICATION_CREDENTIALS,
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  }
  const previousFetch = globalThis.fetch
  const calls: Call[] = []
  const email = 'farnienel@hotmail.com'
  const placeholderId = 'AAAAAAAA-BBBB-CCCC-DDDD-EEEEEEEEEEEE'

  process.env.FIREBASE_SERVICE_ACCOUNT_JSON = JSON.stringify({
    client_email: 'delete-test@demo-project.iam.gserviceaccount.com',
    private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
    project_id: projectId,
  })
  delete process.env.GOOGLE_APPLICATION_CREDENTIALS
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = projectId
  delete process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET

  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    const method = init?.method || 'GET'
    const body = typeof init?.body === 'string' ? init.body : ''
    calls.push({ method, url, body })
    if (url.startsWith('https://oauth2.googleapis.com/token')) {
      return jsonResponse(200, { access_token: 'ya29.test' })
    }
    if (url.includes('/accounts:revokeRefreshTokens') || url.includes('/accounts:delete')) {
      return jsonResponse(200, {})
    }
    if (url.includes(':runQuery')) {
      const filter = queryFilter(body)
      if (filter.collectionId === 'users' && filter.field === 'email' && filter.value === email) {
        return jsonResponse(200, [
          queryHit(`users/${placeholderId}`, {
            email: { stringValue: email },
            organizationId: { stringValue: orgId },
            passwordSet: { booleanValue: false },
            firstName: { stringValue: 'Test' },
            surname: { stringValue: 'Operative' },
          }),
        ])
      }
      return jsonResponse(200, [])
    }
    if (method === 'GET' && url.includes(`/documents/users/${uid}`) && !url.includes('/orgMemberships')) {
      return jsonResponse(200, userDocument())
    }
    if (method === 'GET' && url.includes(`/documents/users/${uid}/orgMemberships`)) {
      return jsonResponse(200, { documents: [] })
    }
    if (method === 'GET' && url.includes(`/documents/adminJobs/${uid}`)) {
      return jsonResponse(200, {
        name: `projects/${projectId}/databases/(default)/documents/adminJobs/${uid}`,
        fields: {
          type: { stringValue: 'accountDelete' },
          status: { stringValue: 'running' },
          uid: { stringValue: uid },
          email: { stringValue: email },
        },
      })
    }
    if (method === 'GET' && url.includes(`/documents/users/${placeholderId}`)) {
      return jsonResponse(200, {
        name: `projects/${projectId}/databases/(default)/documents/users/${placeholderId}`,
        fields: {
          email: { stringValue: email },
          passwordSet: { booleanValue: false },
          firstName: { stringValue: 'Test' },
          surname: { stringValue: 'Operative' },
        },
      })
    }
    if (method === 'GET') return jsonResponse(404, {})
    if (method === 'DELETE' || method === 'PATCH' || method === 'POST') return jsonResponse(200, {})
    return jsonResponse(500, { error: { message: `unexpected ${method} ${url}` } })
  }

  try {
    const result = await executeAccountDelete({ uid, email: '', snapshots: [] })
    assert.equal(result, 'already')
    const queries = calls.filter((call) => call.url.includes(':runQuery')).map((call) => queryFilter(call.body))
    assert.equal(
      queries.some((query) => query.collectionId === 'users' && query.field === 'email' && query.value === email),
      true
    )
    assert.equal(
      queries.some((query) => query.collectionId === 'invitations' && query.field === 'email' && query.value === email),
      true
    )
    assert.equal(
      calls.some((call) => call.method === 'DELETE' && call.url.includes(`/users/${placeholderId}`)),
      true
    )
  } finally {
    globalThis.fetch = previousFetch
    for (const [key, value] of Object.entries(previousEnv)) {
      if (value == null) delete process.env[key]
      else process.env[key] = value
    }
  }
})

test('a failed placeholder delete anonymises that row in the same attempt', async () => {
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
  const previousEnv = {
    FIREBASE_SERVICE_ACCOUNT_JSON: process.env.FIREBASE_SERVICE_ACCOUNT_JSON,
    GOOGLE_APPLICATION_CREDENTIALS: process.env.GOOGLE_APPLICATION_CREDENTIALS,
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  }
  const previousFetch = globalThis.fetch
  const calls: Call[] = []
  const placeholderId = 'AAAAAAAA-BBBB-CCCC-DDDD-EEEEEEEEEEEE'
  const email = 'farnienel@hotmail.com'

  process.env.FIREBASE_SERVICE_ACCOUNT_JSON = JSON.stringify({
    client_email: 'delete-test@demo-project.iam.gserviceaccount.com',
    private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
    project_id: projectId,
  })
  delete process.env.GOOGLE_APPLICATION_CREDENTIALS
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = projectId
  delete process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET

  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    const method = init?.method || 'GET'
    const body = typeof init?.body === 'string' ? init.body : ''
    calls.push({ method, url, body })
    if (url.startsWith('https://oauth2.googleapis.com/token')) {
      return jsonResponse(200, { access_token: 'ya29.test' })
    }
    if (url.includes('/accounts:revokeRefreshTokens') || url.includes('/accounts:delete')) {
      return jsonResponse(200, {})
    }
    if (url.includes(':runQuery')) {
      const filter = queryFilter(body)
      if (filter.collectionId === 'users' && filter.field === 'email' && filter.value === email) {
        return jsonResponse(200, [
          queryHit(`users/${placeholderId}`, {
            email: { stringValue: email },
            passwordSet: { booleanValue: false },
            firstName: { stringValue: 'Test' },
            surname: { stringValue: 'Operative' },
            mobileNumber: { stringValue: '07700' },
          }),
        ])
      }
      return jsonResponse(200, [])
    }
    if (method === 'GET' && url.includes(`/documents/users/${placeholderId}`)) {
      return jsonResponse(200, {
        name: `projects/${projectId}/databases/(default)/documents/users/${placeholderId}`,
        fields: {
          email: { stringValue: email },
          passwordSet: { booleanValue: false },
          firstName: { stringValue: 'Test' },
          surname: { stringValue: 'Operative' },
          mobileNumber: { stringValue: '07700' },
        },
      })
    }
    if (method === 'GET' && url.includes(`/documents/users/${uid}`) && !url.includes('/orgMemberships')) {
      return jsonResponse(200, {
        name: `projects/${projectId}/databases/(default)/documents/users/${uid}`,
        fields: {
          email: { stringValue: email },
          name: { stringValue: 'Test Operative' },
          displayName: { stringValue: 'Test Operative' },
          firstName: { stringValue: 'Test' },
          passwordSet: { booleanValue: true },
        },
      })
    }
    if (method === 'GET' && url.includes(`/documents/users/${uid}/orgMemberships`)) {
      return jsonResponse(200, { documents: [] })
    }
    if (method === 'GET') return jsonResponse(404, {})
    if (method === 'DELETE' && url.includes(`/users/${placeholderId}`)) {
      return jsonResponse(500, { error: { message: 'placeholder locked' } })
    }
    if (method === 'DELETE' || method === 'PATCH' || method === 'POST') return jsonResponse(200, {})
    return jsonResponse(500, { error: { message: `unexpected ${method} ${url}` } })
  }

  try {
    const result = await executeAccountDelete({ uid, email, snapshots: [] })
    assert.equal(result, 'completed')
    const placeholderPatch = calls.find(
      (call) => call.method === 'PATCH' && call.url.includes(`/documents/users/${placeholderId}`)
    )
    assert.ok(placeholderPatch)
    assert.match(placeholderPatch!.body, /Deleted user|Deleted/)
    assert.match(placeholderPatch!.body, /""|"email"/)
  } finally {
    globalThis.fetch = previousFetch
    for (const [key, value] of Object.entries(previousEnv)) {
      if (value == null) delete process.env[key]
      else process.env[key] = value
    }
  }
})
