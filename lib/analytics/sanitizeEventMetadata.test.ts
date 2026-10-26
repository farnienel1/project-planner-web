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

test('tax ids, phone numbers and pay rates never reach analytics', () => {
  const out = sanitizeEventMetadata({
    utrNumber: '1234567890',
    vatNumber: 'GB123456789',
    mobileNumber: '07700900123',
    dayRate: 250,
    hourlyRate: 30,
    accountNumber: 'ACC1',
    feature: 'timesheets',
    label: 'ref 12345 67890 end',
    plan: 'GB 123456789',
    id: 'A1B2C3D4-0000-4000-8000-123456789012',
    count: 3,
  })
  assert.deepEqual(out, { feature: 'timesheets', id: 'A1B2C3D4-0000-4000-8000-123456789012', count: 3 })
})
