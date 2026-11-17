/**
 * Rulebook 1.57.0 §8 (review of #363, guardrail 3): which signed timesheets the 1.57.0 rule newly reads as changed —
 * a signed copy (`weeklyReportOverride.lines`) that lacks a booking the person signed (`operativeSignedBookings`, the
 * current record) while that booking is still live. Not exported: the line manager must counter-sign again. Exported:
 * "Revision due". Counts only; pure (no Firestore).
 *
 * It asks the rulebook itself (`signedTimesheetBookingChanges`) with the person's own signed bookings that are still
 * live as the live lines, each carrying its signed fingerprint and no write time. Then nothing the 1.56.0 rule reads
 * (a fingerprint change, a removal, an addition after the signature) can fire, so `addedBookingIds` holds exactly the
 * 1.57.0 gap. A booking counts as live when its document exists, is not tombstoned, still occupies its day
 * (`bookingOccupiesDay`), is still on a day of the sheet's pay run and is still filed under one of the person's ids
 * (users id, `formerUserIds`, `sameEmailUserIds`, users documents and `operatives` rows on their email).
 *
 * Upper bound: PAYE days are not excluded (a PAYE day is never on the signed record, so this rarely matters).
 * Only the latest version of each pay run counts (`parseTimesheetRevisionDocId`). A signed copy with no labour line
 * naming a booking is the 1.43.0 repair path (rebuilt when a reviewer opens it), counted on its own.
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
  const counts = { sheetsChecked: 0, exported: 0, notExported: 0, emptySnapshotRepair: 0, noRecord: 0 }
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
    const lines = Array.isArray(override.lines) ? override.lines : []
    if (!lines.some((line) => line && line.isPayeDay !== true && line.isLeave !== true && key(line.bookingId))) {
      counts.emptySnapshotRepair += 1
      continue
    }
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
        scheduleOptionPlace: collection === 'managerSiteBookings' && !rulebook.isSiteLocationType(booking.locationType),
      })
    }
    const change = rulebook.signedTimesheetBookingChanges({ sheet: data, liveLines, liveLoaded: true })
    if (!change?.changed || (change.addedBookingIds ?? []).length === 0) continue
    if (change.exported) counts.exported += 1
    else counts.notExported += 1
  }
  return counts
}
