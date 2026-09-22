import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseSuggestion } from './serialize.ts'
import { feedbackWriteError } from './errors.ts'

test('parseSuggestion keeps the submitting organisation name', () => {
  const row = parseSuggestion('idea-1', {
    title: 'Export RAMS',
    details: 'PDF pack',
    category: 'Health & safety',
    relatedFeature: 'health_safety',
    authorUserId: 'u1',
    authorName: 'Ada',
    organizationId: 'org-1',
    organizationName: 'Acme Fit-out',
    voteCount: 3,
    commentCount: 1,
    publicStatus: 'under_review',
    productDecision: 'none',
    pinned: false,
    hidden: false,
  })
  assert.equal(row.organizationName, 'Acme Fit-out')
  assert.equal(row.organizationId, 'org-1')
})

test('feedback write errors tell people to publish firestore.rules', () => {
  assert.match(feedbackWriteError(new Error('Missing or insufficient permissions.')), /firestore\.rules/)
  assert.equal(feedbackWriteError(new Error('offline')), 'offline')
})
