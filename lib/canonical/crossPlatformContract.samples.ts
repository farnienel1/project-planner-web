/**
 * Builds `lib/canonical/cross-platform-contract.json` (rulebook 1.10.0). Not packed for iOS.
 *
 *   npx tsx lib/canonical/crossPlatformContract.samples.ts --write
 *
 * `webWritten` samples are produced here by the rulebook writers web calls (and the Timestamp conversion each web
 * store applies); `iosWritten` samples are copied from the iOS payload builders named in `iosWriter`. `expected` is
 * what `readCrossPlatformSample` returns. `crossPlatformContract.test.ts` fails when the file on disk differs from
 * what this module builds, so a write-shape or reader change regenerates the contract in the same change.
 */

import { writeFileSync } from 'node:fs'
import { bookingWriteFields } from './bookings'
import { readCrossPlatformSample } from './crossPlatformContract'
import { holidayRequestWriteFields } from './leaveRequests'
import { LIVE_COLLECTIONS } from './liveSources'
import { orgMembershipWriteFields } from './orgMembership'
import { materialSendRecordCreateFields, jobTypesWriteFields, tradeTypeInventoryWriteFields } from './operationsDocuments'
import { payRateHistoryWriteFields } from './payRate'
import { notificationCreateFields, variationTradesWriteFields } from './recordsDocuments'
import { warningResolutionWriteFields } from './scheduleSources'
import { sensitiveProfileWriteFields } from './sensitiveProfile'
import { subcontractorBookingCreateFields } from './workDocumentReaders'

export const CONTRACT_TIME_ZONE = 'Europe/London'

type Doc = Record<string, unknown>
export type ContractSample = { platform: 'web' | 'ios'; docId: string; data: Doc; expected?: unknown }
export type ContractCollection = {
  /** `LIVE_COLLECTIONS` id. */
  id: string
  reader: string
  readerOptions?: { projectId?: string }
  /** The web function that produces `webWritten` (rulebook writer or store). */
  webWriter: string
  /** The iOS builder that must produce `iosWritten`. */
  iosWriter: string
  samples: ContractSample[]
}

/** A Firestore Timestamp as both apps hand it to the rulebook. */
export function ts(iso: string): { seconds: number; nanoseconds: number } {
  const ms = Date.parse(iso)
  return { seconds: Math.floor(ms / 1000), nanoseconds: (ms % 1000) * 1e6 }
}
function tsMs(ms: number) {
  return { seconds: Math.floor(ms / 1000), nanoseconds: (ms % 1000) * 1e6 }
}

const CREATED = '2026-10-01T09:00:00.000Z'
const UPDATED = '2026-10-02T10:30:00.000Z'
const DAY = '2026-11-04T00:00:00.000Z'
const ORG = 'ORG-1'
const WEB_JOB = 'a1b2c3d4-0000-4000-8000-00000000000a'
const IOS_JOB = 'A1B2C3D4-0000-4000-8000-00000000000B'

function must<T>(value: T | null | undefined | { ok: false }): T {
  if (value == null || (typeof value === 'object' && 'ok' in (value as object) && (value as { ok: boolean }).ok === false)) {
    throw new Error('contract writer refused its sample')
  }
  return value as T
}

/** Web writes each `…Ms` / instant number as a Timestamp. */
function withTimestamps(fields: Doc, keys: string[]): Doc {
  const out: Doc = { ...fields }
  for (const key of keys) if (typeof out[key] === 'number') out[key] = tsMs(out[key] as number)
  return out
}

/** The web-written documents, from the writers web calls. Keyed by collection id. */
export function webWrittenSamples(): Record<string, { docId: string; data: Doc }> {
  const booking = must(bookingWriteFields({
    id: 'B0000000-0000-4000-8000-000000000001',
    operativeId: 'op-web-1',
    projectId: WEB_JOB,
    dateMs: Date.parse(DAY),
    timeSlot: 'FULL DAY',
    status: 'Confirmed',
    bookedBy: 'Ada Admin',
    notes: 'Bring keys',
    workStartTime: null,
    createdAtMs: Date.parse(CREATED),
    updatedAtMs: Date.parse(UPDATED),
  })) as { ok: true; fields: Doc }
  const sub = must(subcontractorBookingCreateFields({
    id: 'S0000000-0000-4000-8000-000000000001',
    subcontractorId: 'SUB-1',
    projectId: WEB_JOB,
    dateMs: Date.parse(DAY),
    timeSlot: 'AM',
    bookedBy: 'Ada Admin',
    bookedContactIds: ['c-1'],
    bookedOperativeNames: ['Sam Sub'],
    createdAtMs: Date.parse(CREATED),
  })) as { ok: true; fields: Doc }
  const leave = must(holidayRequestWriteFields({
    id: 'H0000000-0000-4000-8000-000000000001',
    organizationId: ORG,
    userId: 'user-web-1',
    startDayKey: '2026-11-04',
    endDayKey: '2026-11-06',
    timeSlot: 'FULL DAY',
    status: 'pending',
    timeZone: CONTRACT_TIME_ZONE,
  }))
  const { startDateMs, endDateMs, startDayKey: _s, endDayKey: _e, ...leaveRest } = leave
  const rate = must(payRateHistoryWriteFields({ userId: 'user-web-1', operativeId: 'op-web-1', rate: 180, payBasis: 'day', effective: '2026-11-04', timeZone: CONTRACT_TIME_ZONE }))
  const resolution = must(warningResolutionWriteFields({ resolutionKey: 'op-clash-b1-b2', status: 'approved', resolvedByUserId: 'user-web-1' }))
  const send = materialSendRecordCreateFields({
    id: 'R0000000-0000-4000-8000-000000000001',
    projectId: WEB_JOB,
    requestType: 'Order',
    sentAt: ts(UPDATED),
    sentBy: 'Ada Admin',
    recipients: [{ name: 'Builders Ltd', email: 'orders@builders.test', wholesalerName: 'Builders Ltd' }],
    lines: [{ materialId: 'M-1', name: 'Plasterboard', quantity: 10, unit: 'Number' }],
  })
  const notification = must(notificationCreateFields({
    organizationId: ORG,
    type: 'holiday_request_submitted',
    title: 'Annual leave request',
    message: 'Ada asked for 4–6 Nov.',
    userId: 'mgr-web-1',
    actorUserId: 'user-web-1',
    relatedId: 'H0000000-0000-4000-8000-000000000001',
    createdAt: ts(UPDATED),
  })).set
  const membership = must(orgMembershipWriteFields({
    organizationId: ORG,
    stored: null,
    next: { role: 'manager', status: 'active', permissions: { manager: true, projects: true } },
    writer: 'admin',
    now: ts(UPDATED),
  })).fields
  const taxIds = (must(sensitiveProfileWriteFields({ utrNumber: '1234567890', vatNumber: 'GB123456789', updatedByUserId: 'user-web-1' })) as { ok: true; fields: Doc }).fields
  return {
    bookings: { docId: booking.fields.id as string, data: withTimestamps(booking.fields, ['date', 'createdAt', 'updatedAt']) },
    subcontractorBookings: { docId: sub.fields.id as string, data: withTimestamps(sub.fields, ['date', 'createdAt', 'updatedAt']) },
    holidayBookings: {
      docId: leave.id,
      data: { ...leaveRest, startDate: tsMs(startDateMs), endDate: tsMs(endDateMs), cancellationRequestedAt: null, createdAt: ts(CREATED), updatedAt: ts(UPDATED) },
    },
    operativeDayRateHistory: {
      docId: 'P0000000-0000-4000-8000-000000000001',
      data: { dayRate: rate.dayRate, payBasis: rate.payBasis, effectiveAt: tsMs(rate.effectiveAtMs), userId: rate.userId, operativeId: rate.operativeId, createdAt: ts(CREATED) },
    },
    warningResolutions: { docId: resolution.documentId, data: { ...resolution.fields, resolvedAt: ts(UPDATED) } },
    materialSendRecords: { docId: send.id as string, data: send },
    notifications: { docId: 'N0000000-0000-4000-8000-000000000001', data: notification },
    orgMemberships: { docId: ORG, data: membership },
    taxIds: { docId: 'taxIds', data: { ...taxIds, updatedAt: ts(UPDATED) } },
    jobTypes: { docId: 'jobTypes', data: must(jobTypesWriteFields([], ['CAT A', 'Small Works', 'Fit out'])).set },
    variationTrades: { docId: 'variationTrades', data: must(variationTradesWriteFields(null, { add: ['Electrical', 'Joinery'] })).set },
    tradeTypeInventory: { docId: 'tradeTypeInventory', data: must(tradeTypeInventoryWriteFields(null, ['Plumber', 'Bricklayer'])).set },
  }
}

/** Web documents for collections whose web writer passes the store payload through `documentWriteFields`. */
const WEB_STORE_SAMPLES: Record<string, { docId: string; data: Doc; webWriter: string }> = {
  organization: {
    docId: ORG,
    webWriter: 'organizationCreateFields + companyDetailsWriteFields + organizationCurrencyWriteFields (web settings)',
    data: { name: 'Acme Build', countryCode: 'GB', currencyCode: 'GBP', currency: 'GBP', settings: { currencyCode: 'GBP' }, officeAddressLine1: '1 High St', officeCity: 'Leeds', officePostcode: 'LS1 1AA', documentAbbreviation: 'ACM', warningDetection: { detectClashes: true, clashLookaheadMode: 'days', clashLookaheadDays: 7, includeWeekendsForUnbookedLabour: false, excludedUserIdsFromUnbookedWarnings: [] }, members: { 'user-web-1': 'admin' }, creatorUserId: 'user-web-1' },
  },
  users: {
    docId: 'user-web-1',
    webWriter: 'buildSaveUserPayload → userProfileWriteFields (lib/stores/userStore.ts)',
    data: { email: 'ada@acme.test', firstName: 'Ada', surname: 'Admin', lastName: 'Admin', organizationId: ORG, role: 'admin', isActive: true, passwordSet: true, isSuperAdmin: false, adminAccess: true, permissions: { adminAccess: true, manager: false, operatives: true, operativeMode: false, projects: true, smallWorks: true }, payBasis: 'day', dayRate: 200, employmentType: 'self_employed', assignedManagerUserIds: [], hasNoLineManager: true, notificationPreferences: { variations: true, companyActivity: false }, createdAt: ts(CREATED), updatedAt: ts(UPDATED) },
  },
  managerSiteBookings: {
    docId: 'MS000000-0000-4000-8000-000000000001',
    webWriter: 'managerSiteBookingStore create payload (lib/stores/managerScheduleStore.ts)',
    data: { id: 'MS000000-0000-4000-8000-000000000001', userId: 'mgr-web-1', date: ts(DAY), timeSlot: 'FULL_DAY', locationType: 'project', locationId: WEB_JOB, isBreakRemoved: false, createdAt: ts(CREATED), updatedAt: ts(UPDATED) },
  },
  projects: {
    docId: WEB_JOB,
    webWriter: 'projectStore save → jobWriteFields (lib/stores/projectStore.ts)',
    data: { id: WEB_JOB, jobNumber: 'J-100', siteName: 'High St Fit Out', addressLine1: '1 High St', addressLine2: '', townCity: 'Leeds', postcode: 'LS1 1AA', siteAddress: '1 High St, Leeds, LS1 1AA', client: { id: 'client-web-1', name: 'Client Co', email: '', phone: '' }, startDate: ts('2026-11-02T00:00:00.000Z'), endDate: ts('2026-12-18T00:00:00.000Z'), jobType: 'CAT A', managerId: 'user:mgr-web-1', managerIds: ['user:mgr-web-1'], managerUserIds: ['mgr-web-1'], isLive: true, organizationId: ORG, createdAt: ts(CREATED), updatedAt: ts(UPDATED) },
  },
  smallWorks: {
    docId: 'sw-web-1',
    webWriter: 'projectStore save (smallWorks) → jobWriteFields',
    data: { id: 'sw-web-1', jobNumber: 'SW-7', siteName: 'Boiler swap', addressLine1: '2 Low Rd', townCity: 'York', postcode: 'YO1 1AA', client: { id: 'client-web-1', name: 'Client Co' }, startDate: ts('2026-11-04T00:00:00.000Z'), endDate: ts('2026-11-04T00:00:00.000Z'), jobType: 'Small Works', managerIds: ['user:mgr-web-1'], managerUserIds: ['mgr-web-1'], isLive: true, organizationId: ORG, createdAt: ts(CREATED), updatedAt: ts(UPDATED) },
  },
  operatives: {
    docId: 'op-web-1',
    webWriter: 'operativeStore save → operativeRowWriteFields',
    data: { id: 'op-web-1', firstName: 'Ollie', lastName: 'Operative', name: 'Ollie Operative', email: 'ollie@acme.test', phone: '', isActive: true, skills: [], qualifications: [], payBasis: 'day', dayRate: 180, organizationId: ORG, startDate: ts(CREATED), createdAt: ts(CREATED), updatedAt: ts(UPDATED) },
  },
  managers: {
    docId: 'mgr-row-web-1',
    webWriter: 'operativeStore saveManager → managerRowWriteFields',
    data: { id: 'mgr-row-web-1', firstName: 'Mia', lastName: 'Manager', email: 'mia@acme.test', mobileNumber: '07000 000000', isActive: true, organizationId: ORG, createdAt: ts(CREATED), updatedAt: ts(UPDATED) },
  },
  clients: {
    docId: 'client-web-1',
    webWriter: 'clientStore save → clientWriteFields',
    data: { id: 'client-web-1', name: 'Client Co', contactPerson: 'Cara', email: 'cara@client.test', phone: '', address: '', organizationId: ORG, createdAt: ts(CREATED), updatedAt: ts(UPDATED) },
  },
  subcontractors: {
    docId: 'SUB-1',
    webWriter: 'subcontractorStore save → subcontractorWriteFields',
    data: { id: 'SUB-1', name: 'Sparks Ltd', subcontractorType: 'Electrical', website: '', address: '', contacts: [{ id: 'c-1', name: 'Sam Sub', email: 'sam@sparks.test', contactNumber: '', position: 'Installer' }], organizationId: ORG, createdAt: ts(CREATED), updatedAt: ts(UPDATED) },
  },
  materials: {
    docId: 'M-1',
    webWriter: 'materialProjectStore add → materialLineWriteFields',
    data: { id: 'M-1', projectId: WEB_JOB, material: 'Plasterboard', quantity: 10, unit: 'Number', status: 'not_ordered', date: ts(DAY), addedBy: 'Ada Admin', addedByUserId: 'user-web-1', addedAt: ts(CREATED), organizationId: ORG, createdAt: ts(CREATED), updatedAt: ts(UPDATED) },
  },
  materialCatalogue: {
    docId: 'CAT-1',
    webWriter: 'materialCatalogStore save → materialCatalogueItemWriteFields',
    data: { id: 'CAT-1', name: 'Plasterboard 12.5mm', defaultUnit: 'Number', brand: 'Gyproc', productCode: 'PB125', organizationId: ORG, createdByUserId: 'user-web-1', createdAt: ts(CREATED), updatedAt: ts(UPDATED) },
  },
  wholesalers: {
    docId: 'W-1',
    webWriter: 'wholesalerStore save → wholesalerWriteFields',
    data: { id: 'W-1', name: 'Builders Ltd', contacts: [{ id: 'wc-1', name: 'Orders', email: 'orders@builders.test', phone: '' }], organizationId: ORG, createdAt: ts(CREATED), updatedAt: ts(UPDATED) },
  },
  siteAudits: {
    docId: 'AUD-1',
    webWriter: 'siteAuditStore save → siteAuditWriteFields',
    data: { id: 'AUD-1', projectId: WEB_JOB, type: 'Site audit', customTitle: '', authorName: 'Ada Admin', date: ts(DAY), items: [], createdByUserId: 'user-web-1', organizationId: ORG, createdAt: ts(CREATED), updatedAt: ts(UPDATED) },
  },
  tasks: {
    docId: 'T-1',
    webWriter: 'taskStore save → taskWriteFields',
    data: { id: 'T-1', projectId: WEB_JOB, title: 'Order skip', details: null, createdBy: 'Ada Admin', createdByUserId: 'user-web-1', status: 'To Do', priority: 'Medium', assignedOperativeId: null, assignedOperativeIds: [], assignedManagerId: 'mgr-row-web-1', assignedManagerIds: ['mgr-row-web-1'], dueDate: ts(DAY), items: [], completedItemIds: [], organizationId: ORG, createdAt: ts(CREATED) },
  },
  healthSafety: {
    docId: `healthSafety_projects_${WEB_JOB.toUpperCase()}`,
    webWriter: 'healthSafetyStore save → healthSafetyDocumentWriteFields',
    data: { talks: [], issues: [{ id: 'ISS-1', projectId: WEB_JOB, talkId: 'TALK-1', issuedByUserId: 'user-web-1', issuedAt: ts(UPDATED), recipientUserIds: ['op-user-1'] }], signatures: [], ramsDocuments: [], otherDocuments: [] },
  },
  variations: {
    docId: 'V-1',
    webWriter: 'variationStorage save → variationWriteFields',
    data: { id: 'V-1', parentId: WEB_JOB, parentType: 'projects', number: 1, title: 'Extra socket', status: 'draft', isDeleted: false, createdByUserId: 'user-web-1', createdAt: ts(CREATED), updatedAt: ts(UPDATED) },
  },
  variationTrackers: {
    docId: WEB_JOB,
    webWriter: 'variationStorage tracker → variationTrackerWriteFields',
    data: { parentId: WEB_JOB, order: ['V-1'], updatedAt: ts(UPDATED) },
  },
  deadlines: {
    docId: `deadlines_projects_${WEB_JOB.toUpperCase()}`,
    webWriter: 'deadlineStore save (lib/stores/deadlineStore.ts)',
    data: { projectId: WEB_JOB, items: [{ id: 'D-1', title: 'Handover', dueDate: ts('2026-12-18T00:00:00.000Z'), assigneeUserIds: ['mgr-web-1'], completed: false }] },
  },
  skills: {
    docId: 'SK-1',
    webWriter: 'skills screen save',
    data: { id: 'SK-1', name: 'IPAF', organizationId: ORG, createdAt: ts(CREATED) },
  },
  timesheets: {
    docId: 'timesheet_user-web-1_1793750400',
    webWriter: 'timesheetOwnerWriteFields / timesheetSignOffWriteFields (timesheet period page)',
    data: { userId: 'user-web-1', startDayKey: '2026-11-01', endDayKey: '2026-11-15', ownerSignedAt: ts(UPDATED), managerSignedAt: null, exportedAt: null },
  },
}

/** iOS-written documents, copied from the iOS payload builders (`iosWriter`). Upper-case UUIDs as iOS stores them. */
const IOS_SAMPLES: Record<string, { docId: string; data: Doc; iosWriter: string }> = {
  organization: { docId: ORG, iosWriter: 'FirebaseBackend organisation settings saves (companyDetailsWriteFields, organizationCurrencyWriteFields)', data: { name: 'Acme Build', countryCode: 'GB', currencyCode: 'GBP', currency: 'GBP', 'settings.currencyCode': 'GBP', settings: { currencyCode: 'GBP', bankHolidayRegionId: 'GB-ENG-WLS' }, bankHolidayRegionId: 'GB-ENG-WLS', officeAddressLine1: '1 High St', officeCity: 'Leeds', officePostcode: 'LS1 1AA', warningDetection: { detectClashes: true, clashLookaheadMode: 'days', clashLookaheadDays: '7', includeWeekendsForUnbookedLabour: true, excludedUserIdsFromUnbookedWarnings: ['USER-IOS-9'] }, members: { 'USER-IOS-1': 'admin' } } },
  users: { docId: 'USER-IOS-1', iosWriter: 'FirebaseBackend.userDocumentPayload', data: { email: 'ian@acme.test', firstName: 'Ian', surname: 'Ios', organizationId: ORG, role: 'manager', isActive: true, passwordSet: true, isSuperAdmin: false, adminAccess: false, manager: true, operatives: false, operativeMode: false, permissions: { manager: true, projects: true }, payBasis: 'hourly', hourlyRate: 25, employmentType: 'paye', assignedManagerUserId: 'USER-IOS-2', assignedManagerUserIds: ['USER-IOS-2'], formerUserIds: ['6F1C2D3E-0000-4000-8000-000000000001'], notificationPreferences: { variations: false }, createdAt: ts(CREATED), updatedAt: ts(UPDATED) } },
  bookings: { docId: 'B1000000-0000-4000-8000-000000000002', iosWriter: 'BookingWritePatch.labourValues', data: { operativeId: 'OP-IOS-1', projectId: IOS_JOB, date: ts('2026-11-04T08:00:00.000Z'), timeSlot: 'AM', bookedBy: 'Ian Ios', notes: '', status: 'Confirmed', isBreakRemoved: false, workStartTime: '07:30', bookingGroupId: 'G-1', createdAt: ts(CREATED), updatedAt: ts(UPDATED) } },
  managerSiteBookings: { docId: 'MS100000-0000-4000-8000-000000000002', iosWriter: 'BookingWritePatch.managerValues', data: { userId: 'USER-IOS-1', date: ts('2026-11-04T08:00:00.000Z'), timeSlot: 'CUSTOM_HOURS', locationType: 'office', isBreakRemoved: true, workStartTime: '09:00', workEndTime: '13:00', createdAt: ts(CREATED), updatedAt: ts(UPDATED) } },
  subcontractorBookings: { docId: 'S1000000-0000-4000-8000-000000000002', iosWriter: 'Rulebook+WorkDocuments subcontractorBookingCreateFields', data: { id: 'S1000000-0000-4000-8000-000000000002', subcontractorId: 'SUB-1', projectID: IOS_JOB, date: ts('2026-11-04T08:00:00.000Z'), timeSlot: 'FULL DAY', isBreakRemoved: false, bookedBy: 'Ian Ios', status: 'Confirmed', bookedContactIds: [], bookedOperativeNames: [], createdAt: ts(CREATED), updatedAt: ts(CREATED) } },
  projects: { docId: IOS_JOB, iosWriter: 'FirebaseBackend.jobDocumentPayload', data: { jobNumber: 'J-200', siteName: 'Office refit', addressLine1: '5 Park Row', addressLine2: '', townCity: 'Leeds', postcode: 'LS1 5AA', siteAddress: '5 Park Row, Leeds', client: { id: 'CLIENT-IOS-1', name: 'Client Co', email: '', phone: '' }, startDate: ts('2026-11-02T00:00:00.000Z'), endDate: ts('2026-12-18T00:00:00.000Z'), jobType: 'CAT B', manager: 'Custom', managerId: 'MGR-ROW-IOS-1', managerIds: ['MGR-ROW-IOS-1'], isLive: true, description: '', hiddenManagerUserIds: [], hiddenOperativeUserIds: [], usesMapPinForLocation: false, organizationId: ORG, createdAt: ts(CREATED), updatedAt: ts(UPDATED) } },
  smallWorks: { docId: 'SW100000-0000-4000-8000-000000000002', iosWriter: 'FirebaseBackend.jobDocumentPayload (smallWorks)', data: { jobNumber: 'SW-8', siteName: 'Leak fix', addressLine1: '9 Side St', townCity: 'York', postcode: 'YO1 9AA', client: { id: 'CLIENT-IOS-1', name: 'Client Co' }, startDate: ts('2026-11-04T00:00:00.000Z'), endDate: ts('2026-11-04T00:00:00.000Z'), jobType: 'Small Works', managerIds: ['MGR-ROW-IOS-1'], managerId: 'MGR-ROW-IOS-1', isLive: true, organizationId: ORG, createdAt: ts(CREATED), updatedAt: ts(UPDATED) } },
  holidayBookings: { docId: 'H1000000-0000-4000-8000-000000000002', iosWriter: 'Rulebook holidayRequestWriteFields (iOS AnnualLeave save)', data: { id: 'H1000000-0000-4000-8000-000000000002', organizationId: ORG, userId: 'USER-IOS-1', operativeId: 'OP-IOS-1', startDate: ts('2026-11-09T00:00:00.000Z'), endDate: ts('2026-11-09T00:00:00.000Z'), status: 'approved', timeSlot: 'AM', approvedByUserId: 'USER-IOS-2', approvedAt: ts(UPDATED), cancellationRequestedAt: null, cancellationRequestedByUserId: null, decisionNote: null, createdAt: ts(CREATED), updatedAt: ts(UPDATED) } },
  operatives: { docId: 'OP-IOS-1', iosWriter: 'FirebaseBackend.operativeDocumentPayload', data: { firstName: 'Olga', lastName: 'Op', name: 'Olga Op', email: 'olga@acme.test', phone: '', startDate: ts(CREATED), skills: ['IPAF'], qualifications: [], isActive: true, currencySymbol: '£', notes: '', tradeTypePreset: 'Labourer', tradeTypeCustom: '', qualificationExpiryDates: {}, qualificationCertificateURLs: {}, payBasis: 'hourly', hourlyRate: 18.5, organizationId: ORG, createdAt: ts(CREATED) } },
  managers: { docId: 'MGR-ROW-IOS-1', iosWriter: 'FirebaseBackend.managerDocumentPayload', data: { firstName: 'Max', lastName: 'Manager', email: 'max@acme.test', mobileNumber: '07000 111111', department: '', isActive: true, notes: '', tradeTypePreset: '', tradeTypeCustom: '', organizationId: ORG, createdAt: ts(CREATED) } },
  clients: { docId: 'CLIENT-IOS-1', iosWriter: 'FirebaseBackend.clientDocumentPayload', data: { id: 'CLIENT-IOS-1', name: 'Client Co', contactPerson: '', email: '', phone: '', address: '', organizationId: ORG, createdAt: ts(CREATED) } },
  subcontractors: { docId: 'SUB-IOS-1', iosWriter: 'FirebaseBackend subcontractor save', data: { name: 'Pipes Ltd', subcontractorType: 'Plumbing', contacts: [{ name: 'Pat Pipe', email: '', contactNumber: '07000 222222', position: 'Supervisor', createdAt: ts(CREATED) }], organizationId: ORG, createdAt: ts(CREATED) } },
  operativeDayRateHistory: { docId: 'P1000000-0000-4000-8000-000000000002', iosWriter: 'FirebaseBackend.recordOperativeDayRateChange (payRateHistoryWriteFields)', data: { userId: 'USER-IOS-1', operativeId: 'OP-IOS-1', dayRate: null, payBasis: null, effectiveAt: ts('2026-11-04T00:00:00.000Z'), createdAt: ts(CREATED) } },
  warningResolutions: { docId: 'mgr-clash-USER-IOS-1-1793750400-0', iosWriter: 'FirebaseBackend warning resolution (warningResolutionWriteFields; older builds: epoch-second keys)', data: { resolutionKey: 'mgr-clash-USER-IOS-1-1793750400-0', status: 'dismissed', resolvedByUserId: 'USER-IOS-2', resolvedAt: ts(UPDATED) } },
  materials: { docId: 'M1000000-0000-4000-8000-000000000002', iosWriter: 'FirebaseBackend.materialLinePayload', data: { projectId: IOS_JOB, material: 'Screws', quantity: 2, unit: 'Box', status: 'ordered', date: ts('2026-11-04T00:00:00.000Z'), addedBy: 'Ian Ios', addedByUserId: 'USER-IOS-1', addedAt: ts(CREATED), organizationId: ORG, createdAt: ts(CREATED) } },
  materialSendRecords: { docId: 'R1000000-0000-4000-8000-000000000002', iosWriter: 'FirebaseBackend.materialSendRecordPayload', data: { id: 'R1000000-0000-4000-8000-000000000002', projectId: IOS_JOB, requestType: 'Quote', sentAt: ts(UPDATED), sentBy: 'Ian Ios', recipients: [{ name: 'Pipes', email: 'quotes@pipes.test' }], lines: [{ materialId: 'M1000000-0000-4000-8000-000000000002', name: 'Screws', quantity: 2, unit: 'Box' }] } },
  materialCatalogue: { docId: 'CAT1000-IOS', iosWriter: 'FirebaseBackend.materialCatalogueItemPayload', data: { name: 'Screws 4x40', defaultUnit: 'Box', brand: '', productCode: '', organizationId: ORG, createdByUserId: 'USER-IOS-1', createdAt: ts(CREATED) } },
  wholesalers: { docId: 'W1000-IOS', iosWriter: 'FirebaseBackend.wholesalerPayload', data: { name: 'Pipes', email: 'quotes@pipes.test', phone: '0113 000000', contacts: [], organizationId: ORG, createdAt: ts(CREATED) } },
  siteAudits: { docId: 'AUD1000-IOS', iosWriter: 'FirebaseBackend.siteAuditPayload', data: { id: 'AUD1000-IOS', organizationId: ORG, projectId: IOS_JOB, projectJobNumber: 'J-200', projectName: 'Office refit', type: 'Snagging', customTitle: '', authorName: 'Ian Ios', date: ts(DAY), items: [{ id: 'I-1', title: 'Paint', location: 'Hall', assignee: '', comments: '', annotations: [], createdAt: ts(CREATED), imageURL: null, imageCapturedAt: null }], createdAt: ts(CREATED) } },
  tasks: { docId: 'T1000000-0000-4000-8000-000000000002', iosWriter: 'FirebaseBackend.projectTaskFields', data: { id: 'T1000000-0000-4000-8000-000000000002', projectId: IOS_JOB, title: 'Check boards', details: null, createdBy: 'Ian Ios', status: 'Completed', priority: 'High', assignedOperativeId: 'OP-IOS-1', assignedOperativeIds: ['OP-IOS-1'], assignedManagerId: null, assignedManagerIds: [], dueDate: null, completedBy: 'Olga Op', completedAt: ts(UPDATED), completionNotes: 'Done', completionImages: [], completionFiles: [], attachedImageURLs: [], items: [], completedItemIds: [], organizationId: ORG, createdAt: ts(CREATED) } },
  healthSafety: { docId: `healthSafety_projects_${IOS_JOB}`, iosWriter: 'HealthSafety store (healthSafetyDocumentWriteFields)', data: { talks: [], issues: [], signatures: [], ramsDocuments: [{ id: 'DOC-1', name: 'RAMS.pdf', url: 'https://example.test/rams.pdf', uploadedAt: ts(CREATED) }], otherDocuments: [] } },
  variations: { docId: 'V1000-IOS', iosWriter: 'VariationStore save (variationWriteFields)', data: { parentId: IOS_JOB, parentType: 'projects', number: 3, title: 'Move door', status: 'submitted', isDeleted: false, createdByUserId: 'USER-IOS-1', createdAt: ts(CREATED) } },
  variationTrackers: { docId: IOS_JOB, iosWriter: 'VariationStore tracker (variationTrackerWriteFields)', data: { parentId: IOS_JOB, order: ['V1000-IOS'] } },
  deadlines: { docId: `deadlines_smallWorks_${'SW100000-0000-4000-8000-000000000002'}`, iosWriter: 'DeadlineStore save', data: { items: [{ id: 'D1000-IOS', title: 'Inspection', dueDate: ts('2026-11-05T00:00:00.000Z'), assigneeUserIds: ['USER-IOS-1'], completed: true }] } },
  notifications: { docId: 'N1000000-0000-4000-8000-000000000002', iosWriter: 'NotificationService create (notificationCreateFields)', data: { organizationId: ORG, type: 'variation_added', title: 'Variation added', message: 'Move door', userId: 'USER-IOS-2', actorUserId: 'USER-IOS-1', relatedId: 'V1000-IOS', requiresPermission: null, deepLinkUserId: null, isRead: false, createdAt: ts(UPDATED) } },
  jobTypes: { docId: 'jobTypes', iosWriter: 'JobTypeStore save (jobTypesWriteFields)', data: { jobTypes: ['CAT A', 'CAT B', 'Small Works'] } },
  skills: { docId: 'SK1000-IOS', iosWriter: 'SkillStore save', data: { name: 'CSCS', organizationId: ORG } },
  timesheets: { docId: 'timesheet_USER-IOS-1_1793750400', iosWriter: 'TimesheetStore.statusPayload', data: { userId: 'USER-IOS-1', ownerSignedAt: ts(UPDATED), managerSignedAt: ts(UPDATED), managerSignedByUserId: 'USER-IOS-2', exportedAt: null } },
  variationTrades: { docId: 'variationTrades', iosWriter: 'Variation trades save (variationTradesWriteFields)', data: { customTrades: ['Electrical', 'Decorating'] } },
  tradeTypeInventory: { docId: 'tradeTypeInventory', iosWriter: 'Trade type inventory save (tradeTypeInventoryWriteFields)', data: { trades: ['Labourer'] } },
  taxIds: { docId: 'taxIds', iosWriter: 'Profile tax ids save (sensitiveProfileWriteFields)', data: { utrNumber: '', vatNumber: 'GB999999999', updatedByUserId: 'USER-IOS-1', updatedAt: ts(UPDATED) } },
  orgMemberships: { docId: ORG, iosWriter: 'FirebaseBackend+OrganizationMembership membershipPayload (legacy flat; 1.10.0 must write orgMembershipWriteFields)', data: { email: 'ian@acme.test', organizationId: ORG, role: 'manager', isActive: true, adminAccess: false, manager: true, operatives: false, skills: false, materials: true, projects: true, smallWorks: false, operativeMode: false, siteAudit: true, isSuperAdmin: false, accountActive: true } },
}

/** `LIVE_COLLECTIONS` id → the rulebook reader for it. Rows not listed have no reader (`CONTRACT_NO_READER`). */
export const CONTRACT_READER_FOR: Readonly<Record<string, { reader: string; readerOptions?: { projectId?: string } }>> = {
  organization: { reader: 'organizationDocument' },
  users: { reader: 'parseUserDocument' },
  bookings: { reader: 'parseBookingDocument' },
  managerSiteBookings: { reader: 'parseManagerSiteBookingDocument' },
  subcontractorBookings: { reader: 'parseSubcontractorBookingDocument' },
  projects: { reader: 'parseProjectDocument' },
  smallWorks: { reader: 'parseSmallWorkDocument' },
  holidayBookings: { reader: 'parseHolidayDocument' },
  timesheets: { reader: 'parseTimesheetStatusFields' },
  operatives: { reader: 'parseOperativeDocument' },
  managers: { reader: 'parseManagerDocument' },
  clients: { reader: 'parseClientDocument' },
  subcontractors: { reader: 'parseSubcontractorDocument' },
  operativeDayRateHistory: { reader: 'parsePayRateHistoryDocument' },
  warningResolutions: { reader: 'parseWarningResolutionDocument' },
  materials: { reader: 'parseMaterialLineDocument' },
  materialSendRecords: { reader: 'parseMaterialSendRecordDocument' },
  materialCatalogue: { reader: 'parseMaterialCatalogueDocument' },
  wholesalers: { reader: 'parseWholesalerDocument' },
  siteAudits: { reader: 'parseSiteAuditDocument' },
  tasks: { reader: 'parseTaskDocument' },
  healthSafety: { reader: 'parseHealthSafetyDocument' },
  variations: { reader: 'parseVariationDocument' },
  variationTrackers: { reader: 'parseVariationTrackerDocument' },
  deadlines: { reader: 'parseDeadlineDocument' },
  notifications: { reader: 'parseNotificationDocument' },
  jobTypes: { reader: 'parseJobTypesDocument' },
  skills: { reader: 'parseSkillDocument' },
  variationTrades: { reader: 'parseVariationTrades' },
  tradeTypeInventory: { reader: 'parseTradeTypeInventory' },
  taxIds: { reader: 'resolveSensitiveProfile' },
  orgMemberships: { reader: 'parseOrgMembershipDocument' },
}

/** Live collections without a shared reader yet, with the reason (the test checks this list is complete). */
export const CONTRACT_NO_READER: Readonly<Record<string, string>> = {
  acceptedBookingClashes: 'Pair keys only (clashPairKey / isClashAccepted read the id); no document reader.',
  dismissedWarnings: 'Dismiss key is the document id; no document reader.',
  qualifications: 'No shared reader yet (known gap).',
  toolboxLibrary: 'Platform content, not organisation data.',
  deletedBookings: 'Write-only tombstones (bookingTombstoneWriteFields); never read by a screen.',
}

export function buildCrossPlatformContract(): {
  contractVersion: number
  timeZone: string
  instantShape: string
  collections: ContractCollection[]
} {
  const web = webWrittenSamples()
  const collections: ContractCollection[] = []
  for (const row of LIVE_COLLECTIONS) {
    const reader = CONTRACT_READER_FOR[row.id]
    if (!reader) continue
    const webSample = web[row.id] ?? WEB_STORE_SAMPLES[row.id]
    const iosSample = IOS_SAMPLES[row.id]
    if (!webSample || !iosSample) throw new Error(`contract: missing sample for ${row.id}`)
    const webWriter = web[row.id] ? 'rulebook writer (see crossPlatformContract.samples.ts webWrittenSamples)' : WEB_STORE_SAMPLES[row.id].webWriter
    const options = { timeZone: CONTRACT_TIME_ZONE, ...(reader.readerOptions ?? {}) }
    const samples: ContractSample[] = [
      { platform: 'web', docId: webSample.docId, data: webSample.data },
      { platform: 'ios', docId: iosSample.docId, data: iosSample.data },
    ].map((sample) => ({
      ...sample,
      platform: sample.platform as 'web' | 'ios',
      expected: readCrossPlatformSample(reader.reader, sample.docId, sample.data, options),
    }))
    collections.push({ id: row.id, reader: reader.reader, ...(reader.readerOptions ? { readerOptions: reader.readerOptions } : {}), webWriter, iosWriter: iosSample.iosWriter, samples })
  }
  return {
    contractVersion: 1,
    timeZone: CONTRACT_TIME_ZONE,
    instantShape: '{ "seconds": number, "nanoseconds": number } — a Firestore Timestamp as both apps pass it to the rulebook',
    collections,
  }
}

export function contractJson(): string {
  return `${JSON.stringify(buildCrossPlatformContract(), null, 2)}\n`
}

if (process.argv.includes('--write')) {
  writeFileSync(new URL('./cross-platform-contract.json', import.meta.url), contractJson())
  console.log('wrote lib/canonical/cross-platform-contract.json')
}
