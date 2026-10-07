import assert from 'node:assert/strict'
import test from 'node:test'
import { DEFAULT_INVOICING } from '../settings/organizationSettings.ts'
import { invoicingQuickSelectLabel, INVOICING_READ_CAP_MS } from './invoicingRead.ts'

test('weekly report does not call invoicing unset while the organisation read is still running', () => {
  const waiting = invoicingQuickSelectLabel({ invoicing: null, periodLabel: null, readFinished: false })
  assert.equal(waiting.enabled, false)
  assert.equal(waiting.label.includes('Set invoicing dates'), false)
  assert.match(waiting.label, /Loading invoicing/)

  const known = invoicingQuickSelectLabel({
    invoicing: DEFAULT_INVOICING,
    periodLabel: '1–16 Oct',
    readFinished: false,
  })
  assert.equal(known.enabled, true)
  assert.equal(known.label, '1–16 Oct')

  const unset = invoicingQuickSelectLabel({ invoicing: null, periodLabel: null, readFinished: true })
  assert.match(unset.label, /Set invoicing dates/)
  assert.ok(INVOICING_READ_CAP_MS > 0 && INVOICING_READ_CAP_MS <= 4_000)
})
