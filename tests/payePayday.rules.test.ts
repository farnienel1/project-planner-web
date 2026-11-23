/**
 * Rulebook 1.32.0 §4.5 (owner bug 23 Nov): "Payment runs and timesheets: you can't set a PAYE payday — it reverts to
 * Not set". The security rules are not the cause: an admin's Save of Payment runs and timesheets, with the PAYE
 * payday (`payePaydayWriteFields`) in the same partial update, is accepted — the web shape (dotted `invoicing.*`) and
 * the iOS first-save shape (a whole `invoicing` map when none is stored). A manager's is refused.
 *
 *   firebase emulators:exec --only firestore "tsx --test tests/payePayday.rules.test.ts"
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { assertFails } from './rulesAssert.ts'
import { claimsContext } from './authClaimsContext.ts'
import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore'
import { payePayday, payePaydayWriteFields } from '../lib/canonical/payePayrun.ts'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const rules = readFileSync(path.join(root, 'firestore.rules'), 'utf8')

const ORG = 'org-paye-payday'
const ORG_NEW = 'org-paye-payday-new'
const ADMIN = 'pp-admin'
const MANAGER = 'pp-manager'
const TODAY = '2026-11-23'

let env: RulesTestEnvironment

async function db(uid: string) {
  return (await claimsContext(env, uid, { email: `${uid}@test.com` })).firestore()
}

test.before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-paye-payday',
    firestore: { rules, host: '127.0.0.1', port: Number(process.env.FIRESTORE_EMULATOR_PORT || 8080) },
  })
  await env.withSecurityRulesDisabled(async (ctx) => {
    const fs = ctx.firestore()
    for (const org of [ORG, ORG_NEW]) {
      await setDoc(doc(fs, 'organizations', org), {
        name: 'Payday Ltd',
        creatorUserId: ADMIN,
        members: { [ADMIN]: 'admin', [MANAGER]: 'manager' },
        ...(org === ORG ? { invoicing: { paymentRunMode: 'date_ranges', paymentDates: [15, 31] } } : {}),
      })
    }
    await setDoc(doc(fs, 'users', ADMIN), { email: `${ADMIN}@test.com`, organizationId: ORG, role: 'admin', adminAccess: true, isSuperAdmin: true, passwordSet: true })
    await setDoc(doc(fs, 'users', MANAGER), { email: `${MANAGER}@test.com`, organizationId: ORG, role: 'manager', manager: true, passwordSet: true })
  })
})

test.after(async () => {
  await env.cleanup()
})

const meta = (uid: string) => ({ updatedAt: serverTimestamp(), updatedBy: uid, updatedFrom: 'web' })

test('web Save: dotted invoicing fields with the PAYE payday are accepted and read back as that payday', async () => {
  const fields = payePaydayWriteFields({ invoicing: { paymentRunMode: 'date_ranges' } }, 25, TODAY)!
  const ref = doc(await db(ADMIN), 'organizations', ORG)
  await assertSucceeds(updateDoc(ref, { 'invoicing.paymentRunMode': 'date_ranges', 'invoicing.noteToUsers': '', ...fields, ...meta(ADMIN) }))
  const stored = (await getDoc(ref)).data()
  if (payePayday(stored) !== 25) throw new Error(`stored payday read back as ${payePayday(stored)}`)
})

test('iOS first Save: a whole invoicing map holding the PAYE payday is accepted', async () => {
  const fields = payePaydayWriteFields({}, 16, TODAY)!
  const invoicing = {
    paymentRunMode: 'date_ranges',
    payePayday: fields['invoicing.payePayday'],
    payePaydayHistory: fields['invoicing.payePaydayHistory'],
  }
  const ref = doc(await db(ADMIN), 'organizations', ORG_NEW)
  await assertSucceeds(updateDoc(ref, { invoicing, ...meta(ADMIN), updatedFrom: 'ios' }))
  const stored = (await getDoc(ref)).data()
  if (payePayday(stored) !== 16) throw new Error(`stored payday read back as ${payePayday(stored)}`)
})

test('a manager cannot set the PAYE payday', async () => {
  const fields = payePaydayWriteFields({}, 10, TODAY)!
  await assertFails(updateDoc(doc(await db(MANAGER), 'organizations', ORG), { ...fields, ...meta(MANAGER) }))
})
