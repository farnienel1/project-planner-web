import assert from 'node:assert/strict'
import test from 'node:test'
import {
  TIMESHEET_EXPORT_RECIPIENT_REFUSED_MESSAGE,
  TIMESHEET_EXPORT_TYPED_RECIPIENTS_MAX,
  timesheetExportRecipientCheck,
} from './exportEmailRecipients'

test('1.54.1 export email: only the signed-in email, case and spaces ignored', () => {
  assert.deepEqual(timesheetExportRecipientCheck({ requested: ' Ada@Example.com ', callerEmail: 'ada@example.com' }), {
    allowed: true,
    recipient: 'ada@example.com',
  })
  // Nothing requested: the caller's own address.
  assert.deepEqual(timesheetExportRecipientCheck({ requested: undefined, callerEmail: 'Ada@example.com' }), {
    allowed: true,
    recipient: 'ada@example.com',
  })
  assert.equal(TIMESHEET_EXPORT_TYPED_RECIPIENTS_MAX, 0)
})

test('1.54.1 export email: any other address is refused, and no sign-in email means no send', () => {
  const other = timesheetExportRecipientCheck({ requested: 'outsider@evil.example', callerEmail: 'ada@example.com' })
  assert.equal(other.allowed, false)
  assert.equal(other.allowed === false && other.message, TIMESHEET_EXPORT_RECIPIENT_REFUSED_MESSAGE)
  const none = timesheetExportRecipientCheck({ requested: 'ada@example.com', callerEmail: null })
  assert.equal(none.allowed === false && none.reason, 'no_caller_email')
})
