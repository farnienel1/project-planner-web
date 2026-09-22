import { Timestamp } from 'firebase/firestore'
import { omitUndefinedDeep } from '@/lib/ios-parity/firestoreCodec'
import { parseFirestoreDate } from '@/lib/firebase/firestoreUtils'
import {
  FEEDBACK_CATEGORIES,
  type FeedbackCategory,
  type FeedbackComment,
  type FeedbackHistoryEntry,
  type FeedbackInternalNotes,
  type FeedbackPublicStatus,
  type FeedbackSuggestion,
  type FeedbackVote,
  type ProductDecision,
  type RelatedFeature,
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

export function parseSuggestion(id: string, data: Record<string, unknown>): FeedbackSuggestion {
  return {
    id,
    title: typeof data.title === 'string' ? data.title : '',
    details: typeof data.details === 'string' ? data.details : '',
    category: asCategory(data.category),
    relatedFeature: asFeature(data.relatedFeature),
    authorUserId: typeof data.authorUserId === 'string' ? data.authorUserId : '',
    authorName: typeof data.authorName === 'string' ? data.authorName : 'Customer',
    organizationId: typeof data.organizationId === 'string' ? data.organizationId : '',
    voteCount: typeof data.voteCount === 'number' ? data.voteCount : 0,
    commentCount: typeof data.commentCount === 'number' ? data.commentCount : 0,
    publicStatus: asStatus(data.publicStatus),
    productDecision: asDecision(data.productDecision),
    officialResponse: typeof data.officialResponse === 'string' ? data.officialResponse : undefined,
    pinned: data.pinned === true,
    hidden: data.hidden === true,
    mergedIntoId: typeof data.mergedIntoId === 'string' ? data.mergedIntoId : undefined,
    createdAt: parseFirestoreDate(data.createdAt) || new Date(),
    updatedAt: parseFirestoreDate(data.updatedAt) || new Date(),
    reviewedAt: parseFirestoreDate(data.reviewedAt),
    reviewedByUserId: typeof data.reviewedByUserId === 'string' ? data.reviewedByUserId : undefined,
  }
}

export function serializeSuggestion(row: FeedbackSuggestion): Record<string, unknown> {
  return omitUndefinedDeep({
    title: row.title,
    details: row.details,
    category: row.category,
    relatedFeature: row.relatedFeature,
    authorUserId: row.authorUserId,
    authorName: row.authorName,
    organizationId: row.organizationId,
    voteCount: row.voteCount,
    commentCount: row.commentCount,
    publicStatus: row.publicStatus,
    productDecision: row.productDecision,
    officialResponse: row.officialResponse || '',
    pinned: row.pinned,
    hidden: row.hidden,
    mergedIntoId: row.mergedIntoId || '',
    createdAt: Timestamp.fromDate(row.createdAt),
    updatedAt: Timestamp.fromDate(row.updatedAt),
    reviewedAt: row.reviewedAt ? Timestamp.fromDate(row.reviewedAt) : undefined,
    reviewedByUserId: row.reviewedByUserId || '',
  })
}

export function parseVote(id: string, data: Record<string, unknown>): FeedbackVote {
  return {
    id,
    suggestionId: typeof data.suggestionId === 'string' ? data.suggestionId : '',
    userId: typeof data.userId === 'string' ? data.userId : '',
    createdAt: parseFirestoreDate(data.createdAt) || new Date(),
  }
}

export function parseComment(id: string, data: Record<string, unknown>): FeedbackComment {
  return {
    id,
    suggestionId: typeof data.suggestionId === 'string' ? data.suggestionId : '',
    authorUserId: typeof data.authorUserId === 'string' ? data.authorUserId : '',
    authorName: typeof data.authorName === 'string' ? data.authorName : 'Customer',
    body: typeof data.body === 'string' ? data.body : '',
    createdAt: parseFirestoreDate(data.createdAt) || new Date(),
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
  const recent = votes.filter(
    (vote) => vote.suggestionId === row.id && now.getTime() - vote.createdAt.getTime() <= 14 * 86_400_000
  ).length
  return recent * 4 + row.voteCount + row.commentCount
}
