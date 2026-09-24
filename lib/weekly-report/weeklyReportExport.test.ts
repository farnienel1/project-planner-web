import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildWeeklyReportSpreadsheetXml } from './weeklyReportGenerator.ts'
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
    paySummary: [],
    grandTotal: 0,
  }
  const xml = buildWeeklyReportSpreadsheetXml(data)
  assert.match(xml, /WEEKLY REPORT/)
  assert.match(xml, /Warnings Summary/)
  assert.match(xml, /Project Breakdown/)
  assert.match(xml, /Sub Contractors/)
  assert.match(xml, /Jane Smith/)
  assert.match(xml, /Pay Summary/)
})
