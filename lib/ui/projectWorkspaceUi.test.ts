import { test } from 'node:test'
import assert from 'node:assert/strict'
import { projectJobKind, projectStatusTone } from './projectWorkspaceUi.ts'
import { workStatusLabel } from '../projects/workStatus.ts'

test('only the Active label gets the green tone', () => {
  assert.equal(projectStatusTone(workStatusLabel('active')), 'active')
  assert.equal(projectStatusTone(workStatusLabel('upcoming')), 'neutral')
  assert.equal(projectStatusTone(workStatusLabel('completed')), 'neutral')
  assert.equal(projectStatusTone(workStatusLabel('inactive')), 'neutral')
  assert.equal(projectStatusTone(''), 'neutral')
})

test('job kind follows the collection: projects green, small works amber', () => {
  assert.equal(projectJobKind(false), 'proj')
  assert.equal(projectJobKind(true), 'sw')
})
