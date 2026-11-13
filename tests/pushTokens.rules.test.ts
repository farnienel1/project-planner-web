/**
 * Rulebook §1 / §13: a device push token belongs to the signed-in account, and this device writes it to its own
 * `users/{uid}` document (`pushTokens` + `pushTokenUpdatedAt`) — the one field a device owns. This suite proves the
 * security rules allow exactly that write for every level (operative, manager, admin, Super Admin) in the shapes both
 * apps send, and refuse it on someone else's document or when other protected fields ride along.
 *
 *   npm run test:rules
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { arrayRemove, arrayUnion, doc, serverTimestamp, setDoc, Timestamp, updateDoc } from 'firebase/firestore'
import { claimsContext } from './authClaimsContext.ts'
import { isExpressionLimitDenial } from './rulesAssert.ts'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const rules = readFileSync(path.join(root, 'firestore.rules'), 'utf8')

const ORG = 'PT-ORG-1'
const SA = 'pt-super-admin'
const ADMIN = 'pt-admin'
const MGR = 'pt-manager'
const OP = 'pt-operative'

const EMAILS: Record<string, string> = {
  [SA]: 'pt-sa@test.com',
  [ADMIN]: 'pt-admin@test.com',
  [MGR]: 'pt-mgr@test.com',
  [OP]: 'pt-op@test.com',
}

let env: RulesTestEnvironment

type Db = ReturnType<Awaited<ReturnType<typeof claimsContext>>['firestore']>

async function dbAs(uid: string): Promise<Db> {
  return (await claimsContext(env, uid, { email: EMAILS[uid], email_verified: true })).firestore()
}

async function allowed(uid: string, write: (db: Db) => Promise<unknown>, message: string) {
  try {
    await write(await dbAs(uid))
  } catch (error) {
    assert.fail(`${message}: refused (${(error as { code?: string })?.code ?? String(error)})`)
  }
}

async function refused(uid: string, write: (db: Db) => Promise<unknown>, message: string) {
  try {
    await write(await dbAs(uid))
  } catch (error) {
    if (process.env.RULES_STRICT_BUDGET === '1' && isExpressionLimitDenial(error)) {
      assert.fail(`${message}: refused by the expression limit, not the rule logic`)
    }
    assert.equal((error as { code?: string })?.code, 'permission-denied', message)
    return
  }
  assert.fail(`${message}: was allowed`)
}

test.before(async () => {
  env = await initializeTestEnvironment({
    projectId: `demo-push-tokens-${Date.now()}`,
    firestore: { rules, host: '127.0.0.1', port: Number(process.env.RULES_PORT ?? 8080) },
  })
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    await setDoc(doc(db, 'organizations', ORG), {
      name: 'Push tokens',
      creatorUserId: SA,
      members: { [SA]: 'admin', [ADMIN]: 'admin', [MGR]: 'manager', [OP]: 'operative' },
      billing: { status: 'active', accessOpen: true },
    })
    const base = { isActive: true, passwordSet: true, organizationId: ORG }
    await setDoc(doc(db, 'users', SA), { ...base, email: EMAILS[SA], role: 'admin', isSuperAdmin: true, adminAccess: true })
    await setDoc(doc(db, 'users', ADMIN), {
      ...base, email: EMAILS[ADMIN], role: 'admin', adminAccess: true, assignedManagerUserIds: [SA], pushTokens: ['admin-old-token'],
    })
    await setDoc(doc(db, 'users', MGR), {
      ...base, email: EMAILS[MGR], role: 'manager', manager: true, assignedManagerUserIds: [ADMIN],
      employmentType: 'self_employed', payBasis: 'day', dayRate: 200,
    })
    await setDoc(doc(db, 'users', OP), {
      ...base, email: EMAILS[OP], role: 'operative', operativeMode: true, assignedManagerUserIds: [MGR],
      employmentType: 'self_employed', payBasis: 'day', dayRate: 150, pushTokens: ['op-old-token'],
    })
  })
})

test.after(async () => {
  await env.cleanup()
})

test('every level saves its own token with the iOS shape (merge-set of pushTokens + pushTokenUpdatedAt)', async () => {
  for (const uid of [OP, MGR, ADMIN, SA]) {
    await allowed(
      uid,
      (db) =>
        setDoc(
          doc(db, 'users', uid),
          { pushTokens: [`${uid}-old-token`, `${uid}-device-token`], pushTokenUpdatedAt: Timestamp.now() },
          { merge: true }
        ),
      `${uid} merge-sets its own pushTokens`
    )
  }
})

test('own token as arrayUnion / arrayRemove with a server timestamp, and an empty list', async () => {
  await allowed(
    OP,
    (db) => updateDoc(doc(db, 'users', OP), { pushTokens: arrayUnion('op-new-token'), pushTokenUpdatedAt: serverTimestamp() }),
    'operative adds a token with arrayUnion'
  )
  await allowed(OP, (db) => updateDoc(doc(db, 'users', OP), { pushTokens: arrayRemove('op-new-token') }), 'operative removes its token on sign-out')
  await allowed(
    MGR,
    (db) => updateDoc(doc(db, 'users', MGR), { pushTokens: [], pushTokenUpdatedAt: serverTimestamp() }),
    'manager clears its own list'
  )
})

test('a token is never written to someone else\'s users document', async () => {
  await refused(
    OP,
    (db) => setDoc(doc(db, 'users', MGR), { pushTokens: ['op-device-token'], pushTokenUpdatedAt: Timestamp.now() }, { merge: true }),
    'operative writes a token on its line manager'
  )
  await refused(
    MGR,
    (db) => updateDoc(doc(db, 'users', OP), { pushTokens: arrayUnion('mgr-device-token') }),
    'manager writes a token on an operative'
  )
})

test('the token write never carries a pay change along with it', async () => {
  await refused(
    OP,
    (db) =>
      setDoc(
        doc(db, 'users', OP),
        { pushTokens: ['op-device-token'], pushTokenUpdatedAt: Timestamp.now(), dayRate: 999 },
        { merge: true }
      ),
    'operative raises its own day rate beside the token'
  )
})
