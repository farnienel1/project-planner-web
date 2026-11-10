/**
 * Tests for the read-only job collection report (`scripts/report-job-collection-mismatch/plan.mjs`) against the
 * packed rulebook.
 *
 *   node --test scripts/report-job-collection-mismatch/plan.test.mjs
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import { loadRulebook } from '../data-cleanup/checks.mjs'
import { RULEBOOK_FUNCTIONS, csvHeader, csvLines, formatReport, planOrg, typeSaysSmallWorks } from './plan.mjs'

const rulebook = loadRulebook()

const job = (id, data = {}) => ({ id, data: { jobNumber: `J-${id}`, siteName: `Site ${id}`, ...data } })

test('the packed rulebook has every function the plan calls', () => {
  for (const name of RULEBOOK_FUNCTIONS) assert.equal(typeof rulebook[name], 'function', name)
})

test('typeSaysSmallWorks follows the rulebook job-type test', () => {
  assert.equal(typeSaysSmallWorks(rulebook, 'Small Works'), true)
  assert.equal(typeSaysSmallWorks(rulebook, 'small_works'), true)
  assert.equal(typeSaysSmallWorks(rulebook, 'CAT A'), false)
  assert.equal(typeSaysSmallWorks(rulebook, ''), false)
  assert.equal(typeSaysSmallWorks(rulebook, null), false)
})

test('clean data: nothing reported, counts per collection', () => {
  const plan = planOrg(
    {
      projects: [job('P1', { jobType: 'CAT A' }), job('P2', { jobType: 'CAT B' })],
      smallWorks: [job('S1', { jobType: 'Small Works' })],
    },
    rulebook
  )
  assert.equal(plan.counts.projects, 2)
  assert.equal(plan.counts.smallWorks, 1)
  assert.deepEqual(plan.typedSmallWorksInProjects, [])
  assert.deepEqual(plan.inBoth, [])
  assert.deepEqual(plan.sharedJobNumbers, [])
  assert.deepEqual(plan.otherTypeInSmallWorks, [])
})

test('(a) projects documents typed Small Works, by jobType or customJobType', () => {
  const plan = planOrg(
    {
      projects: [job('P1', { jobType: 'CAT A' }), job('X1', { jobType: 'Small Works' }), job('X2', { jobType: 'CAT A', customJobType: 'Small Works' })],
      smallWorks: [],
    },
    rulebook
  )
  assert.deepEqual(plan.typedSmallWorksInProjects.map((row) => row.id), ['X1', 'X2'])
  assert.equal(plan.typedSmallWorksInProjects[0].collection, 'projects')
})

test('(b) ids in both collections, without case, with both rows', () => {
  const plan = planOrg(
    {
      projects: [job('AB-1', { jobType: 'CAT A', updatedFrom: 'ios', updatedAt: { seconds: 1700000000, nanoseconds: 0 } })],
      smallWorks: [job('ab-1', { jobType: 'Small Works', updatedFrom: 'web' })],
    },
    rulebook
  )
  assert.equal(plan.inBoth.length, 1)
  assert.equal(plan.inBoth[0].id, 'AB-1')
  assert.equal(plan.inBoth[0].project.updatedFrom, 'ios')
  assert.equal(plan.inBoth[0].project.updatedAt, '2023-11-14T22:13:20.000Z')
  assert.equal(plan.inBoth[0].smallWorks.id, 'ab-1')
  // A pair is reported once, not also as a shared job number.
  assert.deepEqual(plan.sharedJobNumbers, [])
})

test('(d) one job number in both collections under different ids', () => {
  const plan = planOrg(
    {
      projects: [job('P1', { jobNumber: 'SW-100', jobType: 'CAT A' })],
      smallWorks: [job('S1', { jobNumber: ' sw-100 ', jobType: 'Small Works' })],
    },
    rulebook
  )
  assert.equal(plan.sharedJobNumbers.length, 1)
  assert.deepEqual(plan.sharedJobNumbers[0].projects.map((r) => r.id), ['P1'])
  assert.deepEqual(plan.sharedJobNumbers[0].smallWorks.map((r) => r.id), ['S1'])
})

test('smallWorks documents typed something else are listed for information; placeholders are counted apart', () => {
  const plan = planOrg(
    {
      projects: [{ id: 'initial-placeholder', data: {} }],
      smallWorks: [job('S1', { jobType: 'CAT A' }), job('S2', {})],
    },
    rulebook
  )
  assert.equal(plan.counts.projects, 0)
  assert.equal(plan.counts.projectsPlaceholders, 1)
  assert.deepEqual(plan.otherTypeInSmallWorks.map((r) => r.id), ['S1'])
})

test('report text and CSV', () => {
  const plan = planOrg(
    {
      projects: [job('X1', { jobType: 'Small Works', siteName: 'Flat 2, "Rear"' }), job('AB')],
      smallWorks: [job('AB', { jobType: 'Small Works' })],
    },
    rulebook
  )
  const text = formatReport('org1', 'Acme', plan)
  assert.match(text, /Organisation org1 \(Acme\)/)
  assert.match(text, /\(c\) Documents: projects 2, smallWorks 1/)
  assert.match(text, /\(a\) .*: 1/)
  assert.match(text, /\(b\) .*: 1/)
  const lines = csvLines('org1', plan)
  assert.equal(csvHeader().split(',')[0], 'orgId')
  assert.equal(lines.length, 3)
  assert.ok(lines[0].startsWith('org1,a_projects_typed_small_works,projects,X1,'))
  assert.ok(lines[0].includes('"Flat 2, ""Rear"""'))
})
