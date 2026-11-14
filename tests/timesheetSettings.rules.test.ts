/**
 * Rulebook 1.43.0 §16: an operative lists their own timesheets.
 *
 * A timesheet lives at `organizations/{orgId}/settings/timesheet_{uid}_{seconds}`. Both apps load a person's sheets
 * with a settings query on `userId == <uid>` (and `userId in [...]`). Before 1.43.0 the settings read rule first
 * required staff for `variations_*` / `variationItem_*` documents; a query cannot prove it never returns one, so every
 * operative's own-timesheet query was refused. The read now allows a document whose `userId` is the caller first, so
 * the subject's query is provable; nobody else's sheets and no variation documents open up.
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
import { collection, doc, getDoc, getDocs, query, setDoc, Timestamp, where } from 'firebase/firestore'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const rules = readFileSync(path.join(root, 'firestore.rules'), 'utf8')

const ORG = 'org-tss'
const ADMIN = 'tss-admin'
const LM = 'tss-lm'
const OP = 'tss-op'
const OTHER = 'tss-other'

let env: RulesTestEnvironment

async function db(uid: string) {
  return (await claimsContext(env, uid, { email: `${uid}@test.com` })).firestore()
}

function sheet(uid: string, weekStartKey: string) {
  return { userId: uid, weekStartKey, weekStart: Timestamp.fromMillis(Date.parse(`${weekStartKey}T00:00:00Z`)) }
}

test.before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-timesheet-settings',
    firestore: { rules, host: '127.0.0.1', port: Number(process.env.FIRESTORE_EMULATOR_PORT || 8080) },
  })
  await env.withSecurityRulesDisabled(async (ctx) => {
    const fs = ctx.firestore()
    await setDoc(doc(fs, 'organizations', ORG), {
      name: 'Timesheets Ltd',
      creatorUserId: ADMIN,
      members: { [ADMIN]: 'admin', [LM]: 'manager', [OP]: 'operative', [OTHER]: 'operative' },
    })
    await setDoc(doc(fs, 'users', ADMIN), { email: `${ADMIN}@test.com`, organizationId: ORG, role: 'admin', adminAccess: true, isSuperAdmin: true, passwordSet: true })
    await setDoc(doc(fs, 'users', LM), { email: `${LM}@test.com`, organizationId: ORG, role: 'manager', manager: true, permissions: { manager: true, operativeMode: false }, passwordSet: true })
    for (const uid of [OP, OTHER]) {
      await setDoc(doc(fs, 'users', uid), {
        email: `${uid}@test.com`,
        organizationId: ORG,
        role: 'operative',
        operativeMode: true,
        permissions: { operativeMode: true },
        assignedManagerUserIds: [LM],
        assignedManagerUserId: LM,
        employmentType: 'self_employed',
        passwordSet: true,
      })
    }
    await setDoc(doc(fs, 'organizations', ORG, 'settings', `timesheet_${OP}_1761955200`), sheet(OP, '2026-11-01'))
    await setDoc(doc(fs, 'organizations', ORG, 'settings', `timesheet_${OP}_1763251200`), sheet(OP, '2026-11-16'))
    await setDoc(doc(fs, 'organizations', ORG, 'settings', `timesheet_${OTHER}_1761955200`), sheet(OTHER, '2026-11-01'))
    await setDoc(doc(fs, 'organizations', ORG, 'settings', 'variations_J1'), { trades: ['Plumbing'] })
    await setDoc(doc(fs, 'organizations', ORG, 'settings', 'variationItem_V1'), { title: 'V1' })
  })
})

test.after(async () => {
  await env?.cleanup()
})

test('an operative lists their own timesheets (userId == and userId in)', async () => {
  const fs = await db(OP)
  const settings = collection(fs, 'organizations', ORG, 'settings')
  const byEq = (await assertSucceeds(getDocs(query(settings, where('userId', '==', OP))))) as Awaited<ReturnType<typeof getDocs>>
  if (byEq.size !== 2) throw new Error(`expected 2 own sheets, got ${byEq.size}`)
  await assertSucceeds(getDocs(query(settings, where('userId', 'in', [OP]))))
  await assertSucceeds(getDoc(doc(fs, 'organizations', ORG, 'settings', `timesheet_${OP}_1761955200`)))
})

test("an operative cannot read or list another person's timesheet", async () => {
  const fs = await db(OP)
  const settings = collection(fs, 'organizations', ORG, 'settings')
  await assertFails(getDocs(query(settings, where('userId', '==', OTHER))))
  await assertFails(getDocs(query(settings, where('userId', 'in', [OP, OTHER]))))
  await assertFails(getDocs(query(settings, where('weekStartKey', '==', '2026-11-01'))))
})

test('an operative cannot read variation settings documents', async () => {
  const fs = await db(OP)
  await assertFails(getDoc(doc(fs, 'organizations', ORG, 'settings', 'variations_J1')))
  await assertFails(getDoc(doc(fs, 'organizations', ORG, 'settings', 'variationItem_V1')))
  await assertFails(getDocs(collection(fs, 'organizations', ORG, 'settings')))
})

test("a line manager and an admin still list a report's timesheets", async () => {
  for (const uid of [LM, ADMIN]) {
    const fs = await db(uid)
    const settings = collection(fs, 'organizations', ORG, 'settings')
    await assertSucceeds(getDocs(query(settings, where('userId', '==', OP))))
    await assertSucceeds(getDocs(query(settings, where('userId', 'in', [OP, OTHER]))))
  }
})
