import { test } from 'node:test'
import assert from 'node:assert/strict'
import { payEditorRecord, startPayEditorProfileRead } from './payProfileOverlay.ts'
import { setSecuritySwitchConfigForTests } from '../access/securitySwitches.ts'
import { adoptCurrentOrganization } from '../canonical/index.ts'

const stored = { firstName: 'A', payBasis: 'day', dayRate: 120 }

test('pay editor: the early pay-profile read gives the same starting record as reading after the users document', async () => {
  adoptCurrentOrganization('org-a', 'adm')
  setSecuritySwitchConfigForTests({ privatePayOrganizationIds: ['org-a'] })
  const reads: string[] = []
  const load = async (org: string, id: string) => {
    reads.push(`${org}/${id}`)
    return id === 'u1' ? { subjectId: 'u1', fields: { dayRate: 150 } } : null
  }
  const before = await payEditorRecord('org-a', 'u1', stored, load)
  reads.length = 0
  const early = startPayEditorProfileRead('org-a', 'u1', load)
  const after = await payEditorRecord('org-a', 'u1', stored, early)
  assert.deepEqual(after, before)
  assert.deepEqual(reads, ['org-a/u1'], 'one read, started early, not repeated')
  setSecuritySwitchConfigForTests(null)
})

test('pay editor: with privatePay off nothing is read early and the users document is unchanged', async () => {
  adoptCurrentOrganization('org-a', 'adm')
  setSecuritySwitchConfigForTests(null)
  let reads = 0
  const early = startPayEditorProfileRead('org-a', 'u1', async () => {
    reads += 1
    return { subjectId: 'u1', fields: { dayRate: 150 } }
  })
  const record = await payEditorRecord('org-a', 'u1', stored, early)
  await new Promise((resolve) => setTimeout(resolve, 0))
  assert.equal(reads, 0)
  assert.equal(record.dayRate, 120)
})

test('pay editor: another organisation or id is read normally; no organisation means the plain loader', async () => {
  setSecuritySwitchConfigForTests({ privatePayOrganizationIds: ['org-a', 'org-b'] })
  const reads: string[] = []
  const load = async (org: string, id: string) => {
    reads.push(`${org}/${id}`)
    return null
  }
  const early = startPayEditorProfileRead('org-a', 'u1', load)
  await early('org-b', 'u1')
  await early('org-a', 'u2')
  await early('org-a', 'u1')
  assert.deepEqual(reads.sort(), ['org-a/u1', 'org-a/u2', 'org-b/u1'])
  assert.equal(startPayEditorProfileRead('', 'u1', load), load)
  setSecuritySwitchConfigForTests(null)
})
