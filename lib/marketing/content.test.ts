import test from 'node:test'
import assert from 'node:assert/strict'
import {
  MARKETING_PLANS,
  RATES_FAQ,
  planHasModule,
  setupPathForPlan,
  suggestPlanForUsers,
} from './content'

test('marketing plans expose four named tiers with monthly prices', () => {
  assert.deepEqual(
    MARKETING_PLANS.map((plan) => [plan.key, plan.price, plan.users]),
    [
      ['starter', 29, 'Up to 5 users'],
      ['team', 69, 'Up to 15 users'],
      ['professional', 149, 'Up to 40 users'],
      ['enterprise', 299, '40+ users'],
    ]
  )
  assert.equal(MARKETING_PLANS.find((plan) => plan.popular)?.key, 'professional')
})

test('module gating matches starter / team / professional', () => {
  assert.equal(planHasModule('starter', 'scheduling'), true)
  assert.equal(planHasModule('starter', 'materials'), false)
  assert.equal(planHasModule('team', 'materials'), true)
  assert.equal(planHasModule('team', 'hs'), false)
  assert.equal(planHasModule('professional', 'hs'), true)
})

test('estimator suggests a plan that covers team size plus two users', () => {
  assert.equal(suggestPlanForUsers(7).key, 'team')
  assert.equal(suggestPlanForUsers(17).key, 'professional')
  assert.equal(suggestPlanForUsers(50).key, 'enterprise')
})

test('choose-plan links preselect the plan on setup', () => {
  assert.equal(setupPathForPlan('professional'), '/setup?plan=professional')
})

test('user-limit FAQ tells admins they can upgrade with no down time', () => {
  const answer = RATES_FAQ.find(([question]) => question.includes('user limit'))?.[1]
  assert.match(String(answer), /upgrade to continue adding users with no down time/)
})
