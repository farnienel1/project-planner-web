import { dayKeyInOrganizationZone, siteAuditFieldLimitError, worksInTab, worksTabCounts, type WorksTab, type WorksTabCounts } from '@/lib/canonical'
import { dateFromDayKeyInZone } from '@/lib/orgTime/zoneTime'
import { isPlausibleDayKey } from '@/lib/security/boundedValue'
import type { SiteAuditOutboxRecord } from '@/lib/siteAudit/siteAuditOutbox'
import type { PhotoUpload } from '@/lib/siteAudit/auditPhotoUploads'
import type { Project } from '@/types'

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
