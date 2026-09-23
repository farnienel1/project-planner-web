import { test } from 'node:test'
import assert from 'node:assert/strict'
import { sanitizeEventMetadata } from './sanitizeEventMetadata.ts'

test('drops names, emails and free text from event metadata', () => {
  const cleaned = sanitizeEventMetadata({
    path: '/dashboard/tasks',
    taskId: 'abc',
    email: 'sam@company.co.uk',
    name: 'Sam Lee',
    note: 'customer asked to fix this',
    comment: 'hello',
    idea: 'idea-1',
    leaked: 'sam@company.co.uk',
  })
  assert.deepEqual(cleaned, { path: '/dashboard/tasks', taskId: 'abc', idea: 'idea-1' })
})
