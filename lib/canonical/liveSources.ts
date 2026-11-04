/**
 * Live screens and write discipline (rulebook §1 "Live screens" and "Never re-save what you didn't change", 1.9.0).
 *
 * Before 1.9.0 the rulebook said "live screens use real-time listeners" without listing which data that meant, so
 * each app chose: iOS loaded projects, clients, operatives, managers, tasks, job types and annual leave at launch or
 * on pull-to-refresh only; web read most collections on open behind a 60-second cache and loaded My Schedule leave
 * once per session. An edit on one platform did not appear on the other until a restart or a manual refresh. Worse,
 * iOS answered every return to the foreground by re-saving every project, small work and client it held in memory,
 * writing its stale copy over web edits and re-creating documents web had deleted.
 *
 * `LIVE_COLLECTIONS` is the one list. `SYNC_WRITE_TRIGGERS` / `syncWriteAllowed` and `editOfMissingDocumentIsRefused`
 * are the write rules. Pure, JSON in / JSON out, never throw.
 */

/** Where the listener reads: the open organisation, the signed-in user, or the whole platform. */
export type LiveCollectionScope = 'organization' | 'user' | 'platform'

export type LiveCollection = {
  /** Stable id (the collection or settings document name). */
  id: string
  /** Firestore path pattern. */
  path: string
  scope: LiveCollectionScope
  /**
   * True: a screen showing this data holds a snapshot listener while it is open, so a save on another platform
   * appears without a refresh. False: the screen may load it once on open (listed below with the reason).
   */
  listen: boolean
  /** Why, for the rows that may load on open; notes for the others. */
  note: string
}

/**
 * Every shared collection and document, and whether a screen showing it listens (§1). Listeners are scoped to the
 * open organisation and removed when the organisation changes (or on sign-out); a listener never publishes another
 * company's rows. A cache may give the first paint, never the only read.
 */
export const LIVE_COLLECTIONS: ReadonlyArray<LiveCollection> = [
  { id: 'organization', path: 'organizations/{orgId}', scope: 'organization', listen: true, note: 'One listener for every organisation setting.' },
  { id: 'users', path: 'users (organizationId == {orgId})', scope: 'organization', listen: true, note: 'The live roster; the signed-in user document too.' },
  { id: 'bookings', path: 'organizations/{orgId}/bookings', scope: 'organization', listen: true, note: 'Bounded by bookingLoadStart.' },
  { id: 'managerSiteBookings', path: 'organizations/{orgId}/managerSiteBookings', scope: 'organization', listen: true, note: 'Bounded by bookingLoadStart.' },
  { id: 'subcontractorBookings', path: 'organizations/{orgId}/subcontractorBookings', scope: 'organization', listen: true, note: 'Scheduling grids and the weekly overview.' },
  { id: 'projects', path: 'organizations/{orgId}/projects', scope: 'organization', listen: true, note: '' },
  { id: 'smallWorks', path: 'organizations/{orgId}/smallWorks', scope: 'organization', listen: true, note: '' },
  { id: 'holidayBookings', path: 'organizations/{orgId}/holidayBookings', scope: 'organization', listen: true, note: 'Annual leave, My Schedule, Daily Overview, warnings and Home.' },
  { id: 'timesheets', path: 'organizations/{orgId}/settings/timesheet_{uid}_{periodStart}', scope: 'organization', listen: true, note: 'The open sheet document; unsaved edits are never overwritten by a snapshot.' },
  { id: 'operatives', path: 'organizations/{orgId}/operatives', scope: 'organization', listen: true, note: '' },
  { id: 'managers', path: 'organizations/{orgId}/managers', scope: 'organization', listen: true, note: '' },
  { id: 'clients', path: 'organizations/{orgId}/clients', scope: 'organization', listen: true, note: '' },
  { id: 'subcontractors', path: 'organizations/{orgId}/subcontractors', scope: 'organization', listen: true, note: '' },
  { id: 'operativeDayRateHistory', path: 'organizations/{orgId}/operativeDayRateHistory', scope: 'organization', listen: true, note: 'Pay history, while its screen is open.' },
  { id: 'warningResolutions', path: 'organizations/{orgId}/warningResolutions', scope: 'organization', listen: true, note: 'Warnings and the Home warning count.' },
  { id: 'acceptedBookingClashes', path: 'organizations/{orgId}/acceptedBookingClashes', scope: 'organization', listen: true, note: 'Warnings and the Home warning count.' },
  { id: 'dismissedWarnings', path: 'organizations/{orgId}/dismissedWarnings', scope: 'organization', listen: true, note: 'Warnings and the Home warning count.' },
  { id: 'materials', path: 'organizations/{orgId}/materials', scope: 'organization', listen: true, note: 'Per job on the job screen; org-wide where a screen lists every job.' },
  { id: 'materialSendRecords', path: 'organizations/{orgId}/materialSendRecords', scope: 'organization', listen: true, note: '' },
  { id: 'materialCatalogue', path: 'organizations/{orgId}/materialCatalogue', scope: 'organization', listen: true, note: 'While its screen is open.' },
  { id: 'wholesalers', path: 'organizations/{orgId}/wholesalers', scope: 'organization', listen: true, note: 'While its screen is open.' },
  { id: 'siteAudits', path: 'organizations/{orgId}/siteAudits', scope: 'organization', listen: true, note: 'While its screen is open.' },
  { id: 'tasks', path: 'organizations/{orgId}/tasks', scope: 'organization', listen: true, note: '' },
  { id: 'healthSafety', path: 'organizations/{orgId}/settings/healthSafety_{projects|smallWorks}_{KEY}', scope: 'organization', listen: true, note: 'The open job\'s document(s) (healthSafetyDocumentIds).' },
  { id: 'variations', path: 'organizations/{orgId}/variations', scope: 'organization', listen: true, note: '' },
  { id: 'variationTrackers', path: 'organizations/{orgId}/variationTrackers', scope: 'organization', listen: true, note: '' },
  { id: 'deadlines', path: 'organizations/{orgId}/settings/deadlines_{KEY} + settings/deadlineAssignments', scope: 'organization', listen: true, note: 'While its screen is open.' },
  { id: 'notifications', path: 'organizations/{orgId}/notifications (userId == signed-in user)', scope: 'organization', listen: true, note: 'Newest 150.' },
  { id: 'jobTypes', path: 'organizations/{orgId}/settings/jobTypes', scope: 'organization', listen: true, note: 'While a screen that picks a job type is open.' },
  { id: 'skills', path: 'organizations/{orgId}/skills', scope: 'organization', listen: true, note: 'While its screen is open.' },
  { id: 'qualifications', path: 'organizations/{orgId}/qualifications', scope: 'organization', listen: true, note: 'While its screen is open.' },
  { id: 'variationTrades', path: 'organizations/{orgId}/settings/variationTrades', scope: 'organization', listen: false, note: 'Add-only picker suggestions; read when the picker opens.' },
  { id: 'tradeTypeInventory', path: 'organizations/{orgId}/settings/tradeTypeInventory', scope: 'organization', listen: false, note: 'Add-only picker suggestions; read when the picker opens.' },
  { id: 'payProfiles', path: 'organizations/{orgId}/payProfiles/{subjectId}', scope: 'organization', listen: false, note: '1.13.0: private pay, one document per person; read by id when a pay screen opens (only pay viewers may, canViewPersonPay).' },
  { id: 'taxIds', path: 'users/{uid}/private/taxIds', scope: 'user', listen: false, note: 'Private; only its owner and admins edit it, on one screen; read when that screen opens.' },
  { id: 'toolboxLibrary', path: 'platformConfig/*', scope: 'platform', listen: false, note: 'Platform content, changed by releases; read on open.' },
  { id: 'orgMemberships', path: 'users/{uid}/orgMemberships/{orgId}', scope: 'user', listen: false, note: 'Read on sign-in and when switching organisation (1.10.0 parseOrgMembershipDocument); only admins of that organisation change role or permissions.' },
  { id: 'overtimeRequests', path: 'organizations/{orgId}/overtimeRequests', scope: 'organization', listen: true, note: '1.29.0: PAYE overtime requests (parseOvertimeRequestDocument); the person\'s own, or the reports a line manager or admin decides.' },
  { id: 'overtimeReviews', path: 'organizations/{orgId}/overtimeReviews/{userId}_{bookingId}', scope: 'organization', listen: true, note: '1.29.0: approved overtime lines (parseOvertimeReviewDocument), while the Overtime screen is open.' },
  { id: 'overtimeReports', path: 'organizations/{orgId}/overtimeReports', scope: 'organization', listen: false, note: '1.29.0: saved report copies, written once and never changed (parseOvertimeReportDocument); read when Past PAYE payruns opens.' },
  { id: 'priceWorkItems', path: 'organizations/{orgId}/priceWorkItems', scope: 'organization', listen: true, note: '1.30.0: PAYE price work (parsePriceWorkDocument); the person\'s own, or read-only for their line managers and admins, while the screen is open.' },
  { id: 'expenseItems', path: 'organizations/{orgId}/expenseItems', scope: 'organization', listen: true, note: '1.30.0: PAYE expenses (parseExpenseDocument); the person\'s own, or read-only for their line managers and admins, while the screen is open.' },
  { id: 'payeClaimReports', path: 'organizations/{orgId}/payeClaimReports', scope: 'organization', listen: false, note: '1.30.0: saved price work / expenses report copies, written once and never changed (parsePayeClaimReportDocument); read when Past PAYE payruns opens.' },
  { id: 'personalSiteAudits', path: 'organizations/{orgId}/personalSiteAudits', scope: 'organization', listen: true, note: '1.30.0: personal site audits (parsePersonalSiteAuditDocument); the owner\'s only, while Site audits → Personal is open.' },
  { id: 'deletedBookings', path: 'organizations/{orgId}/deletedBookings', scope: 'organization', listen: false, note: 'Write-only tombstones; never shown.' },
]

/** The `LIVE_COLLECTIONS` row for an id (exact, then without case). Null when unknown. */
export function liveCollection(id: unknown): LiveCollection | null {
  const key = typeof id === 'string' ? id.trim() : ''
  if (!key) return null
  return (
    LIVE_COLLECTIONS.find((row) => row.id === key) ??
    LIVE_COLLECTIONS.find((row) => row.id.toLowerCase() === key.toLowerCase()) ??
    null
  )
}

/** Whether a screen showing this data must hold a listener while open. Unknown → true (the default is live). */
export function screenMustListen(id: unknown): boolean {
  return liveCollection(id)?.listen ?? true
}

/**
 * What started a write. Only `userAction` (the user changed this record in this action) and `offlineReplay` (a
 * queued user action pushed when the connection returns, iOS/Android) may write. Launch, foreground, reconnect, a
 * background sync, a pull-to-refresh and a listener snapshot never write anything.
 */
export const SYNC_WRITE_TRIGGERS = [
  'userAction',
  'offlineReplay',
  'launch',
  'foreground',
  'reconnect',
  'backgroundSync',
  'pullToRefresh',
  'listenerSnapshot',
  /** 1.10.0 (M7): producing a Weekly Report. It reads only; it never writes a timesheet or anything else. */
  'weeklyReport',
] as const
export type SyncWriteTrigger = (typeof SYNC_WRITE_TRIGGERS)[number]

/**
 * 1.10.0: the one exception to "never re-save" — idempotent key migrations that change no data. They may run from a
 * scan or listener: `warningResolutionMigrationWrites` writes a warning resolution stored under an older key to its
 * shared key only when the shared key is not already resolved; old documents stay. Running it twice, or on two
 * devices, writes the same result.
 */
export const IDEMPOTENT_MIGRATION_WRITES = ['warningResolutionMigrationWrites'] as const
export type IdempotentMigrationWrite = (typeof IDEMPOTENT_MIGRATION_WRITES)[number]

/**
 * True for `userAction` and `offlineReplay` (§1 "Never re-save what you didn't change"). Any other trigger writes
 * only an `IDEMPOTENT_MIGRATION_WRITES` migration, named in `migration` — except `weeklyReport`, which never writes.
 */
export function syncWriteAllowed(trigger: unknown, migration?: unknown): boolean {
  if (trigger === 'userAction' || trigger === 'offlineReplay') return true
  // A Weekly Report never writes, not even a migration (§7: reports are not stored).
  if (trigger === 'weeklyReport') return false
  return typeof migration === 'string' && (IDEMPOTENT_MIGRATION_WRITES as readonly string[]).includes(migration)
}

/**
 * The records a save may write: the ones the user changed in this action (`changedIds`), matched without case and
 * returned as given in `records`. Every other record in the local copy is left alone — a save of one project never
 * saves the others.
 */
export function recordsToSave<T extends { id: string }>(
  records: ReadonlyArray<T>,
  changedIds: ReadonlyArray<string>
): T[] {
  const wanted = new Set((changedIds || []).map((id) => String(id ?? '').trim().toLowerCase()).filter(Boolean))
  if (wanted.size === 0) return []
  return (records || []).filter((row) => wanted.has(String(row?.id ?? '').trim().toLowerCase()))
}

function codeText(code: unknown): string {
  return (typeof code === 'number' ? String(code) : typeof code === 'string' ? code.trim() : '')
    .toLowerCase()
    .replace(/^firestore\//, '')
}

/**
 * An edit of a document that no longer exists is refused, never turned into a create (§1, 1.9.0; the general form of
 * `bookingReplayRefusedIsFinal`). True when the write edits an existing record (`isCreate` false) and either the
 * read before the write found no document (`exists === false`) or the server answered not-found (`code`
 * `not-found`, iOS `5`) — the app then drops its local row (and any queued item) instead of writing it back with a
 * set/merge. Edits use an update that fails on a missing document, never a merge-set. A create is never refused here.
 */
export function editOfMissingDocumentIsRefused(input: {
  isCreate: boolean | null | undefined
  exists?: boolean | null
  code?: unknown
}): boolean {
  if (input?.isCreate !== false) return false
  if (input.exists === false) return true
  const code = codeText(input.code)
  return code === 'not-found' || code === '5'
}

/**
 * A refused offline replay of any queued edit is final (dropped, not retried): permission-denied (iOS `7`) always;
 * not-found (iOS `5`) when the queued item edits an existing record (`editOfMissingDocumentIsRefused`).
 * `bookingReplayRefusedIsFinal` is this rule for bookings.
 */
export function replayRefusedIsFinal(input: { code: unknown; isCreate?: boolean | null }): boolean {
  const code = codeText(input?.code)
  if (code === 'permission-denied' || code === '7') return true
  return editOfMissingDocumentIsRefused({ isCreate: input?.isCreate, code: input?.code })
}

export const EDIT_OF_MISSING_DOCUMENT_MESSAGE = 'This was deleted on another device.'
