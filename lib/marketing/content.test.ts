import test from 'node:test'
import assert from 'node:assert/strict'
import {
  MARKETING_PLANS,
  RATES_FAQ,
  planHasModule,
  setupPathForPlan,
  suggestPlanForUsers,
} from './content'

test('marketing plans are monthly and annual ProjectPlanner', () => {
  assert.deepEqual(
    MARKETING_PLANS.map((plan) => [plan.key, plan.price, plan.users]),
    [
      ['month', 149, 'Unlimited users'],
      ['year', 1490, 'Unlimited users'],
    ]
  )
  assert.equal(MARKETING_PLANS.find((plan) => plan.popular)?.key, 'month')
})

test('every module is on the one plan', () => {
  assert.equal(planHasModule('month', 'scheduling'), true)
  assert.equal(planHasModule('month', 'materials'), true)
  assert.equal(planHasModule('year', 'hs'), true)
})

test('estimator always points at the single plan', () => {
  assert.equal(suggestPlanForUsers(7).key, 'month')
  assert.equal(suggestPlanForUsers(50).key, 'month')
})

test('choose-plan links preselect monthly or annual', () => {
  assert.equal(setupPathForPlan('month'), '/setup?plan=month')
  assert.equal(setupPathForPlan('year'), '/setup?plan=year')
})

test('pricing says VAT is not charged', () => {
  const vat = RATES_FAQ.find(([question]) => question === 'Do prices include VAT?')
  assert.equal(vat?.[1], 'VAT is not charged. The price is £149 a month, or £1,490 a year.')
})

test('FAQ no longer talks about user-limit bands', () => {
  assert.equal(
    RATES_FAQ.find(([question]) => question.toLowerCase().includes('user limit')),
    undefined
  )
})
