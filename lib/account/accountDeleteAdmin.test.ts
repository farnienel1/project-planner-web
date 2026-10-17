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
    for (const query of queries) {
      const parsed = JSON.parse(query.body) as { structuredQuery: { from: { collectionId: string }[] } }
      assert.equal(parsed.structuredQuery.from[0]?.collectionId, 'organizations')
    }
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
    assert.equal(blob.includes('invitations'), false)
  } finally {
    globalThis.fetch = previousFetch
    for (const [key, value] of Object.entries(previousEnv)) {
      if (value == null) delete process.env[key]
      else process.env[key] = value
    }
  }
})
