import assert from 'node:assert/strict'
import test from 'node:test'
import {
  initialWarningSettingsSaveState,
  stepWarningSettingsSave,
  warningSettingsSaveLabel,
  type WarningSettingsSaveState,
} from './warningSettingsSave.ts'

function run(events: Parameters<typeof stepWarningSettingsSave>[1][], start: WarningSettingsSaveState = initialWarningSettingsSaveState) {
  const steps = []
  let state = start
  for (const event of events) {
    const step = stepWarningSettingsSave(state, event)
    steps.push(step)
    state = step.state
  }
  return steps
}

test('Save stays on the screen and the control becomes Saved', () => {
  const steps = run([{ type: 'edit' }, { type: 'save' }, { type: 'saveSucceeded' }])
  assert.equal(warningSettingsSaveLabel(steps[1].state.phase), 'Saving…')
  assert.equal(steps[1].persist, true)
  assert.equal(steps[1].leave, false)
  assert.equal(warningSettingsSaveLabel(steps[2].state.phase), 'Saved')
  assert.equal(steps[2].leave, false)
})

test('Back with unsaved edits stays on the page and does not write', () => {
  const steps = run([{ type: 'edit' }, { type: 'back' }])
  assert.equal(steps[1].persist, false)
  assert.equal(steps[1].leave, false)
  assert.equal(steps[1].state.phase, 'dirty')
})

test('Back during Saving stays on the page', () => {
  const steps = run([{ type: 'edit' }, { type: 'save' }, { type: 'back' }])
  assert.equal(steps[2].leave, false)
  assert.equal(warningSettingsSaveLabel(steps[2].state.phase), 'Saving…')
  assert.equal(steps[2].persist, false)
})

test('a failed save stays on the screen and does not say Saved', () => {
  const steps = run([{ type: 'edit' }, { type: 'save' }, { type: 'saveFailed' }])
  assert.equal(steps[2].leave, false)
  assert.equal(steps[2].state.phase, 'error')
  assert.equal(warningSettingsSaveLabel(steps[2].state.phase), 'Save')
  assert.equal(steps[2].state.leaveWhenSaved, false)
})

test('Back after Saved leaves immediately, and a clean Back does not write', () => {
  const saved = run([{ type: 'edit' }, { type: 'save' }, { type: 'saveSucceeded' }, { type: 'back' }])
  assert.equal(saved[3].leave, true)
  assert.equal(saved[3].persist, false)
  const clean = stepWarningSettingsSave(initialWarningSettingsSaveState, { type: 'back' })
  assert.equal(clean.leave, true)
  assert.equal(clean.persist, false)
})
