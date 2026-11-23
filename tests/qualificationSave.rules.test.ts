/**
 * Owner issue 16 (23 Nov): renewing a qualification certificate left Save on "Saving…". The web save writes the
 * operatives row with `setDoc(..., { merge: true })` twice (assignment, then the new certificate URL). Every write is
 * raced against a timeout (as `profileSave.rules.test.ts`): a write the rules engine crashes on never settles and
 * fails here as `hang` instead of hanging the screen.
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
import { doc, setDoc, Timestamp } from 'firebase/firestore'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const rules = readFileSync(path.join(root, 'firestore.rules'), 'utf8')

const ORG = 'QS-ORG-1'
const SA = 'qs-super-admin'
const ADMIN = 'qs-admin'
const OPM = 'qs-ops-manager'
const OP = 'qs-operative'
const MGR = 'qs-manager'
const ROW = 'qs-operative-row'
const MGR_ROW = 'qs-manager-row'
const QUAL = 'A1B2C3D4-0000-4000-8000-000000000001'
const WAIT_MS = 8000
const EMAILS: Record<string, string> = {
  [SA]: 'qs-sa@test.com',
  [ADMIN]: 'qs-admin@test.com',
  [OPM]: 'qs-opm@test.com',
  [OP]: 'qs-op@test.com',
  [MGR]: 'qs-mgr@test.com',
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

/** The payload `patchOperativeQualifications` writes for an existing row (serializeOperative, qualification keys only). */
function qualificationWrite(url: string) {
  const now = Timestamp.now()
  return {
    qualifications: [{ id: QUAL, name: 'CSCS', hasEndDate: true, createdAt: now, updatedAt: now }],
    qualificationExpiryDates: { [QUAL]: Timestamp.fromDate(new Date('2027-05-01T00:00:00Z')) },
    qualificationCertificateURLs: { [QUAL]: url },
    updatedAt: now,
  }
}

async function renew(uid: string, row: string): Promise<Outcome[]> {
  const db: Db = await dbAs(uid)
  const ref = doc(db, 'organizations', ORG, 'operatives', row)
  // Save 1: the assignment (old certificate URL still on the draft). Save 2: the new certificate URL.
  return [
    await outcome(setDoc(ref, qualificationWrite('https://example.test/old.pdf'), { merge: true })),
    await outcome(setDoc(ref, qualificationWrite('https://example.test/new.pdf'), { merge: true })),
  ]
}

test.before(async () => {
  env = await initializeTestEnvironment({
    projectId: `demo-qual-save-${Date.now()}`,
    firestore: { rules, host: '127.0.0.1', port: Number(process.env.RULES_PORT ?? 8080) },
  })
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    await setDoc(doc(db, 'organizations', ORG), {
      name: 'Qualification save',
      creatorUserId: SA,
      members: { [SA]: 'admin', [ADMIN]: 'admin', [OPM]: 'manager', [OP]: 'operative', [MGR]: 'manager' },
      billing: { status: 'active', accessOpen: true },
    })
    const base = { isActive: true, passwordSet: true, organizationId: ORG }
    await setDoc(doc(db, 'users', SA), { ...base, email: EMAILS[SA], role: 'admin', isSuperAdmin: true, adminAccess: true })
    await setDoc(doc(db, 'users', ADMIN), { ...base, email: EMAILS[ADMIN], role: 'admin', adminAccess: true, assignedManagerUserIds: [SA] })
    await setDoc(doc(db, 'users', OPM), {
      ...base, email: EMAILS[OPM], role: 'manager', manager: true, operatives: true, assignedManagerUserIds: [ADMIN],
      permissions: { manager: true, operatives: true },
    })
    await setDoc(doc(db, 'users', MGR), {
      ...base, email: EMAILS[MGR], role: 'manager', manager: true, assignedManagerUserIds: [ADMIN], permissions: { manager: true },
    })
    await setDoc(doc(db, 'users', OP), {
      ...base, email: EMAILS[OP], role: 'operative', operativeMode: true, firstName: 'Op', surname: 'One',
      assignedManagerUserIds: [OPM], employmentType: 'self_employed', payBasis: 'day', dayRate: 200,
      permissions: { operativeMode: true },
    })
    const stored = {
      ...qualificationWrite('https://example.test/old.pdf'),
      firstName: 'Op', lastName: 'One', email: EMAILS[OP], linkedUserId: OP, isActive: true, organizationId: ORG,
    }
    await setDoc(doc(db, 'organizations', ORG, 'operatives', ROW), stored)
    await setDoc(doc(db, 'organizations', ORG, 'operatives', MGR_ROW), { ...stored, email: EMAILS[MGR], linkedUserId: MGR })
  })
})

test.after(async () => {
  await env.cleanup()
})

for (const who of [SA, ADMIN, OPM]) {
  test(`${who}: renewing a certificate on an operative's row answers (allowed, never a hang)`, async () => {
    assert.deepEqual(await renew(who, ROW), ['allowed', 'allowed'])
  })
}

test('an operative: renewing their own certificate answers (allowed, never a hang)', async () => {
  assert.deepEqual(await renew(OP, ROW), ['allowed', 'allowed'])
})

test('a manager: renewing their own certificate on their own row answers (allowed, never a hang)', async () => {
  assert.deepEqual(await renew(MGR, MGR_ROW), ['allowed', 'allowed'])
})
