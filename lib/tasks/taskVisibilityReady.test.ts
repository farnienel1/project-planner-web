import { test } from 'node:test'
import assert from 'node:assert/strict'
import { taskVisibilityReady } from './taskVisibilityReady'

const manager = { isSuperAdmin: false, isAdmin: false, isManager: true, isOperativeMode: false }
const admin = { isSuperAdmin: false, isAdmin: true, isManager: false, isOperativeMode: false }
const loaded = {
  orgId: 'o1',
  projectsLoadedOrgId: 'o1',
  smallWorksLoadedOrgId: 'o1',
  operativesLoadedOrgId: 'o1',
  managersLoadedOrgId: 'o1',
  rosterServerOrgId: 'o1',
}

test('admin is ready at once', () => {
  assert.equal(taskVisibilityReady({ role: admin, orgId: 'o1' }), true)
})

test('manager waits for jobs, rows and the server roster', () => {
  assert.equal(taskVisibilityReady({ role: manager, ...loaded }), true)
  assert.equal(taskVisibilityReady({ role: manager, ...loaded, projectsLoadedOrgId: null }), false)
  assert.equal(taskVisibilityReady({ role: manager, ...loaded, rosterServerOrgId: null }), false)
  assert.equal(taskVisibilityReady({ role: manager, ...loaded, rosterServerOrgId: 'other' }), false)
  assert.equal(taskVisibilityReady({ role: manager, ...loaded, managersLoadedOrgId: null }), false)
})

test('a job page that holds its job does not wait for the job lists', () => {
  assert.equal(
    taskVisibilityReady({ role: manager, ...loaded, projectsLoadedOrgId: null, smallWorksLoadedOrgId: null, hasOwnJobs: true }),
    true
  )
})

test('no org or no role is never ready', () => {
  assert.equal(taskVisibilityReady({ role: manager, ...loaded, orgId: null }), false)
  assert.equal(taskVisibilityReady({ role: null, orgId: 'o1' }), false)
})

import { taskFilterInputsLoaded, taskVisibilityPhase } from './taskVisibilityReady'

test('a failed or timed-out load is failed, never loading for ever', () => {
  assert.equal(taskVisibilityPhase({ role: manager, ...loaded, rosterServerOrgId: null }), 'loading')
  assert.equal(taskVisibilityPhase({ role: manager, ...loaded, rosterServerOrgId: null, loadErrors: [null, 'boom'] }), 'failed')
  assert.equal(taskVisibilityPhase({ role: manager, ...loaded, projectsLoadedOrgId: null, timedOut: true }), 'failed')
  assert.equal(taskVisibilityPhase({ role: manager, ...loaded, loadErrors: ['boom'] }), 'ready')
  assert.equal(taskVisibilityPhase({ role: admin, orgId: 'o1', timedOut: true }), 'ready')
})

test('filters are pruned only once every input has loaded, admins included', () => {
  assert.equal(taskFilterInputsLoaded({ ...loaded, tasksLoadedOrgId: 'o1' }), true)
  assert.equal(taskFilterInputsLoaded({ ...loaded, tasksLoadedOrgId: null }), false)
  assert.equal(taskFilterInputsLoaded({ ...loaded, tasksLoadedOrgId: 'o1', projectsLoadedOrgId: null }), false)
  assert.equal(taskFilterInputsLoaded({ ...loaded, tasksLoadedOrgId: 'o1', orgId: null }), false)
})
