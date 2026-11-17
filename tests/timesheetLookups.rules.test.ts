/**
 * `w-timesheet-lookups` (guardrail 1): which of the per-person timesheet queries the live rules answer. Both apps now
 * read a person's sheets under every id they go by — `userId ==` the own id, `userId in` the other ids (a former invite
 * id, a second users document on the same email) and a document-id prefix `timesheet_{id}_` for sheets stored without
 * `userId`. No rules change: this suite records what is allowed today.
 *
 *   - admins and managers (privatePay off): every one of those queries;
 *   - an operative: only `userId ==` their own uid. Their former-id and no-userId queries are REFUSED (known limit —
 *     the read rule's own-query clause tests `resource.data.userId == request.auth.uid` only). The apps skip a refused
 *     query and keep the own sheets, so nothing an operative saw before disappears; the extra sheets come back into
 *     view for them only after a rules change (proposed in the PR, not made here).
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
import { collection, documentId, getDocs, query, setDoc, doc, Timestamp, where } from 'firebase/firestore'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const rules = readFileSync(path.join(root, 'firestore.rules'), 'utf8')

const ORG = 'org-tsl'
const ADMIN = 'tsl-admin'
const LM = 'tsl-lm'
const OP = 'tsl-op'
const OP_INVITE = 'TSL-OP-INVITE'

let env: RulesTestEnvironment

async function db(uid: string) {
  return (await claimsContext(env, uid, { email: `${uid}@test.com` })).firestore()
}

function sheet(uid: string | null, weekStartKey: string) {
  return {
    ...(uid ? { userId: uid } : {}),
    weekStartKey,
    weekStart: Timestamp.fromMillis(Date.parse(`${weekStartKey}T00:00:00Z`)),
  }
}

test.before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-timesheet-lookups',
    firestore: { rules, host: '127.0.0.1', port: Number(process.env.FIRESTORE_EMULATOR_PORT || 8080) },
  })
  await env.withSecurityRulesDisabled(async (ctx) => {
    const fs = ctx.firestore()
    await setDoc(doc(fs, 'organizations', ORG), {
      name: 'Lookups Ltd',
      creatorUserId: ADMIN,
      members: { [ADMIN]: 'admin', [LM]: 'manager', [OP]: 'operative' },
    })
    await setDoc(doc(fs, 'users', ADMIN), { email: `${ADMIN}@test.com`, organizationId: ORG, role: 'admin', adminAccess: true, isSuperAdmin: true, passwordSet: true })
    await setDoc(doc(fs, 'users', LM), { email: `${LM}@test.com`, organizationId: ORG, role: 'manager', manager: true, permissions: { manager: true, operativeMode: false }, passwordSet: true })
    await setDoc(doc(fs, 'users', OP), {
      email: `${OP}@test.com`,
      organizationId: ORG,
      role: 'operative',
      operativeMode: true,
      permissions: { operativeMode: true },
      assignedManagerUserIds: [LM],
      assignedManagerUserId: LM,
      formerUserIds: [OP_INVITE],
      employmentType: 'self_employed',
      passwordSet: true,
    })
    const settings = (id: string) => doc(fs, 'organizations', ORG, 'settings', id)
    await setDoc(settings(`timesheet_${OP}_1761955200`), sheet(OP, '2026-11-01'))
    await setDoc(settings(`timesheet_${OP_INVITE}_1759276800`), sheet(OP_INVITE, '2026-10-01'))
    await setDoc(settings(`timesheet_${OP}_1756684800`), sheet(null, '2026-09-01'))
  })
})

test.after(async () => {
  await env?.cleanup()
})

function prefixQuery(fs: Awaited<ReturnType<typeof db>>, id: string) {
  const settings = collection(fs, 'organizations', ORG, 'settings')
  const prefix = `timesheet_${id}_`
  return query(settings, where(documentId(), '>=', prefix), where(documentId(), '<', `${prefix}`))
}

test('admins and line managers run every per-person timesheet query', async () => {
  for (const uid of [ADMIN, LM]) {
    const fs = await db(uid)
    const settings = collection(fs, 'organizations', ORG, 'settings')
    await assertSucceeds(getDocs(query(settings, where('userId', '==', OP))))
    const alias = (await assertSucceeds(getDocs(query(settings, where('userId', 'in', [OP_INVITE]))))) as Awaited<ReturnType<typeof getDocs>>
    if (alias.size !== 1) throw new Error(`${uid}: expected the former-id sheet, got ${alias.size}`)
    const byPrefix = (await assertSucceeds(getDocs(prefixQuery(fs, OP)))) as Awaited<ReturnType<typeof getDocs>>
    if (!byPrefix.docs.some((entry) => entry.id === `timesheet_${OP}_1756684800`)) throw new Error(`${uid}: no-userId sheet missing`)
  }
})

test('an operative: own userId query allowed; former-id and document-id queries refused (known limit)', async () => {
  const fs = await db(OP)
  const settings = collection(fs, 'organizations', ORG, 'settings')
  await assertSucceeds(getDocs(query(settings, where('userId', '==', OP))))
  await assertFails(getDocs(query(settings, where('userId', 'in', [OP_INVITE]))))
  await assertFails(getDocs(query(settings, where('userId', '==', OP_INVITE))))
  await assertFails(getDocs(prefixQuery(fs, OP)))
})

test('privatePay on: admins every query; a line manager only their report\'s current id; the company-wide read refused to them', async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'platformConfig', 'app'), { privatePay: true }, { merge: true })
  })
  try {
    const admin = await db(ADMIN)
    const adminSettings = collection(admin, 'organizations', ORG, 'settings')
    await assertSucceeds(getDocs(query(adminSettings, where('userId', 'in', [OP_INVITE]))))
    await assertSucceeds(getDocs(prefixQuery(admin, OP)))
    await assertSucceeds(getDocs(query(adminSettings, where('exportedAt', '!=', null))))

    // The line manager falls back to person-by-person reads (the company-wide read is refused) and gets the report's
    // sheets under their current id; the former-id and document-id queries are refused and skipped by the apps.
    const lm = await db(LM)
    const lmSettings = collection(lm, 'organizations', ORG, 'settings')
    await assertFails(getDocs(query(lmSettings, where('exportedAt', '!=', null))))
    await assertSucceeds(getDocs(query(lmSettings, where('userId', '==', OP))))
    await assertFails(getDocs(query(lmSettings, where('userId', 'in', [OP_INVITE]))))
    await assertFails(getDocs(prefixQuery(lm, OP)))

    const op = await db(OP)
    await assertSucceeds(getDocs(query(collection(op, 'organizations', ORG, 'settings'), where('userId', '==', OP))))
  } finally {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'platformConfig', 'app'), { privatePay: false }, { merge: true })
    })
  }
})
