/**
 * Rulebook 1.54.2 §16: with privatePay on, reading a timesheet that does not exist yet.
 *
 * Both apps open a sheet by reading candidate ids (`settings/timesheet_{uid}_{seconds}`) that may not exist. Before
 * 1.54.2 the settings read rule dereferenced `resource` and `request.resource`, which are null on a read of a missing
 * document, so with privatePay on a line manager's read of a report's missing sheet was refused (an error, not a
 * decision) and the sheet could not be opened. A missing sheet is now decided by its id: readable by whoever could
 * read it if it existed (the person, their line managers, admins), never by anyone else.
 *
 *   npm run test:rules
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
const rules = readFileSync(path.join(root, 'firestore.rules'), 'utf8')

const ORG = 'org-tsm'
const ADMIN = 'tsm-admin'
const LM = 'tsm-lm'
const OTHER_MGR = 'tsm-mgr2'
const OP = 'tsm-op'
const OTHER = 'tsm-other'
const EXISTING = `timesheet_${OP}_1761955200`
const MISSING = `timesheet_${OP}_1763251200`
const OTHER_MISSING = `timesheet_${OTHER}_1763251200`

let env: RulesTestEnvironment

async function db(uid: string) {
  return (await claimsContext(env, uid, { email: `${uid}@test.com` })).firestore()
}

test.before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-timesheet-missing',
    firestore: { rules, host: '127.0.0.1', port: Number(process.env.FIRESTORE_EMULATOR_PORT || 8080) },
  })
  await env.withSecurityRulesDisabled(async (ctx) => {
    const fs = ctx.firestore()
    await setDoc(doc(fs, 'organizations', ORG), {
      name: 'Missing Sheets Ltd',
      creatorUserId: ADMIN,
      members: { [ADMIN]: 'admin', [LM]: 'manager', [OTHER_MGR]: 'manager', [OP]: 'operative', [OTHER]: 'operative' },
    })
    await setDoc(doc(fs, 'users', ADMIN), { email: `${ADMIN}@test.com`, organizationId: ORG, role: 'admin', adminAccess: true, isSuperAdmin: true, passwordSet: true })
    for (const uid of [LM, OTHER_MGR]) {
      await setDoc(doc(fs, 'users', uid), { email: `${uid}@test.com`, organizationId: ORG, role: 'manager', manager: true, permissions: { manager: true, operativeMode: false }, passwordSet: true })
    }
    await setDoc(doc(fs, 'users', OP), {
      email: `${OP}@test.com`, organizationId: ORG, role: 'operative', operativeMode: true, permissions: { operativeMode: true },
      assignedManagerUserIds: [LM], assignedManagerUserId: LM, employmentType: 'self_employed', passwordSet: true,
    })
    await setDoc(doc(fs, 'users', OTHER), {
      email: `${OTHER}@test.com`, organizationId: ORG, role: 'operative', operativeMode: true, permissions: { operativeMode: true },
      assignedManagerUserIds: [OTHER_MGR], assignedManagerUserId: OTHER_MGR, employmentType: 'self_employed', passwordSet: true,
    })
    await setDoc(doc(fs, 'organizations', ORG, 'settings', EXISTING), {
      userId: OP, weekStartKey: '2026-11-01', weekStart: Timestamp.fromMillis(Date.parse('2026-11-01T00:00:00Z')),
    })
  })
})

test.after(async () => {
  await env?.cleanup()
})

async function setPrivatePay(on: boolean) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'platformConfig', 'app'), { privatePay: on }, { merge: true })
  })
}

const sheetRef = async (uid: string, id: string) => doc(await db(uid), 'organizations', ORG, 'settings', id)

for (const privatePay of [true, false]) {
  const label = `privatePay ${privatePay ? 'on' : 'off'}`

  test(`${label}: the line manager reads a report's missing timesheet`, async () => {
    await setPrivatePay(privatePay)
    await assertSucceeds(getDoc(await sheetRef(LM, MISSING)))
  })

  test(`${label}: the line manager reads a report's existing timesheet`, async () => {
    await setPrivatePay(privatePay)
    await assertSucceeds(getDoc(await sheetRef(LM, EXISTING)))
  })

  test(`${label}: an admin reads a missing and an existing timesheet`, async () => {
    await setPrivatePay(privatePay)
    await assertSucceeds(getDoc(await sheetRef(ADMIN, MISSING)))
    await assertSucceeds(getDoc(await sheetRef(ADMIN, EXISTING)))
  })

  test(`${label}: the person reads their own missing and existing timesheet`, async () => {
    await setPrivatePay(privatePay)
    await assertSucceeds(getDoc(await sheetRef(OP, MISSING)))
    await assertSucceeds(getDoc(await sheetRef(OP, EXISTING)))
  })
}

test("privatePay on: nobody else reads someone's missing or existing timesheet", async () => {
  await setPrivatePay(true)
  // Another operative, and a manager who is not the person's line manager.
  for (const uid of [OTHER, OTHER_MGR]) {
    await assertFails(getDoc(await sheetRef(uid, MISSING)))
    await assertFails(getDoc(await sheetRef(uid, EXISTING)))
  }
  // A line manager never reads a missing sheet of someone they do not line-manage.
  await assertFails(getDoc(await sheetRef(LM, OTHER_MISSING)))
  // A missing sheet whose id names nobody (no users document) is admins' only.
  await assertFails(getDoc(await sheetRef(LM, 'timesheet_nobody_1763251200')))
  await assertSucceeds(getDoc(await sheetRef(ADMIN, 'timesheet_nobody_1763251200')))
})

test('a missing non-timesheet settings document stays as before', async () => {
  await setPrivatePay(true)
  await assertSucceeds(getDoc(await sheetRef(LM, 'deadlines_J404')))
  await assertFails(getDoc(await sheetRef(OP, 'variations_J404')))
})

test('1.55.0 privatePay on: a missing revision id is read by the same people as its original', async () => {
  await setPrivatePay(true)
  // A revision id `timesheet_{uid}_{stamp}_rev{N}` names the same person as its original (tsUid drops `_rev{N}`).
  for (const id of [`${MISSING}_rev1`, `${EXISTING}_rev1`, `${EXISTING}_rev12`]) {
    await assertSucceeds(getDoc(await sheetRef(LM, id)))
    await assertSucceeds(getDoc(await sheetRef(ADMIN, id)))
    await assertSucceeds(getDoc(await sheetRef(OP, id)))
    await assertFails(getDoc(await sheetRef(OTHER_MGR, id)))
    await assertFails(getDoc(await sheetRef(OTHER, id)))
  }
  await assertFails(getDoc(await sheetRef(LM, `${OTHER_MISSING}_rev1`)))
  await assertSucceeds(getDoc(await sheetRef(OTHER_MGR, `${OTHER_MISSING}_rev1`)))
})
