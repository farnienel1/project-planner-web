import assert from 'node:assert/strict'
import test from 'node:test'
import {
  settingsDraftIsDirty,
  settingsFormIsDirty,
  settingsSaveBarHint,
  settingsValuesEqual,
  type SettingsBaselineState,
} from './settingsDirty.ts'
import { parsePayrollPolicy, type OrgPayrollTimePolicy } from '../canonical/organizationSettings.ts'

test('settings draft dirty compare treats matching snapshots as clean', () => {
  assert.equal(settingsDraftIsDirty({ name: 'Acme' }, { name: 'Acme' }), false)
  assert.equal(settingsDraftIsDirty({ name: 'Acme' }, { name: 'Other' }), true)
})

test('settings compare walks nested maps and arrays by value', () => {
  assert.equal(settingsValuesEqual({ a: { b: [1, { c: 2 }] } }, { a: { b: [1, { c: 2 }] } }), true)
  assert.equal(settingsValuesEqual({ a: { b: [1, { c: 2 }] } }, { a: { b: [1, { c: 3 }] } }), false)
  assert.equal(settingsValuesEqual([1, 2], [1, 2, 3]), false)
  assert.equal(settingsValuesEqual({ list: [] }, { list: {} }), false)
})

test('settings compare ignores key order and undefined keys, and treats NaN as equal', () => {
  assert.equal(settingsValuesEqual({ a: 1, b: 2 }, { b: 2, a: 1 }), true)
  assert.equal(settingsValuesEqual({ a: 1, extra: undefined }, { a: 1 }), true)
  assert.equal(settingsValuesEqual({ a: Number.NaN }, { a: Number.NaN }), true)
  assert.equal(settingsValuesEqual({ a: null }, { a: undefined }), false)
  assert.equal(settingsValuesEqual({ a: 0 }, { a: '0' }), false)
})

test('settings compare reads dates by instant', () => {
  assert.equal(settingsValuesEqual({ d: new Date(1000) }, { d: new Date(1000) }), true)
  assert.equal(settingsValuesEqual({ d: new Date(1000) }, { d: new Date(2000) }), false)
})

test('settings form is never dirty before the saved values load or after the load fails', () => {
  const loading: SettingsBaselineState<{ a: number }> = { status: 'loading' }
  const failed: SettingsBaselineState<{ a: number }> = { status: 'failed' }
  const ready: SettingsBaselineState<{ a: number }> = { status: 'ready', baseline: { a: 1 } }
  assert.equal(settingsFormIsDirty(loading, { a: 2 }), false)
  assert.equal(settingsFormIsDirty(failed, { a: 2 }), false)
  assert.equal(settingsFormIsDirty(ready, { a: 2 }), true)
  assert.equal(settingsFormIsDirty(ready, { a: 1 }), false)
  assert.equal(settingsSaveBarHint(loading), 'Loading saved settings…')
  assert.equal(settingsSaveBarHint(failed), 'Saved settings could not be loaded.')
  assert.equal(settingsSaveBarHint(ready), undefined)
})

// The Working hours panel's own edits, applied the way the panel applies them.
function patch(policy: OrgPayrollTimePolicy, partial: Partial<OrgPayrollTimePolicy>): OrgPayrollTimePolicy {
  return { ...policy, ...partial }
}
function patchWeekend(
  policy: OrgPayrollTimePolicy,
  key: 'saturday' | 'sunday',
  partial: Partial<OrgPayrollTimePolicy['saturday']>
): OrgPayrollTimePolicy {
  return { ...policy, [key]: { ...policy[key], ...partial } }
}

const STORED_POLICIES: Array<[string, Record<string, unknown> | undefined]> = [
  ['a company that never saved a policy', undefined],
  ['a saved policy without weekend maps', { standardDayStart: '08:00', standardDayEnd: '16:30' }],
  [
    'a saved iOS policy',
    {
      standardDayStart: '07:30',
      standardDayEnd: '16:00',
      unpaidBreakMinutes: 30,
      saturday: {
        allHoursAtMultiplierMode: false,
        customStandardStart: '07:30',
        customStandardEnd: '13:00',
        outsideStandardWindowMultiplier: 2,
      },
      sunday: { allHoursAtMultiplierMode: true, allHoursMultiplier: 2 },
      sundaySameAsSaturday: false,
    },
  ],
]

for (const [label, stored] of STORED_POLICIES) {
  test(`working hours: every field turns Save on and putting it back turns Save off (${label})`, () => {
    const baseline = parsePayrollPolicy(stored)
    const state: SettingsBaselineState<OrgPayrollTimePolicy> = { status: 'ready', baseline }
    assert.equal(settingsFormIsDirty(state, baseline), false)

    const edits: Array<(p: OrgPayrollTimePolicy) => OrgPayrollTimePolicy> = [
      (p) => patch(p, { standardDayStart: '08:15' }),
      (p) => patch(p, { standardDayEnd: '17:00' }),
      (p) => patch(p, { standardPaidHours: p.standardPaidHours + 0.5 }),
      (p) => patch(p, { unpaidBreakMinutes: p.unpaidBreakMinutes + 5 }),
      (p) => patch(p, { breakWindowStart: '12:15' }),
      (p) => patch(p, { breakWindowEnd: '12:45' }),
      (p) => patch(p, { weekdayOutsideStandardMultiplier: 1.75 }),
      (p) => patchWeekend(p, 'saturday', { allHoursAtMultiplierMode: !p.saturday.allHoursAtMultiplierMode }),
      (p) => patchWeekend(p, 'saturday', { allHoursMultiplier: 3 }),
      (p) => patchWeekend(p, 'saturday', { definedWindowStart: '08:00' }),
      (p) => patchWeekend(p, 'saturday', { definedWindowEnd: '12:00' }),
      (p) => patchWeekend(p, 'saturday', { outsideWindowMultiplier: 2.5 }),
      (p) => patchWeekend(p, 'sunday', { allHoursAtMultiplierMode: !p.sunday.allHoursAtMultiplierMode }),
      (p) => patchWeekend(p, 'sunday', { allHoursMultiplier: 2.25 }),
      (p) => patchWeekend(p, 'sunday', { definedWindowEnd: '11:00' }),
      (p) => patchWeekend(p, 'sunday', { outsideWindowMultiplier: 1.25 }),
      (p) => patchWeekend(p, 'sunday', { ...p.saturday, sameAsSaturday: !p.sunday.sameAsSaturday }),
    ]
    for (const edit of edits) {
      const edited = edit(baseline)
      assert.equal(settingsFormIsDirty(state, edited), true, JSON.stringify(edited))
    }

    // Change a weekday time, then type the saved value back: Save goes grey again.
    const changed = patch(baseline, { standardDayStart: '09:00' })
    assert.equal(settingsFormIsDirty(state, changed), true)
    assert.equal(settingsFormIsDirty(state, patch(changed, { standardDayStart: baseline.standardDayStart })), false)

    // Change a Saturday rate and put it back.
    const saturday = patchWeekend(baseline, 'saturday', { allHoursMultiplier: 9 })
    const restored = patchWeekend(saturday, 'saturday', { allHoursMultiplier: baseline.saturday.allHoursMultiplier })
    assert.equal(settingsFormIsDirty(state, restored), false)
  })
}

test('working hours: an edit before the saved policy loads does not count as a change', () => {
  const draft = patch(parsePayrollPolicy(undefined), { standardDayStart: '06:00' })
  assert.equal(settingsFormIsDirty<OrgPayrollTimePolicy>({ status: 'loading' }, draft), false)
})
