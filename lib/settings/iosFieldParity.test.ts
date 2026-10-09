import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  DEFAULT_PAYROLL_POLICY,
  invoicingToFirestore,
  parseInvoicing,
  parsePayrollPolicy,
  payrollPolicyToFirestore,
} from './organizationSettings.ts'
import {
  bankHolidayRegionIdFromSelection,
  bankHolidaySelectionFromStored,
  companyIdentityFirestoreFields,
  countryCodeForCompany,
} from '../orgSetup/orgSetupSettings.ts'
import { notificationPreferenceFieldPatch } from './notificationPreferences.ts'
import { completionFileUrls } from '../tasks/completionFiles.ts'
import { DEFAULT_NOTIFICATION_PREFERENCES } from './notificationPreferences.ts'

test('weekend hours save uses iOS payroll field names', () => {
  const policy = {
    ...DEFAULT_PAYROLL_POLICY,
    saturday: {
      ...DEFAULT_PAYROLL_POLICY.saturday,
      allHoursAtMultiplierMode: false,
      definedWindowStart: '08:00',
      definedWindowEnd: '13:00',
      countsAsStandardHours: 5,
      outsideWindowMultiplier: 2,
    },
    sunday: { ...DEFAULT_PAYROLL_POLICY.sunday, sameAsSaturday: true },
    breakPaid: true,
  }
  const written = payrollPolicyToFirestore(policy)
  const saturday = written.saturday as Record<string, unknown>
  assert.equal(written.sundaySameAsSaturday, true)
  assert.equal(saturday.customStandardStart, '08:00')
  assert.equal(saturday.customStandardEnd, '13:00')
  assert.equal(saturday.countsAsHours, 5)
  assert.equal(saturday.outsideStandardWindowMultiplier, 2)
  assert.equal(saturday.useCustomStandardDayWindow, true)
  assert.equal('definedWindowStart' in saturday, false)
  assert.equal('countsAsStandardHours' in saturday, false)
  assert.equal('sameAsSaturday' in (written.sunday as Record<string, unknown>), false)
  assert.equal(written.breakPaid, true)

  const legacy = parsePayrollPolicy({
    saturday: {
      definedWindowStart: '07:00',
      definedWindowEnd: '12:00',
      countsAsStandardHours: 4,
      outsideWindowMultiplier: 1.5,
      allHoursAtMultiplierMode: false,
      allHoursMultiplier: 2,
    },
    sunday: { sameAsSaturday: true, allHoursAtMultiplierMode: true, allHoursMultiplier: 2 },
  })
  assert.equal(legacy.saturday.definedWindowStart, '07:00')
  assert.equal(legacy.saturday.countsAsStandardHours, 4)
  assert.equal(legacy.sunday.sameAsSaturday, true)
  const again = payrollPolicyToFirestore(legacy)
  assert.equal((again.saturday as Record<string, unknown>).customStandardStart, '07:00')
  assert.equal((again.saturday as Record<string, unknown>).countsAsHours, 4)
  assert.equal(again.sundaySameAsSaturday, true)
})

test('payment run rows write startDay and endDay and missing mode is date ranges', () => {
  const parsed = parseInvoicing({
    paymentRunDateRanges: [{ startDate: 1, endDate: 15 }],
  })
  assert.equal(parsed.paymentRunMode, 'date_ranges')
  assert.equal(parsed.paymentRunDateRanges[0].startDay, 1)
  assert.equal(parsed.paymentRunDateRanges[0].endDay, 15)
  const written = invoicingToFirestore(parsed)
  const ranges = written.paymentRunDateRanges as { startDay: number; endDay: number }[]
  assert.equal(ranges[0].startDay, 1)
  assert.equal(ranges[0].endDay, 15)
  assert.equal('startDate' in ranges[0], false)
})

test('company address uses iOS flat fields and does not replace country with the region', () => {
  const fields = companyIdentityFirestoreFields({
    addressLine1: '1 High Street',
    town: 'London',
    postcode: 'SW1A 1AA',
    currency: 'GBP',
    countryCode: 'GB',
    regionSelection: 'GB-ENG',
    documentAbbreviation: 'rm',
  })
  assert.equal(fields.officeAddressLine1, '1 High Street')
  assert.equal(fields.officeCity, 'London')
  assert.equal(fields.officePostcode, 'SW1A 1AA')
  assert.equal(fields.countryCode, 'GB')
  assert.equal(fields.bankHolidayRegionId, 'GB-ENG-WLS')
  assert.equal(fields.currencyCode, 'GBP')
  assert.equal(fields.documentAbbreviation, 'RM')
  assert.equal(countryCodeForCompany('GB-SCT', 'GB'), 'GB')
  assert.equal(bankHolidayRegionIdFromSelection('GB-SCT'), 'GB-SCT')
  assert.equal(bankHolidaySelectionFromStored('GB-ENG-WLS'), 'GB-ENG')
  assert.equal(bankHolidayRegionIdFromSelection(bankHolidaySelectionFromStored('GB-ENG-WLS')), 'GB-ENG-WLS')
  assert.equal(bankHolidaySelectionFromStored('GB-SCT'), 'GB-SCT')
})

test('notification save patches material keys and leaves other preference keys alone', () => {
  const patch = notificationPreferenceFieldPatch(DEFAULT_NOTIFICATION_PREFERENCES)
  assert.equal(patch['notificationPreferences.materialOrderCutOff'], true)
  assert.equal('notificationPreferences' in patch, false)
  assert.equal(Object.keys(patch).some((key) => key.includes('bookingConflicts')), false)
})

test('completion files round-trip as URL strings', () => {
  assert.deepEqual(
    completionFileUrls(['https://cdn.example/a.pdf', { name: 'old', url: 'https://cdn.example/b.pdf' }, { fileURL: 'https://cdn.example/c.pdf' }]),
    ['https://cdn.example/a.pdf', 'https://cdn.example/b.pdf', 'https://cdn.example/c.pdf']
  )
})
