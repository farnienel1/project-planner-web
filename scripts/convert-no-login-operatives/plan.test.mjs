import assert from 'node:assert/strict'
import test from 'node:test'
import { anchoredMemberIds, checkListCsv, checkListMarkdown, checkListRows, parseFilledCheckList } from './plan.mjs'

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

test('1.36.0: anchoredMemberIds lists every members key and the creator once', () => {
  assert.deepEqual(anchoredMemberIds({ members: { u1: 'admin', ' u2 ': 'operative' }, creatorUserId: 'u1' }), ['u1', 'u2'])
  assert.deepEqual(anchoredMemberIds({ creatorUserId: 'c' }), ['c'])
  assert.deepEqual(anchoredMemberIds(null), [])
})

test('1.36.0: a member from another company, or a users document storing the org as a path, is never a ghost candidate', async () => {
  const { readFileSync } = await import('node:fs')
  const vm = await import('node:vm')
  const context = vm.createContext({})
  vm.runInContext(readFileSync(new URL('../../lib/canonical/dist/canonical-business.js', import.meta.url), 'utf8'), context)
  const rulebook = context.ProjectPlannerCanonical
  const operatives = [
    { id: 'row-visitor', firstName: 'Vic', lastName: 'Visitor', email: 'vic@other.com', dayRate: 100, payBasis: 'day' },
    { id: 'row-path', firstName: 'Pat', lastName: 'Path', email: 'pat@x.com', dayRate: 100, payBasis: 'day' },
    { id: 'row-ghost', firstName: 'Gus', lastName: 'Ghost', email: 'gus@x.com', dayRate: 100, payBasis: 'day' },
  ]
  const users = [
    { id: 'u-vic', email: 'vic@other.com', organizationId: 'OTHER' },
    { id: 'u-pat', email: 'pat@x.com', organizationId: 'organizations/ORG' },
  ]
  const ids = (input) => [...rulebook.ghostConversionCandidates(input).map((c) => c.operativeId)]
  // Without the members list the visitor's row would be converted (a second person); with it, only the real no-login row.
  assert.deepEqual(ids({ organizationId: 'ORG', operatives, users }), ['row-ghost', 'row-visitor'])
  assert.deepEqual(ids({ organizationId: 'ORG', operatives, users, memberIds: anchoredMemberIds({ members: { 'u-vic': 'operative' } }) }), ['row-ghost'])
  // The conversion plan carries no write metadata at all when the script has no signed-in user.
  const [ghost] = rulebook.ghostConversionCandidates({ organizationId: 'ORG', operatives, users, memberIds: ['u-vic'] })
  const plan = rulebook.ghostConversionWrites({ organizationId: 'ORG', candidate: ghost, lineManagerIds: ['mgr1'], actorUserId: '', privatePay: true })
  for (const fields of [plan.user.fields, plan.payProfile.fields]) {
    assert.equal('updatedBy' in fields, false)
    assert.equal('updatedFrom' in fields, false)
  }
})
