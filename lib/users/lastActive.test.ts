import assert from 'node:assert/strict'
import test from 'node:test'
import { lastActiveText, personLastSeenAt } from './lastActive'

test('the newest lastSeenAt across every users document of the person', () => {
  const person = { id: 'u1', email: 'a@x.com', lastSeenAt: new Date('2026-11-20T10:00:00Z') }
  const roster = [
    person,
    { id: 'U2', email: 'A@x.com', lastSeenAt: new Date('2026-11-23T09:00:00Z') },
    { id: 'u3', email: 'other@x.com', lastSeenAt: new Date('2026-11-24T09:00:00Z') },
  ]
  assert.equal(personLastSeenAt(person, roster)?.toISOString(), '2026-11-23T09:00:00.000Z')
  assert.equal(personLastSeenAt({ id: 'z', email: '' }, []), null)
  assert.equal(personLastSeenAt(null, roster), null)
})

test('shown in the organisation zone, not the browser zone', () => {
  const at = new Date('2026-07-01T23:30:00Z')
  assert.equal(lastActiveText(at, 'Europe/London'), '2 Jul 2026 at 00:30')
  assert.equal(lastActiveText(at, 'Pacific/Auckland'), '2 Jul 2026 at 11:30')
  assert.equal(lastActiveText(null, 'Europe/London'), '—')
})
