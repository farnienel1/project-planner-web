import assert from 'node:assert/strict'
import test from 'node:test'
import {
  formerUserIdWritesFromProposals,
  looksLikeInvitePlaceholderId,
  proposeFormerUserIdBackfill,
} from './formerUserIdBackfill.ts'

const ORPHAN = 'A1B2C3D4-0000-4000-8000-000000000001'
const OTHER_ORPHAN = 'A1B2C3D4-0000-4000-8000-000000000002'

const pat = { id: 'authPat', email: 'pat@site.test', name: 'Pat Invited' }
const sam = { id: 'authSam', email: 'sam@site.test', name: 'Sam Invited' }

test('an orphan booked while exactly one invite was open is proposed for that person', () => {
  const [proposal] = proposeFormerUserIdBackfill({
    organizationId: 'ORG',
    users: [pat, sam],
    operativeIds: [],
    references: [
      { personId: ORPHAN, source: 'booking', createdAt: new Date('2026-10-05T09:00:00Z') },
      { personId: ORPHAN, source: 'booking', createdAt: new Date('2026-10-06T09:00:00Z') },
    ],
    invitations: [
      { email: 'pat@site.test', isUsed: true, createdAt: new Date('2026-10-01'), usedAt: new Date('2026-10-10') },
      // Sam's invite closed before the booking was written.
      { email: 'sam@site.test', isUsed: true, createdAt: new Date('2026-09-01'), usedAt: new Date('2026-09-02') },
    ],
  })
  assert.equal(proposal.status, 'matched')
  assert.equal(proposal.apply, true)
  assert.equal(proposal.userId, 'authPat')
  assert.equal(proposal.references, 2)
  assert.match(proposal.candidates[0].reason, /2026-10-01 to 2026-10-10/)
})

test('two invites open at once is ambiguous and is never applied without review', () => {
  const [proposal] = proposeFormerUserIdBackfill({
    organizationId: 'ORG',
    users: [pat, sam],
    operativeIds: [],
    references: [{ personId: ORPHAN, source: 'booking', createdAt: new Date('2026-10-05') }],
    invitations: [
      { email: 'pat@site.test', isUsed: true, createdAt: new Date('2026-10-01'), usedAt: new Date('2026-10-10') },
      { email: 'sam@site.test', isUsed: true, createdAt: new Date('2026-10-02'), usedAt: null },
    ],
  })
  assert.equal(proposal.status, 'ambiguous')
  assert.equal(proposal.apply, false)
  assert.equal(proposal.userId, null)
  assert.deepEqual(proposal.candidates.map((candidate) => candidate.userId), ['authPat', 'authSam'])
})

test('ids someone already owns, operative records, and Auth uids are not orphans', () => {
  const proposals = proposeFormerUserIdBackfill({
    organizationId: 'ORG',
    users: [{ ...pat, formerIds: [ORPHAN] }],
    operativeIds: [OTHER_ORPHAN],
    references: [
      { personId: ORPHAN, source: 'booking', createdAt: new Date('2026-10-05') },
      { personId: OTHER_ORPHAN, source: 'booking', createdAt: new Date('2026-10-05') },
      { personId: 'authPat', source: 'booking', createdAt: new Date('2026-10-05') },
      { personId: 'QAlPe29vLLP4spK554UtpaBLW7N2', source: 'booking', createdAt: new Date('2026-10-05') },
    ],
    invitations: [],
  })
  assert.deepEqual(proposals, [])
  assert.equal(looksLikeInvitePlaceholderId(ORPHAN), true)
  assert.equal(looksLikeInvitePlaceholderId('QAlPe29vLLP4spK554UtpaBLW7N2'), false)
})

test('an orphan with no dated reference, such as a warning exclusion alone, is unmatched', () => {
  const [proposal] = proposeFormerUserIdBackfill({
    organizationId: 'ORG',
    users: [pat],
    operativeIds: [],
    references: [{ personId: ORPHAN, source: 'warningExclusion' }],
    invitations: [{ email: 'pat@site.test', isUsed: true, createdAt: new Date('2026-10-01'), usedAt: null }],
  })
  assert.equal(proposal.status, 'unmatched')
  assert.equal(proposal.apply, false)
})

test('only reviewed, applied proposals become writes, grouped per account', () => {
  const writes = formerUserIdWritesFromProposals([
    { orphanId: ORPHAN, apply: true, userId: 'authPat' },
    { orphanId: OTHER_ORPHAN, apply: true, userId: 'authPat' },
    { orphanId: ORPHAN, apply: true, userId: 'authPat' },
    { orphanId: 'A1B2C3D4-0000-4000-8000-000000000003', apply: false, userId: 'authSam' },
    { orphanId: 'not-a-placeholder', apply: true, userId: 'authSam' },
    { orphanId: 'A1B2C3D4-0000-4000-8000-000000000004', apply: true, userId: null },
  ])
  assert.deepEqual([...writes.entries()], [['authPat', [ORPHAN, OTHER_ORPHAN]]])
})
