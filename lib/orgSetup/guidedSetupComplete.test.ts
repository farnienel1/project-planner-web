import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { GuidedSetupData } from '../../components/setup/GuidedOrgSetup.tsx'
import { hasRequiredGuidedProject } from './guidedSetupComplete.ts'

function emptyGuided(): GuidedSetupData {
  return {
    project: { jobNumber: '', siteName: '', jobType: 'CAT A', startDate: '', endDate: '', clientName: '' },
    client: { name: '', email: '', phone: '' },
    subcontractor: {
      name: '',
      tradeType: '',
      website: '',
      address: '',
      contactName: '',
      contactEmail: '',
      contactNumber: '',
    },
    wholesaler: {
      name: '',
      trade: '',
      address: '',
      accountNumber: '',
      contactName: '',
      contactEmail: '',
    },
    qualification: { name: '', hasEndDate: false },
    jobType: { name: '' },
  }
}

test('empty guided setup is not enough to persist a project', () => {
  assert.equal(hasRequiredGuidedProject(emptyGuided()), false)
})

test('a filled project plus client name is enough', () => {
  const data = emptyGuided()
  data.project = {
    jobNumber: 'J-1',
    siteName: 'Site A',
    jobType: 'CAT A',
    startDate: '2026-01-01',
    endDate: '2026-02-01',
    clientName: 'Acme',
  }
  assert.equal(hasRequiredGuidedProject(data), true)
})

test('client step name can stand in for project.clientName', () => {
  const data = emptyGuided()
  data.project = {
    jobNumber: 'J-1',
    siteName: 'Site A',
    jobType: 'CAT A',
    startDate: '2026-01-01',
    endDate: '2026-02-01',
    clientName: '',
  }
  data.client.name = 'Acme'
  assert.equal(hasRequiredGuidedProject(data), true)
})
