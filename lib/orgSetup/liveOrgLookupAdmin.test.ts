import { generateKeyPairSync } from 'node:crypto'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { lookupLiveOrgForEmail } from './liveOrgLookupAdmin.ts'

const uid = 'QAlPe29vLLP4spK554UtpaBLW7N2'
const orgId = '2C67391E-D1FE-4F9F-8055-7149ACDE1F96'
const email = 'ada@firm.com'
const projectId = 'demo-project'

type Call = { method: string; url: string }

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function restDoc(path: string, fields: Record<string, unknown>) {
  return {
    name: `projects/${projectId}/databases/(default)/documents/${path}`,
    fields,
  }
}

async function withAdminLookup(
  handler: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>,
  run: () => Promise<void>
) {
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
  const previousEnv = {
    FIREBASE_SERVICE_ACCOUNT_JSON: process.env.FIREBASE_SERVICE_ACCOUNT_JSON,
    GOOGLE_APPLICATION_CREDENTIALS: process.env.GOOGLE_APPLICATION_CREDENTIALS,
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  }
  const previousFetch = globalThis.fetch
  process.env.FIREBASE_SERVICE_ACCOUNT_JSON = JSON.stringify({
    client_email: 'lookup-test@demo-project.iam.gserviceaccount.com',
    private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
    project_id: projectId,
  })
  delete process.env.GOOGLE_APPLICATION_CREDENTIALS
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = projectId
  globalThis.fetch = handler as typeof fetch
  try {
    await run()
  } finally {
    globalThis.fetch = previousFetch
    if (previousEnv.FIREBASE_SERVICE_ACCOUNT_JSON === undefined) delete process.env.FIREBASE_SERVICE_ACCOUNT_JSON
    else process.env.FIREBASE_SERVICE_ACCOUNT_JSON = previousEnv.FIREBASE_SERVICE_ACCOUNT_JSON
    if (previousEnv.GOOGLE_APPLICATION_CREDENTIALS === undefined) delete process.env.GOOGLE_APPLICATION_CREDENTIALS
    else process.env.GOOGLE_APPLICATION_CREDENTIALS = previousEnv.GOOGLE_APPLICATION_CREDENTIALS
    if (previousEnv.NEXT_PUBLIC_FIREBASE_PROJECT_ID === undefined) delete process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
    else process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = previousEnv.NEXT_PUBLIC_FIREBASE_PROJECT_ID
  }
}

test('live org membership lookup returns hasLiveOrg and never lists orgs or userEmails', async () => {
  const calls: Call[] = []
  await withAdminLookup(async (input, init) => {
    const url = String(input)
    const method = init?.method || 'GET'
    calls.push({ method, url })
    if (url.startsWith('https://oauth2.googleapis.com/token')) {
      return jsonResponse(200, { access_token: 'ya29.test' })
    }
    if (url.includes('/accounts:lookup')) {
      return jsonResponse(200, { users: [{ localId: uid }] })
    }
    if (method === 'GET' && url.includes(`/documents/users/${uid}`) && !url.includes('/orgMemberships')) {
      return jsonResponse(
        200,
        restDoc(`users/${uid}`, {
          email: { stringValue: email },
          isActive: { booleanValue: true },
          organizationId: { stringValue: orgId },
        })
      )
    }
    if (method === 'GET' && url.includes(`/documents/users/${uid}/orgMemberships`)) {
      return jsonResponse(200, {
        documents: [restDoc(`users/${uid}/orgMemberships/${orgId}`, { role: { stringValue: 'admin' } })],
      })
    }
    if (method === 'GET' && url.includes(`/documents/organizations/${orgId}`)) {
      return jsonResponse(
        200,
        restDoc(`organizations/${orgId}`, {
          name: { stringValue: 'Ada Ltd' },
          subscriptionStatus: { stringValue: 'active' },
          members: {
            mapValue: {
              fields: { [uid]: { stringValue: 'admin' } },
            },
          },
        })
      )
    }
    return jsonResponse(404, {})
  }, async () => {
    const result = await lookupLiveOrgForEmail(email)
    assert.deepEqual(result, { hasLiveOrg: true, hasLogin: true })
    assert.equal(
      calls.some((call) => call.url.includes('userEmails')),
      false
    )
    assert.equal(
      JSON.stringify(result).includes('Ada Ltd'),
      false
    )
  })
})

test('deleted account with Auth gone does not look up userEmails and is not live', async () => {
  const calls: Call[] = []
  await withAdminLookup(async (input, init) => {
    const url = String(input)
    calls.push({ method: init?.method || 'GET', url })
    if (url.startsWith('https://oauth2.googleapis.com/token')) {
      return jsonResponse(200, { access_token: 'ya29.test' })
    }
    if (url.includes('/accounts:lookup')) {
      return jsonResponse(400, { error: { message: 'EMAIL_NOT_FOUND' } })
    }
    return jsonResponse(500, { error: 'must not read Firestore after Auth miss' })
  }, async () => {
    const result = await lookupLiveOrgForEmail(email)
    assert.deepEqual(result, { hasLiveOrg: false, hasLogin: false })
    assert.equal(
      calls.some((call) => call.url.includes('userEmails') || call.url.includes('/documents/')),
      false
    )
  })
})

test('leftover Auth with missing users/{uid} is not a live org', async () => {
  await withAdminLookup(async (input, init) => {
    const url = String(input)
    const method = init?.method || 'GET'
    if (url.startsWith('https://oauth2.googleapis.com/token')) {
      return jsonResponse(200, { access_token: 'ya29.test' })
    }
    if (url.includes('/accounts:lookup')) {
      return jsonResponse(200, { users: [{ localId: uid }] })
    }
    if (method === 'GET' && url.includes(`/documents/users/${uid}`)) {
      return jsonResponse(404, {})
    }
    return jsonResponse(500, { error: 'must not continue after missing profile' })
  }, async () => {
    const result = await lookupLiveOrgForEmail(email)
    assert.deepEqual(result, { hasLiveOrg: false, hasLogin: true })
  })
})
