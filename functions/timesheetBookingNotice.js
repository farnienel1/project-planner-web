'use strict'

/**
 * Rulebook 1.54.0 §8 / §13 (owner decision 16 Nov): "Your signed timesheet has changed".
 *
 * On every write of a labour (`bookings`) or manager site (`managerSiteBookings`) booking, find the booking's person's
 * signed, not-exported timesheets and, for each one the write reopens under the 1.47.0 rule
 * (`timesheetBookingChangeNotice`), create one inbox row of type `timesheet_bookings_changed` for the person
 * (`timesheetBookingsChangedRecipients`: an account, never the person who changed the booking). The push follows from
 * `sendDevicePushOnNotificationCreate` as for every other row.
 *
 * Why on the server: the person who edits the booking (a job manager or admin) may not be able to read the person's
 * timesheet (`settings/timesheet_*` is private while `privatePay` is on), so no app can decide it.
 *
 * One row per sheet per person signature (`timesheetBookingsChangedNoticeId`, created with `create()`): further changes
 * before the person signs again add nothing; their next signature lets the next change notify again.
 *
 * Every decision is the packed rulebook's; this file only reads documents and writes the row.
 */

function trimmed(value) {
  return String(value ?? '').trim()
}

function millis(value) {
  if (value == null) return null
  if (typeof value.toMillis === 'function') return value.toMillis()
  if (value instanceof Date) return value.getTime()
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Date.parse(value)
    return Number.isNaN(parsed) ? null : parsed
  }
  if (typeof value === 'object' && typeof value.seconds === 'number') return value.seconds * 1000
  if (typeof value === 'object' && typeof value._seconds === 'number') return value._seconds * 1000
  return null
}

/** A stored booking as the rulebook's `SignedTimesheetBookingDocument` (organisation-zone day key). */
function bookingDocument(canonical, collection, bookingId, data, timeZone) {
  if (!data) return null
  const ms = millis(data.date)
  const dayKey = ms == null ? '' : canonical.dayKeyInOrganizationZone(new Date(ms).toISOString(), timeZone)
  const base = {
    bookingId,
    collection,
    dayKey,
    timeSlot: data.timeSlot,
    workStartTime: data.workStartTime,
    workEndTime: data.workEndTime,
    isBreakRemoved: data.isBreakRemoved === true,
    otMultiplierOverride: typeof data.otMultiplierOverride === 'number' ? data.otMultiplierOverride : null,
    status: data.status,
  }
  if (collection === 'bookings') return { ...base, personId: trimmed(data.operativeId), projectId: trimmed(data.projectId) }
  return {
    ...base,
    personId: trimmed(data.userId),
    locationType: trimmed(data.locationType),
    locationId: trimmed(data.locationId),
    customLocationName: trimmed(data.customLocationName),
  }
}

function sameOrganization(user, orgId) {
  const stored = user && user.organizationId
  const id = typeof stored === 'string' ? stored.split('/').pop() : stored && typeof stored.id === 'string' ? stored.id : ''
  return trimmed(id) === orgId
}

/** A sheet as plain values (instants as epoch ms) for the rulebook. */
function plainSheet(data) {
  const out = { ...data }
  for (const key of ['operativeSignedAt', 'operativeSignedBookingsSignedAt', 'operativeSignedBookingsAt', 'managerSignedAt', 'approvedAt', 'exportedAt']) {
    if (key in out) out[key] = millis(out[key])
  }
  return out
}

/** The fields of a booking the 1.47.0 rule reads (raw), so a write that changes none of them costs no read at all. */
const READ_FIELDS = ['date', 'timeSlot', 'workStartTime', 'workEndTime', 'isBreakRemoved', 'otMultiplierOverride', 'status', 'operativeId', 'userId', 'projectId', 'locationType', 'locationId', 'customLocationName']

function rawSame(before, after) {
  if (!before || !after) return false
  return READ_FIELDS.every((key) => {
    const a = before[key]
    const b = after[key]
    if (key === 'date') return millis(a) === millis(b)
    return (a ?? null) === (b ?? null)
  })
}

/** How far before the booking day a sheet's stored `weekEnd` may sit (zone offsets, end-of-day instants). */
const WEEK_END_SLACK_MS = 2 * 24 * 60 * 60 * 1000

/**
 * `store`:
 *   organization(orgId) → data | null
 *   user(uid) → data | null
 *   operative(orgId, id) → data | null
 *   userEmailClaim(orgId, email) → data | null            (organizations/{orgId}/userEmails/{email})
 *   usersListingFormerId(id) → [{ id, data }]             (users where formerUserIds array-contains id, at most 5)
 *   operativesByEmail(orgId, email) → [{ id, data }]
 *   timesheetsCovering(orgId, userIds, fromMs) → [{ id, data }]
 *     (settings where userId in userIds (at most 10) and weekEnd >= fromMs, oldest first, at most 4 — the sheets whose
 *      pay run can hold the booking day; composite index settings userId ASC, weekEnd ASC)
 *   tombstone(orgId, bookingId) → data | null              (deletedBookings/{bookingId})
 *   createNotification(orgId, id, fields) → 'created' | 'exists'
 *
 * Reads per booking write (review of #337, item 4): 0 when the write changes none of the fields the rule reads; else
 * the organisation (1), the booking person's users document (1) and one sheets query (1 query, at most 4 documents
 * per changed day — usually 1). A labour booking filed under an `operatives` row adds that row, its email claim and the
 * account (3); a booking under a former invite id adds one `formerUserIds` query instead; a delete adds its tombstone
 * (1); a booking given to another person adds the `operatives` rows on the person's email (1 query). Known limit: a
 * sheet stored without `userId` (very old web sheets) is not found and gets no notice (the triangle still shows).
 */
function createTimesheetBookingNotice({ store, canonical, logger = console, serverTimestamp = () => new Date(), now = () => Date.now() }) {
  async function personAccounts(orgId, personId) {
    const out = new Map()
    if (!personId) return out
    const direct = await store.user(personId)
    if (direct && sameOrganization(direct, orgId)) {
      out.set(personId, direct)
      return out
    }
    const operative = await store.operative(orgId, personId)
    const email = trimmed(operative && operative.email).toLowerCase()
    if (email) {
      const claim = await store.userEmailClaim(orgId, email)
      const uid = trimmed(claim && claim.userId)
      if (uid) {
        const user = await store.user(uid)
        if (user && sameOrganization(user, orgId)) out.set(uid, user)
      }
      return out
    }
    // A booking filed under an old invite id: the account that lists it.
    for (const row of await store.usersListingFormerId(personId)) {
      if (sameOrganization(row.data, orgId)) out.set(row.id, row.data)
    }
    return out
  }

  async function personIdsOf(orgId, uid, user, bookingPersonIds, personChanged) {
    const ids = new Set([uid, ...bookingPersonIds, ...(Array.isArray(user.formerUserIds) ? user.formerUserIds : []), ...(Array.isArray(user.sameEmailUserIds) ? user.sameEmailUserIds : [])])
    const email = trimmed(user.email).toLowerCase()
    // Only needed to tell "given to someone else" from "moved to another of their own operatives rows".
    if (personChanged && email) for (const row of await store.operativesByEmail(orgId, email)) ids.add(row.id)
    return [...ids].map(trimmed).filter(Boolean)
  }

  async function handle({ orgId, collection, bookingId, before, after }) {
    if (rawSame(before, after)) return { written: 0, reason: 'no change the rule reads' }
    const org = await store.organization(orgId)
    if (!org) return { written: 0, reason: 'organisation missing' }
    const timeZone = canonical.organizationTimeZone(org.countryCode)
    const beforeDoc = bookingDocument(canonical, collection, bookingId, before, timeZone)
    const afterDoc = bookingDocument(canonical, collection, bookingId, after, timeZone)
    if (!canonical.timesheetBookingWriteMatters(beforeDoc, afterDoc)) return { written: 0, reason: 'no change the rule reads' }

    let actor = trimmed(after && after.updatedBy)
    if (!after) {
      const tombstone = await store.tombstone(orgId, bookingId)
      actor = trimmed(tombstone && tombstone.deletedBy) || trimmed(before && before.updatedBy)
    }

    const bookingPersonIds = [...new Set([beforeDoc && beforeDoc.personId, afterDoc && afterDoc.personId].filter(Boolean))]
    const personChanged = bookingPersonIds.length > 1
    const accounts = new Map()
    for (const personId of bookingPersonIds) {
      for (const [uid, user] of await personAccounts(orgId, personId)) accounts.set(uid, user)
    }
    const dayMs = [before, after].map((row) => (row ? millis(row.date) : null)).filter((ms) => ms != null)
    if (accounts.size === 0 || dayMs.length === 0) return { written: 0, reason: 'no account or day' }
    const fromMs = Math.min(...dayMs) - WEEK_END_SLACK_MS
    const latestMs = Math.max(...dayMs) + WEEK_END_SLACK_MS
    let written = 0
    for (const [uid, user] of accounts) {
      const personIds = await personIdsOf(orgId, uid, user, bookingPersonIds, personChanged)
      // Sheets filed under the account and its former invite ids (an `in` query holds at most 10).
      const sheetOwners = [uid, ...(Array.isArray(user.formerUserIds) ? user.formerUserIds : [])].map(trimmed).filter(Boolean).slice(0, 10)
      const sheets = (await store.timesheetsCovering(orgId, sheetOwners, fromMs)).filter((row) => {
        if (!row.id.startsWith('timesheet_')) return false
        const startMs = millis((row.data || {}).weekStart)
        return startMs == null || startMs <= latestMs
      })
      for (const sheetRow of sheets) {
        const sheet = plainSheet(sheetRow.data || {})
        const startMs = millis((sheetRow.data || {}).weekStart)
        const endMs = millis((sheetRow.data || {}).weekEnd)
        const start = trimmed(sheet.weekStartKey) || (startMs == null ? '' : canonical.dayKeyInOrganizationZone(new Date(startMs).toISOString(), timeZone))
        const end = trimmed(sheet.weekEndKey) || (endMs == null ? '' : canonical.dayKeyInOrganizationZone(new Date(endMs).toISOString(), timeZone))
        if (!start || !end) continue
        const decision = canonical.timesheetBookingChangeNotice({
          sheet,
          periodStartDayKey: start,
          periodEndDayKey: end,
          before: beforeDoc,
          after: afterDoc,
          personIds,
          person: { ...user, id: uid },
          timeZone,
          nowMs: now(),
        })
        if (!decision.notify) continue
        const recipients = canonical.timesheetBookingsChangedRecipients(uid, actor || null, [{ ...user, id: uid }])
        if (recipients.length === 0) continue
        const noticeId = canonical.timesheetBookingsChangedNoticeId(sheetRow.id, sheet)
        if (!noticeId) continue
        const created = canonical.notificationCreateFields({
          organizationId: orgId,
          type: canonical.TIMESHEET_BOOKINGS_CHANGED_NOTICE_TYPE,
          title: canonical.TIMESHEET_BOOKINGS_CHANGED_NOTICE_TITLE,
          message: canonical.TIMESHEET_BOOKINGS_CHANGED_NOTICE_MESSAGE,
          userId: recipients[0],
          deepLinkUserId: uid,
          dayKey: start,
          actorUserId: actor || null,
          serverTimestamp: serverTimestamp(),
        })
        if (!created) continue
        const fields = { ...created.set }
        if (startMs != null && sheetRow.data && sheetRow.data.weekStart) fields.deepLinkWeekStart = sheetRow.data.weekStart
        const result = await store.createNotification(orgId, noticeId, fields)
        if (result === 'created') written += 1
        logger.info('timesheet bookings changed notice', { orgId, sheetId: sheetRow.id, bookingId, reason: decision.reason, result })
      }
    }
    return { written }
  }

  return { handle }
}

/** The admin-SDK store for `createTimesheetBookingNotice`. */
function createAdminTimesheetNoticeStore(db, Timestamp) {
  const data = (snap) => (snap.exists ? snap.data() : null)
  return {
    organization: async (orgId) => data(await db.doc(`organizations/${orgId}`).get()),
    user: async (uid) => (uid && !uid.includes('/') ? data(await db.doc(`users/${uid}`).get()) : null),
    operative: async (orgId, id) => (id && !id.includes('/') ? data(await db.doc(`organizations/${orgId}/operatives/${id}`).get()) : null),
    userEmailClaim: async (orgId, email) => (email && !email.includes('/') ? data(await db.doc(`organizations/${orgId}/userEmails/${email}`).get()) : null),
    usersListingFormerId: async (id) => {
      const snap = await db.collection('users').where('formerUserIds', 'array-contains', id).limit(5).get()
      return snap.docs.map((doc) => ({ id: doc.id, data: doc.data() }))
    },
    operativesByEmail: async (orgId, email) => {
      const snap = await db.collection(`organizations/${orgId}/operatives`).where('email', '==', email).limit(10).get()
      return snap.docs.map((doc) => ({ id: doc.id, data: doc.data() }))
    },
    timesheetsCovering: async (orgId, userIds, fromMs) => {
      if (!userIds.length) return []
      const snap = await db
        .collection(`organizations/${orgId}/settings`)
        .where('userId', 'in', userIds)
        .where('weekEnd', '>=', Timestamp.fromMillis(fromMs))
        .orderBy('weekEnd', 'asc')
        .limit(4)
        .get()
      return snap.docs.map((doc) => ({ id: doc.id, data: doc.data() }))
    },
    tombstone: async (orgId, bookingId) => data(await db.doc(`organizations/${orgId}/deletedBookings/${bookingId}`).get()),
    createNotification: async (orgId, id, fields) => {
      try {
        await db.doc(`organizations/${orgId}/notifications/${id}`).create(fields)
        return 'created'
      } catch (error) {
        // ALREADY_EXISTS (gRPC 6): this sheet's person was already told for this signature.
        if (error && (error.code === 6 || error.code === 'already-exists')) return 'exists'
        throw error
      }
    },
  }
}

module.exports = { createTimesheetBookingNotice, createAdminTimesheetNoticeStore, bookingDocument }
