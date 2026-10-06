import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildWeeklyReportSpreadsheetXml } from './weeklyReportGenerator.ts'
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
        person: 'Alice',
        role: 'Engineer',
        lines: [{ rateType: 'Day', days: 2, rate: 200, pay: 400 }],
        personTotal: 400,
      },
      {
        person: 'Bob',
        role: 'Engineer',
        lines: [{ rateType: 'Day', days: 1, rate: 180, pay: 180 }],
        personTotal: 180,
      },
    ],
    grandTotal: 580,
  }
  const xml = buildWeeklyReportSpreadsheetXml(data)
  assert.match(xml, /WEEKLY REPORT/)
  assert.match(xml, /Warnings Summary/)
  assert.match(xml, /Project Breakdown/)
  assert.match(xml, /Sub Contractors/)
  assert.equal(xml.includes('People'), false)
  assert.equal(xml.includes('Jane Smith'), false)
  assert.match(xml, /Pay Summary/)
  const pay = xml.split('Pay Summary')[1] || ''
  const alice = pay.indexOf('Alice total')
  const bob = pay.indexOf('>Bob<')
  assert.ok(alice >= 0 && bob > alice)
  assert.match(pay.slice(alice, bob), /<Data ss:Type="String"><\/Data>/)
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
  }
  const bytes = await buildWeeklyReportPdf(data)
  assert.equal(String.fromCharCode(...bytes.slice(0, 5)), '%PDF-')
  assert.ok(bytes.byteLength > 1000)
})
