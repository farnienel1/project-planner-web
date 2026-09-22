import { test } from 'node:test'
import assert from 'node:assert/strict'
import { consolidateVotesOnMerge, mergePreviewCounts, similarSuggestions, suggestionTokens } from './similar.ts'
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

test('typos and synonyms still match similar ideas', () => {
  const existing = [
    suggestion({ id: 'schedule', title: 'Cant see achedule well', details: 'The rota is hard to read on a phone' }),
    suggestion({ id: 'excel', title: 'download reports as spreadsheet', details: 'Need csv for payroll' }),
    suggestion({ id: 'unrelated', title: 'Dark mode', details: 'Toggle appearance' }),
  ]
  const schedule = similarSuggestions('schedule view hard to see', '', existing)
  assert.equal(schedule[0]?.id, 'schedule')
  const reports = similarSuggestions('Export reports to Excel', '', existing)
  assert.equal(reports[0]?.id, 'excel')
})

test('merge vote consolidation keeps unique voters only', () => {
  const result = consolidateVotesOnMerge([{ userId: 'a' }, { userId: 'b' }], [{ userId: 'b' }, { userId: 'c' }])
  assert.deepEqual(result.keepUserIds, ['c'])
  assert.deepEqual(result.duplicateUserIds, ['b'])
})

test('merge preview 3+3 with 1 overlap becomes 5 unique voters', () => {
  const preview = mergePreviewCounts(
    [{ userId: 'a' }, { userId: 'b' }, { userId: 'c' }],
    [{ userId: 'c' }, { userId: 'd' }, { userId: 'e' }]
  )
  assert.equal(preview.source, 3)
  assert.equal(preview.destination, 3)
  assert.equal(preview.overlap, 1)
  assert.equal(preview.mergedTotal, 5)
})

test('tokens drop short stop words', () => {
  assert.deepEqual(suggestionTokens('Add a new report export please'), ['report', 'export'])
})

test('product decision maps to a public customer status', () => {
  assert.equal(defaultPublicStatusForDecision('build'), 'planned')
  assert.equal(defaultPublicStatusForDecision('decline'), 'not_planned')
  assert.equal(defaultPublicStatusForDecision('none'), 'under_review')
})
