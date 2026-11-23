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
import { deleteField, doc, FieldPath, setDoc, Timestamp, updateDoc } from 'firebase/firestore'
import type { Operative } from '../types'
import { serializeOperative } from '../lib/ios-parity/converters.ts'
import { operativeQualificationPatch } from '../lib/qualifications/qualificationPatch.ts'

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
const OTHER_ROW = 'qs-someone-else-row'
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

function operative(id: string, email: string, linkedUserId: string, urlKey: string, url: string, expiry: string): Operative {
  const at = new Date('2026-01-01T00:00:00Z')
  return {
    id,
    firstName: 'Op',
    lastName: 'One',
    email,
    linkedUserId,
    startDate: at,
    hourlyRate: 0,
    skills: [],
    qualifications: [{ id: urlKey, name: 'CSCS', hasEndDate: true, createdAt: at, updatedAt: at }],
    qualificationExpiryDates: { [urlKey]: new Date(expiry) },
    qualificationCertificateURLs: { [urlKey]: url },
    isActive: true,
    createdAt: at,
    updatedAt: at,
    organizationId: ORG,
  }
}

/** The stored row, in the real shape (`serializeOperative`), keyed by the iOS upper-case id. */
function storedRow(id: string, email: string, linkedUserId: string): Operative {
  return operative(id, email, linkedUserId, QUAL, 'https://example.test/old.pdf', '2026-05-01T00:00:00Z')
}

/**
 * Exactly what `patchOperativeQualifications` sends for a renewal of an existing row: `serializeOperative` for the
 * qualifications array and `updatedAt`, and `operativeQualificationPatch` field-path writes for the maps (the new
 * key set, the old spelling deleted).
 */
function renewalUpdate(db: Db, row: Operative) {
  const draft = operative(row.id, row.email, row.linkedUserId || '', QUAL.toLowerCase(), 'https://example.test/new.pdf', '2029-05-01T00:00:00Z')
  const patch = operativeQualificationPatch({ baseline: row, draft, live: row })
  const payload = serializeOperative({ ...row, ...draft, qualifications: patch.qualifications, updatedAt: new Date() }, { currencyCode: 'GBP' })
  const more: unknown[] = []
  for (const write of patch.mapWrites) {
    more.push(new FieldPath(write.field, write.key), 'delete' in write ? deleteField() : write.value instanceof Date ? Timestamp.fromDate(write.value) : write.value)
  }
  if (patch.qualificationsChanged) more.push('qualifications', payload.qualifications)
  more.push('updatedAt', payload.updatedAt)
  const [first, value, ...rest] = more as [FieldPath | string, unknown, ...unknown[]]
  return updateDoc(doc(db, 'organizations', ORG, 'operatives', row.id), first, value, ...rest)
}

async function renew(uid: string, row: Operative): Promise<Outcome> {
  return outcome(renewalUpdate(await dbAs(uid), row))
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
    for (const row of [storedRow(ROW, EMAILS[OP], OP), storedRow(MGR_ROW, EMAILS[MGR], MGR), storedRow(OTHER_ROW, 'someone@test.com', '')]) {
      await setDoc(doc(db, 'organizations', ORG, 'operatives', row.id), serializeOperative(row, { currencyCode: 'GBP' }))
    }
  })
})

test.after(async () => {
  await env.cleanup()
})

// Each renewal runs on a fresh copy of the row (the stored shape), so every case starts from the old certificate.
async function reset(row: Operative) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'organizations', ORG, 'operatives', row.id), serializeOperative(row, { currencyCode: 'GBP' }))
  })
}

for (const who of [SA, ADMIN, OPM]) {
  test(`${who}: renewing a certificate on an operative's row answers (allowed, never a hang)`, async () => {
    const row = storedRow(ROW, EMAILS[OP], OP)
    await reset(row)
    assert.equal(await renew(who, row), 'allowed')
  })
}

test('an operative: renewing their own certificate answers (allowed, never a hang)', async () => {
  const row = storedRow(ROW, EMAILS[OP], OP)
  await reset(row)
  assert.equal(await renew(OP, row), 'allowed')
})

test('a manager: renewing their own certificate on their own row answers (allowed, never a hang)', async () => {
  const row = storedRow(MGR_ROW, EMAILS[MGR], MGR)
  await reset(row)
  assert.equal(await renew(MGR, row), 'allowed')
})

test('an operative may not edit someone else\'s row', async () => {
  const row = storedRow(OTHER_ROW, 'someone@test.com', '')
  await reset(row)
  assert.equal(await renew(OP, row), 'denied')
})

test('an operative may not change a non-qualification key on their own row', async () => {
  const row = storedRow(ROW, EMAILS[OP], OP)
  await reset(row)
  const db = await dbAs(OP)
  assert.equal(await outcome(updateDoc(doc(db, 'organizations', ORG, 'operatives', ROW), { isActive: false })), 'denied')
  assert.equal(await outcome(updateDoc(doc(db, 'organizations', ORG, 'operatives', ROW), { notes: 'x', qualifications: [] })), 'denied')
})
