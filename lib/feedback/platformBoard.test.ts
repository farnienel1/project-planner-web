import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  applyAdminOverlay,
  applyOverlaysFromDocs,
  emptyBoard,
  mergeIdeaBoards,
  parseUserIdeaBoard,
  recountBoard,
} from './platformBoard.ts'
import type { FeedbackSuggestion } from './types.ts'

function idea(id: string, extra: Partial<FeedbackSuggestion> = {}): FeedbackSuggestion {
  return {
    id,
    title: extra.title || id,
    details: extra.details || '',
    category: extra.category || 'Other',
    relatedFeature: extra.relatedFeature || 'dashboard',
    authorUserId: extra.authorUserId || 'u1',
    authorName: extra.authorName || 'Ada',
    organizationId: extra.organizationId || 'org-1',
    organizationName: extra.organizationName || 'Acme',
    voteCount: extra.voteCount ?? 1,
    commentCount: extra.commentCount ?? 0,
    publicStatus: extra.publicStatus || 'under_review',
    productDecision: extra.productDecision || 'none',
    pinned: extra.pinned === true,
    hidden: extra.hidden === true,
    mergedIntoId: extra.mergedIntoId,
    createdAt: extra.createdAt || new Date('2026-09-01T00:00:00Z'),
    updatedAt: extra.updatedAt || new Date('2026-09-01T00:00:00Z'),
  }
}

test('user document board round-trips ideas, votes and comments', () => {
  const parsed = parseUserIdeaBoard('u1', {
    ppIdeas: {
      'idea-1': {
        title: 'Dark mode',
        details: 'For night shifts',
        category: 'Mobile',
        authorUserId: 'u1',
        authorName: 'Ada',
        organizationId: 'org-1',
        organizationName: 'Acme',
        voteCount: 1,
        createdAt: new Date('2026-09-20T00:00:00Z'),
      },
    },
    ppIdeaVotes: {
      'idea-1': { suggestionId: 'idea-1', userId: 'u1', createdAt: new Date('2026-09-20T00:00:00Z') },
    },
    ppIdeaComments: {
      c1: { suggestionId: 'idea-1', authorUserId: 'u2', authorName: 'Bo', body: 'Yes', createdAt: new Date() },
    },
  })
  assert.equal(parsed.suggestions[0].title, 'Dark mode')
  assert.equal(parsed.suggestions[0].organizationName, 'Acme')
  assert.equal(parsed.votes.length, 1)
  assert.equal(parsed.comments[0].body, 'Yes')
  assert.equal(parsed.suggestions[0].commentCount, 1)
})

test('owner overlay can hide and move an idea without rewriting the author document', () => {
  const row = applyAdminOverlay(idea('idea-1'), { hidden: true, productDecision: 'build', publicStatus: 'planned' })
  assert.equal(row.hidden, true)
  assert.equal(row.productDecision, 'build')
  assert.equal(row.publicStatus, 'planned')
  assert.equal(row.title, 'idea-1')
})

test('merge prefers live votes over a stale stored count, including unvotes', () => {
  const counted = recountBoard({
    suggestions: [idea('a', { voteCount: 9 })],
    votes: [
      { id: 'a_u1', suggestionId: 'a', userId: 'u1', createdAt: new Date() },
      { id: 'a_u2', suggestionId: 'a', userId: 'u2', createdAt: new Date() },
    ],
    comments: [],
  })
  assert.equal(counted[0].voteCount, 2)
})

test('two user documents combine into one shared board', () => {
  const author = parseUserIdeaBoard('u1', {
    ppIdeas: { a: { title: 'Export RAMS', authorUserId: 'u1', organizationId: 'org-a', organizationName: 'A Ltd' } },
    ppIdeaVotes: { a: true },
  })
  const voter = parseUserIdeaBoard('u2', {
    ppIdeaVotes: { a: true },
    ppIdeaAdmin: { a: { productDecision: 'investigate', publicStatus: 'under_review' } },
  })
  const merged = applyOverlaysFromDocs(mergeIdeaBoards(author, voter), {
    a: { productDecision: 'investigate', publicStatus: 'under_review' },
  })
  assert.equal(merged.suggestions.length, 1)
  assert.equal(merged.suggestions[0].title, 'Export RAMS')
  assert.equal(merged.votes.length, 2)
  assert.equal(merged.suggestions[0].productDecision, 'investigate')
})

test('empty board helper is safe to render', () => {
  const board = emptyBoard()
  assert.deepEqual(board.suggestions, [])
  assert.deepEqual(board.votes, [])
})
