/**
 * iOS parity source: FirebaseBackend.swift deadlineMap / parseDeadline (~L8486).
 * Empty strings are written as "". Optional dates and reminderDaysBefore are null.
 */

import { Timestamp } from 'firebase/firestore'
import { asUppercaseUuid, isUuidString } from '@/lib/ios-parity/uuid'
import { parseFirestoreDate, parseNumber, parseString } from '@/lib/firebase/firestoreUtils'
import type { Deadline, DeadlineChange, DeadlineChangeKind, DeadlineStatus } from '@/lib/deadlines/types'
import { DEADLINE_STATUSES } from '@/lib/deadlines/types'

function emptyToNull(value: string): string | null {
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function statusOf(value: string): DeadlineStatus {
  return (DEADLINE_STATUSES as readonly string[]).includes(value) ? (value as DeadlineStatus) : 'notStarted'
}

function dateOrNull(value: unknown): Date | null {
  return parseFirestoreDate(value) ?? null
}

export function serializeDeadlineChange(change: DeadlineChange): Record<string, unknown> {
  const map: Record<string, unknown> = {
    id: asUppercaseUuid(change.id),
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

export function parseDeadlineChange(map: Record<string, unknown>): DeadlineChange | null {
  const id = parseString(map.id)
  if (!isUuidString(id)) return null
  const at = dateOrNull(map.at) ?? new Date()
  const author = parseString(map.author)
  const type = parseString(map.type, 'note')
  let kind: DeadlineChangeKind
  switch (type) {
    case 'created':
      kind = { type: 'created', due: dateOrNull(map.due) ?? at }
      break
    case 'rescheduled':
      kind = {
        type: 'rescheduled',
        from: dateOrNull(map.from) ?? at,
        to: dateOrNull(map.to) ?? at,
        reason: parseString(map.reason),
      }
      break
    case 'progress':
      kind = { type: 'progress', progress: Math.round(parseNumber(map.progress) ?? 0) }
      break
    case 'status':
      kind = { type: 'status', status: statusOf(parseString(map.status)) }
      break
    case 'completed':
      kind = { type: 'completed', completedOn: dateOrNull(map.completedOn) ?? at }
      break
    case 'assigned':
      kind = { type: 'assigned', assignedTo: parseString(map.assignedTo) }
      break
    case 'fileAttached':
      kind = { type: 'fileAttached', name: parseString(map.name, 'File') }
      break
    case 'siteAuditAttached':
      kind = { type: 'siteAuditAttached', name: parseString(map.name, 'Site audit') }
      break
    case 'note':
      kind = { type: 'note', note: parseString(map.note) }
      break
    default:
      kind = { type: 'note', note: type }
  }
  return { id: asUppercaseUuid(id), at, author, kind }
}

export function serializeDeadline(item: Deadline): Record<string, unknown> {
  return {
    id: asUppercaseUuid(item.id),
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
    dependsOn: item.dependsOn.map((id) => asUppercaseUuid(id)),
    blockedReason: item.blockedReason ?? '',
    reminderDaysBefore: item.reminderDaysBefore,
    originalDue: item.originalDue ? Timestamp.fromDate(item.originalDue) : null,
    history: item.history.map(serializeDeadlineChange),
    contextKind: item.contextKind,
    projectId: item.projectId ? asUppercaseUuid(item.projectId) : '',
    createdByUserId: item.createdByUserId,
    fileURL: item.fileURL ?? '',
    fileName: item.fileName ?? '',
    siteAuditId: item.siteAuditId ? asUppercaseUuid(item.siteAuditId) : '',
    siteAuditTitle: item.siteAuditTitle ?? '',
  }
}

export function parseDeadline(map: Record<string, unknown>, fallbackProjectId: string): Deadline | null {
  const id = parseString(map.id)
  if (!isUuidString(id)) return null
  const historyRaw = Array.isArray(map.history) ? map.history : []
  const dependsRaw = Array.isArray(map.dependsOn) ? map.dependsOn : []
  const reminder = parseNumber(map.reminderDaysBefore)
  const projectRaw = parseString(map.projectId)
  return {
    id: asUppercaseUuid(id),
    title: parseString(map.title, 'Untitled deadline'),
    location: emptyToNull(parseString(map.location)),
    trade: emptyToNull(parseString(map.trade)),
    detail: emptyToNull(parseString(map.detail)),
    start: dateOrNull(map.start),
    due: dateOrNull(map.due) ?? new Date(),
    completedAt: dateOrNull(map.completedAt),
    assignees: Array.isArray(map.assignees) ? map.assignees.filter((row): row is string => typeof row === 'string') : [],
    assigneeUserIds: Array.isArray(map.assigneeUserIds)
      ? map.assigneeUserIds.filter((row): row is string => typeof row === 'string')
      : [],
    company: emptyToNull(parseString(map.company)),
    status: statusOf(parseString(map.status)),
    progress: parseNumber(map.progress) ?? 0,
    isCritical: map.isCritical === true,
    dependsOn: dependsRaw.filter((row): row is string => typeof row === 'string' && isUuidString(row)).map(asUppercaseUuid),
    blockedReason: emptyToNull(parseString(map.blockedReason)),
    reminderDaysBefore: reminder == null ? null : Math.round(reminder),
    originalDue: dateOrNull(map.originalDue),
    history: historyRaw
      .map((row) => (row && typeof row === 'object' ? parseDeadlineChange(row as Record<string, unknown>) : null))
      .filter((row): row is DeadlineChange => row !== null),
    contextKind: parseString(map.contextKind, 'Project'),
    projectId: isUuidString(projectRaw) ? asUppercaseUuid(projectRaw) : asUppercaseUuid(fallbackProjectId),
    createdByUserId: parseString(map.createdByUserId),
    fileURL: emptyToNull(parseString(map.fileURL)),
    fileName: emptyToNull(parseString(map.fileName)),
    siteAuditId: isUuidString(parseString(map.siteAuditId)) ? asUppercaseUuid(parseString(map.siteAuditId)) : null,
    siteAuditTitle: emptyToNull(parseString(map.siteAuditTitle)),
  }
}

export function deadlinesSettingsDocId(projectId: string, isSmallWorks: boolean): string {
  const collection = isSmallWorks ? 'smallWorks' : 'projects'
  return `deadlines_${collection}_${asUppercaseUuid(projectId)}`
}
