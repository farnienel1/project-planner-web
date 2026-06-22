import { doc, getDoc, setDoc, Timestamp, updateDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase/config'

export type WeekendPayrollSettings = {
  allHoursAtMultiplierMode: boolean
  allHoursMultiplier: number
  /** Hours inside the defined window count at standard rate (iOS parity). */
  definedWindowStart?: string
  definedWindowEnd?: string
  countsAsStandardHours?: number
  /** Multiplier for hours outside the defined window on this day (iOS parity). */
  outsideWindowMultiplier?: number
  /** Sunday only — mirror Saturday settings when enabled. */
  sameAsSaturday?: boolean
}

/** Day-of-month payment run window (iOS stores as startDate/endDate numbers 1–31). */
export type PaymentRunDateRange = {
  startDay: number
  endDay: number
}

export type OrgPayrollTimePolicy = {
  standardDayStart: string
  standardDayEnd: string
  unpaidBreakMinutes: number
  standardPaidHours: number
  breakWindowStart: string
  breakWindowEnd: string
  weekdayOutsideStandardMultiplier: number
  saturday: WeekendPayrollSettings
  sunday: WeekendPayrollSettings
}

export type OrgAnnualLeaveDefaults = {
  daysPerYear: number
  startMonth: number
  endMonth: number
  carriesOver: boolean
}

export type OrgWarningDetectionSettings = {
  detectClashes: boolean
  clashLookaheadMode: 'endOfWorkingWeek' | 'numberOfDays' | 'endOfInvoicingPeriod'
  clashLookaheadDays: number
  includeWeekendsForUnbookedLabour: boolean
  excludedUserIdsFromUnbookedWarnings: string[]
}

export type OrgInvoicingSettings = {
  paymentRunMode: 'date_ranges' | 'recurring_timeframe'
  paymentDateMode: 'specific_dates' | 'recurring_date'
  recurringRunStartDay: string
  recurringRunEndDay: string
  recurringPaymentDay: string
  paymentRunDateRanges: PaymentRunDateRange[]
  paymentDates: string[]
  noteToUsers: string
}

export type MyScheduleOptions = {
  showOffice: boolean
  showWorkingFromHome: boolean
  showSiteSurvey: boolean
  customItems: string[]
  customItemEnabled: Record<string, boolean>
}

export type OrganizationDetails = {
  id: string
  name: string
  countryCode?: string
  creatorUserId?: string
  companyLogoURL?: string
  payrollTimePolicy: OrgPayrollTimePolicy
  annualLeaveDefaults: OrgAnnualLeaveDefaults
  warningDetection: OrgWarningDetectionSettings
  invoicing: OrgInvoicingSettings
  myScheduleOptions: MyScheduleOptions
}

const DEFAULT_WEEKEND: WeekendPayrollSettings = {
  allHoursAtMultiplierMode: false,
  allHoursMultiplier: 2,
  definedWindowStart: '07:30',
  definedWindowEnd: '16:00',
  countsAsStandardHours: 8,
  outsideWindowMultiplier: 1.5,
  sameAsSaturday: false,
}

const DEFAULT_SUNDAY: WeekendPayrollSettings = {
  ...DEFAULT_WEEKEND,
  sameAsSaturday: true,
}

export const DEFAULT_PAYROLL_POLICY: OrgPayrollTimePolicy = {
  standardDayStart: '07:30',
  standardDayEnd: '16:00',
  unpaidBreakMinutes: 30,
  standardPaidHours: 8,
  breakWindowStart: '12:00',
  breakWindowEnd: '12:30',
  weekdayOutsideStandardMultiplier: 1.5,
  saturday: { ...DEFAULT_WEEKEND },
  sunday: { ...DEFAULT_SUNDAY },
}

export const DEFAULT_PAYMENT_RUN_DATE_RANGES: PaymentRunDateRange[] = [
  { startDay: 1, endDay: 15 },
  { startDay: 16, endDay: 31 },
]

export const DEFAULT_ANNUAL_LEAVE: OrgAnnualLeaveDefaults = {
  daysPerYear: 25,
  startMonth: 1,
  endMonth: 12,
  carriesOver: false,
}

export const DEFAULT_WARNING_DETECTION: OrgWarningDetectionSettings = {
  detectClashes: true,
  clashLookaheadMode: 'endOfWorkingWeek',
  clashLookaheadDays: 28,
  includeWeekendsForUnbookedLabour: false,
  excludedUserIdsFromUnbookedWarnings: [],
}

export const DEFAULT_INVOICING: OrgInvoicingSettings = {
  paymentRunMode: 'recurring_timeframe',
  paymentDateMode: 'recurring_date',
  recurringRunStartDay: 'monday',
  recurringRunEndDay: 'sunday',
  recurringPaymentDay: 'friday',
  paymentRunDateRanges: DEFAULT_PAYMENT_RUN_DATE_RANGES.map((r) => ({ ...r })),
  paymentDates: [],
  noteToUsers:
    "If your timesheet displays 0 against your rate, then your day/hourly rate hasn't been set by your line manager",
}

export const DEFAULT_MY_SCHEDULE: MyScheduleOptions = {
  showOffice: true,
  showWorkingFromHome: true,
  showSiteSurvey: true,
  customItems: [],
  customItemEnabled: {},
}

function parseWeekend(data: Record<string, unknown> | undefined, fallback: WeekendPayrollSettings): WeekendPayrollSettings {
  if (!data) return { ...fallback }
  return {
    allHoursAtMultiplierMode: data.allHoursAtMultiplierMode === true,
    allHoursMultiplier: Number(data.allHoursMultiplier ?? fallback.allHoursMultiplier),
    definedWindowStart: String(data.definedWindowStart ?? fallback.definedWindowStart ?? '07:30'),
    definedWindowEnd: String(data.definedWindowEnd ?? fallback.definedWindowEnd ?? '16:00'),
    countsAsStandardHours: Number(data.countsAsStandardHours ?? fallback.countsAsStandardHours ?? 8),
    outsideWindowMultiplier: Number(
      data.outsideWindowMultiplier ?? fallback.outsideWindowMultiplier ?? 1.5
    ),
    sameAsSaturday: data.sameAsSaturday === true,
  }
}

export function parsePayrollPolicy(data: Record<string, unknown> | undefined): OrgPayrollTimePolicy {
  if (!data) return { ...DEFAULT_PAYROLL_POLICY, saturday: { ...DEFAULT_WEEKEND }, sunday: { ...DEFAULT_SUNDAY } }
  return {
    standardDayStart: String(data.standardDayStart ?? DEFAULT_PAYROLL_POLICY.standardDayStart),
    standardDayEnd: String(data.standardDayEnd ?? DEFAULT_PAYROLL_POLICY.standardDayEnd),
    unpaidBreakMinutes: Number(data.unpaidBreakMinutes ?? DEFAULT_PAYROLL_POLICY.unpaidBreakMinutes),
    standardPaidHours: Number(data.standardPaidHours ?? DEFAULT_PAYROLL_POLICY.standardPaidHours),
    breakWindowStart: String(data.breakWindowStart ?? DEFAULT_PAYROLL_POLICY.breakWindowStart),
    breakWindowEnd: String(data.breakWindowEnd ?? DEFAULT_PAYROLL_POLICY.breakWindowEnd),
    weekdayOutsideStandardMultiplier: Number(
      data.weekdayOutsideStandardMultiplier ?? DEFAULT_PAYROLL_POLICY.weekdayOutsideStandardMultiplier
    ),
    saturday: parseWeekend(data.saturday as Record<string, unknown> | undefined, DEFAULT_WEEKEND),
    sunday: parseWeekend(data.sunday as Record<string, unknown> | undefined, DEFAULT_SUNDAY),
  }
}

export function payrollPolicyToFirestore(policy: OrgPayrollTimePolicy): Record<string, unknown> {
  return {
    standardDayStart: policy.standardDayStart,
    standardDayEnd: policy.standardDayEnd,
    unpaidBreakMinutes: policy.unpaidBreakMinutes,
    standardPaidHours: policy.standardPaidHours,
    breakWindowStart: policy.breakWindowStart,
    breakWindowEnd: policy.breakWindowEnd,
    weekdayOutsideStandardMultiplier: policy.weekdayOutsideStandardMultiplier,
    saturday: weekendToFirestore(policy.saturday),
    sunday: weekendToFirestore(policy.sunday),
  }
}

function weekendToFirestore(weekend: WeekendPayrollSettings): Record<string, unknown> {
  return {
    allHoursAtMultiplierMode: weekend.allHoursAtMultiplierMode,
    allHoursMultiplier: weekend.allHoursMultiplier,
    definedWindowStart: weekend.definedWindowStart ?? '07:30',
    definedWindowEnd: weekend.definedWindowEnd ?? '16:00',
    countsAsStandardHours: weekend.countsAsStandardHours ?? 8,
    outsideWindowMultiplier: weekend.outsideWindowMultiplier ?? 1.5,
    sameAsSaturday: weekend.sameAsSaturday === true,
  }
}

function parseDayOfMonth(value: unknown): number {
  const n = Number(value)
  if (Number.isInteger(n) && n >= 1 && n <= 31) return n
  return 0
}

function parsePaymentRunDateRanges(data: Record<string, unknown> | undefined): PaymentRunDateRange[] {
  const raw = data?.paymentRunDateRanges
  if (!Array.isArray(raw) || raw.length === 0) {
    return DEFAULT_PAYMENT_RUN_DATE_RANGES.map((r) => ({ ...r }))
  }
  const ranges = raw.slice(0, 2).map((entry) => {
    const row = entry as Record<string, unknown>
    const startDay = parseDayOfMonth(row.startDate ?? row.startDay)
    const endDay = parseDayOfMonth(row.endDate ?? row.endDay)
    return { startDay, endDay }
  })
  while (ranges.length < 2) {
    ranges.push({ startDay: 0, endDay: 0 })
  }
  return ranges
}

export function parseAnnualLeaveDefaults(data: Record<string, unknown> | undefined): OrgAnnualLeaveDefaults {
  if (!data) return { ...DEFAULT_ANNUAL_LEAVE }
  return {
    daysPerYear: Number(data.daysPerYear ?? DEFAULT_ANNUAL_LEAVE.daysPerYear),
    startMonth: Number(data.startMonth ?? DEFAULT_ANNUAL_LEAVE.startMonth),
    endMonth: Number(data.endMonth ?? DEFAULT_ANNUAL_LEAVE.endMonth),
    carriesOver: Boolean(data.carriesOver),
  }
}

export function parseWarningDetection(data: Record<string, unknown> | undefined): OrgWarningDetectionSettings {
  if (!data) return { ...DEFAULT_WARNING_DETECTION, excludedUserIdsFromUnbookedWarnings: [] }
  const mode = String(data.clashLookaheadMode ?? DEFAULT_WARNING_DETECTION.clashLookaheadMode)
  const clashLookaheadMode =
    mode === 'numberOfDays' || mode === 'endOfInvoicingPeriod' ? mode : 'endOfWorkingWeek'
  return {
    detectClashes: data.detectClashes !== false,
    clashLookaheadMode,
    clashLookaheadDays: Number(data.clashLookaheadDays ?? DEFAULT_WARNING_DETECTION.clashLookaheadDays),
    includeWeekendsForUnbookedLabour: Boolean(data.includeWeekendsForUnbookedLabour),
    excludedUserIdsFromUnbookedWarnings: Array.isArray(data.excludedUserIdsFromUnbookedWarnings)
      ? (data.excludedUserIdsFromUnbookedWarnings as string[])
      : [],
  }
}

export function warningDetectionToFirestore(settings: OrgWarningDetectionSettings): Record<string, unknown> {
  return {
    detectClashes: settings.detectClashes,
    clashLookaheadMode: settings.clashLookaheadMode,
    clashLookaheadDays: settings.clashLookaheadDays,
    includeWeekendsForUnbookedLabour: settings.includeWeekendsForUnbookedLabour,
    excludedUserIdsFromUnbookedWarnings: settings.excludedUserIdsFromUnbookedWarnings,
  }
}

export function parseInvoicing(data: Record<string, unknown> | undefined): OrgInvoicingSettings {
  if (!data) return { ...DEFAULT_INVOICING }
  const paymentRunMode =
    data.paymentRunMode === 'date_ranges' ? 'date_ranges' : 'recurring_timeframe'
  const paymentDateMode =
    data.paymentDateMode === 'specific_dates' ? 'specific_dates' : 'recurring_date'
  const paymentDates = Array.isArray(data.paymentDates)
    ? (data.paymentDates as unknown[])
        .map((d) => String(parseDayOfMonth(d) || Number(d) || ''))
        .filter(Boolean)
    : []

  return {
    paymentRunMode,
    paymentDateMode,
    recurringRunStartDay: String(data.recurringRunStartDay ?? DEFAULT_INVOICING.recurringRunStartDay),
    recurringRunEndDay: String(data.recurringRunEndDay ?? DEFAULT_INVOICING.recurringRunEndDay),
    recurringPaymentDay: String(data.recurringPaymentDay ?? DEFAULT_INVOICING.recurringPaymentDay),
    paymentRunDateRanges: parsePaymentRunDateRanges(data),
    paymentDates,
    noteToUsers: String(data.noteToUsers ?? DEFAULT_INVOICING.noteToUsers),
  }
}

export function invoicingToFirestore(settings: OrgInvoicingSettings): Record<string, unknown> {
  return {
    paymentRunMode: settings.paymentRunMode,
    paymentDateMode: settings.paymentDateMode,
    paymentRunDateRanges: settings.paymentRunDateRanges.map((range) => ({
      startDate: range.startDay,
      endDate: range.endDay,
    })),
    paymentDates: settings.paymentDates.map((d) => Number(d)),
    noteToUsers: settings.noteToUsers,
    recurringPaymentRunSummary: `In arrears: ${capitalizeDay(settings.recurringRunStartDay)} to ${capitalizeDay(settings.recurringRunEndDay)} (of the previous week)`,
    recurringRunStartDay: settings.recurringRunStartDay,
    recurringRunEndDay: settings.recurringRunEndDay,
    recurringPaymentDay: settings.recurringPaymentDay,
  }
}

export function parseMyScheduleOptions(settings: Record<string, unknown> | undefined): MyScheduleOptions {
  const raw = (settings?.myScheduleOptions as Record<string, unknown> | undefined) ?? settings
  if (!raw) return { ...DEFAULT_MY_SCHEDULE, customItemEnabled: {} }
  const customItems = Array.isArray(raw.customItems) ? (raw.customItems as string[]) : []
  const enabledRaw = (raw.customItemEnabled as Record<string, boolean> | undefined) ?? {}
  const customItemEnabled = customItems.reduce<Record<string, boolean>>((acc, item) => {
    acc[item] = enabledRaw[item] ?? true
    return acc
  }, {})
  return {
    showOffice: raw.showOffice !== false,
    showWorkingFromHome: raw.showWorkingFromHome !== false,
    showSiteSurvey: raw.showSiteSurvey !== false,
    customItems,
    customItemEnabled,
  }
}

export function myScheduleOptionsToFirestore(options: MyScheduleOptions): Record<string, unknown> {
  return {
    showOffice: options.showOffice,
    showWorkingFromHome: options.showWorkingFromHome,
    showSiteSurvey: options.showSiteSurvey,
    customItems: options.customItems,
    customItemEnabled: options.customItemEnabled,
  }
}

export async function loadOrganizationDetails(organizationId: string): Promise<OrganizationDetails | null> {
  const snap = await getDoc(doc(db, 'organizations', organizationId))
  if (!snap.exists()) return null
  const data = snap.data()
  const settings = (data.settings as Record<string, unknown> | undefined) ?? {}
  return {
    id: snap.id,
    name: String(data.name ?? ''),
    countryCode: data.countryCode as string | undefined,
    creatorUserId: data.creatorUserId as string | undefined,
    companyLogoURL: data.companyLogoURL as string | undefined,
    payrollTimePolicy: parsePayrollPolicy(data.payrollTimePolicy as Record<string, unknown> | undefined),
    annualLeaveDefaults: parseAnnualLeaveDefaults(data.annualLeaveDefaults as Record<string, unknown> | undefined),
    warningDetection: parseWarningDetection(data.warningDetection as Record<string, unknown> | undefined),
    invoicing: parseInvoicing(data.invoicing as Record<string, unknown> | undefined),
    myScheduleOptions: parseMyScheduleOptions(settings),
  }
}

export async function savePayrollPolicy(organizationId: string, policy: OrgPayrollTimePolicy): Promise<void> {
  await updateDoc(doc(db, 'organizations', organizationId), {
    payrollTimePolicy: payrollPolicyToFirestore(policy),
    updatedAt: Timestamp.now(),
  })
}

export async function saveAnnualLeaveDefaults(organizationId: string, defaults: OrgAnnualLeaveDefaults): Promise<void> {
  await updateDoc(doc(db, 'organizations', organizationId), {
    annualLeaveDefaults: defaults,
    updatedAt: Timestamp.now(),
  })
}

export async function saveWarningDetection(organizationId: string, settings: OrgWarningDetectionSettings): Promise<void> {
  await updateDoc(doc(db, 'organizations', organizationId), {
    warningDetection: warningDetectionToFirestore(settings),
    updatedAt: Timestamp.now(),
  })
}

export async function saveInvoicingSettings(organizationId: string, settings: OrgInvoicingSettings): Promise<void> {
  await updateDoc(doc(db, 'organizations', organizationId), {
    invoicing: invoicingToFirestore(settings),
    updatedAt: Timestamp.now(),
  })
}

export async function saveMyScheduleOptions(organizationId: string, options: MyScheduleOptions): Promise<void> {
  await updateDoc(doc(db, 'organizations', organizationId), {
    'settings.myScheduleOptions': myScheduleOptionsToFirestore(options),
    updatedAt: Timestamp.now(),
  })
}

export function capitalizeDay(day: string): string {
  if (!day) return day
  return day.charAt(0).toUpperCase() + day.slice(1)
}

export const WEEKDAY_OPTIONS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const

export function formatPayrollSubtitle(policy: OrgPayrollTimePolicy): string {
  return `${policy.standardDayStart}–${policy.standardDayEnd} · ${policy.standardPaidHours}h · weekday OT ${policy.weekdayOutsideStandardMultiplier}x`
}

export function formatAnnualLeaveSubtitle(defaults: OrgAnnualLeaveDefaults, months: string[]): string {
  const start = months[defaults.startMonth - 1] ?? 'Jan'
  const end = months[defaults.endMonth - 1] ?? 'Dec'
  return `${defaults.daysPerYear} days · ${start}→${end} · ${defaults.carriesOver ? 'carry over' : 'no carry over'}`
}

export function formatScheduleOptionsSubtitle(options: MyScheduleOptions): string {
  const count =
    Number(options.showOffice) + Number(options.showWorkingFromHome) + Number(options.showSiteSurvey) + options.customItems.length
  return `${count} location option${count === 1 ? '' : 's'} in My Schedule`
}
