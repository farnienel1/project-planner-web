/**
 * Pay strip: after `scripts/backfill-pay-profiles.mjs --strip`, `users/{uid}` holds no `employmentType`, `payBasis`,
 * `dayRate`, `hourlyRate` or employment transition; the pay lives only in `payProfiles/{uid}`. Each test below builds
 * the session user from such a stripped users document (as `authStore` does) plus the person's pay profile, shows the
 * stripped document alone gives the wrong answer, and that the fixed path gives the right one. The last tests prove
 * nothing changes while `privatePay` is off.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseAppUserDocument } from '../ios-parity/converters.ts'
import { setSecuritySwitchConfigForTests } from '../access/securitySwitches.ts'
import {
  notePayOperativesOverlaid,
  notePayRosterOverlaid,
  payProfileCacheVersion,
  payProfilesStatusFor,
  resetPayProfilesForTests,
  setPayProfilesForTests,
  setPayProfilesInFlightForTests,
} from './payProfileOverlay.ts'
import { ownPayState, readOwnPayProfile, userWithPayProfile, withOwnPay, type OwnPayRead } from './ownPayRecord.ts'
import { canAccessMyTimesheetsWithPolicy } from '../timesheets/timesheetPayrollPolicy.ts'
import { canSelfBookMySchedule, shouldShowTimesheetsDisabledMessage } from '../permissions.ts'
import { receivesTimesheetSubmissionReminder } from '../timesheets/deliverTimesheetSubmissionReminders.ts'
import { timesheetReminderAudience } from '../timesheets/timesheetReminderAudience.ts'
import { reopenPayePreCheck } from '../overtime/overtimeReopenNotice.ts'
import { payProfilesInputLoad, timesheetInputsStatus } from '../timesheets/timesheetInputs.ts'
import { DEFAULT_INVOICING, employmentTypeOnDay, overtimeHubAccess, readStoredRates } from '../canonical/index.ts'
import { rulebookPerson, rulebookRoster } from '../staff/rulebookPeople.ts'
import type { PayProfileDocument } from '../canonical/index.ts'
import type { User } from '../../types/index.ts'

const ORG = 'org-strip'
const NOW = new Date('2026-11-16T10:00:00Z')
const TZ = 'Europe/London'

/** A PAYE manager's users document after the strip: no pay fields, no stored `timesheetsEnabled`. */
const strippedDoc: Record<string, unknown> = {
  organizationId: ORG,
  email: 'pam@firm.test',
  firstName: 'Pam',
  surname: 'Paye',
  role: 'manager',
  manager: true,
  isActive: true,
  passwordSet: true,
}
const payeProfile: PayProfileDocument = {
  subjectId: 'pam',
  fields: { employmentType: 'paye', payBasis: 'day', dayRate: 210 },
}

function sessionUser(doc: Record<string, unknown> = strippedDoc, id = 'pam'): User {
  const parsed = parseAppUserDocument(id, doc)
  assert.ok(parsed.ok)
  return parsed.value
}

const found = (profile: PayProfileDocument): OwnPayRead => ({ status: 'found', profile })

function on(): void {
  setSecuritySwitchConfigForTests({ privatePayOrganizationIds: [ORG] })
}
function off(): void {
  setSecuritySwitchConfigForTests({ privatePayOrganizationIds: ['org-other'] })
}

test('pay strip 1 (TimesheetsHub): a PAYE person does not get My Timesheets from a stripped users document', () => {
  const stripped = sessionUser()
  // The bug: the stripped document reads as self-employed.
  assert.equal(canAccessMyTimesheetsWithPolicy(stripped, DEFAULT_INVOICING, NOW, TZ), true)
  const own = ownPayState({ user: stripped, rawDocument: strippedDoc, switchesLoaded: true, privatePay: true, read: found(payeProfile) })
  assert.equal(own.status, 'ready')
  assert.equal(own.overlaid, true)
  const me = own.user as User
  assert.equal(me.employmentType, 'paye')
  assert.equal(canAccessMyTimesheetsWithPolicy(me, DEFAULT_INVOICING, NOW, TZ), false)
  assert.equal(shouldShowTimesheetsDisabledMessage(me, false), true)
  // The roster row (the same stripped document) takes the own pay too (subject of My Timesheets, overtime viewer).
  const row = withOwnPay(stripped, own)
  assert.equal(row.employmentType, 'paye')
  assert.equal(overtimeHubAccess({ viewer: rulebookPerson(row, [row]), roster: rulebookRoster([row]) }).mine, true)
  assert.equal(overtimeHubAccess({ viewer: rulebookPerson(stripped, [stripped]), roster: rulebookRoster([stripped]) }).mine, false)
  // Until the own read answers, My Timesheets is not decided (the hub shows neither My Timesheets nor the notice).
  assert.equal(ownPayState({ user: stripped, rawDocument: strippedDoc, switchesLoaded: true, privatePay: true, read: null }).status, 'loading')
})

test('pay strip 2 (My Profile): the rate and employment type come from the own pay profile, own id first, then former ids', async () => {
  const stripped = sessionUser()
  assert.equal(readStoredRates(stripped).dayRate, null)
  assert.equal(employmentTypeOnDay(stripped, NOW, TZ), 'self_employed')
  const me = ownPayState({ user: stripped, rawDocument: strippedDoc, switchesLoaded: true, privatePay: true, read: found(payeProfile) }).user as User
  assert.equal(readStoredRates(me).dayRate, 210)
  assert.equal(readStoredRates(me).payBasis, 'day')
  assert.equal(employmentTypeOnDay(me, NOW, TZ), 'paye')

  const reads: string[] = []
  const read = async (_org: string, id: string): Promise<OwnPayRead> => {
    reads.push(id)
    if (id === 'INVITE-1') return found({ subjectId: 'INVITE-1', fields: { payBasis: 'hourly', hourlyRate: 30 } })
    return { status: 'missing', profile: null }
  }
  const result = await readOwnPayProfile(ORG, { id: 'pam', formerUserIds: ['INVITE-1', 'INVITE-2'] }, read)
  assert.deepEqual(reads, ['pam', 'INVITE-1'])
  assert.equal(result.profile?.subjectId, 'INVITE-1')
  // A refused / offline read is `failed`, never "missing" (which would read as self-employed).
  const failed = await readOwnPayProfile(ORG, { id: 'pam' }, async () => ({ status: 'failed', profile: null }))
  assert.equal(failed.status, 'failed')
  assert.equal(ownPayState({ user: stripped, rawDocument: strippedDoc, switchesLoaded: true, privatePay: true, read: failed }).status, 'failed')
})

test('pay strip 2b (My Schedule): a PAYE manager with no stored timesheetsEnabled does not self-book after the strip', () => {
  const stripped = sessionUser()
  assert.equal(stripped.timesheetsEnabled, true)
  assert.equal(canSelfBookMySchedule(stripped), true)
  const me = userWithPayProfile(stripped, payeProfile, { privatePay: true, rawDocument: strippedDoc })
  assert.equal(me.timesheetsEnabled, false)
  assert.equal(canSelfBookMySchedule(me), false)
  // A stored value is kept.
  const storedOn = { ...strippedDoc, timesheetsEnabled: true }
  assert.equal(userWithPayProfile(sessionUser(storedOn), payeProfile, { privatePay: true, rawDocument: storedOn }).timesheetsEnabled, true)
})

test('pay strip 3 (reminders): only people whose employment type the viewer read are reminded', () => {
  const pam = sessionUser()
  const se = sessionUser({ ...strippedDoc, email: 'sam@firm.test', firstName: 'Sam' }, 'sam')
  const own = ownPayState({ user: pam, rawDocument: strippedDoc, switchesLoaded: true, privatePay: true, read: found(payeProfile) })
  // The bug: the stripped roster row of a PAYE person is reminded.
  assert.equal(receivesTimesheetSubmissionReminder(pam, NOW, TZ), true)
  // A non-admin sends only their own, from their own pay: a PAYE person sends none.
  const mine = timesheetReminderAudience({ privatePay: true, viewerReadsEveryPay: false, payProfiles: 'ready', roster: [pam, se], own })
  assert.deepEqual(mine.map((row) => row.id), ['pam'])
  assert.equal(mine.filter((row) => receivesTimesheetSubmissionReminder(row, NOW, TZ)).length, 0)
  // An admin before the roster overlay landed: only themself.
  assert.deepEqual(
    timesheetReminderAudience({ privatePay: true, viewerReadsEveryPay: true, payProfiles: 'loading', roster: [pam, se], own }).map((row) => row.id),
    ['pam']
  )
  // An admin once it landed: everyone, the viewer's row with their own pay.
  const all = timesheetReminderAudience({ privatePay: true, viewerReadsEveryPay: true, payProfiles: 'ready', roster: [pam, se], own })
  assert.deepEqual(all.map((row) => row.id), ['pam', 'sam'])
  assert.equal(all[0].employmentType, 'paye')
  // The own read not back yet (or failed): nobody.
  assert.deepEqual(
    timesheetReminderAudience({ privatePay: true, viewerReadsEveryPay: false, payProfiles: 'ready', roster: [pam], own: { ...own, status: 'loading' } }),
    []
  )
})

test('pay strip 4 (overtime reopen): an unreadable pay profile does not skip the reopen check', () => {
  const stripped = sessionUser()
  // The bug: the stripped row says self-employed, so the check returned early.
  assert.equal(stripped.employmentType, 'self_employed')
  assert.equal(reopenPayePreCheck({ privatePay: true, person: stripped, profile: null }), 'unknown')
  assert.equal(reopenPayePreCheck({ privatePay: true, person: stripped, profile: payeProfile }), 'paye')
  assert.equal(
    reopenPayePreCheck({ privatePay: true, person: stripped, profile: { subjectId: 'pam', fields: { employmentType: 'self_employed' } } }),
    'notPaye'
  )
  // A profile with no employment type says nothing.
  assert.equal(reopenPayePreCheck({ privatePay: true, person: stripped, profile: { subjectId: 'pam', fields: { dayRate: 1 } } }), 'unknown')
})

test('pay strip 5 (sign / invoice / export / reports): wait for the pay laid over the roster and operatives', () => {
  resetPayProfilesForTests()
  on()
  assert.equal(payProfilesStatusFor(ORG), 'loading')
  setPayProfilesForTests(ORG, [payeProfile])
  // Read, but the roster was not parsed with it yet.
  assert.equal(payProfilesStatusFor(ORG), 'loading')
  notePayRosterOverlaid(ORG, payProfileCacheVersion() - 1)
  assert.equal(payProfilesStatusFor(ORG), 'loading')
  notePayRosterOverlaid(ORG, payProfileCacheVersion())
  assert.equal(payProfilesStatusFor(ORG), 'ready')
  // Operatives rows parsed with an older cache hold the screen too.
  notePayOperativesOverlaid(ORG, payProfileCacheVersion() - 1)
  assert.equal(payProfilesStatusFor(ORG), 'loading')
  notePayOperativesOverlaid(ORG, payProfileCacheVersion())
  assert.equal(payProfilesStatusFor(ORG), 'ready')
  // A new read that changes the cache re-opens the wait until the roster is read again.
  setPayProfilesForTests(ORG, [{ ...payeProfile, fields: { ...payeProfile.fields, dayRate: 220 } }])
  assert.equal(payProfilesStatusFor(ORG), 'loading')

  // The timesheet inputs (sign, counter-sign, Generate invoice, Export) stay closed with the existing message.
  const waiting = timesheetInputsStatus({ details: 'loaded', history: 'loaded', payProfiles: payProfilesInputLoad('loading', 'ready') })
  assert.equal(waiting.ready, false)
  assert.equal(waiting.message, 'Loading pay settings and rate history…')
  assert.equal(timesheetInputsStatus({ details: 'loaded', history: 'loaded', payProfiles: payProfilesInputLoad('ready', 'loading') }).ready, false)
  assert.equal(timesheetInputsStatus({ details: 'loaded', history: 'loaded', payProfiles: payProfilesInputLoad('failed', 'ready') }).failed, true)
  assert.equal(timesheetInputsStatus({ details: 'loaded', history: 'loaded', payProfiles: payProfilesInputLoad('ready', 'ready') }).ready, true)
  // Callers that pass no pay-profile state are unchanged.
  assert.equal(timesheetInputsStatus({ details: 'loaded', history: 'loaded' }).ready, true)
  resetPayProfilesForTests()
  setSecuritySwitchConfigForTests(null)
})

test('pay strip: privatePay off — everything reads exactly as before', () => {
  resetPayProfilesForTests()
  off()
  const withPay = { ...strippedDoc, employmentType: 'self_employed', payBasis: 'day', dayRate: 180 }
  const user = sessionUser(withPay)
  // A stale pay profile is never read in.
  const own = ownPayState({ user, rawDocument: withPay, switchesLoaded: true, privatePay: false, read: found(payeProfile) })
  assert.equal(own.user, user)
  assert.equal(own.status, 'ready')
  assert.equal(own.overlaid, false)
  assert.equal(withOwnPay(user, own), user)
  assert.equal(userWithPayProfile(user, payeProfile, { privatePay: false, rawDocument: withPay }), user)
  assert.equal(canAccessMyTimesheetsWithPolicy(own.user as User, DEFAULT_INVOICING, NOW, TZ), true)
  assert.equal(readStoredRates(own.user as User).dayRate, 180)
  // Reminders: the roster as given.
  const roster = [user]
  const audience = timesheetReminderAudience({ privatePay: false, viewerReadsEveryPay: false, payProfiles: 'loading', roster, own })
  assert.deepEqual(audience, roster)
  // Overtime reopen: the row's employment type, as before.
  assert.equal(reopenPayePreCheck({ privatePay: false, person: user, profile: payeProfile }), 'notPaye')
  assert.equal(reopenPayePreCheck({ privatePay: false, person: { employmentType: 'paye' }, profile: null }), 'paye')
  // No wait for pay profiles.
  assert.equal(payProfilesStatusFor(ORG), 'ready')
  setSecuritySwitchConfigForTests(null)
})

// ---- Coordinator checklist (a)–(e): the iOS twin's failure modes ----

test('(a) before platformConfig/app is read, privatePay is unknown, not off: nothing is decided', async () => {
  const { setSecuritySwitchesUnreadForTests, securitySwitchesLoaded } = await import('../access/securitySwitches.ts')
  resetPayProfilesForTests()
  setSecuritySwitchesUnreadForTests()
  assert.equal(securitySwitchesLoaded(), false)
  // Sign / counter-sign / invoice / export / reports wait.
  assert.equal(payProfilesStatusFor(ORG), 'loading')
  // My Timesheets is not decided (and so the reminders audience is empty).
  const stripped = sessionUser()
  const own = ownPayState({ user: stripped, rawDocument: strippedDoc, switchesLoaded: false, privatePay: false, read: null })
  assert.equal(own.status, 'loading')
  assert.deepEqual(timesheetReminderAudience({ privatePay: true, viewerReadsEveryPay: false, payProfiles: 'loading', roster: [stripped], own }), [])
  // The reminder sender reads nobody while the switches are unknown — it waits (review #342 item 6: it no longer gives
  // up for the session), then runs once they are read.
  const { deliverTimesheetRemindersForViewer } = await import('../timesheets/deliverTimesheetSubmissionReminders.ts')
  let settled = false
  const sending = deliverTimesheetRemindersForViewer(ORG, [stripped]).then((count) => {
    settled = true
    return count
  })
  await new Promise((resolve) => setTimeout(resolve, 50))
  assert.equal(settled, false)
  // The overtime reopen pre-check treats unknown as on (never trusts a stripped row).
  assert.equal(reopenPayePreCheck({ privatePay: true, person: stripped, profile: null }), 'unknown')
  setSecuritySwitchConfigForTests(null)
  // No Firestore in tests: the off path reaches the sender, which writes nothing.
  assert.equal(await sending, 0)
})

test('(b) a refused or failed pay read is not settled — per person, never the whole organisation for one person', async () => {
  const { payProfileReadFailures, payProfileReadErrorKind } = await import('./payProfileOverlay.ts')
  assert.equal(payProfileReadErrorKind({ code: 'permission-denied' }), 'refused')
  assert.equal(payProfileReadErrorKind({ code: 'unavailable' }), 'offline')
  assert.equal(payProfileReadErrorKind(new Error('timeout')), 'offline')
  const none = new Set<string>()
  // A refused planned read fails that person only, earlier answer or not.
  assert.deepEqual(
    payProfileReadFailures(
      [
        { kind: 'read', planned: true, id: 'lm', subjectId: 'lm' },
        { kind: 'refused', planned: true, id: 'B', subjectId: 'B' },
      ],
      { answeredBefore: new Set(['b']) }
    ),
    { wholeOrganization: false, failedSubjectIds: ['b'] }
  )
  // A refused former invite id does not count (the rules may refuse an id with no users document).
  assert.deepEqual(
    payProfileReadFailures([{ kind: 'refused', planned: false, id: 'OLD', subjectId: 'a' }], { answeredBefore: none }),
    { wholeOrganization: false, failedSubjectIds: [] }
  )
  // A former id not reached with nothing read before fails its person (it may hold their pay).
  assert.deepEqual(
    payProfileReadFailures([{ kind: 'offline', planned: false, id: 'OLD', subjectId: 'a' }], { answeredBefore: none }).failedSubjectIds,
    ['a']
  )
  // The whole-collection read (admins): a refusal, or offline with nothing read before, fails the organisation.
  assert.equal(payProfileReadFailures([{ kind: 'refused', planned: true, id: '*' }], { answeredBefore: new Set(['*']) }).wholeOrganization, true)
  assert.equal(payProfileReadFailures([{ kind: 'offline', planned: true, id: '*' }], { answeredBefore: none }).wholeOrganization, true)
  // Failed blocks sign / counter-sign / invoice / export with the failed message (the banner offers Retry).
  const blocked = timesheetInputsStatus({ details: 'loaded', history: 'loaded', payProfiles: payProfilesInputLoad('failed', 'ready') })
  assert.equal(blocked.ready, false)
  assert.equal(blocked.failed, true)
  assert.match(String(blocked.message), /cannot be signed, invoiced or exported/)
})

test('(c) a failed own pay read never decides from the stripped document; the last good read stands', async () => {
  const { ownPayReadAfter } = await import('./ownPayRecord.ts')
  const stripped = sessionUser()
  const failedRead: OwnPayRead = { status: 'failed', profile: null }
  const refusedRead: OwnPayRead = { status: 'refused', profile: null }
  // No earlier answer: failed — My Timesheets and reminders are not decided.
  const failedState = ownPayState({ user: stripped, rawDocument: strippedDoc, switchesLoaded: true, privatePay: true, read: ownPayReadAfter(null, failedRead) })
  assert.equal(failedState.status, 'failed')
  assert.deepEqual(timesheetReminderAudience({ privatePay: true, viewerReadsEveryPay: false, payProfiles: 'ready', roster: [stripped], own: failedState }), [])
  assert.equal(ownPayState({ user: stripped, rawDocument: strippedDoc, switchesLoaded: true, privatePay: true, read: refusedRead }).status, 'failed')
  // Offline after an answer: the last good overlaid record stands.
  const kept = ownPayReadAfter(found(payeProfile), failedRead)
  const keptState = ownPayState({ user: stripped, rawDocument: strippedDoc, switchesLoaded: true, privatePay: true, read: kept })
  assert.equal(keptState.status, 'ready')
  assert.equal(keptState.user?.employmentType, 'paye')
  assert.equal(canAccessMyTimesheetsWithPolicy(keptState.user as User, DEFAULT_INVOICING, NOW, TZ), false)
  // A refusal never keeps it.
  assert.equal(ownPayReadAfter(found(payeProfile), refusedRead).status, 'refused')
  // The own id refused → refused; a former id refused → missing (not a failure).
  assert.equal((await readOwnPayProfile(ORG, { id: 'pam' }, async () => refusedRead)).status, 'refused')
  assert.equal(
    (await readOwnPayProfile(ORG, { id: 'pam', formerUserIds: ['OLD'] }, async (_o, id) => (id === 'OLD' ? refusedRead : { status: 'missing', profile: null }))).status,
    'missing'
  )
})

test('(d) a roster refresh does not flip readiness back to loading; only a change does', () => {
  resetPayProfilesForTests()
  on()
  setPayProfilesForTests(ORG, [payeProfile])
  notePayRosterOverlaid(ORG, payProfileCacheVersion())
  assert.equal(payProfilesStatusFor(ORG), 'ready')
  // A refresh in flight does not re-open the wait once a read has answered — no flicker.
  setPayProfilesInFlightForTests(new Promise<boolean>(() => {}))
  assert.equal(payProfilesStatusFor(ORG), 'ready')
  setPayProfilesInFlightForTests(null)
  // The same answer again (a refresh with no change) keeps the version and the status.
  const before = payProfileCacheVersion()
  setPayProfilesForTests(ORG, [payeProfile])
  notePayRosterOverlaid(ORG, payProfileCacheVersion())
  assert.equal(payProfilesStatusFor(ORG), 'ready')
  assert.ok(payProfileCacheVersion() > before)
  // The counter-signature and its frozen snapshot are one write (`persist` builds `weeklyReportOverride` and saves it
  // in the same draft, and throws while the inputs are not ready), so readiness at the save covers both.
  assert.equal(timesheetInputsStatus({ details: 'loaded', history: 'loaded', payProfiles: payProfilesInputLoad(payProfilesStatusFor(ORG), 'ready') }).ready, true)
  resetPayProfilesForTests()
  setSecuritySwitchConfigForTests(null)
})

test('(e) the cached answer is used offline only, never after a refusal', async () => {
  const { payProfileReadFailures } = await import('./payProfileOverlay.ts')
  const { ownPayReadAfter } = await import('./ownPayRecord.ts')
  const before = new Set(['*', 'a'])
  assert.equal(payProfileReadFailures([{ kind: 'offline', planned: true, id: '*' }], { answeredBefore: before }).wholeOrganization, false)
  assert.deepEqual(payProfileReadFailures([{ kind: 'offline', planned: true, id: 'a', subjectId: 'a' }], { answeredBefore: before }).failedSubjectIds, [])
  assert.deepEqual(payProfileReadFailures([{ kind: 'refused', planned: true, id: 'a', subjectId: 'a' }], { answeredBefore: before }).failedSubjectIds, ['a'])
  assert.equal(ownPayReadAfter(found(payeProfile), { status: 'failed', profile: null }).status, 'found')
  assert.equal(ownPayReadAfter(found(payeProfile), { status: 'refused', profile: null }).status, 'refused')
})
