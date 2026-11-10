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
  copyDiff,
  describeDescendants,
  formatPlan,
  parseForceRefs,
  plainValue,
  PLAIN_VALUE_MAX_DEPTH,
  jobIdSpellings,
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
  const ids = settingsDocumentIds(rulebook, [JOB.toLowerCase()])
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
  const subcollectionDocs = [{ path: `${removedPath}/healthSafety/a`, data: {} }, { path: `${removedPath}/healthSafety/a/rows/x`, data: {} }]
  const clean = { blockers: [] }
  const blocked = { blockers: ['bookings/b4 …'] }

  const dry = planRemoval({ copies, references: clean, removedPath, subcollectionDocs })
  assert.equal(dry.canApply, false)
  assert.deepEqual(dry.deletePaths, [`${removedPath}/healthSafety/a/rows/x`, `${removedPath}/healthSafety/a`, removedPath])

  assert.equal(planRemoval({ copies, references: clean, removedPath, subcollectionDocs, apply: true }).canApply, true)
  const refused = planRemoval({ copies, references: blocked, removedPath, apply: true })
  assert.equal(refused.canApply, false)
  assert.match(refused.refusal, /--force-refs/)
  assert.equal(planRemoval({ copies, references: blocked, removedPath, apply: true, forceRefs: 1 }).canApply, true)

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
  const diff = copyDiff(rulebook, copies.kept, copies.removed)
  const removal = planRemoval({ copies, references, diff, removedPath: copies.removed.path })
  const text = formatPlan({ orgId: ORG, jobId: JOB, copies, references, diff, removal, row: (doc) => doc.data.jobNumber })
  assert.match(text, /Field differences between the copies \(\d+ of \d+ compared\)/)
  assert.match(text, /jobType:|updatedFrom:/)
  assert.match(text, /Blocking --apply: none/)
  assert.match(text, /Keep: {3}smallWorks\//)
  assert.match(text, /Remove: projects\//)
  assert.match(text, /bookings\s+2 {3}\(jobCollection=smallWorks: 1; \(none\): 1\)/)
  assert.match(text, /never touched/)
})

test('settingsDocumentIds reads both copies’ spellings of the id', () => {
  const ids = settingsDocumentIds(rulebook, [JOB, 'ab-12'])
  assert.ok(ids.includes(`healthSafety_projects_${JOB}`))
  assert.ok(ids.includes('healthSafety_projects_AB-12'))
  assert.ok(ids.includes('healthSafety_projects_ab-12'), 'stored-case id older web builds wrote')
  assert.ok(ids.includes('deadlines_smallWorks_AB-12'))
  assert.ok(ids.includes(`variations_${JOB}`))
  assert.ok(ids.includes('variations_ab-12'))
  assert.equal(ids.filter((id) => id === 'deadlineAssignments').length, 1)
  assert.deepEqual(jobIdSpellings('Ab-1', 'AB-1').sort(), ['AB-1', 'Ab-1', 'ab-1'])
})

test('a document stored under the removed copy blocks --apply (with its fields and row counts) unless --force-refs', () => {
  const copies = locateCopies(rulebook, { jobId: JOB, jobs: both() })
  const removedPath = copies.removed.path
  const subcollectionDocs = [{ path: `${removedPath}/healthSafety/data`, data: { talks: [{}, {}], rams: [], note: 'x' } }]
  assert.deepEqual(describeDescendants(subcollectionDocs), [
    { path: `${removedPath}/healthSafety/data`, fields: [{ name: 'note', rows: null }, { name: 'rams', rows: 0 }, { name: 'talks', rows: 2 }] },
  ])
  const refused = planRemoval({ copies, references: { blockers: [] }, removedPath, subcollectionDocs, apply: true })
  assert.equal(refused.canApply, false)
  assert.match(refused.blockers[0], /healthSafety\/data holds data \(note, rams, talks\)/)
  assert.equal(planRemoval({ copies, references: { blockers: [] }, removedPath, subcollectionDocs, apply: true, forceRefs: 1 }).canApply, true)
  const references = planReferences(rulebook, { jobId: JOB, removedCollection: 'projects', refs: {} })
  const text = formatPlan({ orgId: ORG, jobId: JOB, copies, references, removal: refused, row: () => '' })
  assert.match(text, /healthSafety\/data — note, rams \[0 row\(s\)\], talks \[2 row\(s\)\]/)
})

test('copyDiff compares the listed fields (dates as instants) and finds managers only on the removed copy', () => {
  const kept = job('smallWorks', JOB, { managerIds: ['M1'], isLive: true, startDate: { seconds: 1700000000, nanoseconds: 0 }, latitude: 51.5 })
  const removed = job('projects', JOB, {
    managerIds: ['m1', 'M2'],
    managerId: 'M3',
    isLive: true,
    startDate: new Date(1700000000 * 1000),
    latitude: 51.6,
    client: { id: 'c1', name: 'Acme' },
  })
  const diff = copyDiff(rulebook, kept, removed)
  const changed = Object.fromEntries(diff.rows.filter((r) => !r.same).map((r) => [r.field, r]))
  assert.ok(!('startDate' in changed), 'same instant in two stored shapes')
  assert.ok(!('isLive' in changed))
  assert.ok('managerIds' in changed && 'managerId' in changed && 'latitude' in changed && 'client' in changed)
  assert.equal(changed.client.kept, '(missing)')
  assert.deepEqual(diff.managersOnlyOnRemoved, ['M2', 'M3'], 'm1 matches M1 without case')
  for (const field of ['managerUserIds', 'assignedManagerUserIds', 'hiddenOperativeUserIds', 'addressLine1', 'longitude', 'jobNumber', 'siteName', 'endDate']) {
    assert.ok(diff.rows.some((r) => r.field === field), field)
  }
})

test('a manager only on the removed copy blocks --apply unless --force-refs; same managers do not', () => {
  const copies = locateCopies(rulebook, { jobId: JOB, jobs: both() })
  const removedPath = copies.removed.path
  const diff = { rows: [], managersOnlyOnRemoved: ['M2'] }
  const refused = planRemoval({ copies, references: { blockers: [] }, diff, removedPath, apply: true })
  assert.equal(refused.canApply, false)
  assert.match(refused.blockers[0], /Manager id M2 is on the projects copy but not on the smallWorks copy/)
  assert.equal(planRemoval({ copies, references: { blockers: [] }, diff, removedPath, apply: true, forceRefs: 1 }).canApply, true)
  assert.equal(planRemoval({ copies, references: { blockers: [] }, diff: copyDiff(rulebook, copies.kept, copies.removed), removedPath, apply: true }).canApply, true)
})

test('notifications by relatedId and labour bookings under projectID are listed, never blockers', () => {
  const refs = planReferences(rulebook, {
    jobId: JOB,
    removedCollection: 'projects',
    refs: {
      bookings: [{ id: 'old', data: { projectID: JOB.toLowerCase(), jobCollection: 'projects' } }],
      notifications: [
        { id: 'n1', data: { relatedId: JOB.toLowerCase(), type: 'booking_created' } },
        { id: 'n2', data: { relatedId: 'OTHER', type: 'booking_created' } },
      ],
    },
  })
  assert.equal(refs.collections.notifications.count, 1)
  assert.deepEqual(refs.collections.notifications.labels, { 'type=booking_created': 1 })
  assert.equal(refs.collections.bookings.count, 1)
  assert.match(Object.keys(refs.collections.bookings.labels)[0], /job in projectID/)
  // jobCollection on a projectID booking still names the removed copy: that is a blocker as for any booking.
  assert.equal(refs.blockers.length, 1)
})

test('parseForceRefs: absent, bare, a count, anything else invalid', () => {
  assert.equal(parseForceRefs(['node', 'x', '--apply']), null)
  assert.equal(parseForceRefs(['--force-refs']), 'bare')
  assert.equal(parseForceRefs(['--force-refs=2']), 2)
  assert.equal(parseForceRefs(['--force-refs=0']), 0)
  assert.equal(parseForceRefs(['--force-refs=two']), 'invalid')
  assert.equal(parseForceRefs(['--force-refs=']), 'invalid')
  assert.equal(parseForceRefs(['--force-refs=-1']), 'invalid')
  assert.equal(parseForceRefs(['--force-refs=1', '--force-refs=1']), 'invalid')
})

test('--force-refs: bare always refused; N must equal the blocker count found now', () => {
  const copies = locateCopies(rulebook, { jobId: JOB, jobs: both() })
  const removedPath = copies.removed.path
  const references = { blockers: ['a', 'b'] }
  const bare = planRemoval({ copies, references, removedPath, apply: true, forceRefs: 'bare' })
  assert.equal(bare.canApply, false)
  assert.match(bare.refusal, /--force-refs=2 now\). Send the dry run to Claude/)
  const wrong = planRemoval({ copies, references, removedPath, apply: true, forceRefs: 1 })
  assert.equal(wrong.canApply, false)
  assert.match(wrong.refusal, /--force-refs=1 does not match the 2 blocker\(s\) found now/)
  assert.equal(planRemoval({ copies, references, removedPath, apply: true, forceRefs: 2 }).canApply, true)
  assert.equal(planRemoval({ copies, references, removedPath, apply: true, forceRefs: 'invalid' }).canApply, false)
  // No blockers: bare is still refused, a stale N is refused, =0 and no flag pass.
  const clean = { blockers: [] }
  assert.equal(planRemoval({ copies, references: clean, removedPath, apply: true, forceRefs: 'bare' }).canApply, false)
  assert.equal(planRemoval({ copies, references: clean, removedPath, apply: true, forceRefs: 1 }).canApply, false)
  assert.equal(planRemoval({ copies, references: clean, removedPath, apply: true, forceRefs: 0 }).canApply, true)
  assert.equal(planRemoval({ copies, references: clean, removedPath, apply: true }).canApply, true)
  // The refusal without the flag tells the count, never a bare flag to type.
  const refused = planRemoval({ copies, references, removedPath, apply: true })
  assert.match(refused.refusal, /2 blocker\(s\)/)
  assert.match(refused.refusal, /--force-refs=2/)
})

test('plainValue: Firestore types are leaves, depth is capped', () => {
  class DocumentReference {
    constructor(p) {
      this.path = p
      this.id = p.split('/').pop()
      this.firestore = { huge: { client: { settings: {} } } }
    }
  }
  class GeoPoint {
    constructor(lat, lng) {
      this.latitude = lat
      this.longitude = lng
    }
    isEqual() {
      return false
    }
  }
  class Timestamp {
    constructor(seconds) {
      this.seconds = seconds
      this.nanoseconds = 0
    }
    toMillis() {
      return this.seconds * 1000
    }
  }
  const ref = new DocumentReference('organizations/O/clients/C1')
  assert.equal(plainValue(ref), 'ref:organizations/O/clients/C1')
  assert.equal(plainValue(new GeoPoint(51.5, -0.1)), '51.5,-0.1')
  assert.equal(plainValue(new Timestamp(1700000000)), '2023-11-14T22:13:20.000Z')
  assert.equal(plainValue(new Date(0)), '1970-01-01T00:00:00.000Z')
  assert.equal(plainValue(new Uint8Array(3)), 'bytes(3)')
  assert.deepEqual(plainValue({ b: 1, a: { ref } }), { a: { ref: 'ref:organizations/O/clients/C1' }, b: 1 })
  let deep = 'leaf'
  for (let i = 0; i < 20; i += 1) deep = { next: deep }
  const text = JSON.stringify(plainValue(deep))
  assert.equal((text.match(/next/g) || []).length, PLAIN_VALUE_MAX_DEPTH)
  assert.match(text, /…/)
  const cyclic = { name: 'x' }
  cyclic.self = cyclic
  assert.doesNotThrow(() => JSON.stringify(plainValue(cyclic)))
  // fieldText uses it: a client stored as a reference compares by path.
  const diff = copyDiff(rulebook, job('smallWorks', JOB, { client: ref }), job('projects', JOB, { client: new DocumentReference('organizations/O/clients/C1') }))
  assert.equal(diff.rows.find((r) => r.field === 'client').same, true)
  assert.equal(diff.rows.find((r) => r.field === 'client').kept, '"ref:organizations/O/clients/C1"')
})
