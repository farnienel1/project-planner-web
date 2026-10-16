import assert from 'node:assert/strict'
import test from 'node:test'
import { LEGAL_ENTITY } from '../legal/customerLegalPack.ts'
import {
  buildInterestAckHtml,
  buildInterestOwnerHtml,
  interestAckUnsubscribeHeaders,
  sendInterestEmails,
} from './notifyEmail.ts'

const draft = {
  firstName: 'Ada',
  lastName: 'Lovelace',
  company: 'Analytical Engines',
  email: 'ada@example.com',
  phone: '',
  role: 'Owner / Director',
  teamSize: '6–15',
  sectors: ['CAT A'],
  currentTools: '',
  message: '',
  source: 'direct',
  campaign: '',
}

test('the prospect ack footer is the legal entity and an unsubscribe link', () => {
  const html = buildInterestAckHtml({
    firstName: 'Ada',
    company: 'Analytical Engines',
    unsubscribeUrl: 'https://projectplanner.us/interest/unsubscribe?token=abc',
  })
  assert.match(html, /Ada/)
  assert.match(html, /You're on the list/)
  assert.match(html, new RegExp(LEGAL_ENTITY.name))
  assert.match(html, /71-75 Shelton Street/)
  assert.match(html, /info@projectplanner.us/)
  assert.match(html, /Unsubscribe from Project Planner updates/)
  assert.match(html, /interest\/unsubscribe\?token=abc/)
})

test('the owner ping has no unsubscribe link or marketing footer', () => {
  const html = buildInterestOwnerHtml(draft)
  assert.match(html, /registered interest/)
  assert.equal(html.includes('Unsubscribe'), false)
  assert.equal(html.includes(LEGAL_ENTITY.registeredOffice), false)
})

test('ack headers are RFC 8058 one-click', () => {
  const headers = interestAckUnsubscribeHeaders(
    'https://projectplanner.us/api/interest/unsubscribe?token=abc'
  )
  assert.equal(
    headers['List-Unsubscribe'],
    '<https://projectplanner.us/api/interest/unsubscribe?token=abc>'
  )
  assert.equal(headers['List-Unsubscribe-Post'], 'List-Unsubscribe=One-Click')
})

test('a suppressed address skips the prospect ack and still pings the owner', async () => {
  const calls: Array<Record<string, unknown>> = []
  const originalFetch = globalThis.fetch
  globalThis.fetch = (async (_input: string | URL | Request, init?: RequestInit) => {
    calls.push(JSON.parse(String(init?.body || '{}')) as Record<string, unknown>)
    return new Response('ok', { status: 200 })
  }) as typeof fetch

  try {
    const result = await sendInterestEmails(draft, { isSuppressed: async () => true })
    assert.equal(result, 'skipped')
  } finally {
    globalThis.fetch = originalFetch
  }

  assert.equal(calls.length, 1)
  assert.equal(calls[0].to, 'info@projectplanner.us')
  assert.equal('headers' in calls[0], false)
})

test('an unsuppressed address sends the ack with headers and a visible link', async () => {
  const calls: Array<Record<string, unknown>> = []
  const originalFetch = globalThis.fetch
  globalThis.fetch = (async (_input: string | URL | Request, init?: RequestInit) => {
    calls.push(JSON.parse(String(init?.body || '{}')) as Record<string, unknown>)
    return new Response('ok', { status: 200 })
  }) as typeof fetch

  try {
    const result = await sendInterestEmails(draft, { isSuppressed: async () => false })
    assert.equal(result, 'sent')
  } finally {
    globalThis.fetch = originalFetch
  }

  assert.equal(calls.length, 2)
  assert.equal(calls[0].to, 'info@projectplanner.us')
  assert.equal('headers' in calls[0], false)
  assert.equal(calls[1].to, 'ada@example.com')
  assert.equal(calls[1].subject, "You're on the Project Planner list")
  assert.match(String(calls[1].html), /Unsubscribe from Project Planner updates/)
  const headers = calls[1].headers as Record<string, string>
  assert.match(headers['List-Unsubscribe'], /\/api\/interest\/unsubscribe\?token=/)
  assert.equal(headers['List-Unsubscribe-Post'], 'List-Unsubscribe=One-Click')
})
