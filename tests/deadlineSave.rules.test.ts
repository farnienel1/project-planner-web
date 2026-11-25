/**
 * Owner report 25 Nov: a deadline with an attached file must save like one without (the settings document
 * `deadlines_{projects|smallWorks}_{KEY}`, any member of the organisation).
 *
 *   firebase emulators:exec --only firestore --project demo-project-planner-rules "tsx --test tests/deadlineSave.rules.test.ts"
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore'
import { claimsContext } from './authClaimsContext.ts'
import { serializeDeadline } from '../lib/deadlines/codec.ts'
import { applyCreatedHistory, withFileAttached } from '../lib/deadlines/logic.ts'
import type { Deadline } from '../lib/deadlines/types.ts'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const rules = readFileSync(path.join(root, 'firestore.rules'), 'utf8')
const ORG = 'DL-ORG-1'
const MGR = 'dl-manager'
const OP = 'dl-operative'
const JOB = 'DL-JOB-1'
const EMAILS: Record<string, string> = { [MGR]: 'dl-mgr@test.com', [OP]: 'dl-op@test.com' }
let env: RulesTestEnvironment

function draft(id: string): Deadline {
  const due = new Date('2026-12-01T00:00:00Z')
  return applyCreatedHistory(
    {
      id, title: 'First fix', location: null, trade: 'General', detail: null, start: null, due, completedAt: null,
      assignees: [], assigneeUserIds: [], company: null, status: 'notStarted', progress: 0, isCritical: false,
      dependsOn: [], blockedReason: null, reminderDaysBefore: 2, originalDue: null, history: [], contextKind: 'Project',
      projectId: JOB, createdByUserId: MGR, fileURL: null, fileName: 'plan.pdf', siteAuditId: null, siteAuditTitle: null,
    },
    'Mgr',
    new Date()
  )
}

test.before(async () => {
  env = await initializeTestEnvironment({
    projectId: `demo-deadline-save-${Date.now()}`,
    firestore: { rules, host: '127.0.0.1', port: Number(process.env.RULES_PORT ?? 8080) },
  })
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    await setDoc(doc(db, 'organizations', ORG), {
      name: 'Deadlines', creatorUserId: MGR, members: { [MGR]: 'manager', [OP]: 'operative' },
      billing: { status: 'active', accessOpen: true },
    })
    const base = { isActive: true, passwordSet: true, organizationId: ORG }
    await setDoc(doc(db, 'users', MGR), { ...base, email: EMAILS[MGR], role: 'manager', manager: true })
    await setDoc(doc(db, 'users', OP), { ...base, email: EMAILS[OP], role: 'operative', operativeMode: true })
  })
})

test.after(async () => {
  await env.cleanup()
})

for (const uid of [MGR, OP]) {
  test(`a deadline with an attached file saves like one without (${uid})`, async () => {
    const db = (await claimsContext(env, uid, { email: EMAILS[uid], email_verified: true })).firestore()
    const ref = doc(db, 'organizations', ORG, 'settings', `deadlines_projects_${JOB}-${uid}`)
    const plain = draft(`plain-${uid}`)
    await setDoc(ref, { items: [serializeDeadline(plain)], updatedAt: Timestamp.now(), projectId: JOB }, { merge: true })
    const withFile = withFileAttached(
      draft(`file-${uid}`),
      'plan.pdf',
      `https://firebasestorage.googleapis.com/v0/b/demo/o/organizations%2F${ORG}%2FhealthSafety%2F${JOB}%2Fdeadlines%2Fx.pdf?alt=media&token=abc`,
      'Mgr',
      new Date()
    )
    await setDoc(
      ref,
      { items: [serializeDeadline(withFile), serializeDeadline(plain)], updatedAt: Timestamp.now(), projectId: JOB },
      { merge: true }
    )
    const snap = await getDoc(ref)
    assert.equal((snap.data()?.items as unknown[]).length, 2)
  })
}
