import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  EMAIL_SERVER_KEY_HEADER,
  PROJECT_PLANNER_EMAIL_FUNCTION_URL,
  sendProjectPlannerEmail,
} from './resendClient.ts'

type Call = { url: string; headers: Record<string, string>; body: Record<string, unknown> }

async function capture(run: () => Promise<void>, response: Response = new Response('{"sent":true}', { status: 200 })) {
  const calls: Call[] = []
  const originalFetch = globalThis.fetch
  const originalKey = process.env.EMAIL_SERVER_KEY
  process.env.EMAIL_SERVER_KEY = 'test-server-key'
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    calls.push({
      url: String(input),
      headers: (init?.headers || {}) as Record<string, string>,
      body: JSON.parse(String(init?.body || '{}')) as Record<string, unknown>,
    })
    return response
  }) as typeof fetch
  try {
    await run()
  } finally {
    globalThis.fetch = originalFetch
    if (originalKey === undefined) delete process.env.EMAIL_SERVER_KEY
    else process.env.EMAIL_SERVER_KEY = originalKey
  }
  return calls
}

test('sendProjectPlannerEmail posts web_rendered to the authenticated sendEmail function with the server key', async () => {
  const calls = await capture(() =>
    sendProjectPlannerEmail({
      to: 'founder@example.com',
      subject: 'Confirm your Project Planner account',
      html: '<p>Hello</p>',
      orgId: 'org-1',
      idToken: 'id-token-1',
    })
  )
  assert.equal(calls.length, 1)
  assert.equal(calls[0].url, PROJECT_PLANNER_EMAIL_FUNCTION_URL)
  assert.ok(calls[0].url.endsWith('/sendEmail'))
  assert.equal(calls[0].url.includes('api.resend.com'), false)
  assert.equal(calls[0].headers[EMAIL_SERVER_KEY_HEADER], 'test-server-key')
  assert.equal(calls[0].headers.Authorization, 'Bearer id-token-1')
  assert.deepEqual(calls[0].body, {
    template: 'web_rendered',
    to: ['founder@example.com'],
    orgId: 'org-1',
    data: { subject: 'Confirm your Project Planner account', html: '<p>Hello</p>' },
  })
  assert.equal('fromName' in calls[0].body, false, 'the function decides the From name')
})

test('sendProjectPlannerEmail omits Authorization without a user and forwards replyTo, text and headers', async () => {
  const calls = await capture(() =>
    sendProjectPlannerEmail({
      to: 'ada@example.com',
      subject: "You're on the Project Planner list",
      html: '<p>Hello</p>',
      text: 'Hello',
      replyTo: 'visitor@example.com',
      headers: { 'List-Unsubscribe': '<https://projectplanner.us/api/interest/unsubscribe?token=abc>' },
    })
  )
  assert.equal('Authorization' in calls[0].headers, false)
  assert.equal('orgId' in calls[0].body, false)
  assert.deepEqual(calls[0].body.data, {
    subject: "You're on the Project Planner list",
    html: '<p>Hello</p>',
    text: 'Hello',
    replyTo: 'visitor@example.com',
    headers: { 'List-Unsubscribe': '<https://projectplanner.us/api/interest/unsubscribe?token=abc>' },
  })
})

test('sendProjectPlannerEmail forwards attachments by name and content only', async () => {
  const calls = await capture(() =>
    sendProjectPlannerEmail({
      to: 'manager@example.com',
      subject: 'Signed timesheets',
      html: '<p>Attached</p>',
      attachments: [{ filename: 'Ada timesheet.pdf', content: 'JVBERi0x', type: 'application/pdf' }],
    })
  )
  assert.deepEqual(calls[0].body.attachments, [{ filename: 'Ada timesheet.pdf', content: 'JVBERi0x' }])
})

test('sendProjectPlannerEmail refuses to send without EMAIL_SERVER_KEY', async () => {
  const originalKey = process.env.EMAIL_SERVER_KEY
  delete process.env.EMAIL_SERVER_KEY
  try {
    await assert.rejects(
      sendProjectPlannerEmail({ to: 'a@example.com', subject: 's', html: 'h' }),
      /EMAIL_SERVER_KEY/
    )
  } finally {
    if (originalKey !== undefined) process.env.EMAIL_SERVER_KEY = originalKey
  }
})

test('sendProjectPlannerEmail surfaces a Cloud Function error', async () => {
  let failure: unknown
  await capture(
    async () => {
      try {
        await sendProjectPlannerEmail({ to: 'a@example.com', subject: 's', html: 'h' })
      } catch (error) {
        failure = error
      }
    },
    new Response(JSON.stringify({ sent: false, error: 'Too many emails. Try again later.' }), { status: 429 })
  )
  assert.ok(failure instanceof Error)
  assert.equal((failure as Error).message, 'Too many emails. Try again later.')
})

test('sendProjectPlannerEmail asks for the caller as From name and CC, and returns the Resend ids', async () => {
  let result: Awaited<ReturnType<typeof sendProjectPlannerEmail>> | null = null
  const calls = await capture(
    async () => {
      result = await sendProjectPlannerEmail({
        to: 'supplier@example.com',
        subject: 'Order',
        html: '<p>x</p>',
        replyTo: 'me@example.com',
        idToken: 'id-token-1',
        fromCaller: true,
        ccCaller: true,
      })
    },
    new Response(JSON.stringify({ sent: true, ccSupported: true, results: [{ to: 'supplier@example.com', id: 're-id-1', cc: ['me@example.com'] }] }), { status: 200 })
  )
  assert.deepEqual((calls[0].body.data as Record<string, unknown>).fromCaller, true)
  assert.deepEqual((calls[0].body.data as Record<string, unknown>).ccCaller, true)
  assert.deepEqual(result, { ids: ['re-id-1'], cc: ['me@example.com'], ccSupported: true })
})

test('sendProjectPlannerEmail against a function without CC support reports no CC (the route then sends the copy)', async () => {
  let result: Awaited<ReturnType<typeof sendProjectPlannerEmail>> | null = null
  await capture(async () => {
    result = await sendProjectPlannerEmail({ to: 'a@example.com', subject: 's', html: 'h', ccCaller: true })
  }, new Response(JSON.stringify({ sent: true, results: [{ to: 'a@example.com', id: 'x' }] }), { status: 200 }))
  assert.deepEqual(result, { ids: ['x'], cc: [], ccSupported: false })
})

test('sendProjectPlannerEmail forwards requestId (the email function sends one request to one recipient once)', async () => {
  const calls = await capture(() =>
    sendProjectPlannerEmail({
      to: 'wendy@pipes.example',
      subject: 'Quote request',
      html: '<p>Hi</p>',
      orgId: 'org-1',
      idToken: 'id-token-1',
      requestId: ' 6f1d2c3b-4a5e-4f60-8172-93a4b5c6d7e8 ',
    })
  )
  assert.equal(calls[0].body.requestId, '6f1d2c3b-4a5e-4f60-8172-93a4b5c6d7e8')
  const without = await capture(() =>
    sendProjectPlannerEmail({ to: 'wendy@pipes.example', subject: 'Quote request', html: '<p>Hi</p>' })
  )
  assert.equal('requestId' in without[0].body, false)
})
