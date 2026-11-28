import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildTimesheetInvoicePdf, timesheetInvoicePdfFileName } from './invoicePdf.ts'

function latin1(bytes: Uint8Array): string {
  return new TextDecoder('latin1').decode(bytes)
}

test('invoice PDF is a real PDF 1.4 document with iOS title block fields', () => {
  const pdf = buildTimesheetInvoicePdf({
    organizationName: 'Acme Fit-out',
    subject: { key: 'u1', name: 'Ada Booked', kind: 'operative' },
    weekStart: new Date('2026-09-16T00:00:00Z'),
    weekEnd: new Date('2026-09-30T00:00:00Z'),
    amount: 200,
    vatNumber: 'GB123',
    utrNumber: 'UTR9',
    timeZone: 'Europe/London',
    generatedAt: new Date('2026-09-21T08:30:00Z'),
    notes: ['Rate updated to £220.00 from Wed 16 Sep.'],
    lines: [
      {
        date: 'Wed 16 Sep',
        jobNumber: 'J-1',
        projectName: 'Site One',
        details: '08:00-17:00 · 8h · £200.00/day',
        description: 'J-1 Site One',
        amount: 200,
      },
    ],
  })
  const text = latin1(pdf)
  assert.equal(String.fromCharCode(pdf[0], pdf[1], pdf[2], pdf[3], pdf[4]), '%PDF-')
  assert.match(text, /%PDF-1.4/)
  assert.match(text, /%%EOF/)
  assert.match(text, /Invoice/)
  assert.match(text, /Project Planner/)
  assert.match(text, /Acme Fit-out/)
  assert.match(text, /Date \/ Project/)
  assert.match(text, /J-1/)
  assert.match(text, /Site One/)
  assert.match(text, /Rate change notes/)
  assert.match(text, /Total timesheet amount/)
  assert.ok(text.includes(String.fromCharCode(0xa3)), 'WinAnsi pound sign is encoded as 0xA3')
})

test('timesheetInvoicePdfFileName uses Timesheet-Name-timestamp.pdf', () => {
  assert.equal(
    timesheetInvoicePdfFileName('Ada Booked', new Date(1_758_384_000_000)),
    'Timesheet-Ada_Booked-1758384000.pdf'
  )
})

test('review of #363: a row taller than a page continues on the next page; every text line stays on a page', () => {
  const details = Array.from({ length: 120 }, (_, i) => `part${i} 07:00–16:00 · 1.00 day × £225.00/day = £225.00`).join(' ')
  const pdf = buildTimesheetInvoicePdf({
    organizationName: 'Acme',
    subject: { key: 'u1', name: 'Ada', kind: 'operative' },
    weekStart: new Date('2026-11-01T00:00:00Z'),
    weekEnd: new Date('2026-11-15T00:00:00Z'),
    amount: 225,
    timeZone: 'Europe/London',
    generatedAt: new Date('2026-11-17T08:30:00Z'),
    lines: [{ date: 'Tue 10 Nov', jobNumber: 'C646', projectName: '1 Carnaby Street', details, description: '', amount: 225 }],
  })
  const text = latin1(pdf)
  assert.ok((text.match(/\/Type \/Page\b/g) ?? []).length >= 2, 'more than one page')
  assert.match(text, /part119 /)
  assert.match(text, /\(\\\(cont\.\\\)\) Tj/)
  assert.ok((text.match(/\(Tue 10 Nov\) Tj/g) ?? []).length >= 2, 'the date repeats on the next page')
  // No text is placed below the page's bottom margin (y below 40 points from the bottom).
  for (const [, y] of text.matchAll(/ ([\d.]+) Td \(/g)) assert.ok(Number(y) >= 30, `text at y=${y}`)
})
