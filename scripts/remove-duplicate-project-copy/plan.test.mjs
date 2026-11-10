/**
 * Tests for the duplicate job copy clean-up (`scripts/remove-duplicate-project-copy/plan.mjs`) against the packed
 * rulebook.
 *
 *   node --test scripts/remove-duplicate-project-copy/plan.test.mjs
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import { loadRulebook } from '../data-cleanup/checks.mjs'
import {
  RULEBOOK_FUNCTIONS,
  collectionLabel,
  formatPlan,
  keepAndRemove,
  locateCopies,
  planReferences,
  planRemoval,
  settingsDocumentCollection,
  settingsDocumentIds,
} from './plan.mjs'

const rulebook = loadRulebook()
const ORG = '2C67391E-D1FE-4F9F-8055-7149ACDE1F96'
const JOB = '94472FA5-B93D-4EC5-B60E-F798AD5E490C'
const path = (collection, id) => `organizations/${ORG}/${collection}/${id}`
const job = (collection, id, data = {}) => ({ id, path: path(collection, id), data: { jobNumber: 'C716', siteName: 'Ludgate Hill', ...data } })

const both = (projectId = JOB, smallId = JOB) => ({
  projects: [job('projects', projectId, { jobType: 'Small Works' })],
  smallWorks: [job('smallWorks', smallId, { jobType: 'Small Works', updatedFrom: 'web' })],
})

test('the packed rulebook has every function the plan calls', () => {
  for (const name of RULEBOOK_FUNCTIONS) assert.equal(typeof rulebook[name], 'function', name)
})

test('keepAndRemove: default smallWorks, either way round, nothing else', () => {
  assert.deepEqual(keepAndRemove(undefined), { keep: 'smallWorks', remove: 'projects' })
  assert.deepEqual(keepAndRemove('projects'), { keep: 'projects', remove: 'smallWorks' })
  assert.equal(keepAndRemove('jobs'), null)
})

test('locateCopies: ready when the id is in both collections (keeps smallWorks by default)', () => {
  const copies = locateCopies(rulebook, { jobId: JOB, jobs: both() })
  assert.equal(copies.state, 'ready')
  assert.equal(copies.removed.path, path('projects', JOB))
  assert.equal(copies.kept.path, path('smallWorks', JOB))
})

test('locateCopies: ids compared without case; --keep projects removes the smallWorks copy', () => {
  const copies = locateCopies(rulebook, { jobId: JOB.toLowerCase(), keep: 'projects', jobs: both(JOB, JOB.toLowerCase()) })
  assert.equal(copies.state, 'ready')
  assert.equal(copies.removed.path, path('smallWorks', JOB.toLowerCase()))
  assert.equal(copies.kept.path, path('projects', JOB))
})

test('locateCopies: second run is already done; never deletes the only copy', () => {
  assert.equal(locateCopies(rulebook, { jobId: JOB, jobs: { projects: [], smallWorks: both().smallWorks } }).state, 'already-done')
  const only = locateCopies(rulebook, { jobId: JOB, jobs: { projects: both().projects, smallWorks: [] } })
  assert.equal(only.state, 'refused')
  assert.match(only.message, /would remove the job/)
  assert.equal(locateCopies(rulebook, { jobId: JOB, jobs: { projects: [], smallWorks: [] } }).state, 'refused')
})

test('locateCopies: refuses two case variants in one collection, a bad --keep and the placeholder id', () => {
  const jobs = both()
  jobs.projects.push(job('projects', JOB.toLowerCase()))
  assert.equal(locateCopies(rulebook, { jobId: JOB, jobs }).state, 'refused')
  assert.equal(locateCopies(rulebook, { jobId: JOB, keep: 'other', jobs: both() }).state, 'refused')
  assert.equal(locateCopies(rulebook, { jobId: '', jobs: both() }).state, 'refused')
})

test('settingsDocumentIds: both kinds of health & safety and deadlines, the variation log and deadlineAssignments', () => {
  const ids = settingsDocumentIds(rulebook, JOB.toLowerCase())
  assert.ok(ids.includes(`healthSafety_projects_${JOB}`))
  assert.ok(ids.includes(`healthSafety_projects_${JOB.toLowerCase()}`))
  assert.ok(ids.includes(`healthSafety_smallWorks_${JOB}`))
  assert.ok(ids.includes(`deadlines_projects_${JOB}`))
  assert.ok(ids.includes(`deadlines_smallWorks_${JOB}`))
  assert.ok(ids.includes(`variations_${JOB.toLowerCase()}`))
  assert.ok(ids.includes('deadlineAssignments'))
  assert.equal(settingsDocumentCollection(`deadlines_projects_${JOB}`), 'projects')
  assert.equal(settingsDocumentCollection(`healthSafety_smallWorks_${JOB}`), 'smallWorks')
  assert.equal(settingsDocumentCollection('deadlineAssignments'), null)
})

test('collectionLabel names every stored kind label', () => {
  assert.equal(collectionLabel({}), '(none)')
  assert.equal(collectionLabel({ jobCollection: 'smallWorks' }), 'jobCollection=smallWorks')
  assert.equal(collectionLabel({ locationType: 'small_work', parentType: 'smallWork' }), 'locationType=small_work parentType=smallWork')
})

const refsFixture = () => ({
  bookings: [
    { id: 'b1', data: { projectId: JOB.toLowerCase(), jobCollection: 'smallWorks' } },
    { id: 'b2', data: { projectId: JOB } },
    { id: 'b3', data: { projectId: 'OTHER', jobCollection: 'projects' } },
  ],
  managerSiteBookings: [
    { id: 'm1', data: { locationType: 'small_work', locationId: JOB, jobCollection: 'smallWorks' } },
    { id: 'm2', data: { locationType: 'office', locationId: JOB } },
  ],
  subcontractorBookings: [{ id: 's1', data: { projectId: JOB, jobCollection: 'smallWorks' } }],
  materials: [{ id: 'mat1', data: { projectId: JOB } }],
  materialSendRecords: [],
  tasks: [{ id: 't1', data: { projectId: JOB.toLowerCase() } }, { id: 't2', data: { projectId: 'OTHER' } }],
  siteAudits: [],
  variations: [{ id: 'v1', data: { parentId: JOB, parentType: 'smallWork' } }],
  variationTrackers: [{ id: JOB, data: { parentType: 'smallWork' } }],
  worksListPicks: [
    { id: 'u1', data: { projects: [JOB.toLowerCase()], smallWorks: null } },
    { id: 'u2', data: { projects: ['OTHER'], smallWorks: [JOB] } },
  ],
  settings: [
    { id: `healthSafety_smallWorks_${JOB}`, exists: true, data: { talks: [] } },
    { id: `healthSafety_projects_${JOB}`, exists: false, data: {} },
    { id: 'deadlineAssignments', exists: true, data: { projects: { [JOB]: ['u1'], OTHER: [] } } },
  ],
})

test('planReferences: counts and labels per collection, ids without case, no blockers for the live labels', () => {
  const refs = planReferences(rulebook, { jobId: JOB, removedCollection: 'projects', refs: refsFixture() })
  assert.equal(refs.collections.bookings.count, 2)
  assert.deepEqual(refs.collections.bookings.labels, { 'jobCollection=smallWorks': 1, '(none)': 1 })
  assert.equal(refs.collections.managerSiteBookings.count, 1, 'office booking with the id is not a job booking')
  assert.equal(refs.collections.subcontractorBookings.count, 1)
  assert.equal(refs.collections.materials.count, 1)
  assert.equal(refs.collections.tasks.count, 1)
  assert.equal(refs.collections.variations.count, 1)
  assert.equal(refs.collections.variationTrackers.count, 1, 'tracker matched by its document id')
  assert.deepEqual(refs.picks, [
    { uid: 'u1', list: 'projects' },
    { uid: 'u2', list: 'smallWorks' },
  ])
  assert.deepEqual(refs.deadlineAssignment, { keys: [JOB] })
  assert.deepEqual(refs.settings.map((s) => s.id), [`healthSafety_smallWorks_${JOB}`])
  assert.deepEqual(refs.blockers, [])
})

test('planReferences: a booking labelled with the removed collection, or its settings data, blocks', () => {
  const fixture = refsFixture()
  fixture.bookings.push({ id: 'b4', data: { projectId: JOB, jobCollection: 'projects' } })
  fixture.settings.push({ id: `deadlines_projects_${JOB}`, exists: true, data: { items: [] } })
  fixture.settings.push({ id: `healthSafety_projects_${JOB.toLowerCase()}`, exists: true, data: {} })
  const refs = planReferences(rulebook, { jobId: JOB, removedCollection: 'projects', refs: fixture })
  assert.equal(refs.blockers.length, 2)
  assert.match(refs.blockers[0], /bookings\/b4/)
  assert.match(refs.blockers[1], /deadlines_projects_/)
})

test('planRemoval: dry run never applies; blockers refuse --apply unless --force-refs; children first', () => {
  const copies = locateCopies(rulebook, { jobId: JOB, jobs: both() })
  const removedPath = copies.removed.path
  const subcollectionDocs = [{ path: `${removedPath}/healthSafety/a` }, { path: `${removedPath}/healthSafety/a/rows/x` }]
  const clean = { blockers: [] }
  const blocked = { blockers: ['bookings/b4 …'] }

  const dry = planRemoval({ copies, references: clean, removedPath, subcollectionDocs })
  assert.equal(dry.canApply, false)
  assert.deepEqual(dry.deletePaths, [`${removedPath}/healthSafety/a/rows/x`, `${removedPath}/healthSafety/a`, removedPath])

  assert.equal(planRemoval({ copies, references: clean, removedPath, apply: true }).canApply, true)
  const refused = planRemoval({ copies, references: blocked, removedPath, apply: true })
  assert.equal(refused.canApply, false)
  assert.match(refused.refusal, /--force-refs/)
  assert.equal(planRemoval({ copies, references: blocked, removedPath, apply: true, forceRefs: true }).canApply, true)

  const notReady = planRemoval({ copies: { state: 'already-done', message: 'Nothing to do.' }, references: clean, removedPath, apply: true })
  assert.equal(notReady.canApply, false)
  assert.deepEqual(notReady.deletePaths, [])
})

test('planRemoval never lists the kept copy', () => {
  const copies = locateCopies(rulebook, { jobId: JOB, jobs: both() })
  const removal = planRemoval({ copies, references: { blockers: [] }, removedPath: copies.removed.path, apply: true })
  assert.ok(!removal.deletePaths.some((p) => p.startsWith(copies.kept.path)))
})

test('formatPlan prints both copies, the counts and the delete list', () => {
  const copies = locateCopies(rulebook, { jobId: JOB, jobs: both() })
  const references = planReferences(rulebook, { jobId: JOB, removedCollection: 'projects', refs: refsFixture() })
  const removal = planRemoval({ copies, references, removedPath: copies.removed.path })
  const text = formatPlan({ orgId: ORG, jobId: JOB, copies, references, removal, row: (doc) => doc.data.jobNumber })
  assert.match(text, /Keep: {3}smallWorks\//)
  assert.match(text, /Remove: projects\//)
  assert.match(text, /bookings\s+2 {3}\(jobCollection=smallWorks: 1; \(none\): 1\)/)
  assert.match(text, /never touched/)
})
