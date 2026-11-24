import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  orgComplianceReminderDayKey,
  orgComplianceReminderEmail,
  orgComplianceReminderLedgerAfter,
  orgComplianceReminderLedgerFields,
  orgComplianceReminderLedgerPath,
  orgComplianceReminderRecipients,
  orgComplianceRemindersDue,
  orgComplianceRemindersEnabled,
  parseOrgComplianceReminderLedger,
  type OrgComplianceReminderLedger,
} from './orgComplianceReminders'
import type { OrgComplianceDocuments, OrgComplianceEntry } from './orgCompliance'

const TZ = 'Europe/London'
const ms = (dayKey: string) => Date.parse(`${dayKey}T10:00:00Z`)

function entry(id: string, expiresOn: string | null, setDay: string, extra: Partial<OrgComplianceEntry> = {}): OrgComplianceEntry {
  return {
    id,
    section: 'insurance',
    docType: 'public_liability',
    title: `Doc ${id}`,
    issuer: '',
    reference: '',
    coverAmount: null,
    expiresOn,
    path: `organizations/o/compliance/u_${id}.pdf`,
    fileName: 'a.pdf',
    contentType: 'application/pdf',
    sizeBytes: 1,
    uploadedAtMs: ms(setDay),
    uploadedBy: 'u',
    updatedAtMs: ms(setDay),
    updatedBy: 'u',
    ...extra,
  }
}

function docs(...entries: OrgComplianceEntry[]): OrgComplianceDocuments {
  return { insurance: entries, trade: [], quality: [] }
}

test('1.85.0 threshold days: calendar months clamped, 7 calendar days', () => {
  assert.equal(orgComplianceReminderDayKey('2027-03-31', 'twoMonths'), '2027-01-31')
  assert.equal(orgComplianceReminderDayKey('2027-03-31', 'oneMonth'), '2027-02-28')
  assert.equal(orgComplianceReminderDayKey('2028-03-31', 'oneMonth'), '2028-02-29')
  assert.equal(orgComplianceReminderDayKey('2027-01-15', 'twoMonths'), '2026-11-15')
  assert.equal(orgComplianceReminderDayKey('2027-03-03', 'sevenDays'), '2027-02-24')
  assert.equal(orgComplianceReminderDayKey('nope', 'sevenDays'), null)
})

test('1.85.0 owner example: expiry set 1 month and 2 days away → no 2-month email, then 1 month and 7 days', () => {
  const setDay = '2026-11-24'
  const expiry = '2026-12-26' // 1 month and 2 days away; 1-month day 26 Nov, 7-day day 19 Dec
  const d = docs(entry('a', expiry, setDay))
  let ledger: OrgComplianceReminderLedger = { entries: {} }
  const sentLog: string[] = []
  for (let day = setDay; day <= '2027-01-05'; day = new Date(Date.parse(day) + 86_400_000).toISOString().slice(0, 10)) {
    const result = orgComplianceRemindersDue({ documents: d, todayKey: day, timeZone: TZ, sent: ledger })
    for (const r of result.due) sentLog.push(`${day}:${r.threshold}`)
    ledger = orgComplianceReminderLedgerAfter({ ledger: result.ledger, sent: result.due, todayKey: day })
  }
  assert.deepEqual(sentLog, ['2026-11-26:oneMonth', '2026-12-19:sevenDays'])
})

test('1.85.0 an expiry set long before gets all three, once each', () => {
  const d = docs(entry('a', '2027-03-31', '2026-06-01'))
  let ledger: OrgComplianceReminderLedger = { entries: {} }
  const log: string[] = []
  for (let day = '2027-01-01'; day <= '2027-04-10'; day = new Date(Date.parse(day) + 86_400_000).toISOString().slice(0, 10)) {
    const result = orgComplianceRemindersDue({ documents: d, todayKey: day, timeZone: TZ, sent: ledger })
    for (const r of result.due) log.push(`${day}:${r.threshold}:${r.daysLeft}`)
    ledger = orgComplianceReminderLedgerAfter({ ledger: result.ledger, sent: result.due, todayKey: day })
    // Stored and read back each day, as the function does.
    ledger = parseOrgComplianceReminderLedger(orgComplianceReminderLedgerFields(ledger))
  }
  assert.deepEqual(log, ['2027-01-31:twoMonths:59', '2027-02-28:oneMonth:31', '2027-03-24:sevenDays:7'])
})

test('1.85.0 never twice: a failed send is retried, a sent one is not; a second run on the same day adds nothing', () => {
  const d = docs(entry('a', '2027-03-31', '2026-06-01'))
  const first = orgComplianceRemindersDue({ documents: d, todayKey: '2027-01-31', timeZone: TZ, sent: null })
  assert.equal(first.due.length, 1)
  // Send failed: store the ledger without sends; tomorrow it is still due (same band).
  const next = orgComplianceRemindersDue({ documents: d, todayKey: '2027-02-01', timeZone: TZ, sent: first.ledger })
  assert.equal(next.due.length, 1)
  const after = orgComplianceReminderLedgerAfter({ ledger: next.ledger, sent: next.due, todayKey: '2027-02-01' })
  assert.equal(orgComplianceRemindersDue({ documents: d, todayKey: '2027-02-01', timeZone: TZ, sent: after }).due.length, 0)
  assert.equal(orgComplianceRemindersDue({ documents: d, todayKey: '2027-02-20', timeZone: TZ, sent: after }).due.length, 0)
})

test('1.85.0 only the current band: switched on late sends the 7-day email only', () => {
  const d = docs(entry('a', '2027-03-31', '2026-06-01'))
  const result = orgComplianceRemindersDue({ documents: d, todayKey: '2027-03-28', timeZone: TZ, sent: null })
  assert.deepEqual(result.due.map((r) => r.threshold), ['sevenDays'])
})

test('1.85.0 a changed expiry starts again from the new date; an edit of another field does not move the set day', () => {
  const original = entry('a', '2027-03-31', '2026-06-01')
  let r = orgComplianceRemindersDue({ documents: docs(original), todayKey: '2027-01-31', timeZone: TZ, sent: null })
  let ledger = orgComplianceReminderLedgerAfter({ ledger: r.ledger, sent: r.due, todayKey: '2027-01-31' })
  // Title edited on 1 Feb (updatedAtMs moves); the 1-month email on 28 Feb still goes (set day kept by the ledger).
  const edited = { ...original, title: 'Renamed', updatedAtMs: ms('2027-02-01') }
  r = orgComplianceRemindersDue({ documents: docs(edited), todayKey: '2027-02-01', timeZone: TZ, sent: ledger })
  ledger = orgComplianceReminderLedgerAfter({ ledger: r.ledger, sent: r.due, todayKey: '2027-02-01' })
  r = orgComplianceRemindersDue({ documents: docs(edited), todayKey: '2027-02-28', timeZone: TZ, sent: ledger })
  assert.deepEqual(r.due.map((x) => x.threshold), ['oneMonth'])
  ledger = orgComplianceReminderLedgerAfter({ ledger: r.ledger, sent: r.due, todayKey: '2027-02-28' })
  // Renewed on 1 Mar: expiry a year later, set today. Its 2-month email comes on 31 Jan 2028, never the old 7-day one.
  const renewed = { ...edited, expiresOn: '2028-03-31', updatedAtMs: ms('2027-03-01') }
  r = orgComplianceRemindersDue({ documents: docs(renewed), todayKey: '2027-03-24', timeZone: TZ, sent: ledger })
  assert.equal(r.due.length, 0)
  assert.equal(r.ledger.entries['insurance:a'].expiresOn, '2028-03-31')
  assert.deepEqual(r.ledger.entries['insurance:a'].sent, {})
  r = orgComplianceRemindersDue({ documents: docs(renewed), todayKey: '2028-01-31', timeZone: TZ, sent: r.ledger })
  assert.deepEqual(r.due.map((x) => x.threshold), ['twoMonths'])
})

test('1.85.0 removed, expired and no-expiry documents get nothing; removed ones leave the ledger', () => {
  const a = entry('a', '2027-03-31', '2026-06-01')
  const first = orgComplianceRemindersDue({ documents: docs(a), todayKey: '2027-01-31', timeZone: TZ, sent: null })
  const ledger = orgComplianceReminderLedgerAfter({ ledger: first.ledger, sent: first.due, todayKey: '2027-01-31' })
  const gone = orgComplianceRemindersDue({ documents: docs(), todayKey: '2027-02-28', timeZone: TZ, sent: ledger })
  assert.equal(gone.due.length, 0)
  assert.deepEqual(gone.ledger.entries, {})
  assert.equal(orgComplianceRemindersDue({ documents: docs(entry('b', null, '2026-06-01')), todayKey: '2027-02-28', timeZone: TZ }).due.length, 0)
  assert.equal(orgComplianceRemindersDue({ documents: docs(entry('c', '2027-02-27', '2026-06-01')), todayKey: '2027-02-28', timeZone: TZ }).due.length, 0)
  // Expires today: the 7-day band still holds today (sent when it was missed).
  assert.equal(orgComplianceRemindersDue({ documents: docs(entry('d', '2027-02-28', '2026-06-01')), todayKey: '2027-02-28', timeZone: TZ }).due[0].daysLeft, 0)
})

test('1.85.0 a threshold on the day the expiry was set is not sent (it was not ahead)', () => {
  // Expiry set exactly 7 days away: no email at all.
  const d = docs(entry('a', '2026-12-01', '2026-11-24'))
  assert.equal(orgComplianceRemindersDue({ documents: d, todayKey: '2026-11-24', timeZone: TZ }).due.length, 0)
  assert.equal(orgComplianceRemindersDue({ documents: d, todayKey: '2026-11-30', timeZone: TZ }).due.length, 0)
})

test('1.85.0 recipients: active admins with an email, one per address, never a ghost or pending invite', () => {
  const roster = [
    { id: 'A', email: 'Admin@x.com', isActive: true, passwordSet: true, role: { isAdmin: true }, displayName: 'Ann Admin' },
    { id: 'S', email: 'super@x.com', isActive: true, passwordSet: true, role: { isSuperAdmin: true, isAdmin: true }, displayName: 'Sam' },
    { id: 'M', email: 'm@x.com', isActive: true, passwordSet: true, role: { isManager: true } },
    { id: 'P', email: 'p@x.com', isActive: true, passwordSet: false, role: { isAdmin: true } },
    { id: 'I', email: 'i@x.com', isActive: false, passwordSet: true, role: { isAdmin: true } },
  ]
  const out = orgComplianceReminderRecipients(roster as never)
  assert.deepEqual(out.map((r) => r.email).sort(), ['admin@x.com', 'super@x.com'])
  assert.equal(out.find((r) => r.userId === 'A')?.firstName, 'Ann')
})

test('1.85.0 email words, switch and ledger path', () => {
  const r = orgComplianceRemindersDue({ documents: docs(entry('a', '2027-03-31', '2026-06-01')), todayKey: '2027-03-24', timeZone: TZ })
  const email = orgComplianceReminderEmail({ organizationName: 'Acme', reminders: r.due })!
  assert.equal(email.subject, 'Doc a expires 31 Mar 2027 — Acme')
  assert.equal(email.rows[0].whenText, 'Expires in 7 days')
  assert.equal(email.path, '/dashboard/settings/insurance-accreditations')
  assert.equal(orgComplianceReminderEmail({ organizationName: 'Acme', reminders: [] }), null)
  assert.equal(orgComplianceRemindersEnabled({ orgComplianceRemindersEnabled: true }), true)
  assert.equal(orgComplianceRemindersEnabled({ orgComplianceRemindersEnabled: 'true' }), false)
  assert.equal(orgComplianceRemindersEnabled(null), false)
  assert.equal(orgComplianceReminderLedgerPath('org1'), 'organizations/org1/orgCompliance/reminders')
  assert.equal(orgComplianceReminderLedgerPath('../x'), null)
})
