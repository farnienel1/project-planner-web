import test from 'node:test'
import assert from 'node:assert/strict'
import { worksInTab, worksTabCounts } from '@/lib/canonical'
import type { Project } from '@/types'
import {
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
  assert.deepEqual(siteAuditDraftProblem({ items: [], customTitle: '', auditDate: '2026-11-23' }), { message: 'Add at least one photo.' })
  assert.deepEqual(siteAuditDraftProblem({ items: [item(), item({ id: 'i2', title: ' ' })], customTitle: '', auditDate: '2026-11-23' }), {
    message: 'Each photo needs a title before the audit can be saved.',
    itemId: 'i2',
  })
  assert.deepEqual(siteAuditDraftProblem({ items: [item()], customTitle: '', auditDate: 'nope' }), { message: 'Enter a valid audit date.' })
  assert.equal(siteAuditDraftProblem({ items: [item()], customTitle: 'Snags', auditDate: '2026-11-23' }), null)
  assert.ok(siteAuditDraftProblem({ items: [item()], customTitle: 'x'.repeat(5000), auditDate: '2026-11-23' })?.message)
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
