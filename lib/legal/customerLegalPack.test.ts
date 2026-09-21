import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { LEGAL_ENTITY, LEGAL_PACK_DOCUMENTS } from './customerLegalPack.ts'
import { isScrolledToBottom, passwordsMatchAndReady } from './scrollUtils.ts'

test('legal pack uses ProjectPlanner Systems Ltd and info@projectplanner.us', () => {
  const blob = JSON.stringify(LEGAL_PACK_DOCUMENTS)
  assert.equal(LEGAL_ENTITY.name, 'ProjectPlanner Systems Ltd')
  assert.equal(LEGAL_ENTITY.privacyEmail, 'info@projectplanner.us')
  assert.equal(LEGAL_ENTITY.supportEmail, 'info@projectplanner.us')
  assert.equal(blob.includes('ProjectPlanner Systems Ltd'), true)
  assert.equal(blob.includes('info@projectplanner.us'), true)
  assert.equal(blob.includes('[LEGAL COMPANY NAME]'), false)
  assert.equal(blob.includes('[PRIVACY EMAIL'), false)
  assert.equal(blob.includes('[SUPPORT/SECURITY'), false)
  assert.equal(blob.includes('IMPLEMENTATION NOTES'), false)
})

test('pack has SaaS, DPA, AUP and Privacy with privacy as acknowledgement', () => {
  assert.deepEqual(
    LEGAL_PACK_DOCUMENTS.map((doc) => doc.id),
    ['saas', 'dpa', 'aup', 'privacy']
  )
  const privacy = LEGAL_PACK_DOCUMENTS.find((doc) => doc.id === 'privacy')
  assert.equal(privacy?.acknowledgeOnly, true)
  assert.equal(privacy?.acceptLabel.includes('acknowledge'), true)
})

test('Legal policies page lists every sign-up pack document', () => {
  const source = readFileSync(new URL('../../components/auth/PrivacyPolicyContent.tsx', import.meta.url), 'utf8')
  assert.match(source, /LEGAL_PACK_DOCUMENTS/)
  assert.match(source, /Legal policies/)
})

test('isScrolledToBottom is true when content fits or the user reaches the end', () => {
  assert.equal(isScrolledToBottom({ scrollTop: 0, clientHeight: 200, scrollHeight: 180 }), true)
  assert.equal(isScrolledToBottom({ scrollTop: 0, clientHeight: 200, scrollHeight: 400 }), false)
  assert.equal(isScrolledToBottom({ scrollTop: 200, clientHeight: 200, scrollHeight: 400 }), true)
})

test('passwordsMatchAndReady requires length and a match', () => {
  assert.equal(passwordsMatchAndReady('short', 'short'), false)
  assert.equal(passwordsMatchAndReady('longenough', 'different1'), false)
  assert.equal(passwordsMatchAndReady('longenough', 'longenough'), true)
})
