import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildWeeklyReportHtml, buildWeeklyReportSpreadsheetXml } from './weeklyReportGenerator.ts'
import { buildWeeklyReportPdf } from './weeklyReportPdf.ts'
import type { WeeklyReportData } from './weeklyReportData.ts'

test('weekly report spreadsheet includes iOS section titles and named sub contractors', () => {
  const data: WeeklyReportData = {
    organizationName: 'Raccord MEP',
    reportPeriod: {
      start: new Date('2026-09-14T00:00:00Z'),
      end: new Date('2026-09-20T00:00:00Z'),
      label: '14–20 Sep 2026',
    },
    invoicingPeriodLabel: 'Sep 2026',
    generatedAt: new Date('2026-09-21T12:00:00Z'),
    warnings: [],
    projectGroups: [],
    allProjectWorkTotal: 0,
    subContractorRows: [
      {
        projectName: 'Lowndes',
        jobNumber: 'C984',
        subContractor: 'Acme Electrical',
        people: 'Jane Smith',
        type: 'Electrical',
        time: 'FULL DAY',
        days: 1,
      },
    ],
    subContractorTotal: 1,
    annualLeaveRows: [],
    annualLeaveTotal: 0,
    managerScheduleRows: [],
    managerScheduleTotal: 0,
    priceWorkRows: [],
    priceWorkTotal: 0,
    expenseRows: [],
    expenseTotal: 0,
    paySummary: [
      {
        personId: 'a',
        person: 'Alice',
        role: 'Engineer',
        lines: [{ kind: 'weekdayStandard', payBasis: 'day', dates: '14–20 Sep', startDayKey: '2026-09-14', endDayKey: '2026-09-20', line: 'Weekday standard', hours: 17, days: 2, rate: 200, rateText: '£200.00/day', pay: 400, source: 'live', divisor: 8.5, multiplier: null }],
        personTotal: 400,
        check: { state: 'signed', label: 'Timesheet: Signed · Invoice £400.00 ✓', tone: 'good', invoiceTotal: 400, reportTotal: 400, matches: true, changedSinceSigned: false, partialRun: false },
      },
      {
        personId: 'b',
        person: 'Bob',
        role: 'Engineer',
        lines: [{ kind: 'weekdayStandard', payBasis: 'day', dates: '14–20 Sep', startDayKey: '2026-09-14', endDayKey: '2026-09-20', line: 'Weekday standard', hours: 8.5, days: 1, rate: 180, rateText: '£180.00/day', pay: 180, source: 'live', divisor: 8.5, multiplier: null }],
        personTotal: 180,
        check: { state: 'signed', label: 'Timesheet: Signed · Invoice £150.00 · report £180.00', tone: 'warn', invoiceTotal: 150, reportTotal: 180, matches: false, changedSinceSigned: false, partialRun: false },
      },
    ],
    grandTotal: 580,
    payeOvertimeRows: [{ person: 'Sam Paye', jobNumber: 'J-1042', jobName: 'Riverside Flats', overtimeHours: 1.5, label: 'Sam Paye · J-1042 · 1.5h' }],
    payeOvertimeTotal: 1.5,
  }
  const xml = buildWeeklyReportSpreadsheetXml(data)
  assert.match(xml, /WEEKLY REPORT/)
  assert.match(xml, /Warnings Summary/)
  assert.match(xml, /Project Breakdown/)
  assert.match(xml, /Sub Contractors/)
  // Rulebook 1.51.0 (Q4f): the Excel file shows the same rows as the screen and PDF (People included).
  assert.match(xml, /People/)
  assert.match(xml, /Jane Smith/)
  assert.match(xml, /Pay Summary/)
  // Q1 columns and the Q2 check line.
  assert.match(xml, /<Data ss:Type="String">Dates<\/Data>/)
  assert.match(xml, /Timesheet: Signed · Invoice £400\.00 ✓/)
  assert.match(xml, /Invoice £150\.00 · report £180\.00/)
  const html = buildWeeklyReportHtml(data)
  assert.match(html, /<tr class="warn">.*Invoice £150\.00 · report £180\.00/)
  // Rulebook 1.29.0 §7: the PAYE overtime section (hours only).
  assert.match(xml, /PAYE overtime/)
  assert.match(xml, /Sam Paye/)
  assert.match(xml, /1\.5h/)
  const pay = xml.split('Pay Summary')[1] || ''
  const alice = pay.indexOf('Alice total')
  const bob = pay.indexOf('>Bob<')
  assert.ok(alice >= 0 && bob > alice)
  assert.match(pay.slice(alice, bob), /Timesheet: Signed/)
})

test('weekly report pdf downloads as a coloured PDF document', async () => {
  const data: WeeklyReportData = {
    organizationName: 'Raccord MEP',
    reportPeriod: {
      start: new Date('2026-09-14T00:00:00Z'),
      end: new Date('2026-09-20T00:00:00Z'),
      label: '14–20 Sep 2026',
    },
    invoicingPeriodLabel: 'Sep 2026',
    generatedAt: new Date('2026-09-21T12:00:00Z'),
    warnings: [],
    projectGroups: [],
    allProjectWorkTotal: 0,
    subContractorRows: [],
    subContractorTotal: 0,
    annualLeaveRows: [],
    annualLeaveTotal: 0,
    managerScheduleRows: [],
    managerScheduleTotal: 0,
    priceWorkRows: [],
    priceWorkTotal: 0,
    expenseRows: [],
    expenseTotal: 0,
    paySummary: [],
    grandTotal: 0,
    payeOvertimeRows: [],
    payeOvertimeTotal: 0,
  }
  const bytes = await buildWeeklyReportPdf(data)
  assert.equal(String.fromCharCode(...bytes.slice(0, 5)), '%PDF-')
  assert.ok(bytes.byteLength > 1000)
})

test('weekly report HTML escapes price work and expenses; spreadsheet prefixes formulas', () => {
  const data: WeeklyReportData = {
    organizationName: 'Raccord MEP',
    reportPeriod: {
      start: new Date('2026-09-14T00:00:00Z'),
      end: new Date('2026-09-20T00:00:00Z'),
      label: '14–20 Sep 2026',
    },
    invoicingPeriodLabel: 'Sep 2026',
    generatedAt: new Date('2026-09-21T12:00:00Z'),
    warnings: [],
    projectGroups: [],
    allProjectWorkTotal: 0,
    subContractorRows: [],
    subContractorTotal: 0,
    annualLeaveRows: [],
    annualLeaveTotal: 0,
    managerScheduleRows: [],
    managerScheduleTotal: 0,
    priceWorkRows: [
      {
        person: '<script>Ada</script>',
        title: 'Extra',
        jobNumber: 'C1',
        date: '14 Sep',
        details: '=1+1',
        amount: 10,
      },
    ],
    priceWorkTotal: 10,
    expenseRows: [
      {
        person: 'Bob',
        title: 'Van',
        jobNumber: 'C1',
        date: '14 Sep',
        details: '<img src=x>',
        amount: 5,
      },
    ],
    expenseTotal: 5,
    paySummary: [],
    grandTotal: 0,
    payeOvertimeRows: [{ person: '<b>Ada</b>', jobNumber: 'J-1', jobName: 'Job', overtimeHours: 2, label: 'Ada · J-1 · 2h' }],
    payeOvertimeTotal: 2,
  }
  const html = buildWeeklyReportHtml(data)
  assert.doesNotMatch(html, /<script>Ada/)
  assert.match(html, /&lt;script&gt;Ada&lt;\/script&gt;/)
  assert.match(html, /&lt;img src=x&gt;/)
  assert.match(html, /PAYE overtime/)
  assert.match(html, /&lt;b&gt;Ada&lt;\/b&gt;/)
  const xml = buildWeeklyReportSpreadsheetXml(data)
  assert.match(xml, /'=1\+1/)
})
