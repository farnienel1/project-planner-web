import { Timestamp } from 'firebase/firestore'
import { omitUndefinedDeep } from '@/lib/ios-parity/firestoreCodec'
import { parseFirestoreDate } from '@/lib/firebase/firestoreUtils'
import {
  FEEDBACK_CATEGORIES,
  FEEDBACK_STATUSES,
  type FeedbackCategory,
  type FeedbackComment,
  type FeedbackHistoryEntry,
  type FeedbackInternalNotes,
  type FeedbackPublicStatus,
  type FeedbackStatus,
  type FeedbackSuggestion,
  type FeedbackVote,
  type ProductDecision,
  type RelatedFeature,
  unifiedStatus,
} from '@/lib/feedback/types'

function asCategory(value: unknown): FeedbackCategory {
  return FEEDBACK_CATEGORIES.includes(value as FeedbackCategory) ? (value as FeedbackCategory) : 'Other'
}

function asStatus(value: unknown): FeedbackPublicStatus {
  const allowed: FeedbackPublicStatus[] = ['under_review', 'planned', 'in_progress', 'released', 'not_planned']
  return allowed.includes(value as FeedbackPublicStatus) ? (value as FeedbackPublicStatus) : 'under_review'
}

function asDecision(value: unknown): ProductDecision {
  const allowed: ProductDecision[] = ['none', 'investigate', 'build', 'in_progress', 'released', 'decline']
  return allowed.includes(value as ProductDecision) ? (value as ProductDecision) : 'none'
}

function asFeature(value: unknown): RelatedFeature {
  const allowed: RelatedFeature[] = [
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
  ]
  return allowed.includes(value as RelatedFeature) ? (value as RelatedFeature) : 'dashboard'
}

function asUnifiedStatus(value: unknown): FeedbackStatus | undefined {
  return FEEDBACK_STATUSES.includes(value as FeedbackStatus) ? (value as FeedbackStatus) : undefined
}

export function parseSuggestion(id: string, data: Record<string, unknown>): FeedbackSuggestion {
  const row: FeedbackSuggestion = {
    id,
    title: typeof data.title === 'string' ? data.title : '',
    details: typeof data.details === 'string' ? data.details : '',
    category: asCategory(data.category ?? data.categoryId),
    relatedFeature: asFeature(data.relatedFeature),
    authorUserId: typeof data.authorUserId === 'string' ? data.authorUserId : typeof data.authorId === 'string' ? data.authorId : '',
    authorName: typeof data.authorName === 'string' ? data.authorName : 'Customer',
    authorRole: typeof data.authorRole === 'string' ? data.authorRole : undefined,
    organizationId: typeof data.organizationId === 'string' ? data.organizationId : typeof data.authorOrgId === 'string' ? data.authorOrgId : '',
    organizationName: typeof data.organizationName === 'string' ? data.organizationName : undefined,
    showCompanyName: data.showCompanyName === true,
    voteCount: typeof data.voteCount === 'number' ? data.voteCount : 0,
    commentCount: typeof data.commentCount === 'number' ? data.commentCount : 0,
    publicStatus: asStatus(data.publicStatus),
    productDecision: asDecision(data.productDecision),
    status: asUnifiedStatus(data.status),
    officialResponse: typeof data.officialResponse === 'string' ? data.officialResponse : undefined,
    releaseNote: typeof data.releaseNote === 'string' ? data.releaseNote : undefined,
    effort: data.effort === 'S' || data.effort === 'M' || data.effort === 'L' || data.effort === 'XL' ? data.effort : undefined,
    pinned: data.pinned === true,
    hidden: data.hidden === true || data.deleted === true,
    mergedIntoId: typeof data.mergedIntoId === 'string' ? data.mergedIntoId : undefined,
    createdAt: parseFirestoreDate(data.createdAt) || new Date(),
    updatedAt: parseFirestoreDate(data.updatedAt) || new Date(),
    reviewedAt: parseFirestoreDate(data.reviewedAt),
    reviewedByUserId: typeof data.reviewedByUserId === 'string' ? data.reviewedByUserId : undefined,
    shippedAt: parseFirestoreDate(data.shippedAt),
    followerCount: typeof data.followerCount === 'number' ? data.followerCount : undefined,
    orgCount: typeof data.orgCount === 'number' ? data.orgCount : undefined,
    trendingScore: typeof data.trendingScore === 'number' ? data.trendingScore : undefined,
  }
  row.status = unifiedStatus(row)
  row.publicStatus =
    row.status === 'shipped'
      ? 'released'
      : row.status === 'not_planned'
        ? 'not_planned'
        : row.status === 'planned'
          ? 'planned'
          : row.status === 'in_progress'
            ? 'in_progress'
            : 'under_review'
  return row
}

export function serializeSuggestion(row: FeedbackSuggestion): Record<string, unknown> {
  const status = unifiedStatus(row)
  return omitUndefinedDeep({
    title: row.title,
    details: row.details,
    category: row.category,
    relatedFeature: row.relatedFeature,
    authorUserId: row.authorUserId,
    authorName: row.authorName,
    authorRole: row.authorRole || '',
    organizationId: row.organizationId,
    organizationName: row.organizationName || '',
    showCompanyName: row.showCompanyName === true,
    voteCount: row.voteCount,
    commentCount: row.commentCount,
    publicStatus: row.publicStatus,
    productDecision: row.productDecision,
    status,
    officialResponse: row.officialResponse || '',
    releaseNote: row.releaseNote || '',
    effort: row.effort || '',
    pinned: row.pinned,
    hidden: row.hidden,
    mergedIntoId: row.mergedIntoId || '',
    createdAt: Timestamp.fromDate(row.createdAt),
    updatedAt: Timestamp.fromDate(row.updatedAt),
    reviewedAt: row.reviewedAt ? Timestamp.fromDate(row.reviewedAt) : undefined,
    reviewedByUserId: row.reviewedByUserId || '',
    shippedAt: row.shippedAt ? Timestamp.fromDate(row.shippedAt) : undefined,
    followerCount: row.followerCount || 0,
    orgCount: row.orgCount || 0,
    trendingScore: row.trendingScore || 0,
  })
}

export function parseVote(id: string, data: Record<string, unknown>): FeedbackVote {
  const importance =
    data.importance === 'nice' || data.importance === 'important' || data.importance === 'blocking'
      ? data.importance
      : undefined
  return {
    id,
    suggestionId: typeof data.suggestionId === 'string' ? data.suggestionId : typeof data.ideaId === 'string' ? data.ideaId : '',
    userId: typeof data.userId === 'string' ? data.userId : '',
    createdAt: parseFirestoreDate(data.createdAt) || new Date(),
    importance,
    organizationId: typeof data.organizationId === 'string' ? data.organizationId : undefined,
  }
}

export function parseComment(id: string, data: Record<string, unknown>): FeedbackComment {
  return {
    id,
    suggestionId: typeof data.suggestionId === 'string' ? data.suggestionId : typeof data.ideaId === 'string' ? data.ideaId : '',
    authorUserId: typeof data.authorUserId === 'string' ? data.authorUserId : typeof data.authorId === 'string' ? data.authorId : '',
    authorName: typeof data.authorName === 'string' ? data.authorName : 'Customer',
    body: data.deleted === true ? '' : typeof data.body === 'string' ? data.body : '',
    createdAt: parseFirestoreDate(data.createdAt) || new Date(),
    editedAt: parseFirestoreDate(data.editedAt),
    deleted: data.deleted === true,
    isOfficial: data.isOfficial === true,
  }
}

export function parseHistory(id: string, data: Record<string, unknown>): FeedbackHistoryEntry {
  return {
    id,
    suggestionId: typeof data.suggestionId === 'string' ? data.suggestionId : '',
    actorUserId: typeof data.actorUserId === 'string' ? data.actorUserId : '',
    actorName: typeof data.actorName === 'string' ? data.actorName : 'Developer',
    field: typeof data.field === 'string' ? data.field : '',
    fromValue: typeof data.fromValue === 'string' ? data.fromValue : '',
    toValue: typeof data.toValue === 'string' ? data.toValue : '',
    reason: typeof data.reason === 'string' ? data.reason : undefined,
    createdAt: parseFirestoreDate(data.createdAt) || new Date(),
  }
}

export function parseInternalNotes(data: Record<string, unknown>): FeedbackInternalNotes {
  return {
    notes: typeof data.notes === 'string' ? data.notes : '',
    updatedAt: parseFirestoreDate(data.updatedAt) || new Date(),
    updatedByUserId: typeof data.updatedByUserId === 'string' ? data.updatedByUserId : '',
  }
}

export function publicSuggestion(row: FeedbackSuggestion): Omit<FeedbackSuggestion, never> {
  return row
}

export function trendingScore(row: FeedbackSuggestion, votes: FeedbackVote[], now = new Date()): number {
  if (typeof row.trendingScore === 'number' && row.trendingScore > 0 && votes.length === 0) return row.trendingScore
  const windowMs = 14 * 86_400_000
  let score = 0
  for (const vote of votes) {
    if (vote.suggestionId !== row.id) continue
    const ageHours = Math.max(0, (now.getTime() - vote.createdAt.getTime()) / 3_600_000)
    if (now.getTime() - vote.createdAt.getTime() > windowMs) continue
    const weight = 1 + (vote.importance === 'blocking' ? 0.5 : 0)
    score += weight * 0.5 ** (ageHours / 72)
  }
  if (score === 0) {
    const ageHours = Math.max(0, (now.getTime() - row.createdAt.getTime()) / 3_600_000)
    return row.voteCount * 0.5 ** (ageHours / 72) + 0.5 * row.commentCount * 0.5 ** (ageHours / 72)
  }
  return score
}
