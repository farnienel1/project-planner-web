import { test } from 'node:test'
import assert from 'node:assert/strict'
import { managerExportEmailHTML, paymentRunDateStamp, invoiceRateChangeNotes, timesheetExportFileName, invoiceLinesForTimesheet, invoiceLinesTotal, pdfBytesToBase64 } from './timesheetExport.ts'
import type { User } from '../../types/index.ts'
import { emptyDayRateHistory } from './dayRateHistoryStorage.ts'
import { emptyTimesheetDraft } from './timesheetDraft.ts'
import type { TimesheetPayrollSummary } from './timesheetPayrollCollector.ts'

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
  assert.match(html, /attached, with backup download links/)
  assert.equal(/cannot attach files/i.test(html), false)
})

test('timesheetExportFileName matches iOS PDF naming', () => {
  assert.equal(
    timesheetExportFileName('Ada Booked', '16.09.26 30.09.26'),
    'Ada Booked timesheet for payment run date 16.09.26 30.09.26.pdf'
  )
})

test('pdfBytesToBase64 round-trips PDF bytes', () => {
  const bytes = Buffer.from('%PDF-1.4 test')
  const encoded = pdfBytesToBase64(new Uint8Array(bytes))
  assert.equal(Buffer.from(encoded, 'base64').toString(), '%PDF-1.4 test')
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

test('Email and export PDF uses raw payroll, skips declined extras, and uses revised extra amounts', () => {
  const payroll: TimesheetPayrollSummary = {
    totalHours: 16,
    overtimeHours: 0,
    shiftCount: 2,
    baseAmount: 400,
    overtimeAmount: 0,
    workAmount: 400,
    lineItems: [
      {
        id: 'day-1',
        date: new Date('2026-09-21T08:00:00Z'),
        jobNumber: 'J-1',
        projectName: 'Site One',
        details: '08:00 – 16:00',
        paidHours: 8,
        payrollBasis: 'dayRate',
        dayRate: 200,
        amount: 200,
        isPayeDay: false,
        isOvertimeLine: false,
        hasRate: true,
      },
      {
        id: 'day-2',
        date: new Date('2026-09-22T08:00:00Z'),
        jobNumber: 'J-1',
        projectName: 'Site One',
        details: '08:00 – 16:00',
        paidHours: 8,
        payrollBasis: 'dayRate',
        dayRate: 200,
        amount: 200,
        isPayeDay: false,
        isOvertimeLine: false,
        hasRate: true,
      },
    ],
  }
  const draft = {
    ...emptyTimesheetDraft(),
    payrollLineReviews: {
      'day-2': { decision: 'declined' as const, revisedAmount: null },
    },
    expenseEntries: [
      {
        id: 'e1',
        title: 'Parking',
        details: '',
        jobNumber: 'J-1',
        date: new Date('2026-09-21T08:00:00Z'),
        amount: 12,
        managerDecision: 'declined' as const,
      },
    ],
    priceWorkEntries: [
      {
        id: 'p1',
        title: 'Extra first fix',
        details: '',
        jobNumber: 'J-1',
        agreedManagerName: 'Pat',
        startDate: new Date('2026-09-21T08:00:00Z'),
        amount: 80,
        managerDecision: 'edited' as const,
        managerRevisedAmount: 60,
      },
    ],
  }
  const exported = invoiceLinesForTimesheet({
    payroll,
    draft,
    timeZone: 'Europe/London',
    extrasMode: 'export',
  })
  assert.equal(
    exported.some((line) => line.description.includes('Parking')),
    false
  )
  assert.equal(invoiceLinesTotal(exported), 460)

  const generated = invoiceLinesForTimesheet({
    payroll,
    draft,
    timeZone: 'Europe/London',
    extrasMode: 'raw',
  })
  assert.equal(
    generated.some((line) => line.description.includes('Parking')),
    true
  )
  assert.equal(invoiceLinesTotal(generated), 492)
  const parking = generated.find((line) => line.projectName === 'Expense')
  assert.equal(parking?.jobNumber, '—')
  // 17 Nov: a price work / expense row shows its title (and description), never "0h · rate not set".
  assert.equal(parking?.details, 'Parking')
  const priceWork = exported.find((line) => line.projectName === 'Price work')
  assert.equal(priceWork?.projectName, 'Price work')
  assert.equal(priceWork?.details, 'Extra first fix')
  assert.equal(priceWork?.amount, 60)
})

test('1.36.0 FU-5: invoiceRateChangeNotes includes history under a former invite id and every operatives row, without case', () => {
  const notes = invoiceRateChangeNotes({
    history: {
      byUserId: {
        'INVITE-OLD': [{ id: 'h1', userId: 'INVITE-OLD', dayRate: 230, effectiveAt: new Date('2026-09-20T00:00:00Z'), createdAt: new Date('2026-09-20T00:00:00Z') }],
      },
      byOperativeId: {
        'OP-2': [{ id: 'h2', userId: '', operativeId: 'OP-2', dayRate: 240, effectiveAt: new Date('2026-09-22T00:00:00Z'), createdAt: new Date('2026-09-22T00:00:00Z') }],
        'op-blank': [{ id: 'h3', userId: '', operativeId: 'op-blank', dayRate: 999, effectiveAt: new Date('2026-09-22T00:00:00Z'), createdAt: new Date('2026-09-22T00:00:00Z') }],
      },
    },
    user: { id: 'u1', email: 'ada@x.com', formerUserIds: ['invite-old'] } as unknown as User,
    operatives: [
      { id: 'op-2', email: 'Ada@x.com' },
      { id: 'op-blank', email: '' },
    ] as never,
    periodStart: new Date('2026-09-16T00:00:00Z'),
    periodEnd: new Date('2026-09-30T00:00:00Z'),
    timeZone: 'Europe/London',
  })
  assert.equal(notes.length, 2)
  assert.ok(notes.some((note) => /^Rate updated to £230.00/.test(note)))
  assert.ok(notes.some((note) => /^Operative rate updated to £240.00/.test(note)))
})

test('1.67.0 review (SF1): an edited day-rate overtime row on the invoice never shows a sum that does not add up to its amount', () => {
  const overtime = {
    id: 'op-b1-ot',
    date: new Date('2026-11-02T16:00:00Z'),
    jobNumber: 'J-1',
    projectName: 'Site One (Overtime)',
    details: '16:00–22:00',
    paidHours: 6,
    payrollBasis: 'dayRate' as const,
    dayRate: 337.5,
    amount: 238.24,
    isPayeDay: false,
    isOvertimeLine: true,
    hasRate: true,
    standardDayHours: 8.5,
    otMultiplier: 1.5,
    otBaseRate: 225,
  }
  const payroll: TimesheetPayrollSummary = {
    totalHours: 6, overtimeHours: 6, shiftCount: 1, baseAmount: 0, overtimeAmount: 238.24, workAmount: 238.24,
    lineItems: [overtime],
  }
  const unrevised = invoiceLinesForTimesheet({ payroll, draft: emptyTimesheetDraft(), timeZone: 'Europe/London', extrasMode: 'export' })
  assert.ok(unrevised[0].details.includes('6h × 1.5 = 9h · 9h × £26.47/h (rounded) = £238.24'), unrevised[0].details)
  const draft = {
    ...emptyTimesheetDraft(),
    managerSignedAt: new Date('2026-11-16T10:00:00Z'),
    payrollLineReviews: { 'op-b1-ot': { decision: 'edited' as const, revisedAmount: 300 } },
  }
  const revised = invoiceLinesForTimesheet({ payroll, draft, timeZone: 'Europe/London', extrasMode: 'export' })
  assert.equal(revised[0].amount, 300)
  assert.ok(!revised[0].details.includes('£26.47/h'), revised[0].details)
  // The details show the amount paid, never the live line's £238.24.
  assert.ok(revised[0].details.endsWith('£300.00'), revised[0].details)
})
