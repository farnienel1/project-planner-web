/**
 * Rulebook 1.51.0 §7 (Q3, Q4f): the weekly report's sections as text cells — the one table builder the screen and
 * every export (PDF, HTML, Excel) render, so all four show exactly the same rows. The figures come from
 * `buildWeeklyReportData` (`weeklyReportPayRows`, `weeklyReportLeaveRows`); this file only formats them.
 */
import { formatMoney, PAY_HIDDEN_NOTE, WEEKLY_REPORT_PAY_COLUMNS } from '@/lib/canonical'
import type { WeeklyReportData } from '@/lib/weekly-report/weeklyReportData'

export type WeeklyReportSectionKey =
  | 'warnings'
  | 'approvedClashes'
  | 'project'
  | 'allProjects'
  | 'subContractors'
  | 'annualLeave'
  | 'managerSchedule'
  | 'payeOvertime'
  | 'priceWork'
  | 'expenses'
  | 'paySummary'

export type WeeklyReportSection = {
  key: WeeklyReportSectionKey
  title: string
  headers: string[]
  rows: string[][]
  /** Shown instead of the table when `rows` is empty. */
  empty: string
  /** Relative column widths (PDF). */
  weights?: number[]
  /** Per row: `warn` for an amber check line, `good` for a ticked one, `total` for a total row. */
  tones?: Array<'good' | 'warn' | 'total' | null>
  /** A note under the table (pay hidden). */
  note?: string
}

/** Header and rows of the Approved clashes section. */
export const APPROVED_CLASH_HEADERS = ['Date', 'Priority', 'Type', 'Person', 'Detail']

export const WEEKLY_REPORT_SECTION_ICONS: Record<WeeklyReportSectionKey, string> = {
  warnings: '⚠',
  approvedClashes: '✅',
  project: '🏗',
  allProjects: '🏗',
  subContractors: '🔧',
  annualLeave: '🌴',
  managerSchedule: '📅',
  payeOvertime: '⏱️',
  priceWork: '🧱',
  expenses: '🧾',
  paySummary: '💷',
}

const fixed = (value: number) => value.toFixed(2)
const hours = (value: number) => `${Math.round(value * 100) / 100}h`

export function weeklyReportSections(data: WeeklyReportData): WeeklyReportSection[] {
  const money = (amount: number) => formatMoney(amount, data.currencyCode)
  const sections: WeeklyReportSection[] = []

  sections.push({
    key: 'warnings',
    title: 'Warnings Summary',
    headers: ['Status', 'Priority', 'Type', 'Date', 'Description', 'Detail', 'For'],
    rows: data.warnings.map((row) => [row.status, row.priority, row.type, row.date, row.description, row.detail, row.forPerson]),
    empty: 'No warnings in period',
    weights: [0.7, 0.7, 1.1, 0.9, 1.2, 3.4, 1.2],
  })

  sections.push({
    key: 'approvedClashes',
    title: 'Approved clashes',
    headers: APPROVED_CLASH_HEADERS,
    rows: (data.approvedClashes ?? []).map((row) => [row.date, row.priority, row.type, row.person, row.detail]),
    empty: 'No clashes approved in this period',
    weights: [0.9, 0.7, 1.1, 1.2, 4],
  })

  // Q4a: paid hours and paid days (the Pay Summary's figures), never booked-day units.
  const projectHeaders = ['Project', 'Job No.', 'Person', 'Trade', 'Role', 'Hours', 'Paid days']
  for (const group of data.projectGroups) {
    sections.push({
      key: 'project',
      title: `Project Breakdown — ${group.projectName}`,
      headers: projectHeaders,
      rows: [
        ...group.rows.map((row) => [group.projectName, group.jobNumber, row.person, row.trade, row.role, hours(row.hours), fixed(row.days)]),
        ['', '', '', '', 'Project Total', hours(group.projectHours), fixed(group.projectTotal)],
      ],
      empty: 'No project bookings',
      tones: [...group.rows.map(() => null), 'total'],
    })
  }
  if (data.projectGroups.length === 0) {
    sections.push({ key: 'project', title: 'Project Breakdown', headers: projectHeaders, rows: [], empty: 'No project bookings in this period' })
  }
  sections.push({
    key: 'allProjects',
    title: 'All Project Work',
    headers: ['', 'Hours', 'Paid days'],
    rows: [['All Project Work', hours(data.allProjectHoursTotal ?? 0), fixed(data.allProjectWorkTotal)]],
    empty: 'No project bookings in this period',
    tones: ['total'],
  })

  sections.push({
    key: 'subContractors',
    title: 'Sub Contractors',
    headers: ['Project', 'Job No.', 'Sub Contractor', 'People', 'Type', 'Time', 'Days'],
    rows: data.subContractorRows.length
      ? [
          ...data.subContractorRows.map((row) => [row.projectName, row.jobNumber, row.subContractor, row.people || '—', row.type, row.time, fixed(row.days)]),
          ['', '', '', '', '', 'Sub Contractor total', fixed(data.subContractorTotal)],
        ]
      : [],
    empty: 'No sub contractor bookings in this period',
    tones: [...data.subContractorRows.map(() => null), 'total'],
  })

  sections.push({
    key: 'annualLeave',
    title: 'Annual Leave',
    headers: ['Person', 'Role', 'Days', 'Type'],
    rows: data.annualLeaveRows.length
      ? [...data.annualLeaveRows.map((row) => [row.person, row.role, fixed(row.days), row.type]), ['', 'Annual Leave Total', fixed(data.annualLeaveTotal), '']]
      : [],
    empty: 'No annual leave in this period',
    tones: [...data.annualLeaveRows.map(() => null), 'total'],
  })

  sections.push({
    key: 'managerSchedule',
    title: 'Manager / Admin Additional Schedule',
    headers: ['Person', 'Role', 'Location', 'Time', 'Hours', 'Paid days'],
    rows: data.managerScheduleRows.length
      ? [
          ...data.managerScheduleRows.map((row) => [row.person, row.role, row.location, row.time, hours(row.hours), fixed(row.days)]),
          ['', '', '', 'Total', '', fixed(data.managerScheduleTotal)],
        ]
      : [],
    empty: 'No additional manager schedule in this period',
    tones: [...data.managerScheduleRows.map(() => null), 'total'],
  })

  sections.push({
    key: 'payeOvertime',
    title: 'PAYE overtime',
    headers: ['Person', 'Job Number', 'Job', 'Overtime (hours × rate)'],
    rows: data.payeOvertimeRows.length
      ? [
          ...data.payeOvertimeRows.map((row) => [row.person, row.jobNumber, row.jobName, row.hoursCell ?? `${row.overtimeHours}h`]),
          ['', '', 'Total', `${data.payeOvertimeTotal}h`],
        ]
      : [],
    empty: 'No PAYE overtime in this period',
    tones: [...data.payeOvertimeRows.map(() => null), 'total'],
  })

  for (const [key, title, list, total] of [
    ['priceWork', 'Price Work', data.priceWorkRows, data.priceWorkTotal],
    ['expenses', 'Expenses', data.expenseRows, data.expenseTotal],
  ] as const) {
    sections.push({
      key,
      title,
      headers: ['Person', 'Title', 'Job Number', 'Date', 'Details', 'Amount'],
      rows: list.length
        ? [...list.map((row) => [row.person, row.title, row.jobNumber, row.date, row.details, money(row.amount)]), ['', '', '', '', `${title} Total`, money(total)]]
        : [],
      empty: `No ${title.toLowerCase()} in this period`,
      tones: [...list.map(() => null), 'total'],
    })
  }

  // Q1 / Q2: Person | Role | Dates | Line | Hours | Days | Rate | Pay, a total row and the invoice check line.
  const payRows: string[][] = []
  const payTones: Array<'good' | 'warn' | 'total' | null> = []
  for (const person of data.paySummary) {
    for (const row of person.lines) {
      const money_ = row.source === 'claim'
      payRows.push([
        person.person,
        person.role,
        row.dates,
        row.line,
        money_ ? '' : hours(row.hours),
        money_ ? '' : fixed(row.days),
        row.rateText,
        row.payLabel ?? money(row.pay),
      ])
      payTones.push(null)
    }
    payRows.push([`${person.person} total`, '', '', '', '', '', '', person.personTotalLabel ?? money(person.personTotal)])
    payTones.push('total')
    if (person.check) {
      payRows.push(['', '', '', person.check.label, '', '', '', ''])
      payTones.push(person.check.tone === 'warn' ? 'warn' : person.check.tone === 'good' ? 'good' : null)
    }
  }
  if (data.paySummary.length) {
    payRows.push(['', '', '', '', '', '', 'Grand Total', money(data.grandTotal)])
    payTones.push('total')
  }
  sections.push({
    key: 'paySummary',
    title: 'Pay Summary',
    headers: [...WEEKLY_REPORT_PAY_COLUMNS],
    rows: payRows,
    empty: 'No pay data for this period',
    weights: [1.2, 0.9, 0.8, 3.4, 0.6, 0.6, 1, 1],
    tones: payTones,
    note: data.payHiddenPeople ? PAY_HIDDEN_NOTE : undefined,
  })
  return sections
}
