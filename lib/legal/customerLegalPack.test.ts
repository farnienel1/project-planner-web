import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { LEGAL_ENTITY, LEGAL_PACK_DOCUMENTS } from './customerLegalPack.ts'
import { PROCESSORS_PUBLIC_URL } from './processors.ts'
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

test('DPA §8 and Privacy point at the www processors list, not the homepage', () => {
  const dpa = JSON.stringify(LEGAL_PACK_DOCUMENTS.find((doc) => doc.id === 'dpa'))
  const privacy = JSON.stringify(LEGAL_PACK_DOCUMENTS.find((doc) => doc.id === 'privacy'))
  assert.match(dpa, new RegExp(PROCESSORS_PUBLIC_URL.replace(/\./g, '\\.')))
  assert.equal(dpa.includes('published at https://projectplanner.us.'), false)
  assert.match(privacy, new RegExp(PROCESSORS_PUBLIC_URL.replace(/\./g, '\\.')))
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

test('SaaS §3 requires authorised users to be 16 or over without collecting dates of birth', () => {
  const saas = LEGAL_PACK_DOCUMENTS.find((doc) => doc.id === 'saas')
  const section = saas?.sections.find((row) => row.title.startsWith('3.'))
  assert.match(
    section?.paragraphs.join(' ') || '',
    /Authorised Users must be 16 or over\. ProjectPlanner does not collect dates of birth; each user confirms that age when they create or accept an account\./
  )
  assert.equal(LEGAL_ENTITY.version, '1.1')
  assert.equal(LEGAL_ENTITY.effectiveDate, '26 October 2026')
})

test('sign-up policy includes the toolbox talks disclaimer', () => {
  const aup = LEGAL_PACK_DOCUMENTS.find((doc) => doc.id === 'aup')
  const blob = JSON.stringify(aup)
  assert.match(
    blob,
    /The Toolbox Talks provided within this app are for general guidance and informational purposes only; users remain solely responsible for assessing and managing their own health and safety obligations, ensuring the content is appropriate to the specific circumstances, and complying with all applicable laws, regulations, risk assessments and site requirements\./
  )
})

test('Legal policies page lists every sign-up pack document', () => {
  const source = readFileSync(new URL('../../components/auth/PrivacyPolicyContent.tsx', import.meta.url), 'utf8')
  assert.match(source, /LEGAL_PACK_DOCUMENTS/)
  assert.match(source, /Legal policies/)
  assert.match(source, /PROCESSORS_PATH/)
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

test('terms carry a content and copyright section with a takedown contact and a repeat-infringer line', () => {
  const saas = LEGAL_PACK_DOCUMENTS.find((doc) => doc.id === 'saas')
  const section = saas?.sections.find((row) => row.title === '20. Content and Copyright')
  const text = section?.paragraphs.join(' ') || ''
  assert.match(text, /info@projectplanner\.us/)
  assert.match(text, /Report a problem with this file/)
  assert.match(text, /repeatedly infringe/)
})
