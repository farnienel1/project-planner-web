export const PRODUCT_EVENT_NAMES = [
  'user_signed_up',
  'user_logged_in',
  'dashboard_viewed',
  'project_created',
  'project_viewed',
  'project_updated',
  'small_work_created',
  'task_created',
  'task_updated',
  'task_completed',
  'task_deleted',
  'schedule_viewed',
  'materials_viewed',
  'health_safety_viewed',
  'report_viewed',
  'timesheet_viewed',
  'idea_submitted',
  'idea_voted',
] as const

export type ProductEventName = (typeof PRODUCT_EVENT_NAMES)[number]

export type ProductEvent = {
  id: string
  userId: string
  organizationId?: string
  sessionId?: string
  eventName: ProductEventName
  metadata?: Record<string, string | number | boolean>
  createdAt: Date
}

export type ProductSession = {
  id: string
  userId: string
  organizationId?: string
  startedAt: Date
  lastActivityAt: Date
  endedAt?: Date
  durationMs?: number
  entryPath?: string
  exitPath?: string
}

export type DateRangePreset =
  | 'today'
  | 'yesterday'
  | 'last_7'
  | 'last_30'
  | 'last_90'
  | 'this_month'
  | 'last_month'
  | 'custom'

export const FEATURE_EVENT_GROUPS: { id: string; label: string; events: ProductEventName[] }[] = [
  { id: 'projects', label: 'Projects', events: ['project_created', 'project_viewed', 'project_updated'] },
  { id: 'small_works', label: 'Small works', events: ['small_work_created'] },
  { id: 'tasks', label: 'Tasks', events: ['task_created', 'task_updated', 'task_completed', 'task_deleted'] },
  { id: 'schedule', label: 'Schedule', events: ['schedule_viewed'] },
  { id: 'materials', label: 'Materials', events: ['materials_viewed'] },
  { id: 'health_safety', label: 'Health & safety', events: ['health_safety_viewed'] },
  { id: 'timesheets', label: 'Timesheets', events: ['timesheet_viewed'] },
  { id: 'reports', label: 'Reports', events: ['report_viewed'] },
  { id: 'dashboard', label: 'Home', events: ['dashboard_viewed'] },
  { id: 'ideas', label: 'Ideas', events: ['idea_submitted', 'idea_voted'] },
]

export function featureForEvent(eventName: ProductEventName): string {
  return FEATURE_EVENT_GROUPS.find((group) => group.events.includes(eventName))?.id || 'other'
}
