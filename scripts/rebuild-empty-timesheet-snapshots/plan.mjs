/**
 * 17 Nov follow-up: which not-exported signed timesheets have a snapshot the rulebook already treats as broken —
 * `timesheetSnapshotNeedsRebuild` (1.43.0: frozen with no labour lines by the loading bug, a booking of the person in
 * the pay run written on or before the approval). The app rebuilds such a snapshot (signatures kept) when the line
 * manager or an admin opens the sheet; this lists them so the owner can ask for that visit. Pure (no Firestore).
 *
 * The live lines are the person's labour and manager site bookings in the pay run (every id they go by: users id,
 * `formerUserIds`, `sameEmailUserIds`, users documents and `operatives` rows on their email), each booking's stored
 * write times. Approximations: PAYE days are not excluded, and a labour booking that does not occupy its day
 * (`bookingOccupiesDay`) is skipped; the app's own check decides when the sheet is opened.
 * Only the latest version of each pay run counts (`parseTimesheetRevisionDocId`).
 */

const key = (value) => String(value ?? '').trim().toLowerCase()

export function personIdsFor(userId, users, operatives) {
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

function endDayKey(data, start, timeZone, rulebook) {
  if (typeof data.weekEndKey === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(data.weekEndKey)) return data.weekEndKey
  const parsed = rulebook.parsePayrunSnapshotSheet('timesheet_x_0', { userId: 'x', weekStart: data.weekEnd }, timeZone)
  return parsed?.startDayKey || start
}

/** The latest stored version of each pay run whose snapshot exists, holds no labour line and is not exported. */
export function emptySnapshotCandidates(rulebook, sheets, timeZone) {
  const latest = new Map()
  for (const sheet of sheets) {
    const ref = rulebook.parseTimesheetRevisionDocId(sheet.id)
    if (!ref) continue
    const held = latest.get(ref.baseDocumentId)
    if (!held || ref.revision > held.revision) latest.set(ref.baseDocumentId, { revision: ref.revision, sheet })
  }
  const out = []
  for (const { sheet } of latest.values()) {
    const data = sheet.data || {}
    const override = data.weeklyReportOverride
    if (!override || typeof override !== 'object') continue
    if (Array.isArray(override.lines) && override.lines.length > 0) continue
    if (data.exportedAt != null) continue
    const parsed = rulebook.parsePayrunSnapshotSheet(sheet.id, data, timeZone)
    if (!parsed?.userId) continue
    out.push({ sheet, userId: parsed.userId, startDayKey: parsed.startDayKey, endDayKey: endDayKey(data, parsed.startDayKey, timeZone, rulebook) })
  }
  return out
}

/**
 * @param rulebook the packed rulebook
 * @param input `{ timeZone, sheets: [{id, data}], users: [{id, data}], operatives: [{id, data}],
 *   bookings: [{ collection: 'bookings' | 'managerSiteBookings', id, data }] }` — all values already `plain`.
 * @returns one row per sheet `timesheetSnapshotNeedsRebuild` flags, oldest pay run first.
 */
export function emptySnapshotRows(rulebook, input) {
  const rows = []
  for (const candidate of emptySnapshotCandidates(rulebook, input.sheets, input.timeZone)) {
    const ids = personIdsFor(candidate.userId, input.users, input.operatives)
    const liveLines = []
    for (const row of input.bookings) {
      const stored = row.data || {}
      const read =
        row.collection === 'bookings'
          ? rulebook.parseBookingDocument(row.id, stored, { timeZone: input.timeZone })
          : rulebook.parseManagerSiteBookingDocument(row.id, stored, { timeZone: input.timeZone })
      if (!read?.ok) continue
      const booking = read.booking
      const personId = row.collection === 'bookings' ? booking.operativeId : booking.userId
      if (!ids.has(key(personId))) continue
      if (row.collection === 'bookings' && !rulebook.bookingOccupiesDay(booking.status)) continue
      const day = booking.dateMs != null ? rulebook.dayKeyInOrganizationZone(booking.dateMs, input.timeZone) : ''
      if (!day || day < candidate.startDayKey || day > candidate.endDayKey) continue
      liveLines.push({
        id: `${row.collection === 'bookings' ? 'op' : 'mgr'}-${row.id}-normal`,
        bookingId: row.id,
        bookingCollection: row.collection,
        bookingCreatedAt: stored.createdAt ?? null,
        bookingUpdatedAt: stored.updatedAt ?? null,
        scheduleOptionPlace: row.collection === 'managerSiteBookings' && !rulebook.isSiteLocationType(booking.locationType),
      })
    }
    if (!rulebook.timesheetSnapshotNeedsRebuild(candidate.sheet.data, liveLines)) continue
    const user = input.users.find((entry) => key(entry.id) === key(candidate.userId))
    const name = user ? `${user.data?.firstName ?? ''} ${user.data?.surname ?? ''}`.trim() || user.data?.email || candidate.userId : candidate.userId
    rows.push({
      documentId: candidate.sheet.id,
      userId: candidate.userId,
      name,
      startDayKey: candidate.startDayKey,
      endDayKey: candidate.endDayKey,
      bookings: liveLines.length,
    })
  }
  return rows.sort((a, b) => (a.startDayKey < b.startDayKey ? -1 : a.startDayKey > b.startDayKey ? 1 : a.name.localeCompare(b.name)))
}
