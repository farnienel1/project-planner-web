export const FEEDBACK_CATEGORIES = [
  'Projects',
  'Small works',
  'Scheduling',
  'Tasks',
  'Materials',
  'Health & safety',
  'Timesheets',
  'Reports',
  'Users',
  'Mobile',
  'Other',
] as const

export type FeedbackCategory = (typeof FEEDBACK_CATEGORIES)[number]

export const FEEDBACK_PUBLIC_STATUSES = [
  'under_review',
  'planned',
  'in_progress',
  'released',
  'not_planned',
] as const

export type FeedbackPublicStatus = (typeof FEEDBACK_PUBLIC_STATUSES)[number]

export const PRODUCT_DECISIONS = ['none', 'investigate', 'build', 'in_progress', 'released', 'decline'] as const
export type ProductDecision = (typeof PRODUCT_DECISIONS)[number]

/** One status model for customers, owner console, and roadmap. */
export const FEEDBACK_STATUSES = [
  'new',
  'under_review',
  'planned',
  'in_progress',
  'shipped',
  'not_planned',
  'merged',
] as const
export type FeedbackStatus = (typeof FEEDBACK_STATUSES)[number]

export const RELATED_FEATURES = [
  'projects',
  'small_works',
  'schedule',
  'tasks',
  'materials',
  'health_safety',
  'timesheets',
  'reports',
  'users',
  'dashboard',
  'ideas',
] as const

export type RelatedFeature = (typeof RELATED_FEATURES)[number]

export const CATEGORY_FEATURE: Record<FeedbackCategory, RelatedFeature> = {
  Projects: 'projects',
  'Small works': 'small_works',
  Scheduling: 'schedule',
  Tasks: 'tasks',
  Materials: 'materials',
  'Health & safety': 'health_safety',
  Timesheets: 'timesheets',
  Reports: 'reports',
  Users: 'users',
  Mobile: 'dashboard',
  Other: 'dashboard',
}

export type FeedbackImportance = 'nice' | 'important' | 'blocking'

export type FeedbackSuggestion = {
  id: string
  title: string
  details: string
  category: FeedbackCategory
  relatedFeature: RelatedFeature
  authorUserId: string
  authorName: string
  authorRole?: string
  organizationId: string
  organizationName?: string
  showCompanyName?: boolean
  voteCount: number
  commentCount: number
  publicStatus: FeedbackPublicStatus
  productDecision: ProductDecision
  status?: FeedbackStatus
  officialResponse?: string
  releaseNote?: string
  effort?: 'S' | 'M' | 'L' | 'XL'
  pinned: boolean
  hidden: boolean
  mergedIntoId?: string
  createdAt: Date
  updatedAt: Date
  reviewedAt?: Date
  reviewedByUserId?: string
  shippedAt?: Date
  followerCount?: number
  orgCount?: number
  trendingScore?: number
}

export type FeedbackVote = {
  id: string
  suggestionId: string
  userId: string
  createdAt: Date
  importance?: FeedbackImportance
  organizationId?: string
}

export type FeedbackComment = {
  id: string
  suggestionId: string
  authorUserId: string
  authorName: string
  body: string
  createdAt: Date
  editedAt?: Date
  deleted?: boolean
  isOfficial?: boolean
}

export type FeedbackInternalNotes = {
  notes: string
  updatedAt: Date
  updatedByUserId: string
}

export type FeedbackHistoryEntry = {
  id: string
  suggestionId: string
  actorUserId: string
  actorName: string
  field: string
  fromValue: string
  toValue: string
  reason?: string
  createdAt: Date
}

export const PUBLIC_STATUS_LABEL: Record<FeedbackPublicStatus, string> = {
  under_review: 'Under Review',
  planned: 'Planned',
  in_progress: 'In Progress',
  released: 'Released',
  not_planned: 'Not Planned',
}

export const PUBLIC_STATUS_COPY: Record<FeedbackPublicStatus, string> = {
  under_review: "We're looking into this.",
  planned: "We're planning to build this.",
  in_progress: "We're currently working on this.",
  released: 'This is now available.',
  not_planned: "We're not currently planning to build this.",
}

export const DECISION_LABEL: Record<ProductDecision, string> = {
  none: 'Awaiting review',
  investigate: 'Investigate',
  build: 'Build',
  in_progress: 'In progress',
  released: 'Released',
  decline: 'Decline',
}

export const DECISION_HUE: Record<ProductDecision, string> = {
  none: 'lib',
  investigate: 'warn',
  build: 'hs',
  in_progress: 'blue',
  released: 'user',
  decline: 'red',
}

export function defaultPublicStatusForDecision(decision: ProductDecision): FeedbackPublicStatus {
  switch (decision) {
    case 'build':
      return 'planned'
    case 'in_progress':
      return 'in_progress'
    case 'released':
      return 'released'
    case 'decline':
      return 'not_planned'
    case 'investigate':
    case 'none':
    default:
      return 'under_review'
  }
}

export const CUSTOMER_STATUS_LABEL: Record<FeedbackStatus, string> = {
  new: 'Under review',
  under_review: 'Under review',
  planned: 'Planned',
  in_progress: 'In progress',
  shipped: 'Shipped',
  not_planned: 'Not planned',
  merged: 'Merged',
}

export const CONSOLE_STATUS_LABEL: Record<FeedbackStatus, string> = {
  new: 'Needs review',
  under_review: 'Investigating',
  planned: 'Planned',
  in_progress: 'Building',
  shipped: 'Released',
  not_planned: 'Declined',
  merged: 'Merged',
}

export const CUSTOMER_STATUS_COPY: Record<FeedbackStatus, string> = {
  new: "We're looking into this.",
  under_review: "We're looking into this.",
  planned: "We're planning to build this.",
  in_progress: "We're currently working on this.",
  shipped: 'This is now available.',
  not_planned: "We're not currently planning to build this.",
  merged: 'This was merged into another idea.',
}

export const STATUS_HUE: Record<FeedbackStatus, string> = {
  new: 'warn',
  under_review: 'warn',
  planned: 'hs',
  in_progress: 'blue',
  shipped: 'user',
  not_planned: 'lib',
  merged: 'lib',
}

export function unifiedStatus(
  row: Pick<FeedbackSuggestion, 'publicStatus' | 'productDecision' | 'mergedIntoId' | 'status'>
): FeedbackStatus {
  if (row.mergedIntoId) return 'merged'
  if (row.status && (FEEDBACK_STATUSES as readonly string[]).includes(row.status)) return row.status
  if (row.productDecision === 'released' || row.publicStatus === 'released') return 'shipped'
  if (row.productDecision === 'decline' || row.publicStatus === 'not_planned') return 'not_planned'
  if (row.productDecision === 'in_progress' || row.publicStatus === 'in_progress') return 'in_progress'
  if (row.productDecision === 'build' || row.publicStatus === 'planned') return 'planned'
  if (row.productDecision === 'investigate') return 'under_review'
  if (row.productDecision === 'none') return 'new'
  return 'under_review'
}

export function decisionFromStatus(status: FeedbackStatus): ProductDecision {
  switch (status) {
    case 'under_review':
      return 'investigate'
    case 'planned':
      return 'build'
    case 'in_progress':
      return 'in_progress'
    case 'shipped':
      return 'released'
    case 'not_planned':
      return 'decline'
    case 'new':
    case 'merged':
    default:
      return 'none'
  }
}

export function publicStatusFromUnified(status: FeedbackStatus): FeedbackPublicStatus {
  switch (status) {
    case 'planned':
      return 'planned'
    case 'in_progress':
      return 'in_progress'
    case 'shipped':
      return 'released'
    case 'not_planned':
      return 'not_planned'
    default:
      return 'under_review'
  }
}

export function roleLabel(role?: string): string {
  const value = (role || '').trim().toLowerCase()
  if (value === 'admin' || value === 'superadmin' || value === 'super_admin') return 'an admin'
  if (value === 'manager') return 'a site manager'
  if (value === 'operative') return 'an operative'
  if (value === 'viewer') return 'a viewer'
  return 'a customer'
}

export function validateIdeaTitle(title: string, categories: readonly string[] = FEEDBACK_CATEGORIES): string | null {
  const value = title.trim()
  if (value.length < 8) return 'Title needs at least 8 characters.'
  if (value.length > 90) return 'Title must be 90 characters or fewer.'
  if (categories.some((item) => item.toLowerCase() === value.toLowerCase())) {
    return 'Use a specific title, not just the category name.'
  }
  return null
}

export function validateIdeaDetails(details: string): string | null {
  const value = details.trim()
  if (value.length < 20) return 'Describe the problem in at least 20 characters.'
  if (value.length > 2000) return 'Details must be 2000 characters or fewer.'
  return null
}

export function suggestCategoryFromText(text: string): FeedbackCategory {
  const haystack = text.toLowerCase()
  const rules: Array<[FeedbackCategory, string[]]> = [
    ['Scheduling', ['schedule', 'rota', 'planner', 'calendar', 'diary', 'booking']],
    ['Timesheets', ['timesheet', 'hours', 'clock']],
    ['Health & safety', ['rams', 'toolbox', 'tbt', 'safety', 'h&s']],
    ['Reports', ['report', 'export', 'excel', 'spreadsheet', 'csv']],
    ['Materials', ['material', 'order', 'delivery', 'wholesaler']],
    ['Tasks', ['task', 'todo', 'to-do']],
    ['Small works', ['small work', 'smallworks']],
    ['Users', ['user', 'invite', 'permission', 'role']],
    ['Mobile', ['mobile', 'iphone', 'android', 'app']],
    ['Projects', ['project', 'job']],
  ]
  for (const [category, needles] of rules) {
    if (needles.some((needle) => haystack.includes(needle))) return category
  }
  return 'Other'
}
