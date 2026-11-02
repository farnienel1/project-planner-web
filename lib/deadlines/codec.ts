/**
 * iOS parity source: FirebaseBackend.swift deadlineMap / parseDeadline (~L8486).
 * Empty strings are written as "". Optional dates and reminderDaysBefore are null.
 */

import { Timestamp } from 'firebase/firestore'
import { asUppercaseUuid, isUuidString } from '@/lib/ios-parity/uuid'
import {
  deadlinesDocumentId,
  parseDeadlineItem,
  type DeadlineChangeDocument,
} from '@/lib/canonical/workDocumentReaders'
import type { Deadline, DeadlineChange, DeadlineChangeKind, DeadlineStatus } from '@/lib/deadlines/types'
import { DEADLINE_STATUSES } from '@/lib/deadlines/types'

/** UUIDs upper case as Swift writes them; any other id exactly as stored (rulebook §1). */
function storedId(value: string): string {
  return isUuidString(value) ? asUppercaseUuid(value) : value.trim()
}

function emptyToNull(value: string): string | null {
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function statusOf(value: string): DeadlineStatus {
  return (DEADLINE_STATUSES as readonly string[]).includes(value) ? (value as DeadlineStatus) : 'notStarted'
}

export function serializeDeadlineChange(change: DeadlineChange): Record<string, unknown> {
  const map: Record<string, unknown> = {
    id: storedId(change.id),
    at: Timestamp.fromDate(change.at),
    author: change.author,
  }
  const kind = change.kind
  switch (kind.type) {
    case 'created':
      map.type = 'created'
      map.due = Timestamp.fromDate(kind.due)
      break
    case 'rescheduled':
      map.type = 'rescheduled'
      map.from = Timestamp.fromDate(kind.from)
      map.to = Timestamp.fromDate(kind.to)
      map.reason = kind.reason
      break
    case 'progress':
      map.type = 'progress'
      map.progress = kind.progress
      break
    case 'status':
      map.type = 'status'
      map.status = kind.status
      break
    case 'note':
      map.type = 'note'
      map.note = kind.note
      break
    case 'completed':
      map.type = 'completed'
      map.completedOn = Timestamp.fromDate(kind.completedOn)
      break
    case 'assigned':
      map.type = 'assigned'
      map.assignedTo = kind.assignedTo
      break
    case 'fileAttached':
      map.type = 'fileAttached'
      map.name = kind.name
      break
    case 'siteAuditAttached':
      map.type = 'siteAuditAttached'
      map.name = kind.name
      break
  }
  return map
}

function changeFromDocument(change: DeadlineChangeDocument): DeadlineChange {
  const at = change.atMs != null ? new Date(change.atMs) : new Date()
  const when = (ms: number | null) => (ms != null ? new Date(ms) : at)
  let kind: DeadlineChangeKind
  switch (change.type) {
    case 'created':
      kind = { type: 'created', due: when(change.dueMs) }
      break
    case 'rescheduled':
      kind = { type: 'rescheduled', from: when(change.fromMs), to: when(change.toMs), reason: change.reason ?? '' }
      break
    case 'progress':
      kind = { type: 'progress', progress: change.progress ?? 0 }
      break
    case 'status':
      kind = { type: 'status', status: statusOf(change.status ?? '') }
      break
    case 'completed':
      kind = { type: 'completed', completedOn: when(change.completedOnMs) }
      break
    case 'assigned':
      kind = { type: 'assigned', assignedTo: change.assignedTo ?? '' }
      break
    case 'fileAttached':
      kind = { type: 'fileAttached', name: change.name ?? 'File' }
      break
    case 'siteAuditAttached':
      kind = { type: 'siteAuditAttached', name: change.name ?? 'Site audit' }
      break
    default:
      kind = { type: 'note', note: change.note ?? '' }
  }
  return { id: change.id, at, author: change.author, kind }
}

/** One stored history row. Reading is the rulebook's (`parseDeadlineItem`); the id keeps its stored case. */
export function parseDeadlineChange(map: Record<string, unknown>): DeadlineChange | null {
  const item = parseDeadlineItem({ id: 'change', history: [map] })
  const change = item?.history[0]
  return change ? changeFromDocument(change) : null
}

export function serializeDeadline(item: Deadline): Record<string, unknown> {
  return {
    id: storedId(item.id),
    title: item.title,
    location: item.location ?? '',
    trade: item.trade ?? '',
    detail: item.detail ?? '',
    start: item.start ? Timestamp.fromDate(item.start) : null,
    due: Timestamp.fromDate(item.due),
    completedAt: item.completedAt ? Timestamp.fromDate(item.completedAt) : null,
    assignees: item.assignees,
    assigneeUserIds: item.assigneeUserIds,
    company: item.company ?? '',
    status: item.status,
    progress: item.progress,
    isCritical: item.isCritical,
    dependsOn: item.dependsOn.map(storedId),
    blockedReason: item.blockedReason ?? '',
    reminderDaysBefore: item.reminderDaysBefore,
    originalDue: item.originalDue ? Timestamp.fromDate(item.originalDue) : null,
    history: item.history.map(serializeDeadlineChange),
    contextKind: item.contextKind,
    projectId: item.projectId ? storedId(item.projectId) : '',
    createdByUserId: item.createdByUserId,
    fileURL: item.fileURL ?? '',
    fileName: item.fileName ?? '',
    siteAuditId: item.siteAuditId ? storedId(item.siteAuditId) : '',
    siteAuditTitle: item.siteAuditTitle ?? '',
  }
}

/**
 * One stored deadline. Reading is the rulebook's `parseDeadlineItem` (§1): the id, dependencies and assignee ids
 * keep their stored case and a non-UUID id is kept; an item with no id is skipped.
 */
export function parseDeadline(map: Record<string, unknown>, fallbackProjectId: string): Deadline | null {
  const item = parseDeadlineItem(map, { projectId: fallbackProjectId })
  if (!item) return null
  const date = (ms: number | null) => (ms != null ? new Date(ms) : null)
  return {
    id: item.id,
    title: item.title,
    location: item.location,
    trade: item.trade,
    detail: item.detail,
    start: date(item.startMs),
    due: date(item.dueMs) ?? new Date(),
    completedAt: date(item.completedAtMs),
    assignees: item.assignees,
    assigneeUserIds: item.assigneeUserIds,
    company: item.company,
    status: item.status,
    progress: item.progress,
    isCritical: item.isCritical,
    dependsOn: item.dependsOn,
    blockedReason: item.blockedReason,
    reminderDaysBefore: item.reminderDaysBefore,
    originalDue: date(item.originalDueMs),
    history: item.history.map(changeFromDocument),
    contextKind: item.contextKind,
    projectId: item.projectId,
    createdByUserId: item.createdByUserId,
    fileURL: item.fileURL,
    fileName: item.fileName,
    siteAuditId: item.siteAuditId,
    siteAuditTitle: item.siteAuditTitle,
  }
}

/** `deadlinesDocumentId` (rulebook): `deadlines_{projects|smallWorks}_{KEY}`. */
export function deadlinesSettingsDocId(projectId: string, isSmallWorks: boolean): string {
  return deadlinesDocumentId(projectId, isSmallWorks)
}
