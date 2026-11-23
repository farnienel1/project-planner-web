import {
  dayKeyInOrganizationZone,
  normalizeDocumentId,
  seesEveryJob,
  siteAuditFieldLimitError,
  visibleJobs,
  worksInTab,
  worksTabCounts,
  type JobAccessViewer,
  type WorksListContext,
  type WorksTab,
  type WorksTabCounts,
} from '@/lib/canonical'
import { dateFromDayKeyInZone } from '@/lib/orgTime/zoneTime'
import { isPlausibleDayKey } from '@/lib/security/boundedValue'
import type { SiteAuditOutboxRecord } from '@/lib/siteAudit/siteAuditOutbox'
import type { PhotoUpload } from '@/lib/siteAudit/auditPhotoUploads'
import type { Project, SiteAudit } from '@/types'

/**
 * The New site audit page (owner request 23 Nov): its job step lists projects or small works under All / Active /
 * Upcoming / Completed, defaulting to Active (as iOS). Which tab a job is under is rulebook §21 (`worksInTab`,
 * counts `worksTabCounts`, an inactive job under Completed) on the organisation day — never worked out here.
 */
export const SITE_AUDIT_JOB_TABS: ReadonlyArray<{ tab: WorksTab; label: string }> = [
  { tab: 'all', label: 'All' },
  { tab: 'active', label: 'Active' },
  { tab: 'upcoming', label: 'Upcoming' },
  { tab: 'completed', label: 'Completed' },
]

export const SITE_AUDIT_JOB_DEFAULT_TAB: WorksTab = 'active'

export function siteAuditJobsInTab<T extends Project>(jobs: ReadonlyArray<T>, tab: WorksTab, now: unknown, timeZone: string): T[] {
  return worksInTab(jobs, tab, now, timeZone)
}

export function siteAuditJobTabCounts(jobs: ReadonlyArray<Project>, now: unknown, timeZone: string): WorksTabCounts {
  return worksTabCounts(jobs, now, timeZone)
}

/** One photo of the audit being made, as the page holds it. */
export type SiteAuditDraftItem = {
  id: string
  title: string
  location: string
  comments: string
  assignee: string
  annotations: string
  photo: File
  previewUrl: string
  takenAt: Date
  detailsAdded: boolean
}

/**
 * Why the audit cannot be saved yet, checked in the order the save always checked it (moved here unchanged from the
 * create flow so the Review step can ask the same question): at least one photo, a title on every photo (`itemId`
 * names the first without one), the rulebook field limits (`siteAuditFieldLimitError`) and a valid audit date.
 */
export function siteAuditDraftProblem(input: {
  items: ReadonlyArray<SiteAuditDraftItem>
  customTitle: string
  auditDate: string
}): { message: string; itemId?: string; step: 2 | 3 } | null {
  const { items, customTitle, auditDate } = input
  if (items.length === 0) return { message: 'Add at least one photo.', step: 3 }
  const missing = items.find((item) => !item.title.trim())
  if (missing) return { message: 'Each photo needs a title before the audit can be saved.', itemId: missing.id, step: 3 }
  const titleError = siteAuditFieldLimitError({ customTitle })
  if (titleError) return { message: titleError, step: 2 }
  const itemError = items.map((item) => siteAuditFieldLimitError(item)).find((message) => message) ?? null
  if (itemError) return { message: itemError, step: 3 }
  if (!isPlausibleDayKey(auditDate)) return { message: 'Enter a valid audit date.', step: 2 }
  return null
}

/** The audit date the page opens with: today in the organisation zone, stored as `yyyy-MM-dd` (as before). */
export function siteAuditDefaultDate(nowMs: number, timeZone: string): string {
  return dayKeyInOrganizationZone(new Date(nowMs).toISOString(), timeZone)
}

/** The audit date shown on Review, e.g. "23 Nov 2026" (organisation zone; display only). */
export function siteAuditDateText(dayKey: string, timeZone: string): string {
  if (!isPlausibleDayKey(dayKey)) return dayKey
  try {
    return new Intl.DateTimeFormat('en-GB', { timeZone, day: 'numeric', month: 'short', year: 'numeric' }).format(
      dateFromDayKeyInZone(dayKey, timeZone)
    )
  } catch {
    return dayKey
  }
}

export const SITE_AUDIT_LEAVE_CONFIRM_MESSAGE = 'Leave this audit? Your photos and details will be lost.'

/**
 * Whether leaving the page would lose the audit: photos or a typed title are on it and it is not saving and not kept
 * on this device yet (once the send starts it stays in the outbox as "Not sent" until it is saved).
 */
export function siteAuditHasUnsavedWork(input: {
  itemCount: number
  customTitle: string
  saving: boolean
  keptOnDevice: boolean
}): boolean {
  if (input.saving || input.keptOnDevice) return false
  return input.itemCount > 0 || input.customTitle.trim() !== ''
}

/**
 * After the send: the audit list is reloaded when it was saved, and the page goes back only while the person is
 * still on it (they may have left while it uploaded — never pull them back).
 */
export function siteAuditAfterSend(input: { saved: boolean; stillOnPage: boolean }): { reload: boolean; leave: boolean } {
  return { reload: input.saved, leave: input.saved && input.stillOnPage }
}

/**
 * The record kept on this device and sent (`sendSiteAudit`), built exactly as the create flow always built it (moved
 * here unchanged so a test can lock it): text trimmed, the project's id / job number / site name, the photo and its
 * upload state (a fresh pending upload for a photo not tried yet).
 */
export function siteAuditOutboxRecord(input: {
  auditId: string
  organizationId: string
  userId: string
  nowMs: number
  project: Pick<Project, 'id' | 'jobNumber' | 'siteName'>
  auditType: string
  customTitle: string
  auditDate: string
  authorName: string
  visibleToOperatives: boolean
  items: ReadonlyArray<SiteAuditDraftItem>
  uploads: Record<string, PhotoUpload>
}): SiteAuditOutboxRecord {
  const { project, uploads } = input
  return {
    id: input.auditId,
    kind: 'project',
    organizationId: input.organizationId,
    userId: input.userId,
    createdAtMs: input.nowMs,
    updatedAtMs: input.nowMs,
    project: { id: project.id, jobNumber: project.jobNumber, siteName: project.siteName },
    meta: {
      type: input.auditType,
      customTitle: input.customTitle.trim(),
      date: input.auditDate,
      authorName: input.authorName,
      visibleToOperatives: input.visibleToOperatives,
    },
    items: input.items.map((item) => ({
      id: item.id,
      title: item.title.trim(),
      location: item.location.trim(),
      comments: item.comments.trim(),
      assignee: item.assignee.trim(),
      annotations: item.annotations.trim(),
      takenAtMs: item.takenAt.getTime(),
      photo: item.photo,
      fileName: item.photo.name,
      upload: uploads[item.id] ?? { itemId: item.id, status: 'pending', progress: 0, attempts: 0 },
    })),
  }
}

/** Where the job list for a new site audit stands (owner decision 23 Nov). */
export type SiteAuditJobChoice<T> = { state: 'loading' | 'failed' | 'ready'; jobs: T[] }

/**
 * The jobs a person may start a site audit on (owner decision 23 Nov, before launch): exactly the jobs they see —
 * rulebook §21 `visibleJobs`. Admins, super admins and managers (`seesEveryJob`) see every job, so nothing changes for
 * them and nothing has to load first. Anyone else (operatives: the jobs of their own bookings, tasks and deadlines, less
 * the jobs hidden from them) gets no list until the bookings, tasks, deadlines and roster rows the rule reads have
 * loaded (`contextLoaded`), so an empty "No jobs" is never shown before the data is there; a failed load is `failed`,
 * never an empty list. With no signed-in viewer the list is still loading.
 */
export function siteAuditJobChoice<T extends Project>(input: {
  jobs: ReadonlyArray<T>
  viewer: JobAccessViewer | null
  context: WorksListContext | null
  contextLoaded: boolean
  contextFailed?: boolean
}): SiteAuditJobChoice<T> {
  const { viewer } = input
  if (!viewer || !viewer.role) return { state: 'loading', jobs: [] }
  if (seesEveryJob(viewer.role)) return { state: 'ready', jobs: visibleJobs(input.jobs, viewer, input.context) }
  if (input.contextFailed) return { state: 'failed', jobs: [] }
  if (!input.contextLoaded) return { state: 'loading', jobs: [] }
  return { state: 'ready', jobs: visibleJobs(input.jobs, viewer, input.context) }
}

/** Whether the job a per-job New site audit page opened on is one the person may start an audit on (`siteAuditJobChoice`). */
export function siteAuditJobAllowed(input: {
  job: Project
  viewer: JobAccessViewer | null
  context: WorksListContext | null
  contextLoaded: boolean
  contextFailed?: boolean
}): 'loading' | 'failed' | 'allowed' | 'refused' {
  const choice = siteAuditJobChoice({ ...input, jobs: [input.job] })
  if (choice.state !== 'ready') return choice.state
  return choice.jobs.length > 0 ? 'allowed' : 'refused'
}

export const SITE_AUDIT_JOB_REFUSED_MESSAGE = 'You can\'t create site audits for this job.'
export const SITE_AUDIT_JOBS_FAILED_MESSAGE = 'Your jobs did not finish loading. Check the connection and try again.'

/**
 * The per-job New site audit page, once it has said "allowed" for a job, keeps showing the form for that job whatever
 * the access check says later (review of #419): a booking or task change, or a listener restarting mid-audit, must never
 * unmount the form and lose the photos. Loading / failed / refused only apply before the first grant. Returns the job id
 * granted so far (the page keeps it in state) and what to show.
 */
export function siteAuditJobPageGrant(input: {
  grantedJobId: string | null
  jobId: string
  allowed: 'loading' | 'failed' | 'allowed' | 'refused'
}): { grantedJobId: string | null; show: 'flow' | 'loading' | 'failed' | 'refused' } {
  if (input.grantedJobId && input.grantedJobId === input.jobId) return { grantedJobId: input.grantedJobId, show: 'flow' }
  if (input.allowed === 'allowed') return { grantedJobId: input.jobId, show: 'flow' }
  return { grantedJobId: input.grantedJobId, show: input.allowed }
}

/** How long the job list waits for an operative's bookings and tasks before saying it did not load (review of #419). */
export const SITE_AUDIT_JOBS_LOAD_TIMEOUT_MS = 15_000

/**
 * The audits a person sees in the Site audit hub and on a job's Site audits page (the rule the job page already used,
 * and iOS `siteAuditsForCurrentUser`): an operative sees audits marked visible to operatives and the audits they wrote;
 * everyone else sees every audit.
 */
export function siteAuditsVisibleToViewer<T extends Pick<SiteAudit, 'visibleToOperatives' | 'createdByUserId'>>(
  audits: ReadonlyArray<T>,
  viewer: { operativeMode: boolean; userId: string | null | undefined }
): T[] {
  if (!viewer.operativeMode) return [...audits]
  const uid = viewer.userId ?? ''
  return audits.filter((audit) => audit.visibleToOperatives || (uid !== '' && audit.createdByUserId === uid))
}

/**
 * The jobs in the Site audit hub's Projects / Small works browse lists (owner decision 23 Nov, before launch; iOS
 * `SiteAuditProjectsBrowserView`): the jobs `siteAuditJobChoice` gives the person (rulebook §21 `visibleJobs` — every
 * job for admins and managers), plus, for anyone else, every job that holds an audit they wrote (`authoredJobIds`,
 * ids without case), so an operative's own past audits stay reachable after their booking, task or deadline on that
 * job has gone. Loading / failed as `siteAuditJobChoice`; catalogue order kept.
 */
export function siteAuditBrowseJobs<T extends Project>(input: {
  jobs: ReadonlyArray<T>
  viewer: JobAccessViewer | null
  context: WorksListContext | null
  contextLoaded: boolean
  contextFailed?: boolean
  authoredJobIds: Iterable<string>
}): SiteAuditJobChoice<T> {
  const choice = siteAuditJobChoice(input)
  if (choice.state !== 'ready' || !input.viewer?.role || seesEveryJob(input.viewer.role)) return choice
  const authored = new Set<string>()
  for (const id of input.authoredJobIds) {
    const key = normalizeDocumentId(id)
    if (key) authored.add(key)
  }
  if (authored.size === 0) return choice
  const shown = new Set(choice.jobs.map((job) => job.id))
  return {
    state: 'ready',
    jobs: input.jobs.filter((job) => shown.has(job.id) || authored.has(normalizeDocumentId(job.id))),
  }
}

/** The job ids of the audits `userId` wrote (`createdByUserId`, as stored). */
export function siteAuditAuthoredJobIds(
  audits: ReadonlyArray<Pick<SiteAudit, 'projectId' | 'createdByUserId'>>,
  userId: string | null | undefined
): string[] {
  if (!userId) return []
  return audits.filter((audit) => audit.createdByUserId === userId && audit.projectId).map((audit) => audit.projectId)
}
