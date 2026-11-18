/**
 * Edit user "Save" answers (owner bug 17 Nov: "Saving…" never returned for an Operatives manager editing an operative,
 * although the phone number changed). Every write is raced against a timeout, as `methodTernary.rules.test.ts`: a write
 * the rules engine crashes on never settles, so it fails as `hang` instead of hanging the suite.
 *
 *   npm run test:rules
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { claimsContext } from './authClaimsContext.ts'
import { isExpressionLimitDenial } from './rulesAssert.ts'
import { doc, serverTimestamp, setDoc, Timestamp, updateDoc, writeBatch } from 'firebase/firestore'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const rules = readFileSync(path.join(root, 'firestore.rules'), 'utf8')

const ORG = 'PS-ORG-1'
const SA = 'ps-super-admin'
const ADMIN = 'ps-admin'
const OPM = 'ps-ops-manager'
const OP = 'ps-operative'
const ROW = 'ps-operative-row'
const WAIT_MS = 8000
const EMAILS: Record<string, string> = {
  [SA]: 'ps-sa@test.com',
  [ADMIN]: 'ps-admin@test.com',
  [OPM]: 'ps-opm@test.com',
  [OP]: 'ps-op@test.com',
}

let env: RulesTestEnvironment
type Outcome = 'allowed' | 'denied' | 'budget' | 'hang' | `error:${string}`

async function outcome(write: Promise<unknown>): Promise<Outcome> {
  let timer: NodeJS.Timeout | undefined
  const timeout = new Promise<Outcome>((resolve) => {
    timer = setTimeout(() => resolve('hang'), WAIT_MS)
  })
  const settled = write.then(
    () => 'allowed' as Outcome,
    (error: { code?: string }) => {
      if (isExpressionLimitDenial(error)) return 'budget' as Outcome
      return error?.code === 'permission-denied' ? ('denied' as Outcome) : (`error:${String(error?.code)}` as Outcome)
    }
  )
  try {
    return await Promise.race([settled, timeout])
  } finally {
    clearTimeout(timer)
  }
}

async function dbAs(uid: string) {
  return (await claimsContext(env, uid, { email: EMAILS[uid], email_verified: true })).firestore()
}
type Db = Awaited<ReturnType<typeof dbAs>>
async function as(uid: string, write: (db: Db) => Promise<unknown>): Promise<Outcome> {
  return outcome(write(await dbAs(uid)))
}

test.before(async () => {
  env = await initializeTestEnvironment({
    projectId: `demo-profile-save-${Date.now()}`,
    firestore: { rules, host: '127.0.0.1', port: Number(process.env.RULES_PORT ?? 8080) },
  })
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    await setDoc(doc(db, 'organizations', ORG), {
      name: 'Profile save',
      creatorUserId: SA,
      members: { [SA]: 'admin', [ADMIN]: 'admin', [OPM]: 'manager', [OP]: 'operative' },
      billing: { status: 'active', accessOpen: true },
    })
    const base = { isActive: true, passwordSet: true, organizationId: ORG }
    await setDoc(doc(db, 'users', SA), { ...base, email: EMAILS[SA], role: 'admin', isSuperAdmin: true, adminAccess: true })
    await setDoc(doc(db, 'users', ADMIN), { ...base, email: EMAILS[ADMIN], role: 'admin', adminAccess: true, assignedManagerUserIds: [SA] })
    await setDoc(doc(db, 'users', OPM), {
      ...base, email: EMAILS[OPM], role: 'manager', manager: true, operatives: true, assignedManagerUserIds: [ADMIN],
      permissions: { manager: true, operatives: true },
    })
    await setDoc(doc(db, 'users', OP), {
      ...base, email: EMAILS[OP], role: 'operative', operativeMode: true, firstName: 'Op', surname: 'One',
      assignedManagerUserIds: [OPM], employmentType: 'self_employed', payBasis: 'day', dayRate: 200,
      permissions: { operativeMode: true },
    })
    await setDoc(doc(db, 'organizations', ORG, 'userEmails', EMAILS[OP]), { userId: OP })
    const opBase = { ...base, role: 'operative', operativeMode: true, assignedManagerUserIds: [OPM], employmentType: 'self_employed', permissions: { operativeMode: true } }
    await setDoc(doc(db, 'users', 'v-sa-false'), { ...opBase, email: 'v1@test.com', isSuperAdmin: false, adminAccess: false, manager: false, operatives: false })
    await setDoc(doc(db, 'users', 'v-no-email'), { ...opBase })
    await setDoc(doc(db, 'users', 'v-ghost'), { ...opBase, email: '', ghost: true, passwordSet: false })
    await setDoc(doc(db, 'users', 'v-full'), { ...opBase, email: 'v4@test.com', isSuperAdmin: false, adminAccess: false, manager: false, operatives: false,
      permissions: { operativeMode: true, adminAccess: false, manager: false, operatives: false, materials: true, siteAudit: true, annualLeaveSelfBook: false, timesheetSelfSign: false } })
    await setDoc(doc(db, 'organizations', ORG, 'operatives', ROW), {
      email: EMAILS[OP], firstName: 'Op', surname: 'One', linkedUserId: OP,
    })
  })
})

test.after(async () => {
  await env.cleanup()
})

/** The web profile save's batch for a phone change (`userStore.saveUser`): partial users update, email claim, row names. */
function phoneSaveBatch(db: Db, parts: { user?: boolean; claim?: boolean; row?: boolean; mirror?: string }) {
  const batch = writeBatch(db)
  if (parts.user) batch.update(doc(db, 'users', OP), { mobileNumber: '07700900123', updatedAt: serverTimestamp() })
  if (parts.claim) batch.set(doc(db, 'organizations', ORG, 'userEmails', EMAILS[OP]), { userId: OP })
  if (parts.row) {
    batch.update(doc(db, 'organizations', ORG, 'operatives', ROW), {
      firstName: 'Op', surname: 'One', lastName: 'One', name: 'Op One', displayName: 'Op One', updatedAt: Timestamp.now(),
    })
  }
  if (parts.mirror) {
    // The `operativeProfiles` mirror create (`addPartialDocumentToBatch` when it is missing).
    batch.set(doc(db, 'organizations', ORG, 'operativeProfiles', OP), {
      userId: OP, payBasis: 'day', dayRate: 200, updatedAt: serverTimestamp(), updatedBy: parts.mirror, updatedFrom: 'web',
    })
  }
  return batch.commit()
}

for (const who of [OPM, ADMIN]) {
  const label = who === OPM ? 'an Operatives manager' : 'an admin'
  test(`${label}: the profile save batch for a phone change answers (allowed, never a hang)`, async () => {
    assert.equal(await as(who, (db) => phoneSaveBatch(db, { user: true })), 'allowed')
    assert.equal(await as(who, (db) => phoneSaveBatch(db, { claim: true })), 'allowed')
    assert.equal(await as(who, (db) => phoneSaveBatch(db, { row: true })), 'allowed')
    assert.equal(await as(who, (db) => phoneSaveBatch(db, { user: true, claim: true, row: true, mirror: who })), 'allowed')
  })
}

test('an Operatives manager: background writes after a save answer (row sync, active flag)', async () => {
  assert.equal(
    await as(OPM, (db) =>
      updateDoc(doc(db, 'organizations', ORG, 'operatives', ROW), { isActive: true, updatedAt: serverTimestamp(), updatedBy: OPM, updatedFrom: 'web' })
    ),
    'allowed'
  )
  assert.equal(
    await as(OPM, (db) => {
      const batch = writeBatch(db)
      batch.update(doc(db, 'users', OP), { isActive: true, updatedAt: Timestamp.now() })
      return batch.commit()
    }),
    'allowed'
  )
})

test('an Operatives manager: a phone update answers on every stored operative shape (isSuperAdmin false, no email, ghost)', async () => {
  for (const id of ['v-sa-false', 'v-no-email', 'v-ghost', 'v-full']) {
    assert.equal(await as(OPM, (db) => updateDoc(doc(db, 'users', id), { mobileNumber: '0770', updatedAt: serverTimestamp() })), 'allowed', id)
  }
})
