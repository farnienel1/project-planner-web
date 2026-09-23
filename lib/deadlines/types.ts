/**
 * iOS parity source: Views/DLModels.swift
 * Spec: docs/ios-parity/01-data-model.md settings/deadlines_*
 */

export const DEADLINE_STATUSES = ['notStarted', 'inProgress', 'blocked', 'complete'] as const
export type DeadlineStatus = (typeof DEADLINE_STATUSES)[number]

export const DEADLINE_TRADE_OPTIONS = [
  'General',
  'Electrical',
  'Mechanical',
  'Plumbing & Gas',
  'Groundworks',
  'Scaffolding',
  'Brick & Block',
  'Joinery',
  'Drylining',
  'Painting',
  'Roofing',
  'Demolition',
  'Steel Fixing',
  'Plant',
] as const

export const DEADLINE_LOCATION_PRESETS = [
  'Ground Floor',
  '1st Floor',
  '2nd Floor',
  '3rd Floor',
  '4th Floor',
  '5th Floor',
  '6th Floor',
  '7th Floor',
  '8th Floor',
  'Roof',
  'Risers',
  'External',
  'Basement',
] as const

export const DEADLINE_RESCHEDULE_REASONS = [
  'Materials',
  'Preceding trade',
  'Access',
  'Weather',
  'Labour',
  'Client change',
  'Design change',
  'Inspection',
] as const

export type DeadlineGrouping = 'date' | 'location' | 'trade' | 'assignee'
export type DeadlineFilter = 'all' | 'overdue' | 'thisWeek' | 'atRisk' | 'complete'

export type DeadlineChangeKind =
  | { type: 'created'; due: Date }
  | { type: 'rescheduled'; from: Date; to: Date; reason: string }
  | { type: 'progress'; progress: number }
  | { type: 'status'; status: DeadlineStatus }
  | { type: 'note'; note: string }
  | { type: 'completed'; completedOn: Date }
  | { type: 'assigned'; assignedTo: string }
  | { type: 'fileAttached'; name: string }
  | { type: 'siteAuditAttached'; name: string }

export type DeadlineChange = {
  id: string
  at: Date
  author: string
  kind: DeadlineChangeKind
}

export type Deadline = {
  id: string
  title: string
  location: string | null
  trade: string | null
  detail: string | null
  start: Date | null
  due: Date
  completedAt: Date | null
  assignees: string[]
  assigneeUserIds: string[]
  company: string | null
  status: DeadlineStatus
  progress: number
  isCritical: boolean
  dependsOn: string[]
  blockedReason: string | null
  reminderDaysBefore: number | null
  originalDue: Date | null
  history: DeadlineChange[]
  contextKind: string
  projectId: string
  createdByUserId: string
  fileURL: string | null
  fileName: string | null
  siteAuditId: string | null
  siteAuditTitle: string | null
}

export type DeadlineUrgency =
  | { kind: 'complete' }
  | { kind: 'blocked' }
  | { kind: 'overdue'; days: number }
  | { kind: 'today' }
  | { kind: 'tomorrow' }
  | { kind: 'soon'; days: number }
  | { kind: 'thisWeek'; days: number }
  | { kind: 'later'; days: number }

export type DeadlineGroup = {
  id: string
  title: string
  items: Deadline[]
  tone: 'red' | 'amber' | 'blue' | 'slate' | 'green' | null
}
