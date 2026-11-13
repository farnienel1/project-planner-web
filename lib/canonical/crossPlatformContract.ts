/**
 * The cross-platform write/read contract (rulebook "How the rulebook changes", 1.10.0).
 *
 * `lib/canonical/cross-platform-contract.json` lists, for every shared collection in `LIVE_COLLECTIONS` that has a
 * rulebook reader, a document as web writes it (`webWritten`), a document as iOS writes it (`iosWritten`), and what
 * the reader returns for each (`expected`). Web's `crossPlatformContract.test.ts` and iOS
 * `CrossPlatformContractTests` (the file is mirrored to `ProjectPlannerTests/CrossPlatformContract.json`) both run
 * every sample through `readCrossPlatformSample` and compare with `expected`, and each checks that its own writers
 * still produce its samples. A change to what an app writes changes the contract in the same change, so the other
 * platform's tests see it.
 *
 * Instants in the JSON are `{ "seconds": n, "nanoseconds": n }` (what both apps pass a Firestore Timestamp as).
 */

import { parseBookingDocument, parseManagerSiteBookingDocument } from './bookings'
import { parseCompanyDetails } from './companyDetails'
import { parseAnnualLeaveAdjustmentDocument } from './annualLeaveAdjustments'
import { parseHolidayDocument } from './holidayDocument'
import { resolveOrganizationCurrency } from './money'
import { parseUserNotificationPreferences } from './notificationPreferences'
import {
  parseJobTypesDocument,
  parseMaterialCatalogueDocument,
  parseMaterialLineDocument,
  parseMaterialSendRecordDocument,
  parseSiteAuditDocument,
  parseTaskDocument,
  parseTradeTypeInventory,
  parseWholesalerDocument,
} from './operationsDocuments'
import { parseOrganizationName, parseWarningDetection } from './organizationSettings'
import { parseOrgMembershipDocument } from './orgMembership'
import {
  parseClientDocument,
  parseManagerDocument,
  parseOperativeDocument,
  parsePayRateHistoryDocument,
  parseSkillDocument,
  parseSubcontractorDocument,
  parseUserDocument,
} from './peopleDocuments'
import {
  parseHealthSafetyDocument,
  parseNotificationDocument,
  parseVariationDocument,
  parseVariationTrackerDocument,
  parseVariationTrades,
  parseWarningResolutionDocument,
} from './recordsDocuments'
import { resolveSensitiveProfile } from './sensitiveProfile'
import { parseTimesheetStatusFields } from './timesheetPeriod'
import {
  parseDeadlineDocument,
  parseProjectDocument,
  parseSmallWorkDocument,
  parseSubcontractorBookingDocument,
} from './workDocumentReaders'

export type CrossPlatformReaderOptions = { timeZone?: string | null; projectId?: string | null }

type Reader = (docId: string, data: Record<string, unknown>, options: CrossPlatformReaderOptions) => unknown

/** Reader name in the contract → the rulebook reader it runs. */
export const CROSS_PLATFORM_CONTRACT_READERS: Readonly<Record<string, Reader>> = {
  parseBookingDocument: (id, data, o) => parseBookingDocument(id, data, { timeZone: o.timeZone }),
  parseManagerSiteBookingDocument: (id, data, o) => parseManagerSiteBookingDocument(id, data, { timeZone: o.timeZone }),
  parseSubcontractorBookingDocument: (id, data, o) => parseSubcontractorBookingDocument(id, data, { timeZone: o.timeZone }),
  parseProjectDocument: (id, data, o) => parseProjectDocument(id, data, { timeZone: o.timeZone }),
  parseSmallWorkDocument: (id, data, o) => parseSmallWorkDocument(id, data, { timeZone: o.timeZone }),
  parseHolidayDocument: (id, data, o) => parseHolidayDocument(id, data, o.timeZone),
  parseOperativeDocument: (id, data, o) => parseOperativeDocument(id, data, o.timeZone),
  parseManagerDocument: (id, data) => parseManagerDocument(id, data),
  parseClientDocument: (id, data) => parseClientDocument(id, data),
  parseSubcontractorDocument: (id, data) => parseSubcontractorDocument(id, data),
  parsePayRateHistoryDocument: (id, data, o) => parsePayRateHistoryDocument(id, data, o.timeZone),
  parseWarningResolutionDocument: (id, data, o) => parseWarningResolutionDocument(id, data, { timeZone: o.timeZone }),
  parseMaterialLineDocument: (id, data, o) => parseMaterialLineDocument(id, data, { timeZone: o.timeZone }),
  parseMaterialSendRecordDocument: (id, data, o) => parseMaterialSendRecordDocument(id, data, { timeZone: o.timeZone }),
  parseMaterialCatalogueDocument: (id, data) => parseMaterialCatalogueDocument(id, data),
  parseWholesalerDocument: (id, data) => parseWholesalerDocument(id, data),
  parseSiteAuditDocument: (id, data, o) => parseSiteAuditDocument(id, data, { timeZone: o.timeZone }),
  parseTaskDocument: (id, data, o) => parseTaskDocument(id, data, { timeZone: o.timeZone }),
  parseHealthSafetyDocument: (_id, data, o) => parseHealthSafetyDocument(data, { projectId: o.projectId, timeZone: o.timeZone }),
  parseVariationDocument: (id, data) => parseVariationDocument(id, data),
  parseVariationTrackerDocument: (id, data) => parseVariationTrackerDocument(id, data),
  parseDeadlineDocument: (id, data, o) => parseDeadlineDocument(id, data, { projectId: o.projectId, timeZone: o.timeZone }),
  parseNotificationDocument: (id, data, o) => parseNotificationDocument(id, data, { timeZone: o.timeZone }),
  parseJobTypesDocument: (_id, data) => parseJobTypesDocument(data),
  parseSkillDocument: (id, data) => parseSkillDocument(id, data),
  parseUserDocument: (id, data) => parseUserDocument(id, data),
  parseVariationTrades: (_id, data) => parseVariationTrades(data),
  parseTradeTypeInventory: (_id, data) => parseTradeTypeInventory(data),
  parseTimesheetStatusFields: (_id, data) => parseTimesheetStatusFields(data),
  resolveSensitiveProfile: (_id, data) => resolveSensitiveProfile({ privateDoc: data }),
  parseOrgMembershipDocument: (id, data) => parseOrgMembershipDocument(id, data),
  parseAnnualLeaveAdjustmentDocument: (id, data) => parseAnnualLeaveAdjustmentDocument(id, data),
  /** `organizations/{orgId}`: the settings readers together. */
  organizationDocument: (_id, data) => ({
    name: parseOrganizationName(data),
    companyDetails: parseCompanyDetails(data),
    currency: resolveOrganizationCurrency(data),
    warningDetection: parseWarningDetection(
      (data.warningDetection && typeof data.warningDetection === 'object'
        ? data.warningDetection
        : (data.settings as Record<string, unknown> | undefined)?.warningDetection) as Record<string, unknown> | undefined
    ),
  }),
  /** `users/{uid}.notificationPreferences`. */
  parseUserNotificationPreferences: (_id, data) =>
    parseUserNotificationPreferences(data.notificationPreferences as Record<string, unknown> | undefined),
}

/** JSON round trip, so `expected` compares as plain data on every platform (undefined keys dropped). */
function plain(value: unknown): unknown {
  if (value === undefined) return null
  return JSON.parse(JSON.stringify(value))
}

/**
 * Runs one contract sample through its reader and returns plain JSON (the shape `expected` holds). Unknown reader →
 * `{ error: 'unknown_reader' }`.
 */
export function readCrossPlatformSample(
  reader: unknown,
  docId: unknown,
  data: Record<string, unknown> | null | undefined,
  options?: CrossPlatformReaderOptions | null
): unknown {
  const run = CROSS_PLATFORM_CONTRACT_READERS[typeof reader === 'string' ? reader : '']
  if (!run) return { error: 'unknown_reader' }
  return plain(run(typeof docId === 'string' ? docId : '', data && typeof data === 'object' ? data : {}, options || {}))
}

export function crossPlatformContractReaderNames(): string[] {
  return Object.keys(CROSS_PLATFORM_CONTRACT_READERS).sort()
}
