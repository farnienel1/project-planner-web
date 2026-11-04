/**
 * Tests for the blank "Assigned manager" clean-up (`scripts/cleanup-blank-managers/plan.mjs`) against the packed
 * rulebook: which rows are junk, which are only listed, the job updates, and idempotence.
 *
 *   node --test scripts/cleanup-blank-managers/plan.test.mjs
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import { loadRulebook } from '../data-cleanup/checks.mjs'
import { RULEBOOK_FUNCTIONS, applyPatch, classifyManagerRows, formatReport, planOrg, plannedPaths } from './plan.mjs'

const rulebook = loadRulebook()

const JUNK = '0F8FAD5B-D9CB-469F-A165-70867728950E'
const REAL_ROW = '7C9E6679-7425-40DE-944B-E07FC1F90AE7'

/** A managers row as iOS before #185 wrote it (`managerDocumentPayload` + write metadata). */
const junkRow = (id = JUNK, extra = {}) => ({
  id,
  data: {
    firstName: 'Assigned',
    lastName: 'manager',
    email: '',
    mobileNumber: '',
    department: '',
    isActive: true,
    notes: '',
    tradeTypePreset: '',
    tradeTypeCustom: '',
    organizationId: 'org1',
    updatedFrom: 'ios',
    ...extra,
  },
})

const realRow = { id: REAL_ROW, data: { firstName: 'Mo', lastName: 'Manager', email: 'mo@example.com' } }
const users = [{ id: 'uid-mo', data: { firstName: 'Mo', surname: 'Manager', email: 'mo@example.com' } }]

const job = (id, fields, extra = {}) => ({ id, data: { jobNumber: `J-${id}`, siteName: `Site ${id}`, ...fields, ...extra } })

test('the packed rulebook has every function the clean-up reads', () => {
  for (const name of RULEBOOK_FUNCTIONS) assert.equal(typeof rulebook[name], 'function', name)
})

test('a blank-email "Assigned manager" row with nothing else is junk; others are only listed', () => {
  const { junk, ambiguous } = classifyManagerRows(rulebook, {
    managers: [
      junkRow(),
      { id: 'no-email-field', data: { firstName: 'Assigned', lastName: 'manager' } },
      junkRow('named', { firstName: 'Jo', lastName: 'Bloggs' }),
      junkRow('linked', { linkedUserId: 'uid-x' }),
      junkRow('phone', { mobileNumber: '07700 900000' }),
      junkRow('paid', { dayRate: 200 }),
      junkRow('uid-mo'),
      junkRow('site'),
      { id: 'empty', data: { email: '  ' } },
      realRow,
    ],
    users,
    siteBookingUserIds: ['SITE'],
  })
  assert.deepEqual(junk.map((row) => row.id).sort(), [JUNK, 'no-email-field'].sort())
  const why = Object.fromEntries(ambiguous.map((row) => [row.id, row.why.join(' | ')]))
  assert.deepEqual(Object.keys(why).sort(), ['empty', 'linked', 'named', 'paid', 'phone', 'site', 'uid-mo'])
  assert.match(why.named, /not "Assigned manager"/)
  assert.match(why.linked, /linked account/)
  assert.match(why.phone, /mobileNumber/)
  assert.match(why.paid, /dayRate/)
  assert.match(why['uid-mo'], /users account/)
  assert.match(why.site, /manager site booking/)
  assert.match(why.empty, /not "Assigned manager"/)
})

test('a junk id that is a former or same-email id of an account is only listed', () => {
  const { junk, ambiguous } = classifyManagerRows(rulebook, {
    managers: [junkRow()],
    users: [{ id: 'uid-a', data: { formerUserIds: [JUNK.toLowerCase()] } }],
  })
  assert.equal(junk.length, 0)
  assert.equal(ambiguous.length, 1)
})

test('the jobs lose only the junk id; managerId moves on or goes; empty lists go', () => {
  const input = {
    orgId: 'org1',
    managers: [junkRow(), realRow],
    users,
    siteBookingUserIds: [],
    jobs: {
      projects: [
        job('p1', { managerIds: [JUNK, REAL_ROW], managerId: JUNK, managerUserIds: ['uid-mo'] }),
        job('p2', { managerIds: [JUNK.toLowerCase()], managerId: JUNK }),
        job('p3', { managerIds: [REAL_ROW], managerId: REAL_ROW }),
      ],
      smallWorks: [job('s1', { managerId: JUNK, assignedManagerUserIds: [JUNK, 'user:uid-mo'] })],
    },
  }
  const plan = planOrg(rulebook, input)
  assert.deepEqual(plan.deletes, [{ path: `organizations/org1/managers/${JUNK}`, id: JUNK }])
  const byId = Object.fromEntries(plan.updates.map((row) => [row.jobId, row]))
  assert.deepEqual(Object.keys(byId).sort(), ['p1', 'p2', 's1'])
  assert.deepEqual(byId.p1.set, { managerIds: [REAL_ROW], managerId: REAL_ROW })
  assert.deepEqual(byId.p1.remove, [])
  assert.deepEqual(byId.p2.set, {})
  assert.deepEqual(byId.p2.remove.sort(), ['managerId', 'managerIds'])
  assert.deepEqual(byId.s1.set.assignedManagerUserIds, ['user:uid-mo'])
  assert.equal(byId.p1.jobNumber, 'J-p1')
  assert.match(byId.p1.otherManagers.join(','), /Mo Manager/)
  assert.deepEqual(plan.leftWithoutManager.map((row) => row.jobId), ['p2'])
  assert.equal(plan.junk[0].jobs.length, 3)
  assert.deepEqual(plannedPaths(plan).length, 4)

  // Idempotent: after the writes (jobs patched, row deleted) the same run plans nothing.
  const patched = (list, collection) =>
    list.map((row) => {
      const update = plan.updates.find((u) => u.path === `organizations/org1/${collection}/${row.id}`)
      return update ? { id: row.id, data: applyPatch(row.data, update) } : row
    })
  const again = planOrg(rulebook, {
    ...input,
    managers: [realRow],
    jobs: { projects: patched(input.jobs.projects, 'projects'), smallWorks: patched(input.jobs.smallWorks, 'smallWorks') },
  })
  assert.equal(again.updates.length + again.deletes.length + again.ambiguous.length, 0)

  // A run that updated the jobs but not the row: only the row delete is left.
  const half = planOrg(rulebook, { ...input, jobs: { projects: patched(input.jobs.projects, 'projects'), smallWorks: patched(input.jobs.smallWorks, 'smallWorks') } })
  assert.equal(half.updates.length, 0)
  assert.equal(half.deletes.length, 1)
})

test('an ambiguous row never touches a job', () => {
  const plan = planOrg(rulebook, {
    orgId: 'org1',
    managers: [junkRow(JUNK, { notes: 'typed by someone' })],
    users: [],
    jobs: { projects: [job('p1', { managerIds: [JUNK], managerId: JUNK })], smallWorks: [] },
  })
  assert.equal(plan.updates.length, 0)
  assert.equal(plan.deletes.length, 0)
  assert.equal(plan.ambiguous.length, 1)
})

test('the dry-run report names rows, jobs, the jobs left without a manager and says nothing was written', () => {
  const plan = planOrg(rulebook, {
    orgId: 'org1',
    managers: [junkRow()],
    users: [],
    jobs: { projects: [job('p1', { managerIds: [JUNK], managerId: JUNK })], smallWorks: [] },
  })
  const text = formatReport([{ orgId: 'org1', orgName: 'Acme', plan }], { apply: false, projectId: 'demo', rulebookVersion: 'x' })
  assert.match(text, /DRY RUN/)
  assert.match(text, new RegExp(`would delete managers/${JUNK}`))
  assert.match(text, /J-p1/)
  assert.match(text, /Jobs left with no manager/)
  assert.match(text, /Nothing was written/)
})
