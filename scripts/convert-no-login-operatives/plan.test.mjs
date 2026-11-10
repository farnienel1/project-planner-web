import assert from 'node:assert/strict'
import test from 'node:test'
import { checkListCsv, checkListMarkdown, checkListRows, parseFilledCheckList } from './plan.mjs'

const candidate = {
  operativeId: 'row-a',
  firstName: 'Ann',
  lastName: 'Row, Jr',
  name: 'Ann Row, Jr',
  email: 'ann@x.com',
  trade: 'Labourer',
  payBasis: 'day',
  rate: 120,
  duplicateOperativeIds: ['row-b'],
  issues: [],
}

test('check list round trip: the owner fills the line manager and the script reads it back', () => {
  const rows = checkListRows('org1', [candidate, { ...candidate, operativeId: 'row-c', payBasis: null, rate: null, issues: ['rate'] }])
  const csv = checkListCsv(rows)
  assert.match(csv, /"Ann Row, Jr"/)
  assert.match(checkListMarkdown(rows), /line manager, rate/)
  const filled = csv
    .split('\n')
    .map((line, i) => (i === 1 ? line.replace(/,$/, ',mgr1;mgr2') : i === 2 ? line.replace(/,,rate,$/, ',,rate,mgr1').replace(',,,,', ',hourly,18,,') : line))
    .join('\n')
  const parsed = parseFilledCheckList(filled)
  assert.deepEqual(parsed.get('org1/row-a')?.lineManagerIds, ['mgr1', 'mgr2'])
  assert.equal(parsed.get('org1/row-a')?.overrides.dayRate, 120)
  assert.equal(parsed.get('org1/row-a')?.overrides.surname, 'Row, Jr')
})

test('rows without a line manager are skipped', () => {
  const csv = checkListCsv(checkListRows('org1', [candidate]))
  assert.equal(parseFilledCheckList(csv).size, 0)
  assert.equal(parseFilledCheckList('').size, 0)
})
