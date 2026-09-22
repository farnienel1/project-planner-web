import { canonicalToken } from '@/lib/feedback/synonyms'
import type { FeedbackSuggestion } from '@/lib/feedback/types'

const STOP = new Set([
  'the',
  'and',
  'for',
  'with',
  'from',
  'that',
  'this',
  'have',
  'has',
  'are',
  'was',
  'were',
  'into',
  'onto',
  'able',
  'just',
  'like',
  'want',
  'need',
  'please',
  'could',
  'would',
  'should',
  'make',
  'made',
  'more',
  'than',
  'then',
  'them',
  'they',
  'your',
  'our',
  'can',
  'cant',
  'not',
  'but',
  'add',
  'new',
  'hard',
  'well',
  'onto',
])

function stem(token: string): string {
  if (token.length <= 4) return token
  if (token.endsWith('ing')) return token.slice(0, -3)
  if (token.endsWith('ies')) return `${token.slice(0, -3)}y`
  if (token.endsWith('es') && token.length > 5) return token.slice(0, -2)
  if (token.endsWith('s') && !token.endsWith('ss')) return token.slice(0, -1)
  if (token.endsWith('ed') && token.length > 5) return token.slice(0, -2)
  return token
}

export function suggestionTokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3 && !STOP.has(token))
    .map((token) => canonicalToken(stem(token)))
}

export function characterTrigrams(text: string): Set<string> {
  const compact = suggestionTokens(text).join('')
  const grams = new Set<string>()
  if (compact.length < 3) {
    if (compact) grams.add(compact)
    return grams
  }
  for (let i = 0; i <= compact.length - 3; i += 1) grams.add(compact.slice(i, i + 3))
  return grams
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0
  let overlap = 0
  for (const item of a) if (b.has(item)) overlap += 1
  return overlap / (a.size + b.size - overlap)
}

export function similarScore(queryText: string, candidateText: string): number {
  const queryTokens = new Set(suggestionTokens(queryText))
  const candidateTokens = new Set(suggestionTokens(candidateText))
  const tokenScore = jaccard(queryTokens, candidateTokens)
  const trigramScore = jaccard(characterTrigrams(queryText), characterTrigrams(candidateText))
  return 0.6 * tokenScore + 0.4 * trigramScore
}

export type ScoredSuggestion = { row: FeedbackSuggestion; score: number }

export function similarSuggestions(
  title: string,
  details: string,
  existing: FeedbackSuggestion[],
  limit = 5,
  threshold = 0.3
): FeedbackSuggestion[] {
  return similarSuggestionsScored(title, details, existing, limit, threshold).map((entry) => entry.row)
}

export function similarSuggestionsScored(
  title: string,
  details: string,
  existing: FeedbackSuggestion[],
  limit = 5,
  threshold = 0.3
): ScoredSuggestion[] {
  const query = `${title} ${details}`.trim()
  if (query.length < 6) return []
  return existing
    .filter((row) => !row.hidden && !row.mergedIntoId)
    .map((row) => ({
      row,
      score: similarScore(query, `${row.title} ${row.details} ${row.category}`),
    }))
    .filter((entry) => entry.score >= threshold)
    .sort((a, b) => b.score - a.score || b.row.voteCount - a.row.voteCount)
    .slice(0, limit)
}

export function voteId(suggestionId: string, userId: string): string {
  return `${suggestionId}_${userId}`
}

export function followId(suggestionId: string, userId: string): string {
  return `${suggestionId}_${userId}`
}

export function consolidateVotesOnMerge(
  destinationVotes: { userId: string }[],
  sourceVotes: { userId: string }[]
): { keepUserIds: string[]; duplicateUserIds: string[] } {
  const existing = new Set(destinationVotes.map((vote) => vote.userId))
  const keepUserIds: string[] = []
  const duplicateUserIds: string[] = []
  for (const vote of sourceVotes) {
    if (existing.has(vote.userId)) duplicateUserIds.push(vote.userId)
    else {
      keepUserIds.push(vote.userId)
      existing.add(vote.userId)
    }
  }
  return { keepUserIds, duplicateUserIds }
}

export function mergePreviewCounts(
  destinationVotes: { userId: string }[],
  sourceVotes: { userId: string }[]
): { source: number; destination: number; overlap: number; mergedTotal: number } {
  const { keepUserIds, duplicateUserIds } = consolidateVotesOnMerge(destinationVotes, sourceVotes)
  const destination = new Set(destinationVotes.map((vote) => vote.userId)).size
  const source = new Set(sourceVotes.map((vote) => vote.userId)).size
  return {
    source,
    destination,
    overlap: duplicateUserIds.length,
    mergedTotal: destination + keepUserIds.length,
  }
}
