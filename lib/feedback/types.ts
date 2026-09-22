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

export type FeedbackSuggestion = {
  id: string
  title: string
  details: string
  category: FeedbackCategory
  relatedFeature: RelatedFeature
  authorUserId: string
  authorName: string
  organizationId: string
  voteCount: number
  commentCount: number
  publicStatus: FeedbackPublicStatus
  productDecision: ProductDecision
  officialResponse?: string
  pinned: boolean
  hidden: boolean
  mergedIntoId?: string
  createdAt: Date
  updatedAt: Date
  reviewedAt?: Date
  reviewedByUserId?: string
}

export type FeedbackVote = {
  id: string
  suggestionId: string
  userId: string
  createdAt: Date
}

export type FeedbackComment = {
  id: string
  suggestionId: string
  authorUserId: string
  authorName: string
  body: string
  createdAt: Date
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
