/**
 * Company data export (launch checklist 2.1): which documents are read, which file each one goes to, and what is
 * never exported.
 *
 * The collection list starts from the rulebook's own list, `OPERATIONAL_COLLECTION_PATHS` (imported read-only from
 * lib/canonical): every plain `organizations/{orgId}/<name>` entry is read; the templated entries
 * (`settings/variations_{parentId}`, `settings/healthSafety_…`) live in the `settings` collection, which is read
 * whole; `healthSafetyEvidence` is a Cloud Storage path, listed in files.csv. The other organisation collections
 * the security rules know (bookings by kind, pay history, warning state, roster rows) are added below.
 *
 * Every read is under `organizations/{orgId}` of the open organisation, plus the roster query `users` where
 * `organizationId` is that organisation (rulebook §1, §11) and, by id, the people anchored on it (its `members` keys
 * and creator, `rosterMembersForOrganization`). Nothing else is read.
 */
import { OPERATIONAL_COLLECTION_PATHS } from '../canonical/organizationSettings'
import type { ExportValue } from './values'

export const ORGANIZATION_PATH_TEMPLATE = 'organizations/{orgId}'

/** One CSV file of the zip. */
export type ExportFile = {
  file: string
  title: string
  description: string
}

/** The CSV files, in README order. */
export const EXPORT_FILES = {
  organisation: { file: 'organisation.csv', title: 'Organisation', description: 'The organisation document: company details, working hours, leave defaults, payment runs, warning settings and other settings. Billing is reduced to the plan status.' },
  people: { file: 'people.csv', title: 'People', description: 'User accounts of this organisation (users where organizationId is this organisation, plus members listed on the organisation). Push tokens, confirmation tokens and tax ids are left out.' },
  operatives: { file: 'operatives.csv', title: 'Operatives', description: 'Operative roster rows (organizations/{orgId}/operatives), including assigned qualifications.' },
  managers: { file: 'managers.csv', title: 'Managers', description: 'Manager roster rows (organizations/{orgId}/managers).' },
  subcontractors: { file: 'subcontractors.csv', title: 'Subcontractors', description: 'Subcontractor firms and their contacts.' },
  clients: { file: 'clients.csv', title: 'Clients', description: 'Clients.' },
  jobs: { file: 'jobs.csv', title: 'Jobs', description: 'Projects and small works; the jobCollection column says which.' },
  bookings: { file: 'bookings.csv', title: 'Bookings', description: 'Labour bookings (organizations/{orgId}/bookings), the full archive.' },
  managerSiteBookings: { file: 'manager-site-bookings.csv', title: 'Manager site bookings', description: 'Manager site, office, working-from-home and site-survey bookings.' },
  subcontractorBookings: { file: 'subcontractor-bookings.csv', title: 'Subcontractor bookings', description: 'Subcontractor bookings.' },
  deletedBookings: { file: 'deleted-bookings.csv', title: 'Deleted bookings', description: 'Booking tombstones: which booking was deleted, when and by whom.' },
  annualLeave: { file: 'annual-leave.csv', title: 'Annual leave', description: 'Annual leave requests and decisions (holidayBookings).' },
  timesheets: { file: 'timesheets.csv', title: 'Timesheets', description: 'Timesheets (settings/timesheet_{userId}_{periodStart}, and the timesheets collection when used): lines, price work, expenses, reviews and sign-off.' },
  ratesHistory: { file: 'rates-history.csv', title: 'Rates history', description: 'Effective-dated day / hourly rate history (operativeDayRateHistory).' },
  payProfiles: { file: 'pay-profiles.csv', title: 'Pay profiles', description: 'Private pay profiles (payProfiles): pay basis, rates and employment type per person.' },
  operativeProfiles: { file: 'operative-profiles.csv', title: 'Operative profiles', description: 'The operativeProfiles pay and line-manager mirror.' },
  materials: { file: 'materials.csv', title: 'Materials', description: 'Job material lines and their order status.' },
  materialOrders: { file: 'material-orders.csv', title: 'Material orders', description: 'Quote and order send records (materialSendRecords).' },
  materialCatalogue: { file: 'material-catalogue.csv', title: 'Material catalogue', description: 'The company material catalogue.' },
  wholesalers: { file: 'wholesalers.csv', title: 'Wholesalers', description: 'Wholesalers and their contacts.' },
  variations: { file: 'variations.csv', title: 'Variations', description: 'Variations (organizations/{orgId}/variations).' },
  variationTrackers: { file: 'variation-trackers.csv', title: 'Variation trackers', description: 'Per-job variation numbering settings.' },
  variationLogs: { file: 'variation-logs.csv', title: 'Variation logs', description: 'Variation logs and items kept in settings (variations_{jobId}, variationItem_{id}, variationTrades).' },
  tasks: { file: 'tasks.csv', title: 'Tasks', description: 'Tasks.' },
  deadlines: { file: 'deadlines.csv', title: 'Deadlines', description: 'Deadline programmes (settings/deadlines_…) and assignees (settings/deadlineAssignments).' },
  healthSafety: { file: 'health-safety.csv', title: 'Health & safety', description: 'Health & safety records per job: toolbox talks, issues, signatures, RAMS and other documents (settings/healthSafety_… and each job\'s healthSafety documents).' },
  siteAudits: { file: 'site-audits.csv', title: 'Site audits', description: 'Site audits.' },
  qualifications: { file: 'qualifications.csv', title: 'Qualifications', description: 'The qualification library.' },
  skills: { file: 'skills.csv', title: 'Skills', description: 'The skills catalogue.' },
  warningResolutions: { file: 'warning-resolutions.csv', title: 'Warning resolutions', description: 'Approved and dismissed warnings (warningResolutions).' },
  acceptedClashes: { file: 'accepted-clashes.csv', title: 'Accepted clashes', description: 'Approved booking clashes (acceptedBookingClashes).' },
  dismissedWarnings: { file: 'dismissed-warnings.csv', title: 'Dismissed warnings', description: 'Dismissed warnings (dismissedWarnings).' },
  settings: { file: 'settings.csv', title: 'Other settings', description: 'Other company settings documents (job types, trade types and similar).' },
  notifications: { file: 'notifications.csv', title: 'Notifications', description: 'Inbox notifications of everyone in the organisation (only when chosen).' },
  overtimeRequests: { file: 'overtime-requests.csv', title: 'Overtime requests', description: 'PAYE overtime requests and their decisions (overtimeRequests, rulebook 1.29.0).' },
  overtimeReviews: { file: 'overtime-reviews.csv', title: 'Overtime reviews', description: 'Approved PAYE overtime lines, one per person and booking (overtimeReviews).' },
  overtimeReports: { file: 'overtime-reports.csv', title: 'Overtime reports', description: 'Saved PAYE overtime report copies (overtimeReports), as sent.' },
  priceWorkItems: { file: 'price-work.csv', title: 'PAYE price work', description: 'PAYE price work items with their approver and evidence paths (priceWorkItems, rulebook 1.30.0).' },
  expenseItems: { file: 'expenses.csv', title: 'PAYE expenses', description: 'PAYE expenses with their evidence paths (expenseItems, rulebook 1.30.0).' },
  payeClaimReports: { file: 'price-work-and-expense-reports.csv', title: 'Price work and expense reports', description: 'Saved PAYE price work and expenses report copies (payeClaimReports), as sent.' },
} as const satisfies Record<string, ExportFile>

export type ExportFileKey = keyof typeof EXPORT_FILES

/** A collection under `organizations/{orgId}` that is read whole, and the file its documents go to. */
export type OrganizationCollectionRead = {
  collection: string
  file: ExportFileKey
  /** Only read when the admin ticks it. */
  optional?: boolean
  /**
   * The security rules refuse an unfiltered query (variations: `resource.data.parentId is string`); on refusal the
   * collection is read one job at a time with `parentId ==`.
   */
  perJobFallbackField?: string
}

/** The plain collections named by `OPERATIONAL_COLLECTION_PATHS` (`organizations/{orgId}/<name>`). */
export function operationalCollectionNames(): string[] {
  const names: string[] = []
  for (const path of Object.values(OPERATIONAL_COLLECTION_PATHS)) {
    const match = /^organizations\/\{orgId\}\/([A-Za-z]+)$/.exec(path)
    if (match && !names.includes(match[1])) names.push(match[1])
  }
  return names
}

const FILE_FOR_COLLECTION: Record<string, ExportFileKey> = {
  variations: 'variations',
  variationTrackers: 'variationTrackers',
  bookings: 'bookings',
  holidayBookings: 'annualLeave',
  timesheets: 'timesheets',
  dismissedWarnings: 'dismissedWarnings',
  projects: 'jobs',
  smallWorks: 'jobs',
  clients: 'clients',
  tasks: 'tasks',
  siteAudits: 'siteAudits',
  materialCatalogue: 'materialCatalogue',
  materials: 'materials',
  materialSendRecords: 'materialOrders',
  qualifications: 'qualifications',
  // Not in OPERATIONAL_COLLECTION_PATHS; named by the security rules and the rulebook §1 live-data table.
  managerSiteBookings: 'managerSiteBookings',
  subcontractorBookings: 'subcontractorBookings',
  deletedBookings: 'deletedBookings',
  operatives: 'operatives',
  managers: 'managers',
  subcontractors: 'subcontractors',
  wholesalers: 'wholesalers',
  skills: 'skills',
  operativeDayRateHistory: 'ratesHistory',
  payProfiles: 'payProfiles',
  operativeProfiles: 'operativeProfiles',
  warningResolutions: 'warningResolutions',
  acceptedBookingClashes: 'acceptedClashes',
  settings: 'settings',
  notifications: 'notifications',
  overtimeRequests: 'overtimeRequests',
  overtimeReviews: 'overtimeReviews',
  overtimeReports: 'overtimeReports',
  priceWorkItems: 'priceWorkItems',
  expenseItems: 'expenseItems',
  payeClaimReports: 'payeClaimReports',
}

const ADDITIONAL_COLLECTIONS = [
  'managerSiteBookings',
  'subcontractorBookings',
  'deletedBookings',
  'operatives',
  'managers',
  'subcontractors',
  'wholesalers',
  'skills',
  'operativeDayRateHistory',
  'payProfiles',
  'operativeProfiles',
  'warningResolutions',
  'acceptedBookingClashes',
  'settings',
  'notifications',
] as const

/**
 * Organisation collections deliberately not exported, and why (listed in the README).
 */
export const EXCLUDED_COLLECTIONS: Record<string, string> = {
  userEmails: 'internal sign-in email claims (an index of email → account), not company records',
  dashboardLayouts: 'each person\'s Home layout, a per-user display preference',
  fileReports: 'moderation reports about uploaded files, reviewed in Settings → Reported files',
  personalSiteAudits: 'personal site audits are private to the person who created them (rulebook 1.30.0); copies attached to expenses or price work are listed with those',
}

/** Every collection read under `organizations/{orgId}`, in reading order. */
export function organizationCollectionReads(options: { includeNotifications: boolean }): OrganizationCollectionRead[] {
  const names = [...operationalCollectionNames(), ...ADDITIONAL_COLLECTIONS.filter((name) => name !== 'notifications')]
  if (options.includeNotifications) names.push('notifications')
  const seen = new Set<string>()
  const reads: OrganizationCollectionRead[] = []
  for (const name of names) {
    if (seen.has(name) || EXCLUDED_COLLECTIONS[name]) continue
    seen.add(name)
    const file = FILE_FOR_COLLECTION[name] ?? 'settings'
    reads.push({
      collection: name,
      file,
      ...(name === 'notifications' ? { optional: true } : {}),
      ...(name === 'variations' ? { perJobFallbackField: 'parentId' } : {}),
    })
  }
  return reads
}

/** Job kinds whose documents have a `healthSafety` subcollection (read per job). */
export const JOB_COLLECTIONS = ['projects', 'smallWorks'] as const

/**
 * The file a `settings/{id}` document goes to: timesheets, deadlines, variation logs and health & safety have their
 * own files; everything else is settings.csv.
 */
export function fileForSettingsDocument(documentId: string): ExportFileKey {
  if (documentId.startsWith('timesheet_')) return 'timesheets'
  if (documentId.startsWith('deadlines_') || documentId === 'deadlineAssignments') return 'deadlines'
  if (
    documentId.startsWith('variations_') ||
    documentId.startsWith('variationItem_') ||
    documentId === 'variationTrades'
  ) {
    return 'variationLogs'
  }
  if (documentId.startsWith('healthSafety_')) return 'healthSafety'
  return 'settings'
}

/** The file for a document of collection `collection` (under the organisation) with id `documentId`. */
export function fileForDocument(collection: string, documentId: string): ExportFileKey {
  if (collection === 'settings') return fileForSettingsDocument(documentId)
  return FILE_FOR_COLLECTION[collection] ?? 'settings'
}

// ─── What is never exported ───────────────────────────────────────────────────

/**
 * Field names never exported, at any depth: device push tokens, confirmation / invite tokens, secrets, API keys,
 * password material, Stripe ids and private tax ids (VAT number, UTR — rulebook §12 keeps them at
 * `users/{uid}/private/taxIds`; older documents may still carry a copy).
 */
export function isExcludedFieldName(key: string): boolean {
  const k = key.toLowerCase()
  return (
    k.includes('token') ||
    k.includes('secret') ||
    k.includes('apikey') ||
    k.includes('api_key') ||
    k.includes('privatekey') ||
    k.includes('private_key') ||
    k === 'password' ||
    k.includes('passwordhash') ||
    k.includes('passwordsalt') ||
    k.includes('stripe') ||
    k === 'vatnumber' ||
    k === 'utrnumber' ||
    k === 'vat_number' ||
    k === 'utr_number'
  )
}

/** Billing and subscription keep only the plan status (no Stripe ids, payment history or revenue). */
export const BILLING_KEPT_FIELDS = ['status', 'billingInterval', 'planKey', 'trialEnd', 'currentPeriodEnd', 'cancelAtPeriodEnd'] as const

function stripExcluded(value: ExportValue): ExportValue {
  if (Array.isArray(value)) return value.map(stripExcluded)
  if (value !== null && typeof value === 'object') {
    const out: { [key: string]: ExportValue } = {}
    for (const [key, inner] of Object.entries(value)) {
      if (isExcludedFieldName(key)) continue
      out[key] = stripExcluded(inner)
    }
    return out
  }
  return value
}

function keepOnly(value: ExportValue | undefined, keys: readonly string[]): ExportValue | undefined {
  if (value === undefined) return undefined
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return null
  const out: { [key: string]: ExportValue } = {}
  for (const key of keys) if (key in value) out[key] = value[key]
  return out
}

/** A document with every excluded field removed. The organisation document also has billing reduced. */
export function sanitizeDocument(
  data: Record<string, ExportValue>,
  kind: 'organization' | 'other' = 'other'
): Record<string, ExportValue> {
  const out = stripExcluded(data) as Record<string, ExportValue>
  if (kind === 'organization') {
    for (const key of ['billing', 'subscription']) {
      const kept = keepOnly(data[key], BILLING_KEPT_FIELDS)
      if (kept === undefined) delete out[key]
      else out[key] = kept
    }
  }
  return out
}

/** What the README says is left out. */
export const EXCLUSION_NOTES: readonly string[] = [
  'Device push tokens (users pushTokens), account confirmation and invitation tokens, and any field named like a token, secret, API key or password.',
  'Stripe customer, subscription and price ids, payment history and revenue: billing is reduced to the plan status (status, interval, trial end, current period end, cancel at period end).',
  'Private tax ids (VAT number and UTR, users/{uid}/private/taxIds). They are each person\'s own billing details for the invoices they send, not the company\'s; admins can see them per person in the app.',
  'Sign-in data held by Firebase Authentication (passwords, sign-in methods). The export never reads it.',
  'Uploaded files themselves (photos, certificates, RAMS, logos): files.csv lists each one with its storage path and download URL, but the binaries are not in the zip.',
  ...Object.entries(EXCLUDED_COLLECTIONS).map(([name, why]) => `${name}: ${why}.`),
  'Other companies\' data, and each person\'s memberships of other companies.',
]
