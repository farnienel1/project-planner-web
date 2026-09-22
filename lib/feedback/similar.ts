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
  'not',
  'but',
  'add',
  'new',
])

export function suggestionTokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3 && !STOP.has(token))
}

export function similarSuggestions(
  title: string,
  details: string,
  existing: FeedbackSuggestion[],
  limit = 5
): FeedbackSuggestion[] {
  const query = new Set(suggestionTokens(`${title} ${details}`))
  if (query.size === 0) return []
  return existing
    .filter((row) => !row.hidden && !row.mergedIntoId)
    .map((row) => {
      const tokens = suggestionTokens(`${row.title} ${row.details} ${row.category}`)
      const overlap = tokens.filter((token) => query.has(token)).length
      const score = overlap / Math.max(query.size, 1)
      return { row, score, overlap }
    })
    .filter((entry) => entry.overlap >= 2 || entry.score >= 0.34)
    .sort((a, b) => b.score - a.score || b.row.voteCount - a.row.voteCount)
    .slice(0, limit)
    .map((entry) => entry.row)
}

export function voteId(suggestionId: string, userId: string): string {
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
