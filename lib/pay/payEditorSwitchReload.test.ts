import { test } from 'node:test'
import assert from 'node:assert/strict'
import { reseedUntouchedPayFields, samePayValue, watchPayEditorPrivatePay, withPayFieldsFrom } from './payEditorSwitchReload.ts'
import { payEditorRecord } from './payProfileOverlay.ts'
import { setSecuritySwitchConfigForTests } from '../access/securitySwitches.ts'
import { adoptCurrentOrganization } from '../canonical/index.ts'

const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0))

test('1.26.1 pay editor: privatePay stays off while the form is open — no reload, no read, no change', async () => {
  adoptCurrentOrganization('org-a', 'adm')
  setSecuritySwitchConfigForTests(null)
  let reloads = 0
  let profileReads = 0
  const reloading: boolean[] = []
  const reloaded: unknown[] = []
  const stored = { firstName: 'A', payBasis: 'day', dayRate: 120 }
  const stop = watchPayEditorPrivatePay<Record<string, unknown>>({
    organizationId: () => 'org-a',
    reload: () => {
      reloads += 1
      return payEditorRecord('org-a', 'u1', stored, async () => {
        profileReads += 1
        return { subjectId: 'u1', fields: { dayRate: 150 } }
      })
    },
    onReloading: (value) => reloading.push(value),
    onReloaded: (next) => reloaded.push(next),
  })
  // Other switches and other organisations change; privatePay stays off for org-a.
  setSecuritySwitchConfigForTests({ enforcedReads: true })
  setSecuritySwitchConfigForTests({ enforcedReads: true, privatePayOrganizationIds: ['org-other'] })
  setSecuritySwitchConfigForTests({ privatePayOrganizationIds: ['org-other'] })
  await flush()
  assert.equal(reloads, 0)
  assert.equal(profileReads, 0)
  assert.deepEqual(reloading, [])
  assert.deepEqual(reloaded, [])
  stop()
  setSecuritySwitchConfigForTests(null)
})

test('1.26.1 pay editor: privatePay flips on while the form is open — reload, re-seed untouched pay, move the baseline, Save disabled until done', async () => {
  adoptCurrentOrganization('org-a', 'adm')
  setSecuritySwitchConfigForTests(null)
  // The form opened with the switch off: it started from the users document (stale 120; the pay profile says 150).
  const usersDoc = { firstName: 'A', payBasis: 'day', dayRate: 120, employmentType: 'self_employed' }
  let baseline: Record<string, unknown> = await payEditorRecord('org-a', 'u1', usersDoc, async () => {
    throw new Error('not read while off')
  })
  assert.equal(baseline, usersDoc)
  // The admin edits the employment type but leaves the rate alone.
  let form: Record<string, unknown> = { ...baseline, employmentType: 'paye' }

  let release: () => void = () => undefined
  const gate = new Promise<void>((resolve) => (release = resolve))
  let profileReads = 0
  let saveDisabled = false
  const stop = watchPayEditorPrivatePay<Record<string, unknown>>({
    organizationId: () => 'org-a',
    reload: async () => {
      await gate
      return payEditorRecord('org-a', 'u1', usersDoc, async () => {
        profileReads += 1
        return { subjectId: 'u1', fields: { payBasis: 'day', dayRate: 150, employmentType: 'self_employed' } }
      })
    },
    onReloading: (value) => (saveDisabled = value),
    onReloaded: (next) => {
      const start = baseline
      baseline = withPayFieldsFrom(start, next)
      form = reseedUntouchedPayFields(form, start, next)
    },
  })

  setSecuritySwitchConfigForTests({ privatePayOrganizationIds: ['org-a'] })
  await flush()
  assert.equal(saveDisabled, true, 'Save is disabled while the starting record reloads')
  assert.equal(form.dayRate, 120)
  release()
  await flush()
  await flush()
  assert.equal(saveDisabled, false)
  assert.equal(profileReads, 1)
  // Untouched rate takes the pay profile's; the admin's employment type change is kept.
  assert.equal(form.dayRate, 150)
  assert.equal(form.employmentType, 'paye')
  // Baseline (save diff, originalDayRate / originalEmploymentType, rate-history previous row) is the reloaded pay.
  assert.equal(baseline.dayRate, 150)
  assert.equal(baseline.employmentType, 'self_employed')
  assert.equal(baseline.firstName, 'A')

  // After the editor closes nothing is reloaded.
  stop()
  setSecuritySwitchConfigForTests(null)
  await flush()
  assert.equal(profileReads, 1)
})

test('1.26.1 pay editor: a change for another open organisation, a failed reload, and only the latest change applies', async () => {
  adoptCurrentOrganization('org-b', 'adm')
  setSecuritySwitchConfigForTests(null)
  let reloads = 0
  const stopOther = watchPayEditorPrivatePay({
    organizationId: () => 'org-a',
    reload: async () => {
      reloads += 1
      return {}
    },
    onReloading: () => undefined,
    onReloaded: () => undefined,
  })
  setSecuritySwitchConfigForTests({ privatePay: true })
  await flush()
  assert.equal(reloads, 0, 'the editor belongs to org-a; org-b is open')
  stopOther()

  adoptCurrentOrganization('org-a', 'adm')
  setSecuritySwitchConfigForTests(null)
  const states: boolean[] = []
  let failed = 0
  const stopFail = watchPayEditorPrivatePay({
    organizationId: () => 'org-a',
    reload: async () => null,
    onReloading: (value) => states.push(value),
    onReloaded: () => assert.fail('nothing to apply'),
    onFailed: () => (failed += 1),
  })
  setSecuritySwitchConfigForTests({ privatePay: true })
  await flush()
  assert.deepEqual(states, [true], 'Save stays disabled after a failed reload')
  assert.equal(failed, 1)
  stopFail()

  setSecuritySwitchConfigForTests(null)
  const applied: number[] = []
  let call = 0
  const resolvers: Array<(value: { dayRate: number }) => void> = []
  const stopLatest = watchPayEditorPrivatePay<{ dayRate: number }>({
    organizationId: () => 'org-a',
    reload: () => new Promise((resolve) => resolvers[call++] = resolve),
    onReloading: () => undefined,
    onReloaded: (next) => applied.push(next.dayRate),
  })
  setSecuritySwitchConfigForTests({ privatePay: true })
  setSecuritySwitchConfigForTests(null)
  resolvers[1]({ dayRate: 120 })
  resolvers[0]({ dayRate: 150 })
  await flush()
  assert.deepEqual(applied, [120])
  stopLatest()
  setSecuritySwitchConfigForTests(null)
})

test('1.26.1 pay editor: re-seed helpers compare missing / null / blank as one value and dates by instant', () => {
  assert.equal(samePayValue(undefined, null), true)
  assert.equal(samePayValue('', null), true)
  assert.equal(samePayValue(new Date(5), new Date(5)), true)
  assert.equal(samePayValue(0, null), false)
  const start = { payBasis: 'hourly', hourlyRate: 20, employmentTypeEffectiveAt: new Date(5) }
  const current = { ...start, employmentTypeEffectiveAt: new Date(5), name: 'x' }
  const next = { payBasis: 'day', dayRate: 200 }
  assert.deepEqual(reseedUntouchedPayFields(current, start, next as never), { payBasis: 'day', dayRate: 200, name: 'x' })
  assert.deepEqual(withPayFieldsFrom({ ...start, name: 'x' }, next as never), { payBasis: 'day', dayRate: 200, name: 'x' })
})
