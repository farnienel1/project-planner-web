/**
 * Add User duplicate-name wiring (rulebook 1.36.0 §11, owner decision 10 Nov; review of #294): the warning is shown,
 * Add anyway resubmits with `nameConfirmed`, and the Ghost account path runs `ghostCreateError` first.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { addUserNameCheck } from './addUserNameCheck'

const sam = {
  id: 'u-sam',
  email: 'sam@example.com',
  firstName: 'Sam',
  surname: 'Smith',
  passwordSet: true,
  isActive: true,
  role: 'admin',
  adminAccess: true,
}

const validGhost = {
  firstName: 'Sam',
  surname: 'Smith',
  payBasis: 'day' as const,
  dayRate: 150,
  lineManagerIds: ['u-sam'],
}

test('1.36.0 Add User: a matching name stops the save with the warning', () => {
  const check = addUserNameCheck({ firstName: 'sam', surname: 'SMITH', roster: [sam], claimedEmails: null, nameConfirmed: false })
  assert.equal(check.kind, 'warn')
  assert.deepEqual(check.kind === 'warn' ? check.matches.map((m) => m.id) : [], ['u-sam'])
})

test('1.36.0 Add User: Add anyway (nameConfirmed) saves; no match saves', () => {
  assert.deepEqual(
    addUserNameCheck({ firstName: 'Sam', surname: 'Smith', roster: [sam], claimedEmails: null, nameConfirmed: true }),
    { kind: 'save' }
  )
  assert.deepEqual(
    addUserNameCheck({ firstName: 'Ann', surname: 'Other', roster: [sam], claimedEmails: null, nameConfirmed: false }),
    { kind: 'save' }
  )
})

test('1.36.0 Add User ghost path: ghostCreateError refuses before the duplicate-name warning, even after Add anyway', () => {
  const broken = { ...validGhost, dayRate: 0 }
  for (const nameConfirmed of [false, true]) {
    const check = addUserNameCheck({
      firstName: 'Sam',
      surname: 'Smith',
      roster: [sam],
      claimedEmails: null,
      nameConfirmed,
      ghost: { draft: broken, lineManagerRoster: [sam] },
    })
    assert.equal(check.kind, 'refuse')
  }
  // A valid ghost then reaches the duplicate-name warning.
  const ok = addUserNameCheck({
    firstName: 'Sam',
    surname: 'Smith',
    roster: [sam],
    claimedEmails: null,
    nameConfirmed: false,
    ghost: { draft: validGhost, lineManagerRoster: [sam] },
  })
  assert.equal(ok.kind, 'warn')
})

test('1.36.0 AddUserScreen wiring: both paths check, the modal resubmits with nameConfirmed, labels from the rulebook', () => {
  const screen = readFileSync(new URL('../../components/users/AddUserScreen.tsx', import.meta.url), 'utf8')
  assert.match(screen, /if \(stopBeforeSave\(firstName, surname, nameConfirmed, ghostDraft\)\) return/)
  assert.match(screen, /if \(stopBeforeSave\(firstName, surname, nameConfirmed\)\) return/)
  // Both checks come before anything is saved.
  const submit = screen.slice(screen.indexOf('const handleSubmit'))
  assert.ok(submit.indexOf('stopBeforeSave(firstName, surname, nameConfirmed, ghostDraft)') < submit.indexOf('await createGhost('))
  assert.ok(submit.indexOf('stopBeforeSave(firstName, surname, nameConfirmed)') < submit.indexOf('await inviteUser('))
  assert.match(screen, /void handleSubmit\(undefined, \{ nameConfirmed: true \}\)/)
  assert.match(screen, /open=\{duplicateMatches !== null\}/)
  for (const name of [
    'DUPLICATE_NAME_WARNING_TITLE',
    'DUPLICATE_NAME_WARNING_MESSAGE',
    'DUPLICATE_NAME_CONFIRM_LABEL',
    'DUPLICATE_NAME_CANCEL_LABEL',
    'sameNamePersonContactLabel(person)',
  ]) {
    assert.ok(screen.includes(name), name)
  }
  // No second name comparison in the screen.
  assert.equal(/toLowerCase\(\)\s*===/.test(screen.slice(screen.indexOf('const stopBeforeSave'), screen.indexOf('const handleSubmit'))), false)
})
