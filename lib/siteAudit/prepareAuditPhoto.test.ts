import assert from 'node:assert/strict'
import test from 'node:test'
import { auditPhotoStampLayout } from './prepareAuditPhoto'

test('a small photo splits the stamp so each line fits', () => {
  const layout = auditPhotoStampLayout(96, 64, '6 Oct 2026, 20:50')
  assert.deepEqual(layout.lines, ['6 Oct 2026', '20:50'])
  for (const line of layout.lines) {
    assert.ok(line.length * layout.fontSize * 0.62 <= 96 - 8, line)
  }
  assert.ok(layout.bar <= 64)
  assert.ok(layout.fontSize >= 8)
})

test('a wide photo keeps the stamp on one line', () => {
  const layout = auditPhotoStampLayout(2000, 800, '6 Oct 2026, 20:50')
  assert.deepEqual(layout.lines, ['6 Oct 2026, 20:50'])
  assert.ok(layout.fontSize >= 12)
})
