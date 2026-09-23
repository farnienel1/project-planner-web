export const PRODUCT_EVENT_NAMES = [
  'user_signed_up',
  'user_logged_in',
  'login',
  'logout',
  'session_started',
  'password_reset_requested',
  'dashboard_viewed',
  'page_viewed',
  'org_created',
  'org_setup_step_completed',
  'org_setup_completed',
  'user_invited',
  'invite_accepted',
  'project_created',
  'project_viewed',
  'project_updated',
  'small_work_created',
  'task_created',
  'task_updated',
  'task_completed',
  'task_deleted',
  'schedule_viewed',
  'schedule_edited',
  'materials_viewed',
  'material_order_created',
  'health_safety_viewed',
  'hs_document_uploaded',
  'rams_signed',
  'report_viewed',
  'report_exported',
  'timesheet_viewed',
  'timesheet_submitted',
  'timesheet_signed',
  'timesheet_approved',
  'warning_issued',
  'annual_leave_requested',
  'invoice_created',
  'payment_run_created',
  'feature_opened',
  'client_error',
  'idea_submitted',
  'idea_voted',
  'idea_vote_removed',
  'idea_comment',
  'idea_followed',
  'idea_viewed',
  'idea_status',
  'idea_merged',
  'idea_official_response',
  'idea_similar_shown',
  'idea_similar_chosen',
  'feedback_board_viewed',
  'feedback_search',
  'feedback_filter_used',
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
  source?: 'web' | 'server'
  appVersion?: string
  path?: string
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
  appVersion?: string
}

export type DateRangePreset =
  | 'today'
  | 'yesterday'
  | 'last_7'
  | 'last_30'
  | 'last_90'
  | 'this_month'
  | 'last_month'
  | 'all_time'
  | 'custom'

export const FEATURE_EVENT_GROUPS: { id: string; label: string; events: ProductEventName[] }[] = [
  { id: 'projects', label: 'Projects', events: ['project_created', 'project_viewed', 'project_updated'] },
  { id: 'small_works', label: 'Small works', events: ['small_work_created'] },
  { id: 'tasks', label: 'Tasks', events: ['task_created', 'task_updated', 'task_completed', 'task_deleted'] },
  { id: 'schedule', label: 'Schedule', events: ['schedule_viewed', 'schedule_edited'] },
  { id: 'materials', label: 'Materials', events: ['materials_viewed', 'material_order_created'] },
  { id: 'health_safety', label: 'Health & safety', events: ['health_safety_viewed', 'hs_document_uploaded', 'rams_signed'] },
  { id: 'timesheets', label: 'Timesheets', events: ['timesheet_viewed', 'timesheet_submitted', 'timesheet_signed', 'timesheet_approved'] },
  { id: 'reports', label: 'Reports', events: ['report_viewed', 'report_exported'] },
  { id: 'dashboard', label: 'Home', events: ['dashboard_viewed', 'page_viewed'] },
  {
    id: 'ideas',
    label: 'Feedback',
    events: [
      'idea_submitted',
      'idea_voted',
      'idea_vote_removed',
      'idea_comment',
      'idea_followed',
      'feedback_board_viewed',
    ],
  },
]

export function featureForEvent(eventName: ProductEventName): string {
  return FEATURE_EVENT_GROUPS.find((group) => group.events.includes(eventName))?.id || 'other'
}

export const METRIC_DEFINITIONS: Record<string, string> = {
  'Active user': 'A user with at least one login, session, or core event in the selected range.',
  DAU: 'Distinct active users in 1 day.',
  WAU: 'Distinct active users in 7 days.',
  MAU: 'Distinct active users in 28 days.',
  Stickiness: 'DAU divided by MAU.',
  'New user': 'A user whose account was created in the selected range.',
  'New org': 'An organisation created in the selected range.',
  'Active org': 'An organisation with at least one active user in the range.',
  'Returning user': 'Active in this range and also active at least once before it.',
  'Projects / tasks created': 'project_created / task_created events recorded in the range. Historic jobs are not invented.',
}
