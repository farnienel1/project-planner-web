import { test } from 'node:test'
import assert from 'node:assert/strict'
import { consolidateVotesOnMerge, similarSuggestions, suggestionTokens } from './similar.ts'
import { defaultPublicStatusForDecision } from './types.ts'
import type { FeedbackSuggestion } from './types.ts'

function suggestion(partial: Partial<FeedbackSuggestion> & { id: string; title: string }): FeedbackSuggestion {
  return {
    details: '',
    category: 'Reports',
    relatedFeature: 'reports',
    authorUserId: 'u1',
    authorName: 'Ada',
    organizationId: 'org',
    voteCount: 0,
    commentCount: 0,
    publicStatus: 'under_review',
    productDecision: 'none',
    pinned: false,
    hidden: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...partial,
  }
}

test('similar suggestions match overlapping product language', () => {
  const existing = [
    suggestion({ id: '1', title: 'Export reports to Excel', details: 'Need spreadsheet exports for weekly reports' }),
    suggestion({ id: '2', title: 'Dark mode', details: 'Toggle appearance' }),
  ]
  const matches = similarSuggestions('Excel report export', 'weekly spreadsheet', existing)
  assert.equal(matches[0]?.id, '1')
  assert.equal(matches.some((row) => row.id === '2'), false)
})

test('merge vote consolidation keeps unique voters only', () => {
  const result = consolidateVotesOnMerge([{ userId: 'a' }, { userId: 'b' }], [{ userId: 'b' }, { userId: 'c' }])
  assert.deepEqual(result.keepUserIds, ['c'])
  assert.deepEqual(result.duplicateUserIds, ['b'])
})

test('tokens drop short stop words', () => {
  assert.deepEqual(suggestionTokens('Add a new report export please'), ['report', 'export'])
})

test('product decision maps to a public customer status', () => {
  assert.equal(defaultPublicStatusForDecision('build'), 'planned')
  assert.equal(defaultPublicStatusForDecision('decline'), 'not_planned')
  assert.equal(defaultPublicStatusForDecision('none'), 'under_review')
})
