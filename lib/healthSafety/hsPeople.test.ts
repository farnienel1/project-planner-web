import { test } from 'node:test'
import assert from 'node:assert/strict'
import { UserRole, type User } from '../../types/index.ts'
import {
  filterHsRecipients,
  groupRecipientsByTrade,
  isHsRecipient,
  recipientTradeFilters,
  userDisplayName,
  userTradeLabel,
} from './hsPeople.ts'

function user(partial: Partial<User> & Pick<User, 'id' | 'firstName' | 'surname'>): User {
  return {
    email: `${partial.id}@example.com`,
    organizationId: 'org',
    role: UserRole.OPERATIVE,
    isActive: true,
    passwordSet: true,
    isSuperAdmin: false,
    policyAccepted: true,
    permissions: {
      adminAccess: false,
      manager: false,
      operatives: true,
      skills: false,
      qualifications: false,
      materials: false,
      projects: false,
      smallWorks: false,
      operativeMode: true,
      annualLeaveSelfBook: false,
      weeklyReports: false,
      dailyOverview: false,
      subContractors: false,
      siteAudit: false,
      wholesalersOrderHistory: false,
    },
    createdAt: new Date(),
    updatedAt: new Date(),
    ...partial,
  } as User
}

test('userTradeLabel uses custom Other trade and falls back to General', () => {
  assert.equal(userTradeLabel({ tradeTypePreset: 'Electrician' }), 'Electrician')
  assert.equal(userTradeLabel({ tradeTypePreset: 'Other', tradeTypeCustom: 'Splicer' }), 'Splicer')
  assert.equal(userTradeLabel({}), 'General')
})

test('filter and group recipients by trade with search', () => {
  const people = [
    user({ id: '1', firstName: 'Amy', surname: 'Watts', tradeTypePreset: 'Electrician' }),
    user({ id: '2', firstName: 'Ben', surname: 'Cole', tradeTypePreset: 'Plumber' }),
    user({ id: '3', firstName: 'Cara', surname: 'Lee', tradeTypePreset: 'Electrician' }),
    user({
      id: '4',
      firstName: 'Inactive',
      surname: 'User',
      isActive: false,
      tradeTypePreset: 'Electrician',
    }),
  ]
  const active = people.filter(isHsRecipient)
  assert.equal(active.length, 3)
  assert.deepEqual(recipientTradeFilters(active), ['All', 'Electrician', 'Plumber'])

  const electricians = filterHsRecipients(active, '', 'Electrician')
  assert.deepEqual(
    electricians.map((row) => row.id),
    ['1', '3']
  )
  const searched = filterHsRecipients(active, 'cole', 'All')
  assert.deepEqual(
    searched.map((row) => row.id),
    ['2']
  )

  const groups = groupRecipientsByTrade(active)
  assert.deepEqual(
    groups.map((group) => [group.trade, group.users.map((row) => userDisplayName(row))]),
    [
      ['Electrician', ['Amy Watts', 'Cara Lee']],
      ['Plumber', ['Ben Cole']],
    ]
  )
})
