import test from 'node:test'
import assert from 'node:assert/strict'
import { visibleJobs, worksInTab, worksTabCounts, type JobAccessViewer } from '@/lib/canonical'
import type { Project } from '@/types'
import {
  siteAuditAfterSend,
  siteAuditAuthoredJobIds,
  siteAuditBrowseJobs,
  siteAuditsVisibleToViewer,
  siteAuditDateText,
  siteAuditDefaultDate,
  siteAuditHasUnsavedWork,
  siteAuditJobAllowed,
  siteAuditJobChoice,
  siteAuditJobPageGrant,
  SITE_AUDIT_JOB_DEFAULT_TAB,
  SITE_AUDIT_JOB_TABS,
  siteAuditDraftProblem,
  siteAuditJobTabCounts,
  siteAuditJobsInTab,
  siteAuditOutboxRecord,
  type SiteAuditDraftItem,
} from '@/lib/siteAudit/siteAuditCreateDraft'

const photo = { name: 'IMG_1.jpg' } as unknown as File
const item = (over: Partial<SiteAuditDraftItem> = {}): SiteAuditDraftItem => ({
  id: 'i1',
  title: '  Front courtyard ',
  location: ' Entrance ',
  comments: ' crack ',
  assignee: ' Sam ',
  annotations: ' arrow ',
  photo,
  previewUrl: 'blob:x',
  takenAt: new Date(1_763_900_000_000),
  detailsAdded: true,
  ...over,
})

test('job step tabs: All / Active / Upcoming / Completed, default Active, from the rulebook', () => {
  assert.deepEqual(SITE_AUDIT_JOB_TABS.map((t) => t.label), ['All', 'Active', 'Upcoming', 'Completed'])
  assert.equal(SITE_AUDIT_JOB_DEFAULT_TAB, 'active')
  const now = Date.UTC(2026, 10, 23, 12)
  const jobs = [
    { id: 'a', startDayKey: '2026-11-01', endDayKey: '2026-12-31' },
    { id: 'u', startDayKey: '2026-12-10', endDayKey: '2026-12-31' },
    { id: 'c', startDayKey: '2026-10-01', endDayKey: '2026-10-31' },
    { id: 'x', startDayKey: '2026-11-01', endDayKey: '2026-12-31', isLive: false },
  ] as unknown as Project[]
  for (const tab of ['all', 'active', 'upcoming', 'completed'] as const) {
    assert.deepEqual(siteAuditJobsInTab(jobs, tab, now, 'Europe/London'), worksInTab(jobs, tab, now, 'Europe/London'))
  }
  assert.deepEqual(siteAuditJobTabCounts(jobs, now, 'Europe/London'), worksTabCounts(jobs, now, 'Europe/London'))
  assert.deepEqual(siteAuditJobsInTab(jobs, 'active', now, 'Europe/London').map((j) => j.id), ['a'])
})

test('save checks: same order and messages as the dialog had', () => {
  assert.deepEqual(siteAuditDraftProblem({ items: [], customTitle: '', auditDate: '2026-11-23' }), { message: 'Add at least one photo.', step: 3 })
  assert.deepEqual(siteAuditDraftProblem({ items: [item(), item({ id: 'i2', title: ' ' })], customTitle: '', auditDate: '2026-11-23' }), {
    message: 'Each photo needs a title before the audit can be saved.',
    itemId: 'i2',
    step: 3,
  })
  assert.deepEqual(siteAuditDraftProblem({ items: [item()], customTitle: '', auditDate: 'nope' }), { message: 'Enter a valid audit date.', step: 2 })
  assert.equal(siteAuditDraftProblem({ items: [item()], customTitle: 'Snags', auditDate: '2026-11-23' }), null)
  const longTitle = siteAuditDraftProblem({ items: [item()], customTitle: 'x'.repeat(5000), auditDate: '2026-11-23' })
  assert.ok(longTitle?.message)
  assert.equal(longTitle?.step, 2)
  assert.equal(siteAuditDraftProblem({ items: [item({ comments: 'x'.repeat(50_000) })], customTitle: '', auditDate: '2026-11-23' })?.step, 3)
})

test('guardrail 7: the record sent is exactly the one the dialog built', () => {
  const uploads = { i2: { itemId: 'i2', status: 'done' as const, progress: 1, attempts: 1 } }
  const items = [item(), item({ id: 'i2' })]
  const nowMs = 1_763_900_100_000
  const project = { id: 'P1', jobNumber: 'J-1', siteName: 'Carnaby' }
  const built = siteAuditOutboxRecord({
    auditId: 'A1',
    organizationId: 'org',
    userId: 'u1',
    nowMs,
    project,
    auditType: 'Snags',
    customTitle: ' Plant room ',
    auditDate: '2026-11-23',
    authorName: 'Test Admin',
    visibleToOperatives: false,
    items,
    uploads,
  })
  // The literal the create flow wrote before the move (origin/main debe4dea, SiteAuditCreateFlow.submit), with Date.now() = nowMs.
  const before = {
    id: 'A1',
    kind: 'project',
    organizationId: 'org',
    userId: 'u1',
    createdAtMs: nowMs,
    updatedAtMs: nowMs,
    project: { id: project.id, jobNumber: project.jobNumber, siteName: project.siteName },
    meta: { type: 'Snags', customTitle: ' Plant room '.trim(), date: '2026-11-23', authorName: 'Test Admin', visibleToOperatives: false },
    items: items.map((it) => ({
      id: it.id,
      title: it.title.trim(),
      location: it.location.trim(),
      comments: it.comments.trim(),
      assignee: it.assignee.trim(),
      annotations: it.annotations.trim(),
      takenAtMs: it.takenAt.getTime(),
      photo: it.photo,
      fileName: it.photo.name,
      upload: (uploads as Record<string, unknown>)[it.id] ?? { itemId: it.id, status: 'pending', progress: 0, attempts: 0 },
    })),
  }
  assert.deepEqual(built, before)
})

test('after the send: reload when saved, leave the page only while still on it', () => {
  assert.deepEqual(siteAuditAfterSend({ saved: true, stillOnPage: true }), { reload: true, leave: true })
  assert.deepEqual(siteAuditAfterSend({ saved: true, stillOnPage: false }), { reload: true, leave: false })
  assert.deepEqual(siteAuditAfterSend({ saved: false, stillOnPage: true }), { reload: false, leave: false })
})

test('unsaved work: photos or a title, not while saving or kept on the device', () => {
  assert.equal(siteAuditHasUnsavedWork({ itemCount: 0, customTitle: ' ', saving: false, keptOnDevice: false }), false)
  assert.equal(siteAuditHasUnsavedWork({ itemCount: 1, customTitle: '', saving: false, keptOnDevice: false }), true)
  assert.equal(siteAuditHasUnsavedWork({ itemCount: 0, customTitle: 'Snags', saving: false, keptOnDevice: false }), true)
  assert.equal(siteAuditHasUnsavedWork({ itemCount: 2, customTitle: '', saving: true, keptOnDevice: false }), false)
  assert.equal(siteAuditHasUnsavedWork({ itemCount: 2, customTitle: '', saving: false, keptOnDevice: true }), false)
})

test('audit date: today in the organisation zone, shown as "23 Nov 2026"', () => {
  // 23:30 UTC on 22 Nov is already 23 Nov in Auckland and still 22 Nov in London.
  const late = Date.UTC(2026, 10, 22, 23, 30)
  assert.equal(siteAuditDefaultDate(late, 'Europe/London'), '2026-11-22')
  assert.equal(siteAuditDefaultDate(late, 'Pacific/Auckland'), '2026-11-23')
  assert.equal(siteAuditDateText('2026-11-23', 'Europe/London'), '23 Nov 2026')
  assert.equal(siteAuditDateText('2026-11-23', 'Pacific/Auckland'), '23 Nov 2026')
  assert.equal(siteAuditDateText('nope', 'Europe/London'), 'nope')
})

const role = (over: Partial<JobAccessViewer['role']> = {}): JobAccessViewer['role'] => ({
  isSuperAdmin: false,
  isAdmin: false,
  isManager: false,
  isOperativeMode: false,
  ...over,
})
const jobsForChoice = [
  { id: 'J-BOOKED' },
  { id: 'j-task' },
  { id: 'j-deadline' },
  { id: 'j-hidden', hiddenOperativeUserIds: ['OP-USER'] },
  { id: 'j-other' },
] as unknown as Project[]
const opContext = {
  operatives: [{ id: 'op-row', email: 'op@x.test' }],
  managers: [],
  bookings: [
    { projectId: 'j-booked', operativeId: 'op-row', status: 'Confirmed' },
    { projectId: 'j-hidden', operativeId: 'op-user', status: 'Confirmed' },
    { projectId: 'j-other', operativeId: 'someone-else', status: 'Confirmed' },
    { projectId: 'j-other', operativeId: 'op-user', status: 'Cancelled' },
  ],
  managerSiteBookings: [],
  tasks: [{ projectId: 'j-task', assignedOperativeIds: ['op-row'] }],
  deadlineJobIds: ['j-deadline'],
}
const operative: JobAccessViewer = { role: role({ isOperativeMode: true }), ids: ['op-user'], email: 'OP@x.test', uid: 'op-user' }

test('new site audit jobs (owner 23 Nov): an operative sees only visibleJobs — bookings, tasks, deadlines, less hidden', () => {
  const choice = siteAuditJobChoice({ jobs: jobsForChoice, viewer: operative, context: opContext, contextLoaded: true })
  assert.equal(choice.state, 'ready')
  assert.deepEqual(choice.jobs.map((j) => j.id), ['J-BOOKED', 'j-task', 'j-deadline'])
  // Exactly the rulebook's answer, never a second filter.
  assert.deepEqual(choice.jobs, visibleJobs(jobsForChoice, operative, opContext))
})

test('new site audit jobs: admins, super admins and managers see every job and need nothing loaded', () => {
  for (const r of [role({ isAdmin: true }), role({ isSuperAdmin: true }), role({ isManager: true })]) {
    const viewer: JobAccessViewer = { role: r, ids: ['m1'] }
    const choice = siteAuditJobChoice({ jobs: jobsForChoice, viewer, context: null, contextLoaded: false })
    assert.equal(choice.state, 'ready')
    assert.equal(choice.jobs.length, jobsForChoice.length)
  }
})

test('new site audit jobs: never an empty list before the operative\'s data has loaded; a failed load says so', () => {
  assert.deepEqual(siteAuditJobChoice({ jobs: jobsForChoice, viewer: operative, context: null, contextLoaded: false }), {
    state: 'loading',
    jobs: [],
  })
  assert.equal(
    siteAuditJobChoice({ jobs: jobsForChoice, viewer: operative, context: opContext, contextLoaded: false, contextFailed: true }).state,
    'failed'
  )
  assert.equal(siteAuditJobChoice({ jobs: jobsForChoice, viewer: null, context: null, contextLoaded: true }).state, 'loading')
})

test('per-job new site audit: an operative is refused a job they cannot see, allowed their own', () => {
  const ask = (id: string) =>
    siteAuditJobAllowed({ job: jobsForChoice.find((j) => j.id === id)!, viewer: operative, context: opContext, contextLoaded: true })
  assert.equal(ask('J-BOOKED'), 'allowed')
  assert.equal(ask('j-other'), 'refused')
  assert.equal(ask('j-hidden'), 'refused')
  assert.equal(
    siteAuditJobAllowed({ job: jobsForChoice[4], viewer: { role: role({ isManager: true }), ids: ['m'] }, context: null, contextLoaded: false }),
    'allowed'
  )
  assert.equal(siteAuditJobAllowed({ job: jobsForChoice[0], viewer: operative, context: null, contextLoaded: false }), 'loading')
})

test('per-job new site audit: once allowed, the form stays for that job (review of #419)', () => {
  let grant = siteAuditJobPageGrant({ grantedJobId: null, jobId: 'J1', allowed: 'loading' })
  assert.deepEqual(grant, { grantedJobId: null, show: 'loading' })
  grant = siteAuditJobPageGrant({ grantedJobId: grant.grantedJobId, jobId: 'J1', allowed: 'allowed' })
  assert.deepEqual(grant, { grantedJobId: 'J1', show: 'flow' })
  // A booking or task change, or a listener restart, mid-audit: the form is never unmounted.
  for (const later of ['loading', 'failed', 'refused'] as const) {
    assert.equal(siteAuditJobPageGrant({ grantedJobId: 'J1', jobId: 'J1', allowed: later }).show, 'flow')
  }
  // Another job (a new URL) starts again.
  assert.deepEqual(siteAuditJobPageGrant({ grantedJobId: 'J1', jobId: 'J2', allowed: 'refused' }), { grantedJobId: 'J1', show: 'refused' })
  assert.equal(siteAuditJobPageGrant({ grantedJobId: null, jobId: 'J1', allowed: 'failed' }).show, 'failed')
})

test('hub browse lists (owner 23 Nov): an operative sees visibleJobs plus the jobs holding an audit they wrote', () => {
  const audits = [
    { projectId: 'J-OTHER', createdByUserId: 'op-user' }, // their own audit on a job they no longer see
    { projectId: 'j-hidden', createdByUserId: 'someone-else' }, // another person's audit: never brings the job back
  ]
  const authored = siteAuditAuthoredJobIds(audits, 'op-user')
  assert.deepEqual(authored, ['J-OTHER'])
  const choice = siteAuditBrowseJobs({ jobs: jobsForChoice, viewer: operative, context: opContext, contextLoaded: true, authoredJobIds: authored })
  assert.equal(choice.state, 'ready')
  // Catalogue order; 'j-other' matched to the audit's 'J-OTHER' without case; 'j-hidden' stays out.
  assert.deepEqual(choice.jobs.map((j) => j.id), ['J-BOOKED', 'j-task', 'j-deadline', 'j-other'])
})

test('hub browse lists: admins and managers keep every job; loading and failed are passed through', () => {
  const viewer: JobAccessViewer = { role: role({ isManager: true }), ids: ['m1'] }
  assert.equal(
    siteAuditBrowseJobs({ jobs: jobsForChoice, viewer, context: null, contextLoaded: false, authoredJobIds: [] }).jobs.length,
    jobsForChoice.length
  )
  assert.equal(
    siteAuditBrowseJobs({ jobs: jobsForChoice, viewer: operative, context: null, contextLoaded: false, authoredJobIds: ['j-other'] }).state,
    'loading'
  )
  assert.equal(
    siteAuditBrowseJobs({ jobs: jobsForChoice, viewer: operative, context: opContext, contextLoaded: false, contextFailed: true, authoredJobIds: [] }).state,
    'failed'
  )
})

test('audits an operative sees: visible to operatives, or their own; everyone else every audit', () => {
  const audits = [
    { id: 'a', visibleToOperatives: true, createdByUserId: 'x' },
    { id: 'b', visibleToOperatives: false, createdByUserId: 'op-user' },
    { id: 'c', visibleToOperatives: false, createdByUserId: 'x' },
  ]
  assert.deepEqual(siteAuditsVisibleToViewer(audits, { operativeMode: true, userId: 'op-user' }).map((a) => a.id), ['a', 'b'])
  assert.deepEqual(siteAuditsVisibleToViewer(audits, { operativeMode: true, userId: '' }).map((a) => a.id), ['a'])
  assert.equal(siteAuditsVisibleToViewer(audits, { operativeMode: false, userId: 'm' }).length, 3)
})
