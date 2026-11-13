import { test } from 'node:test'
import assert from 'node:assert/strict'
import { EmailBatchUnsupportedError, sendProjectPlannerEmailBatch } from './resendClient.ts'
import { sendMaterialRequestMessages, type MaterialRequestSendDeps } from './materialRequestSend.ts'

const messages = [
  { to: 'One@Shop.example', subject: 'Material order request — J-1 — Acme', html: '<p>Dear One</p>' },
  { to: 'two@shop.example', subject: 'Material order request — J-1 — Acme', html: '<p>Dear Two</p>' },
  { to: 'three@shop.example', subject: 'Material order request — J-1 — Acme', html: '<p>Dear Three</p>' },
]
const input = {
  messages,
  senderEmail: 'Max@Example.com',
  replyTo: 'max@example.com',
  orgId: 'org-1',
  idToken: 'id-token',
  requestId: '6F1D2C3B-4A5E-4F60-8172-93A4B5C6D7E8',
}

function deps(overrides: Partial<MaterialRequestSendDeps>): MaterialRequestSendDeps & { batchCalls: unknown[]; oneCalls: Array<Record<string, unknown>> } {
  const batchCalls: unknown[] = []
  const oneCalls: Array<Record<string, unknown>> = []
  return {
    batchCalls,
    oneCalls,
    sendBatch: async (params) => {
      batchCalls.push(params)
      return {
        results: params.messages.map((row, index) => ({ to: row.to.toLowerCase(), id: `re_${index}`, cc: ['max@example.com'] })),
        failed: [],
      }
    },
    sendOne: async (params) => {
      oneCalls.push(params as Record<string, unknown>)
      return { ids: [`one_${oneCalls.length}`], cc: ['max@example.com'], ccSupported: true }
    },
    reason: (message) => message,
    ...overrides,
  }
}

test('material request: every recipient goes to the email function in ONE call, with one request id', async () => {
  const d = deps({})
  const outcome = await sendMaterialRequestMessages(input, d)
  assert.equal(d.batchCalls.length, 1)
  assert.equal(d.oneCalls.length, 0, 'no call per recipient')
  const call = d.batchCalls[0] as { messages: unknown[]; requestId: string; fromCaller: boolean; ccCaller: boolean }
  assert.equal(call.messages.length, 3)
  assert.equal(call.requestId, input.requestId)
  assert.equal(call.fromCaller, true)
  assert.equal(call.ccCaller, true)
  assert.deepEqual(outcome, { sent: 3, copies: 3, failed: [], failures: [], messageIds: ['re_0', 're_1', 're_2'], mode: 'batch' })
})

test('material request: a recipient the provider refused is reported, the others count as sent', async () => {
  const d = deps({
    sendBatch: async () => ({
      results: [
        { to: 'one@shop.example', id: 're_0', cc: ['max@example.com'] },
        { to: 'three@shop.example', id: 're_2', cc: ['max@example.com'] },
      ],
      failed: ['two@shop.example'],
    }),
  })
  const outcome = await sendMaterialRequestMessages(input, d)
  assert.equal(outcome.sent, 2)
  assert.deepEqual(outcome.failed, ['two@shop.example'])
  assert.equal(outcome.failures.length, 1)
})

test('material request: no answer from the function fails every recipient and never retries one by one', async () => {
  const d = deps({
    sendBatch: async () => {
      throw new Error('The email service did not answer in time. Check your sent items before sending again.')
    },
  })
  const outcome = await sendMaterialRequestMessages(input, d)
  assert.equal(outcome.sent, 0)
  assert.deepEqual(outcome.failed, ['one@shop.example', 'two@shop.example', 'three@shop.example'])
  assert.equal(d.oneCalls.length, 0)
})

test('material request: an older function without web_rendered_batch falls back to one call per recipient, all at once as before', async () => {
  let inFlight = 0
  let maxInFlight = 0
  const d = deps({
    sendBatch: async () => {
      throw new EmailBatchUnsupportedError()
    },
  })
  const inner = d.sendOne
  d.sendOne = async (params) => {
    inFlight += 1
    maxInFlight = Math.max(maxInFlight, inFlight)
    await new Promise((resolve) => setTimeout(resolve, 2))
    inFlight -= 1
    return inner(params)
  }
  const outcome = await sendMaterialRequestMessages(input, d)
  assert.equal(outcome.mode, 'single')
  assert.equal(outcome.sent, 3)
  assert.equal(maxInFlight, 3, 'all at once, as before (sequential calls could outlast the host request limit)')
  assert.ok(d.oneCalls.every((row) => row.requestId === input.requestId && row.ccCaller === true))
})

test('material request fallback: a function without CC support still sends the sender their Copy:', async () => {
  const d = deps({
    sendBatch: async () => {
      throw new EmailBatchUnsupportedError()
    },
  })
  const inner = d.sendOne
  d.sendOne = async (params) => ({ ...(await inner(params)), cc: [], ccSupported: false })
  const outcome = await sendMaterialRequestMessages({ ...input, messages: messages.slice(0, 1) }, d)
  assert.equal(outcome.sent, 1)
  assert.equal(outcome.copies, 1)
  assert.equal(d.oneCalls[1].to, 'max@example.com')
  assert.match(String(d.oneCalls[1].subject), /^Copy: /)
})

async function withFetch(response: Response, run: () => Promise<void>) {
  const calls: Array<{ url: string; body: Record<string, unknown> }> = []
  const originalFetch = globalThis.fetch
  const originalKey = process.env.EMAIL_SERVER_KEY
  process.env.EMAIL_SERVER_KEY = 'test-server-key'
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), body: JSON.parse(String(init?.body || '{}')) })
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

test('sendProjectPlannerEmailBatch posts web_rendered_batch with every message and recipient', async () => {
  let result: Awaited<ReturnType<typeof sendProjectPlannerEmailBatch>> | null = null
  const calls = await withFetch(
    new Response(JSON.stringify({ sent: true, failed: [], results: [{ to: 'one@shop.example', id: 're_1', cc: ['max@example.com'] }] })),
    async () => {
      result = await sendProjectPlannerEmailBatch({
        messages: [{ to: 'One@Shop.example', subject: 'S', html: '<p>h</p>' }],
        replyTo: 'max@example.com',
        orgId: 'org-1',
        idToken: 't',
        fromCaller: true,
        ccCaller: true,
        requestId: input.requestId,
      })
    }
  )
  assert.equal(calls.length, 1)
  assert.deepEqual(calls[0].body, {
    template: 'web_rendered_batch',
    to: ['one@shop.example'],
    orgId: 'org-1',
    requestId: input.requestId,
    data: {
      messages: [{ to: 'one@shop.example', subject: 'S', html: '<p>h</p>' }],
      replyTo: 'max@example.com',
      fromCaller: true,
      ccCaller: true,
    },
  })
  assert.deepEqual(result, { results: [{ to: 'one@shop.example', id: 're_1', cc: ['max@example.com'] }], failed: [] })
})

test('sendProjectPlannerEmailBatch: an older function (unknown template) throws EmailBatchUnsupportedError; a 502 lists the failed', async () => {
  await withFetch(new Response(JSON.stringify({ sent: false, error: 'Unknown template web_rendered_batch' }), { status: 400 }), async () => {
    await assert.rejects(
      sendProjectPlannerEmailBatch({ messages: [{ to: 'a@x.example', subject: 'S', html: 'h' }] }),
      (error) => error instanceof EmailBatchUnsupportedError
    )
  })
  await withFetch(
    new Response(JSON.stringify({ sent: false, error: 'The email provider did not accept the message', failed: ['a@x.example'] }), { status: 502 }),
    async () => {
      const result = await sendProjectPlannerEmailBatch({ messages: [{ to: 'a@x.example', subject: 'S', html: 'h' }] })
      assert.deepEqual(result.failed, ['a@x.example'])
      assert.equal(result.results.length, 0)
    }
  )
  await withFetch(new Response(JSON.stringify({ sent: false, error: 'Too many emails. Try again later.' }), { status: 429 }), async () => {
    await assert.rejects(sendProjectPlannerEmailBatch({ messages: [{ to: 'a@x.example', subject: 'S', html: 'h' }] }), /Too many emails/)
  })
})
