import assert from 'node:assert/strict'
import test from 'node:test'
import { emptyTimesheetDraft, type TimesheetDraft } from './timesheetDraft.ts'
import {
  currentPeriodTimesheetMembers,
  timesheetReviewerHubStats,
} from './timesheetHubStats.ts'
import type { User } from '../../types/index.ts'

function user(partial: Partial<User> & { id: string }): User {
  return {
    email: `${partial.id}@test.com`,
    firstName: partial.firstName || 'Pat',
    surname: partial.surname || 'Operative',
    organizationId: 'org',
    role: 'operative',
    passwordSet: true,
    policyAccepted: true,
    permissions: {
      adminAccess: false,
      manager: false,
      operatives: false,
      skills: false,
      qualifications: false,
      materials: false,
      projects: false,
      smallWorks: false,
      operativeMode: true,
      annualLeaveSelfBook: false,
      weeklyReports: false,
      dailyOverview: true,
      subContractors: false,
      siteAudit: true,
      wholesalersOrderHistory: true,
    },
    isSuperAdmin: false,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    assignedManagerUserId: 'mgr',
    ...partial,
  } as User
}

function signed(partial: Partial<TimesheetDraft> = {}): TimesheetDraft {
  return {
    ...emptyTimesheetDraft(),
    operativeSignedAt: new Date('2026-10-01T09:00:00.000Z'),
    operativeSignedByName: 'Pat',
    ...partial,
  }
}

test('hub Exported is history length, not exported-this-pay-run', () => {
  const current = user({ id: 'current' })
  const older = user({ id: 'older' })
  const drafts = new Map<string, TimesheetDraft>([
    [
      current.id,
      signed({
        managerSignedAt: new Date('2026-10-02T09:00:00.000Z'),
        managerSignedByName: 'Mgr',
        exportedAt: new Date('2026-10-03T09:00:00.000Z'),
      }),
    ],
  ])
  const stats = timesheetReviewerHubStats({
    groups: [[current], [older]],
    currentPeriodDrafts: drafts,
    exportedHistoryCount: 17,
  })
  assert.equal(stats.exported, 17)
  assert.equal(stats.awaiting, 0)
  assert.equal(stats.signed, 0)
  assert.notEqual(stats.exported, currentPeriodTimesheetMembers([[current]], drafts, 'exported').length)
})

test('hub Awaiting and Signed off match current-period tab buckets', () => {
  const awaiting = user({ id: 'awaiting' })
  const signedOff = user({ id: 'signed' })
  const unsigned = user({ id: 'unsigned' })
  const drafts = new Map<string, TimesheetDraft>([
    [awaiting.id, signed()],
    [
      signedOff.id,
      signed({
        managerSignedAt: new Date('2026-10-02T09:00:00.000Z'),
        managerSignedByName: 'Mgr',
      }),
    ],
    [unsigned.id, emptyTimesheetDraft()],
  ])
  const groups = [[awaiting], [signedOff], [unsigned]]
  const stats = timesheetReviewerHubStats({
    groups,
    currentPeriodDrafts: drafts,
    exportedHistoryCount: 4,
  })
  assert.deepEqual(
    currentPeriodTimesheetMembers(groups, drafts, 'awaiting').map((row) => row.id),
    ['awaiting']
  )
  assert.deepEqual(
    currentPeriodTimesheetMembers(groups, drafts, 'signed').map((row) => row.id),
    ['signed']
  )
  assert.equal(stats.awaiting, 1)
  assert.equal(stats.signed, 1)
  assert.equal(stats.exported, 4)
})

test('email-aliased group counts as one current-period row', () => {
  const account = user({ id: 'acct', email: 'pat@test.com', firstName: 'Pat' })
  const alias = user({ id: 'alias', email: 'pat@test.com', firstName: 'Pat' })
  const drafts = new Map<string, TimesheetDraft>([
    [alias.id, signed()],
    [account.id, emptyTimesheetDraft()],
  ])
  const stats = timesheetReviewerHubStats({
    groups: [[account, alias]],
    currentPeriodDrafts: drafts,
    exportedHistoryCount: 0,
  })
  assert.equal(stats.awaiting, 1)
  assert.equal(stats.signed, 0)
})

test('leftover invoice stamp (null exportedAt) does not inflate hub Exported', () => {
  const member = user({ id: 'inv' })
  const drafts = new Map<string, TimesheetDraft>([
    [member.id, signed({ exportedAt: null })],
  ])
  const stats = timesheetReviewerHubStats({
    groups: [[member]],
    currentPeriodDrafts: drafts,
    exportedHistoryCount: 0,
  })
  assert.equal(stats.exported, 0)
  assert.equal(stats.awaiting, 1)
})
