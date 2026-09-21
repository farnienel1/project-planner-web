import { test } from 'node:test'
import assert from 'node:assert/strict'
import { managerExportEmailHTML, paymentRunDateStamp } from './timesheetExport.ts'

test('paymentRunDateStamp matches iOS dd.MM.yy dd.MM.yy', () => {
  assert.equal(
    paymentRunDateStamp(new Date('2026-09-16T12:00:00Z'), new Date('2026-09-30T12:00:00Z'), 'Europe/London'),
    '16.09.26 30.09.26'
  )
})

test('manager export email lists download links for filing', () => {
  const html = managerExportEmailHTML({
    recipientName: 'Alex',
    weekTitle: '16 – 30 September 2026',
    paymentRunStamp: '16.09.26 30.09.26',
    organizationName: 'Acme',
    attachmentNames: ['Ada Booked timesheet for payment run date 16.09.26 30.09.26.html'],
    downloadLinks: [
      {
        fileName: 'Ada Booked timesheet for payment run date 16.09.26 30.09.26.html',
        url: 'https://example.com/export.html',
      },
    ],
    timesheetCount: 1,
  })
  assert.match(html, /Signed timesheets for filing/)
  assert.match(html, /Hello Alex/)
  assert.match(html, /https:\/\/example.com\/export.html/)
  assert.match(html, /16.09.26 30.09.26/)
})
