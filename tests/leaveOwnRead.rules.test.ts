/**
 * Rulebook 1.73.2 (§9, §16, §18; owner 23 Nov "do Phase B before launch"): annual leave reads, Phase B.
 * With `platformConfig/app.operativeOwnLeave` on (or the organisation listed in `operativeOwnLeaveOrganizationIds`),
 * a caller at the operative level reads a `holidayBookings` record only when its `userId` or `operativeId` is one of
 * their ids (own uid, former / same-email ids on their users document, an `operatives` row on their sign-in email) or
 * its `userId` is their sign-in email (any letter case). Admins, managers, a user with no level flag (claims role
 * 'member') and an admin with a stray operative-mode flag are not narrowed. Switch off = every member reads, as before.
 * The rules accept the apps' exact queries (`leaveQueryPlan`): one `or` of `userId in` (ids + two email spellings on the
 * first query only) and `operativeId in` (ids) per `OWN_LEAVE_IDS_PER_QUERY` (6) ids. Each `operatives`-row id costs
 * the rule one document lookup and one query may make 10 (3 are the rule's own), so 6 ids per query always fit —
 * however many rows the person has (1.73.2: 14 ids per query refused an operative with 8 or more row ids).
 * Emulator only (own project id).
 *
 *   npm run test:rules
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { assertLogicalDeny, assertSucceedsWithinBudget } from './rulesAssert.ts'
import { claimsContext } from './authClaimsContext.ts'
import { collection, doc, getDoc, getDocs, or, query, setDoc, Timestamp, where } from 'firebase/firestore'
import { leaveQueryPlan } from '../lib/canonical/staffAccess.ts'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const rules = readFileSync(path.join(root, 'firestore.rules'), 'utf8')

const ORG = 'org-own-leave'
const OTHER_ORG = 'org-elsewhere'
const ADMIN = 'ol-admin'
const MANAGER = 'ol-manager'
const NOFLAG = 'ol-noflag'
const STRAY = 'ol-stray-admin'
const OP = 'ol-op'
const OP_EMAIL_STORED = 'Ol-Op@Test.com'
const OP_TOKEN_EMAIL = 'ol-op@test.com'
const COLLEAGUE = 'ol-colleague'
const ROW_A = 'ol-row-a'
const ROW_B = 'ol-row-b'
const FORMER = Array.from({ length: 11 }, (_, i) => `ol-former-${i}`)
const MANY_ROWS = Array.from({ length: 14 }, (_, i) => `ol-many-row-${i}`)

let env: RulesTestEnvironment

async function db(uid: string, email = `${uid}@test.com`) {
  return (await claimsContext(env, uid, { email })).firestore()
}

function leave(fields: Record<string, unknown>) {
  return {
    organizationId: ORG,
    startDate: Timestamp.fromMillis(Date.parse('2026-12-01T00:00:00Z')),
    endDate: Timestamp.fromMillis(Date.parse('2026-12-01T00:00:00Z')),
    timeSlot: 'FULL DAY',
    status: 'approved',
    ...fields,
  }
}

async function seed(switchConfig: Record<string, unknown> | null) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const d = ctx.firestore()
    if (switchConfig) await setDoc(doc(d, 'platformConfig', 'app'), switchConfig)
    await setDoc(doc(d, 'organizations', ORG), {
      name: 'Own Leave Co',
      creatorUserId: ADMIN,
      members: { [ADMIN]: 'admin', [MANAGER]: 'manager', [NOFLAG]: 'member', [STRAY]: 'admin', [OP]: 'operative', [COLLEAGUE]: 'operative' },
    })
    const user = (id: string, fields: Record<string, unknown>) =>
      setDoc(doc(d, 'users', id), { email: `${id}@test.com`, organizationId: ORG, passwordSet: true, isActive: true, ...fields })
    await user(ADMIN, { role: 'admin', adminAccess: true, isSuperAdmin: true })
    await user(MANAGER, { role: 'manager', manager: true, assignedManagerUserIds: [ADMIN] })
    await user(NOFLAG, { assignedManagerUserIds: [ADMIN] })
    await user(STRAY, { role: 'admin', adminAccess: true, operativeMode: true })
    await user(OP, { email: OP_EMAIL_STORED, role: 'operative', operativeMode: true, assignedManagerUserIds: [MANAGER], formerUserIds: FORMER })
    await user(COLLEAGUE, { role: 'operative', operativeMode: true, assignedManagerUserIds: [MANAGER] })
    await setDoc(doc(d, 'organizations', ORG, 'operatives', ROW_A), { firstName: 'Ol', lastName: 'Op', email: OP_TOKEN_EMAIL, isActive: true })
    await setDoc(doc(d, 'organizations', ORG, 'operatives', ROW_B), { firstName: 'Ol', lastName: 'Op', email: OP_EMAIL_STORED, isActive: true })
    for (const row of MANY_ROWS) {
      // Every one of these ids is an `operatives` row on the operative's email: the worst case for the lookup budget.
      await setDoc(doc(d, 'organizations', ORG, 'operatives', row), { firstName: 'Ol', lastName: 'Op', email: OP_TOKEN_EMAIL, isActive: true })
    }
    await setDoc(doc(d, 'organizations', ORG, 'operatives', 'ol-colleague-row'), { firstName: 'Co', lastName: 'L', email: `${COLLEAGUE}@test.com`, isActive: true })
    const hb = (id: string, fields: Record<string, unknown>) => setDoc(doc(d, 'organizations', ORG, 'holidayBookings', id), leave(fields))
    await hb('H-OWN', { userId: OP })
    await hb('H-FORMER', { userId: FORMER[3] })
    await hb('H-ROW-OP', { operativeId: ROW_A })
    await hb('H-ROW-USERID', { userId: ROW_B })
    await hb('H-EMAIL', { userId: OP_EMAIL_STORED })
    await hb('H-EMAIL-LOWER', { userId: OP_TOKEN_EMAIL })
    await hb('H-MANY-LAST-OP', { operativeId: MANY_ROWS[13] })
    await hb('H-MANY-LAST-USER', { userId: MANY_ROWS[12] })
    await hb('H-COLLEAGUE', { userId: COLLEAGUE })
    await hb('H-COLLEAGUE-ROW', { operativeId: 'ol-colleague-row' })
  })
}

test.before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-project-planner-own-leave',
    firestore: { rules, host: '127.0.0.1', port: Number(process.env.RULES_PORT || 8080) },
  })
})

test.after(async () => {
  await env?.cleanup()
})

const leaveCol = async (uid: string, email?: string) => collection(await db(uid, email), 'organizations', ORG, 'holidayBookings')
const leaveDoc = async (id: string, uid: string, email?: string) => doc(await db(uid, email), 'organizations', ORG, 'holidayBookings', id)

/** The operative's queries exactly as `leaveQueryPlan` builds them (one `or` per `OWN_LEAVE_IDS_PER_QUERY` ids). */
async function ownQueries(ids: string[], email = OP_EMAIL_STORED) {
  const plan = leaveQueryPlan(
    { uid: OP, ids: [OP], email, role: { isAdmin: false, isManager: false, isOperativeMode: true } } as never,
    { ownIds: ids, email, operativeOwnLeave: true }
  )
  const col = await leaveCol(OP, OP_TOKEN_EMAIL)
  return plan.queries.map((q) => {
    if (q.kind !== 'own') throw new Error('expected an own query')
    return query(col, or(where('userId', 'in', q.anyOf[0].values), where('operativeId', 'in', q.anyOf[1].values)))
  })
}

test('switch off: an operative reads every leave record, as before', async () => {
  await env.clearFirestore()
  await seed(null)
  await assertSucceedsWithinBudget(getDocs(await leaveCol(OP, OP_TOKEN_EMAIL)))
  await assertSucceedsWithinBudget(getDoc(await leaveDoc('H-COLLEAGUE', OP, OP_TOKEN_EMAIL)))
  await env.clearFirestore()
  await seed({ operativeOwnLeave: false, operativeOwnLeaveOrganizationIds: [OTHER_ORG] })
  await assertSucceedsWithinBudget(getDocs(await leaveCol(OP, OP_TOKEN_EMAIL)))
})

for (const [label, config] of [
  ['global switch', { operativeOwnLeave: true }],
  ['organisation listed', { operativeOwnLeaveOrganizationIds: [ORG] }],
] as const) {
  test(`${label}: an operative reads only their own leave`, async () => {
    await env.clearFirestore()
    await seed(config)
    // The whole collection is refused.
    await assertLogicalDeny(getDocs(await leaveCol(OP, OP_TOKEN_EMAIL)))
    // Own records by id, under every key the apps query.
    for (const id of ['H-OWN', 'H-FORMER', 'H-ROW-OP', 'H-ROW-USERID', 'H-EMAIL', 'H-EMAIL-LOWER']) {
      await assertSucceedsWithinBudget(getDoc(await leaveDoc(id, OP, OP_TOKEN_EMAIL)))
    }
    // A colleague's records are refused.
    await assertLogicalDeny(getDoc(await leaveDoc('H-COLLEAGUE', OP, OP_TOKEN_EMAIL)))
    await assertLogicalDeny(getDoc(await leaveDoc('H-COLLEAGUE-ROW', OP, OP_TOKEN_EMAIL)))
    // The apps' own query (uid + a former id + both rows + two email spellings).
    const [q] = await ownQueries([OP, FORMER[3], ROW_A, ROW_B])
    const snap = (await assertSucceedsWithinBudget(getDocs(q))) as { docs: { id: string }[] }
    const got = snap.docs.map((d) => d.id).sort()
    if (JSON.stringify(got) !== JSON.stringify(['H-EMAIL', 'H-EMAIL-LOWER', 'H-FORMER', 'H-OWN', 'H-ROW-OP', 'H-ROW-USERID'])) {
      throw new Error(`unexpected own leave: ${got.join(',')}`)
    }
    // A query that names a colleague is refused.
    const col = await leaveCol(OP, OP_TOKEN_EMAIL)
    await assertLogicalDeny(getDocs(query(col, or(where('userId', 'in', [OP, COLLEAGUE]), where('operativeId', 'in', [OP])))))
    await assertLogicalDeny(getDocs(query(col, where('operativeId', '==', 'ol-colleague-row'))))
  })
}

test('switch on: 14 ids (uid, 11 former ids, two operatives rows) plus two email spellings fit, in 6-id queries', async () => {
  await env.clearFirestore()
  await seed({ operativeOwnLeave: true })
  const queries = await ownQueries([OP, ...FORMER, ROW_A, ROW_B])
  if (queries.length !== 3) throw new Error(`expected three queries, got ${queries.length}`)
  for (const q of queries) await assertSucceedsWithinBudget(getDocs(q))
})

for (const count of [10, 14]) {
  test(`switch on: an operative with ${count} operatives rows reads their own leave with the app's chunked queries`, async () => {
    await env.clearFirestore()
    await seed({ operativeOwnLeave: true })
    const rows = MANY_ROWS.slice(0, count)
    const queries = await ownQueries([OP, ...rows])
    const expected = Math.ceil((count + 1) / 6)
    if (queries.length !== expected) throw new Error(`expected ${expected} queries, got ${queries.length}`)
    const ids = new Set<string>()
    for (const q of queries) {
      const snap = (await assertSucceedsWithinBudget(getDocs(q))) as { docs: { id: string }[] }
      for (const d of snap.docs) ids.add(d.id)
    }
    for (const id of ['H-OWN', 'H-EMAIL', 'H-EMAIL-LOWER']) if (!ids.has(id)) throw new Error(`missing ${id}`)
    if (count === 14 && !(ids.has('H-MANY-LAST-OP') && ids.has('H-MANY-LAST-USER'))) throw new Error('missing a last-row record')
    if (ids.has('H-COLLEAGUE') || ids.has('H-COLLEAGUE-ROW')) throw new Error('a colleague record was returned')
    // Still refused: the whole collection and a colleague's record.
    await assertLogicalDeny(getDocs(await leaveCol(OP, OP_TOKEN_EMAIL)))
    await assertLogicalDeny(getDoc(await leaveDoc('H-COLLEAGUE', OP, OP_TOKEN_EMAIL)))
  })
}

test('switch on: admins, managers, a no-flag user and an admin with a stray operative-mode flag are not narrowed', async () => {
  await env.clearFirestore()
  await seed({ operativeOwnLeave: true })
  for (const uid of [ADMIN, MANAGER, NOFLAG, STRAY]) {
    await assertSucceedsWithinBudget(getDocs(await leaveCol(uid)))
    await assertSucceedsWithinBudget(getDoc(await leaveDoc('H-COLLEAGUE', uid)))
  }
})

test('switch listed for another organisation only: this organisation is not narrowed', async () => {
  await env.clearFirestore()
  await seed({ operativeOwnLeaveOrganizationIds: [OTHER_ORG] })
  await assertSucceedsWithinBudget(getDocs(await leaveCol(OP, OP_TOKEN_EMAIL)))
})
