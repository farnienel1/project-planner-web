/**
 * Rulebook 1.52.0, review of #330: `orgBillingOpen` (the lapsed-subscription and scheduled-deletion gate, §16, §19,
 * §20) was rewritten with nested `get` to cut compile cost. It must allow and deny exactly as before for every shape
 * the organisation document can hold — a missing, null, string or map `deletion`; a missing, null, string, number,
 * list or map `billing`. Each case is its own organisation; the probe is a member's read through the catch-all rule
 * (`canAccessOrganization`).
 *
 *   npm run test:rules     (RULES_PATH=<file> runs the same cases against another rules file, e.g. main's)
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { assertFails } from './rulesAssert.ts'
import { claimsContext } from './authClaimsContext.ts'
import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const rules = readFileSync(process.env.RULES_PATH || path.join(root, 'firestore.rules'), 'utf8')

const PAST = Timestamp.fromMillis(Date.now() - 24 * 3600 * 1000)
const FUTURE = Timestamp.fromMillis(Date.now() + 24 * 3600 * 1000)

// [case, extra organisation fields, open?] — the expectations are main's (1.51.0) behaviour.
const CASES: Array<[string, Record<string, unknown>, boolean]> = [
  ['no billing or deletion', {}, true],
  ['deletion null', { deletion: null }, true],
  ['deletion as a string', { deletion: 'scheduled' }, true],
  ['deletion map without status', { deletion: {} }, true],
  ['deletion scheduled', { deletion: { status: 'scheduled' } }, false],
  ['deletion restored status', { deletion: { status: 'active' } }, true],
  ['billing null', { billing: null }, true],
  ['billing as a string', { billing: 'active' }, true],
  ['billing as a number', { billing: 5 }, true],
  ['billing as a list', { billing: ['a', 'b'] }, true],
  ['billing map, nothing set', { billing: { status: 'trialing' } }, true],
  ['billing accessOpen true', { billing: { accessOpen: true } }, true],
  ['billing accessOpen false', { billing: { accessOpen: false } }, false],
  ['billing grace ended', { billing: { accessOpen: true, accessClosesAt: PAST } }, false],
  ['billing grace running', { billing: { accessOpen: true, accessClosesAt: FUTURE } }, true],
  ['billing accessClosesAt as text', { billing: { accessClosesAt: 'soon' } }, true],
  ['both scheduled and lapsed', { deletion: { status: 'scheduled' }, billing: { accessOpen: false } }, false],
]

let env: RulesTestEnvironment
const MEMBER = 'bg-member'

test.before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-billing-gate',
    firestore: { rules, host: '127.0.0.1', port: Number(process.env.FIRESTORE_EMULATOR_PORT || 8080) },
  })
  await env.withSecurityRulesDisabled(async (ctx) => {
    const fs = ctx.firestore()
    const members: Record<string, string> = {}
    CASES.forEach((_, index) => {
      members[`bg-${index}`] = 'operative'
    })
    await setDoc(doc(fs, 'users', MEMBER), { email: `${MEMBER}@test.com`, organizationId: 'bg-0', role: 'operative', operativeMode: true, passwordSet: true })
    for (const [index, [, extra]] of CASES.entries()) {
      const org = `bg-${index}`
      await setDoc(doc(fs, 'organizations', org), { name: org, creatorUserId: 'someone', members: { [MEMBER]: 'operative' }, ...extra })
      await setDoc(doc(fs, 'users', MEMBER, 'orgMemberships', org), { organizationId: org, role: 'operative', status: 'active' })
      await setDoc(doc(fs, 'organizations', org, 'clients', 'c1'), { name: 'Client' })
    }
  })
})

test.after(async () => {
  await env.cleanup()
})

for (const [index, [name, , open]] of CASES.entries()) {
  test(`billing gate: ${name} → ${open ? 'open' : 'closed'}`, async () => {
    const fs = (await claimsContext(env, MEMBER, { email: `${MEMBER}@test.com` })).firestore()
    const read = getDoc(doc(fs, 'organizations', `bg-${index}`, 'clients', 'c1'))
    if (open) await assertSucceeds(read)
    else await assertFails(read)
  })
}
