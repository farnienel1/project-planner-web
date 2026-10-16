import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  PROCESSOR_INVENTORY,
  PROCESSORS_NOT_USED,
  PROCESSORS_PATH,
  PROCESSORS_PUBLIC_URL,
} from './processors.ts'

test('processor inventory is the published set only', () => {
  assert.deepEqual(
    PROCESSOR_INVENTORY.map((row) => row.id),
    [
      'firebase',
      'functions',
      'push',
      'app-check',
      'maps-google',
      'stripe',
      'netlify',
      'resend',
      'apple-on-device',
      'osm',
      'whatsapp',
    ]
  )
  assert.equal(PROCESSOR_INVENTORY.some((row) => /sentry|crashlytics|openai|analytics sdk/i.test(row.name)), false)
  assert.match(PROCESSORS_NOT_USED, /Sentry/)
})

test('Cloud Functions region is us-central1 United States, Resend is DEBUG only', () => {
  const functions = PROCESSOR_INVENTORY.find((row) => row.id === 'functions')
  assert.equal(functions?.region?.confidence, 'Certain')
  assert.match(functions?.region?.label || '', /us-central1/)
  assert.match(functions?.purpose || '', /email/)
  const resend = PROCESSOR_INVENTORY.find((row) => row.id === 'resend')
  assert.match(resend?.purpose || '', /iOS DEBUG/)
  assert.match(resend?.purpose || '', /does not claim production Resend/)
})

test('public processors URL is www-canonical', () => {
  assert.equal(PROCESSORS_PATH, '/processors')
  assert.equal(PROCESSORS_PUBLIC_URL, 'https://www.projectplanner.us/processors')
})

test('register-interest FAQ does not claim UK/EU Google Cloud', () => {
  const source = readFileSync(new URL('../../app/register-interest/page.tsx', import.meta.url), 'utf8')
  assert.equal(source.includes('UK/EU'), false)
  assert.match(source, /us-central1/)
})

test('login, setup and register-interest expose /privacy and /terms', () => {
  const links = readFileSync(new URL('../../components/legal/LegalLinks.tsx', import.meta.url), 'utf8')
  const login = readFileSync(new URL('../../components/auth/LoginBrandScreen.tsx', import.meta.url), 'utf8')
  const setup = readFileSync(new URL('../../components/setup/OrgSetupWizard.tsx', import.meta.url), 'utf8')
  const form = readFileSync(new URL('../../components/marketing/RegisterInterestForm.tsx', import.meta.url), 'utf8')
  const interest = readFileSync(new URL('../../app/register-interest/page.tsx', import.meta.url), 'utf8')
  assert.match(links, /PRIVACY_PATH/)
  assert.match(links, /TERMS_PATH/)
  assert.match(login, /LegalLinks/)
  assert.match(setup, /LegalLinks/)
  assert.match(form, /\/privacy/)
  assert.match(form, /\/terms/)
  assert.match(interest, /\/privacy/)
  assert.match(interest, /\/terms/)
  const footer = readFileSync(new URL('../../components/marketing/MarketingShell.tsx', import.meta.url), 'utf8')
  assert.match(footer, /\/privacy/)
  assert.match(footer, /\/terms/)
  assert.match(footer, /\/processors/)
})
