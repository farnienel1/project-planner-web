/**
 * Owner console PR 2 (Overview, spec §4.1): the figures against the hand-worked seed (expected.json `commandCentre`),
 * plus the edge cases of each rule. A failure means the code and the hand sums disagree.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { buildOwnerConsoleSeed, SEED_NOW_MS } from '../../scripts/owner-console-seed/seedData.mjs'
import { ownerOrgRows, ownerPeopleRows, type OwnerOrgRow } from './directory.ts'
import { resolveConsolePeriod } from '../analytics/consolePeriod.ts'
import {
  attentionReasons,
  commandCentre,
  commandCentreHeadline,
  isPayingOrganisation,
  latestOwnerActions,
  liveFeed,
  organisationsNeedingAttention,
} from './commandCentre.ts'
import { ATTENTION_REASON_DEFINITIONS, COMMAND_CENTRE_METRICS, LIVE_FEED_DEFINITION } from './metricContracts.ts'

const expected = JSON.parse(readFileSync(new URL('../../scripts/owner-console-seed/expected.json', import.meta.url), 'utf8')).commandCentre
const seed = buildOwnerConsoleSeed()
const orgRows = ownerOrgRows(seed.orgs, SEED_NOW_MS)
const peopleRows = ownerPeopleRows(seed.users, orgRows, seed.orgs)
const now = new Date(SEED_NOW_MS)
const DAY = 24 * 60 * 60 * 1000

function headline(period: 'today' | 'week' | 'month' | 'year' | 'to_date', includeTestData = false) {
  return commandCentreHeadline({ orgRows, peopleRows, range: resolveConsolePeriod(period, now), includeTestData, nowMs: SEED_NOW_MS })
}

test('seed: active people and active organisations in the month, with and without test data (D1, D12)', () => {
  assert.equal(headline('month').activePeople.value, expected.month.activePeople)
  assert.equal(headline('month', true).activePeople.value, expected.month.activePeopleWithTest)
  assert.equal(headline('month').activeOrganisations.value, expected.month.activeOrganisations)
  assert.equal(headline('month', true).activeOrganisations.value, expected.month.activeOrganisationsWithTest)
})

test('seed: this week counts only people seen since Monday', () => {
  assert.equal(headline('week').activePeople.value, expected.week.activePeople)
  assert.equal(headline('week').activeOrganisations.value, expected.week.activeOrganisations)
})

test('seed: MRR is active billing only, trials out, nothing filled in from a list price', () => {
  const mrr = headline('month').mrr
  assert.equal(mrr.pence, expected.mrr.pence)
  assert.equal(mrr.payingOrganisations, expected.mrr.payingOrganisations)
  assert.equal(mrr.missing.length, expected.mrr.missing)
  assert.equal(mrr.trials, expected.mrr.trials)
  // MRR does not change with the period (it is today's figure).
  assert.deepEqual(headline('year').mrr, mrr)
})

test('seed: new people and new organisations this year, with the previous year', () => {
  const off = headline('year')
  const on = headline('year', true)
  assert.equal(off.newPeople.value, expected.year.newPeople)
  assert.equal(off.newPeople.previous, expected.year.newPeoplePrevious)
  assert.equal(on.newPeople.previous, expected.year.newPeoplePreviousWithTest)
  assert.equal(off.newOrganisations.value, expected.year.newOrganisations)
  assert.equal(on.newOrganisations.value, expected.year.newOrganisationsWithTest)
  assert.equal(off.newOrganisations.previous, expected.year.newOrganisationsPrevious)
  // To date has no previous window: the comparison is 0, never a guess.
  assert.equal(headline('to_date').newPeople.previous, 0)
})

test('seed: organisations needing attention, most urgent first', () => {
  const rows = organisationsNeedingAttention({ orgRows, peopleRows, includeTestData: false, nowMs: SEED_NOW_MS })
  assert.deepEqual(
    rows.map((row) => ({ orgId: row.orgId, kinds: row.reasons.map((reason) => reason.kind), label: row.reasons[0].label })),
    expected.attention
  )
  // Test organisations never appear unless included (here the test company needs nothing anyway).
  assert.equal(rows.some((row) => row.orgId === 'org-test'), false)
})

test('seed: the live feed, newest first, test company out, owner actions in', () => {
  const feed = liveFeed({ orgRows, peopleRows, auditEntries: seed.adminAuditLog, includeTestData: false })
  assert.deepEqual(feed.slice(0, expected.feedFirst.length).map((item) => item.id), expected.feedFirst)
  assert.equal(feed.some((item) => item.id === 'org:org-test'), false)
  const action = feed.find((item) => item.kind === 'ownerAction')
  assert.equal(action?.title, 'Owner action: Marked internal / test')
  // The owner's own record links to the test company even with test data hidden.
  assert.equal(action?.orgId, 'org-test')
  assert.match(action?.detail || '', /done$/)
  assert.equal(feed.length, 25)
  const withTest = liveFeed({ orgRows, peopleRows, auditEntries: seed.adminAuditLog, includeTestData: true })
  assert.equal(withTest.some((item) => item.id === 'org:org-test'), true)
})

test('every figure and list on the Overview has a written contract', () => {
  for (const key of ['activeOrganisations', 'activePeople', 'mrr', 'newPeople', 'newOrganisations'] as const) {
    const contract = COMMAND_CENTRE_METRICS[key]
    assert.ok(contract.definition.length > 40, key)
    assert.ok(contract.refresh.length > 0, key)
    assert.ok(contract.comparison.length > 0, key)
  }
  const kinds = new Set(organisationsNeedingAttention({ orgRows, peopleRows, includeTestData: true, nowMs: SEED_NOW_MS }).flatMap((row) => row.reasons.map((reason) => reason.kind)))
  for (const kind of kinds) assert.ok(ATTENTION_REASON_DEFINITIONS[kind], kind)
  assert.ok(LIVE_FEED_DEFINITION.length > 40)
})

function org(fields: Partial<OwnerOrgRow>): OwnerOrgRow {
  return {
    id: 'o',
    name: 'Org',
    unfinished: false,
    createdAtMs: SEED_NOW_MS - 100 * DAY,
    memberCount: 1,
    billingStatus: null,
    billingInterval: null,
    lapsed: false,
    deletion: 'active',
    eraseAfterMs: null,
    isTest: false,
    trialEndMs: null,
    mrrPence: null,
    cancelAtPeriodEnd: false,
    lastPaymentFailedAtMs: null,
    ...fields,
  }
}

test('MRR: past_due counts inside the grace and not after it; a paying org without mrrPence is listed as missing', () => {
  assert.equal(isPayingOrganisation(org({ billingStatus: 'past_due', lastPaymentFailedAtMs: SEED_NOW_MS - 2 * DAY }), SEED_NOW_MS), true)
  assert.equal(isPayingOrganisation(org({ billingStatus: 'past_due', lastPaymentFailedAtMs: SEED_NOW_MS - 8 * DAY }), SEED_NOW_MS), false)
  assert.equal(isPayingOrganisation(org({ billingStatus: 'trialing' }), SEED_NOW_MS), false)
  const result = commandCentreHeadline({
    orgRows: [
      org({ id: 'a', name: 'A', billingStatus: 'active', mrrPence: 4900 }),
      org({ id: 'b', name: 'B', billingStatus: 'active', mrrPence: 0 }),
      org({ id: 'c', name: 'C', billingStatus: 'active' }),
      org({ id: 'd', name: 'D', billingStatus: 'active', mrrPence: 9900, isTest: true }),
    ],
    peopleRows: [],
    range: resolveConsolePeriod('month', now),
    includeTestData: false,
    nowMs: SEED_NOW_MS,
  })
  assert.equal(result.mrr.pence, 4900)
  assert.equal(result.mrr.payingOrganisations, 3)
  assert.deepEqual(result.mrr.missing.map((row) => row.id), ['b', 'c'])
})

test('attention: quiet after 14 days, not for a new organisation; trial ended; cancelling; lapsed', () => {
  const quiet = attentionReasons(org({}), SEED_NOW_MS - 20 * DAY, SEED_NOW_MS)
  assert.deepEqual(quiet.map((r) => r.label), ['Quiet · nobody seen for 20 days'])
  assert.deepEqual(attentionReasons(org({}), SEED_NOW_MS - 13 * DAY, SEED_NOW_MS), [])
  assert.deepEqual(attentionReasons(org({ createdAtMs: SEED_NOW_MS - 3 * DAY }), null, SEED_NOW_MS), [])
  assert.deepEqual(attentionReasons(org({}), null, SEED_NOW_MS).map((r) => r.label), ['Quiet · nobody has been seen yet'])
  const trial = attentionReasons(org({ billingStatus: 'trialing', trialEndMs: SEED_NOW_MS - DAY }), SEED_NOW_MS, SEED_NOW_MS)
  assert.deepEqual(trial.map((r) => r.label), ['Trial ended'])
  assert.deepEqual(attentionReasons(org({ billingStatus: 'trialing', trialEndMs: SEED_NOW_MS + 20 * DAY }), SEED_NOW_MS, SEED_NOW_MS), [])
  const cancelling = attentionReasons(org({ billingStatus: 'active', cancelAtPeriodEnd: true }), SEED_NOW_MS, SEED_NOW_MS)
  assert.deepEqual(cancelling.map((r) => r.kind), ['cancelling'])
  const lapsed = attentionReasons(org({ billingStatus: 'canceled', lapsed: true, cancelAtPeriodEnd: true }), SEED_NOW_MS, SEED_NOW_MS)
  assert.deepEqual(lapsed.map((r) => r.label), ['Subscription canceled · apps blocked'])
  const grace = attentionReasons(org({ billingStatus: 'past_due', lastPaymentFailedAtMs: SEED_NOW_MS - DAY }), SEED_NOW_MS, SEED_NOW_MS)
  assert.deepEqual(grace.map((r) => r.label), ['Payment failed · in grace'])
  // An erased organisation is never listed; a scheduled one only for its deletion.
  assert.deepEqual(attentionReasons(org({ deletion: 'erased' }), null, SEED_NOW_MS), [])
  assert.deepEqual(
    attentionReasons(org({ deletion: 'scheduled', eraseAfterMs: SEED_NOW_MS + 1.5 * DAY, billingStatus: 'canceled', lapsed: true }), null, SEED_NOW_MS).map((r) => r.kind),
    ['scheduled']
  )
})

test('owner actions: one line per request (its latest step), reveals left out, entries without a requestId kept', () => {
  const at = (days: number) => new Date(SEED_NOW_MS - days * DAY)
  const rows = latestOwnerActions([
    { id: '1', data: { requestId: 'r', action: 'ownerChangeUserEmail', phase: 'requested', at: at(1) } },
    { id: '2', data: { requestId: 'r', action: 'ownerChangeUserEmail', phase: 'failed', at: at(0.9) } },
    { id: '3', data: { action: 'reveal_email', at: at(0.5) } },
    { id: '4', data: { requestId: 'x', action: 'ownerRevealEmail', phase: 'completed', at: at(0.5) } },
    { id: '5', data: { action: 'accountDelete', at: at(2), targetUserId: 'u' } },
    { id: '6', data: { action: '', at: at(2) } },
  ])
  assert.deepEqual(
    rows.map((row) => [row.key, row.phase]).sort(),
    [
      ['doc:5', ''],
      ['r', 'failed'],
    ]
  )
})

test('the whole page: one call returns headline, attention and feed from the same rows', () => {
  const page = commandCentre({ orgRows, peopleRows, auditEntries: seed.adminAuditLog, range: resolveConsolePeriod('month', now), includeTestData: false, nowMs: SEED_NOW_MS })
  assert.equal(page.headline.activePeople.value, expected.month.activePeople)
  assert.equal(page.attention.length, expected.attention.length)
  assert.equal(page.feed[0].id, expected.feedFirst[0])
})
