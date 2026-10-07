import assert from 'node:assert/strict'
import test from 'node:test'
import { chooseWebSessionOrganization } from './webActiveOrg.ts'

const RACCORD = '2C67391E-D1FE-4F9F-8055-7149ACDE1F96'
const TEST_PRICING = '6b04f81d-a55e-41d2-8676-ecd116ad8450'

test('a remembered company stays selected when its read does not finish', () => {
  const choice = chooseWebSessionOrganization({
    rememberedOrganizationId: RACCORD,
    documentOrganizationId: TEST_PRICING,
    probes: { [RACCORD]: 'unknown', [TEST_PRICING]: 'allowed' },
  })
  assert.equal(choice.organizationId, RACCORD)
  assert.equal(choice.persistOrganizationId, RACCORD)
})

test('a remembered company is dropped only when the login is not a member', () => {
  const choice = chooseWebSessionOrganization({
    rememberedOrganizationId: RACCORD,
    documentOrganizationId: TEST_PRICING,
    probes: { [RACCORD]: 'denied', [TEST_PRICING]: 'allowed' },
  })
  assert.equal(choice.organizationId, TEST_PRICING)
  assert.equal(choice.persistOrganizationId, TEST_PRICING)
})

test('an explicit switch wins over the company stored on the user document', () => {
  const choice = chooseWebSessionOrganization({
    explicitOrganizationId: RACCORD,
    rememberedOrganizationId: TEST_PRICING,
    documentOrganizationId: TEST_PRICING,
    probes: { [RACCORD]: 'allowed', [TEST_PRICING]: 'allowed' },
  })
  assert.equal(choice.organizationId, RACCORD)
})

test('organisation ids match ignoring case when choosing the session company', () => {
  const choice = chooseWebSessionOrganization({
    explicitOrganizationId: RACCORD.toLowerCase(),
    documentOrganizationId: TEST_PRICING,
    probes: new Map([[RACCORD, 'allowed' as const]]),
  })
  assert.equal(choice.organizationId, RACCORD.toLowerCase())
})

test('one saved membership does not shorten the search for other companies', async () => {
  const source = await import('node:fs/promises').then((fs) =>
    fs.readFile(new URL('./membershipService.ts', import.meta.url), 'utf8')
  )
  assert.equal(source.includes('byId.size > 0 ? 1800'), false)
  assert.match(source, /discoveryBudgetMs = 12_000/)
})
