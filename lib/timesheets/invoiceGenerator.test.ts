import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildTimesheetInvoiceHtml, timesheetInvoiceFileName } from './invoiceGenerator.ts'

test('invoice HTML matches iOS InvoicePDFBuilder title block and columns', () => {
  const html = buildTimesheetInvoiceHtml({
    organizationName: 'Acme Fit-out',
    subject: { key: 'u1', name: 'Ada Booked', kind: 'operative' },
    weekStart: new Date('2026-09-16T00:00:00Z'),
    weekEnd: new Date('2026-09-30T00:00:00Z'),
    totalHours: 8,
    totalDays: 1,
    amount: 200,
    vatNumber: 'GB123',
    utrNumber: 'UTR9',
    timeZone: 'Europe/London',
    generatedAt: new Date('2026-09-21T08:30:00Z'),
    lines: [
      {
        date: 'Wed 16 Sep',
        jobNumber: 'J-1',
        projectName: 'Site One',
        details: '08:00–17:00 · 8h · £200.00/day',
        description: 'J-1 Site One · 08:00–17:00 · 8h · £200.00/day',
        amount: 200,
      },
    ],
  })
  assert.match(html, />Invoice</)
  assert.match(html, /Project Planner/)
  assert.match(html, /Company/)
  assert.match(html, /Acme Fit-out/)
  assert.match(html, /INVOICE PERIOD/)
  assert.match(html, /Date \/ Project/)
  assert.match(html, /J-1/)
  assert.match(html, /Site One/)
  assert.match(html, /VAT number/)
  assert.match(html, /UTR number/)
  assert.match(html, /Total invoice amount/)
})

test('timesheetInvoiceFileName sanitises like iOS InvoicePDFBuilder', () => {
  assert.equal(timesheetInvoiceFileName('Ada Booked', new Date(1_758_384_000_000)), 'Invoice-Ada_Booked-1758384000.html')
  assert.equal(timesheetInvoiceFileName('A/B:C', new Date(0)), 'Invoice-A-B-C-0.html')
})
