import { test } from 'node:test'
import assert from 'node:assert/strict'
import { managerExportEmailHTML, paymentRunDateStamp, invoiceRateChangeNotes, timesheetExportFileName } from './timesheetExport.ts'
import type { User } from '../../types/index.ts'
import { emptyDayRateHistory } from './dayRateHistoryStorage.ts'

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
    attachmentNames: ['Ada Booked timesheet for payment run date 16.09.26 30.09.26.pdf'],
    downloadLinks: [
      {
        fileName: 'Ada Booked timesheet for payment run date 16.09.26 30.09.26.pdf',
        url: 'https://example.com/export.pdf',
      },
    ],
    timesheetCount: 1,
  })
  assert.match(html, /Signed timesheets for filing/)
  assert.match(html, /Hello Alex/)
  assert.match(html, /https:\/\/example.com\/export.pdf/)
  assert.match(html, /16.09.26 30.09.26/)
})

test('timesheetExportFileName matches iOS PDF naming', () => {
  assert.equal(
    timesheetExportFileName('Ada Booked', '16.09.26 30.09.26'),
    'Ada Booked timesheet for payment run date 16.09.26 30.09.26.pdf'
  )
})

test('invoiceRateChangeNotes includes in-period user history like iOS', () => {
  const user = {
    id: 'u1',
    email: 'ada@x.com',
    firstName: 'Ada',
    surname: 'Booked',
    organizationId: 'org',
    role: 'operative',
    passwordSet: true,
    policyAccepted: true,
    permissions: {
      adminAccess: false,
      manager: false,
      operatives: false,
      skills: false,
      qualifications: false,
      materials: false,
      projects: false,
      smallWorks: false,
      operativeMode: true,
      annualLeaveSelfBook: false,
      weeklyReports: false,
      dailyOverview: true,
      subContractors: false,
      siteAudit: true,
      wholesalersOrderHistory: true,
    },
    isSuperAdmin: false,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as User
  const notes = invoiceRateChangeNotes({
    history: {
      ...emptyDayRateHistory(),
      byUserId: {
        u1: [
          {
            id: 'h1',
            userId: 'u1',
            dayRate: 220,
            effectiveAt: new Date('2026-09-20T00:00:00Z'),
            createdAt: new Date('2026-09-20T00:00:00Z'),
          },
          {
            id: 'h0',
            userId: 'u1',
            dayRate: 180,
            effectiveAt: new Date('2026-01-01T00:00:00Z'),
            createdAt: new Date('2026-01-01T00:00:00Z'),
          },
        ],
      },
    },
    user,
    operatives: [],
    periodStart: new Date('2026-09-16T00:00:00Z'),
    periodEnd: new Date('2026-09-30T00:00:00Z'),
    timeZone: 'Europe/London',
  })
  assert.equal(notes.length, 1)
  assert.match(notes[0], /Rate updated to £220.00/)
})
