/**
 * Rulebook 1.57.0 §8 (review of #363, guardrail 3): which signed timesheets the 1.57.0 rule newly flags — a signed copy
 * (`weeklyReportOverride.lines`) that lacks a booking the person signed (`operativeSignedBookings`, the current record)
 * while that booking is still live. Not exported: the line manager must counter-sign again. Exported: "Revision due".
 * Counts only; pure (no Firestore).
 *
 * It asks the rulebook itself: `signedTimesheetBookingChanges` (its `snapshotGapBookingIds`, kept apart from other
 * changes; `snapshotGapOnly` when nothing else changed — under J1 reports keep the signed figures for those) and
 * `timesheetSnapshotNeedsRebuild` (an empty signed copy the 1.43.0 repair rebuilds when a reviewer opens it — never an
 * exported one, never one whose bookings were all written after approval). The live lines are the person's signed
 * bookings that are still live, with their signed fingerprint and their stored write times. A booking counts as live
 * when its document exists, is not tombstoned, still occupies its day (`bookingOccupiesDay`), is still on a day of the
 * sheet's pay run and is still filed under one of the person's ids (users id, `formerUserIds`, `sameEmailUserIds`,
 * users documents and `operatives` rows on their email).
 *
 * Approximations: PAYE days are not excluded (rarely on a signed record), and only the person's signed bookings are
 * live lines (another booking of the pay run could make an empty copy repairable that is counted as flagged here).
 * Only the latest version of each pay run counts (`parseTimesheetRevisionDocId`).
 */

const key = (value) => String(value ?? '').trim().toLowerCase()

/** A stored value with Firestore Timestamps turned into `{ seconds, nanoseconds }` (the rulebook runs in its own realm). */
export function plain(value) {
  if (value == null || typeof value !== 'object') return value
  if (typeof value.toMillis === 'function') {
    const ms = value.toMillis()
    return { seconds: Math.floor(ms / 1000), nanoseconds: (ms % 1000) * 1e6 }
  }
  if (value instanceof Date) return { seconds: Math.floor(value.getTime() / 1000), nanoseconds: (value.getTime() % 1000) * 1e6 }
  if (Array.isArray(value)) return value.map(plain)
  const out = {}
  for (const [k, v] of Object.entries(value)) out[k] = plain(v)
  return out
}

function endDayKey(data, start, timeZone, rulebook) {
  if (typeof data.weekEndKey === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(data.weekEndKey)) return data.weekEndKey
  const parsed = rulebook.parsePayrunSnapshotSheet('timesheet_x_0', { userId: 'x', weekStart: data.weekEnd }, timeZone)
  return parsed?.startDayKey || start
}

function personIds(userId, users, operatives) {
  const ids = new Set([key(userId)])
  const self = users.find((row) => key(row.id) === key(userId))
  const email = key(self?.data?.email)
  for (const id of [...(self?.data?.formerUserIds ?? []), ...(self?.data?.sameEmailUserIds ?? [])]) ids.add(key(id))
  if (email) {
    for (const row of users) if (key(row.data?.email) === email) ids.add(key(row.id))
    for (const row of operatives) if (key(row.data?.email) === email) ids.add(key(row.id))
  }
  ids.delete('')
  return ids
}

/**
 * @param {object} rulebook the packed rulebook
 * @param {{ timeZone: string, sheets: Array<{id: string, data: object}>, users: Array<{id: string, data: object}>,
 *   operatives: Array<{id: string, data: object}>, bookings: Map<string, object|null>, tombstoned: Set<string> }} input
 *   `bookings` maps `${collection}|${bookingId}` to the stored document (null when missing); `tombstoned` holds the
 *   same keys. All values already `plain`.
 */
export function snapshotGapCounts(rulebook, input) {
  const counts = { sheetsChecked: 0, exported: 0, notExported: 0, gapOnly: 0, otherChange: 0, emptySnapshotRepair: 0, noRecord: 0 }
  // Latest version of each pay run only.
  const latest = new Map()
  for (const sheet of input.sheets) {
    const ref = rulebook.parseTimesheetRevisionDocId(sheet.id)
    if (!ref) continue
    const held = latest.get(ref.baseDocumentId)
    if (!held || ref.revision > held.revision) latest.set(ref.baseDocumentId, { revision: ref.revision, sheet })
  }
  for (const { sheet } of latest.values()) {
    const data = sheet.data || {}
    const override = data.weeklyReportOverride
    if (!override || typeof override !== 'object' || !data.operativeSignedAt) continue
    counts.sheetsChecked += 1
    const record = Array.isArray(data.operativeSignedBookings) ? data.operativeSignedBookings : []
    if (record.length === 0) {
      counts.noRecord += 1
      continue
    }
    const parsed = rulebook.parsePayrunSnapshotSheet(sheet.id, data, input.timeZone)
    const start = parsed?.startDayKey || ''
    const end = endDayKey(data, start, input.timeZone, rulebook)
    const ids = personIds(parsed?.userId || data.userId, input.users, input.operatives)
    const liveLines = []
    for (const row of record) {
      const collection = key(row?.collection) === 'managersitebookings' ? 'managerSiteBookings' : 'bookings'
      const bookingId = String(row?.bookingId ?? '').trim()
      if (!bookingId) continue
      const docKey = `${collection}|${key(bookingId)}`
      const stored = input.bookings.get(docKey)
      if (!stored || input.tombstoned.has(docKey)) continue
      const read =
        collection === 'bookings'
          ? rulebook.parseBookingDocument(bookingId, stored, { timeZone: input.timeZone })
          : rulebook.parseManagerSiteBookingDocument(bookingId, stored, { timeZone: input.timeZone })
      if (!read?.ok) continue
      const booking = read.booking
      if (collection === 'bookings' && !rulebook.bookingOccupiesDay(booking.status)) continue
      if (!ids.has(key(collection === 'bookings' ? booking.operativeId : booking.userId))) continue
      const day = booking.dateMs != null ? rulebook.dayKeyInOrganizationZone(booking.dateMs, input.timeZone) : null
      if (day && start && end && (day < start || day > end)) continue
      liveLines.push({
        id: `${collection === 'bookings' ? 'op' : 'mgr'}-${bookingId}-normal`,
        bookingId,
        bookingCollection: collection,
        bookingFingerprint: row.fingerprint,
        bookingCreatedAt: stored.createdAt ?? null,
        bookingUpdatedAt: stored.updatedAt ?? null,
        scheduleOptionPlace: collection === 'managerSiteBookings' && !rulebook.isSiteLocationType(booking.locationType),
      })
    }
    if (rulebook.timesheetSnapshotNeedsRebuild(data, liveLines)) {
      counts.emptySnapshotRepair += 1
      continue
    }
    const change = rulebook.signedTimesheetBookingChanges({ sheet: data, liveLines, liveLoaded: true })
    if ((change?.snapshotGapBookingIds ?? []).length === 0) {
      // Flagged already before 1.57.0 (a booking changed, was removed or added after signing): not this rule's doing.
      if (change?.changed) counts.otherChange += 1
      continue
    }
    if (change.exported) counts.exported += 1
    else counts.notExported += 1
    if (change.snapshotGapOnly) counts.gapOnly += 1
  }
  return counts
}
