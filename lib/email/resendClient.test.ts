import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  PROJECT_PLANNER_EMAIL_FUNCTION_URL,
  sendProjectPlannerEmail,
} from './resendClient.ts'

test('sendProjectPlannerEmail posts to the iOS Cloud Function, not Resend', async () => {
  const calls: Array<{ url: string; body: Record<string, unknown> }> = []
  const originalFetch = globalThis.fetch
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    calls.push({
      url: String(input),
      body: JSON.parse(String(init?.body || '{}')) as Record<string, unknown>,
    })
    return new Response('ok', { status: 200 })
  }) as typeof fetch

  try {
    await sendProjectPlannerEmail({
      to: 'founder@example.com',
      subject: 'Confirm your Project Planner account',
      html: '<p>Hello</p>',
    })
  } finally {
    globalThis.fetch = originalFetch
  }

  assert.equal(calls.length, 1)
  assert.equal(calls[0].url, PROJECT_PLANNER_EMAIL_FUNCTION_URL)
  assert.equal(calls[0].url.includes('api.resend.com'), false)
  assert.equal(calls[0].body.to, 'founder@example.com')
  assert.equal(calls[0].body.fromName, 'Project Planner')
  assert.equal(calls[0].body.replyTo, 'info@projectplanner.us')
})

test('sendProjectPlannerEmail forwards cc, replyTo and fromName like iOS', async () => {
  const calls: Array<{ body: Record<string, unknown> }> = []
  const originalFetch = globalThis.fetch
  globalThis.fetch = (async (_input: string | URL | Request, init?: RequestInit) => {
    calls.push({ body: JSON.parse(String(init?.body || '{}')) as Record<string, unknown> })
    return new Response('ok', { status: 200 })
  }) as typeof fetch

  try {
    await sendProjectPlannerEmail({
      to: 'alex@cef.example',
      subject: 'Quote request — P-104 — Acme',
      html: '<p>Hi</p>',
      cc: 'farnie@example.com',
      replyTo: 'farnie@example.com',
      fromName: 'Farnie (via Project Planner)',
    })
  } finally {
    globalThis.fetch = originalFetch
  }

  assert.equal(calls[0].body.cc, 'farnie@example.com')
  assert.equal(calls[0].body.replyTo, 'farnie@example.com')
  assert.equal(calls[0].body.fromName, 'Farnie (via Project Planner)')
})

test('sendProjectPlannerEmail surfaces a Cloud Function error', async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = (async () =>
    new Response(JSON.stringify({ error: 'mailbox unavailable' }), { status: 500 })) as typeof fetch

  try {
    await assert.rejects(
      () =>
        sendProjectPlannerEmail({
          to: 'founder@example.com',
          subject: 'Hi',
          html: '<p>x</p>',
        }),
      /mailbox unavailable/
    )
  } finally {
    globalThis.fetch = originalFetch
  }
})
