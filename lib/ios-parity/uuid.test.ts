import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { isUuidString, syntheticUuidFromKey } from './uuid.ts'

function expectedUuid(key: string): string {
  const digest = createHash('sha256').update(key).digest()
  const bytes = Uint8Array.from(digest.subarray(0, 16))
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`.toUpperCase()
}

test('syntheticUuidFromKey matches iOS SHA-256 UUID v4 layout', async () => {
  const key = 'timesheetPending|user-1|manager-1|1758384000'
  const id = await syntheticUuidFromKey(key)
  assert.equal(isUuidString(id), true)
  assert.equal(id, expectedUuid(key))
  assert.equal(id, id.toUpperCase())
})
