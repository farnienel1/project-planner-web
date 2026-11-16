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

/**
 * `store`:
 *   organization(orgId) → data | null
 *   user(uid) → data | null
 *   operative(orgId, id) → data | null
 *   userEmailClaim(orgId, email) → data | null            (organizations/{orgId}/userEmails/{email})
 *   usersListingId(field, id) → [{ id, data }]             (users where `field` array-contains id)
 *   operativesByEmail(orgId, email) → [{ id, data }]
 *   timesheets(orgId, uid) → [{ id, data }]                (settings where userId == uid)
 *   tombstone(orgId, bookingId) → data | null              (deletedBookings/{bookingId})
 *   createNotification(orgId, id, fields) → 'created' | 'exists'
 */
function createTimesheetBookingNotice({ store, canonical, logger = console, serverTimestamp = () => new Date() }) {
  async function personAccounts(orgId, personId) {
    const out = new Map()
    if (!personId) return out
    const direct = await store.user(personId)
    if (direct && sameOrganization(direct, orgId)) out.set(personId, direct)
    const operative = await store.operative(orgId, personId)
    const email = trimmed(operative && operative.email).toLowerCase()
    if (email) {
      const claim = await store.userEmailClaim(orgId, email)
      const uid = trimmed(claim && claim.userId)
      if (uid && !out.has(uid)) {
        const user = await store.user(uid)
        if (user && sameOrganization(user, orgId)) out.set(uid, user)
      }
    }
    for (const field of ['formerUserIds', 'sameEmailUserIds']) {
      for (const row of await store.usersListingId(field, personId)) {
        if (!out.has(row.id) && sameOrganization(row.data, orgId)) out.set(row.id, row.data)
      }
    }
    return out
  }

  async function personIdsOf(orgId, uid, user) {
    const ids = new Set([uid, ...(Array.isArray(user.formerUserIds) ? user.formerUserIds : []), ...(Array.isArray(user.sameEmailUserIds) ? user.sameEmailUserIds : [])])
    const email = trimmed(user.email).toLowerCase()
    if (email) for (const row of await store.operativesByEmail(orgId, email)) ids.add(row.id)
    return [...ids].map(trimmed).filter(Boolean)
  }

  async function handle({ orgId, collection, bookingId, before, after }) {
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

    const accounts = new Map()
    for (const personId of new Set([beforeDoc && beforeDoc.personId, afterDoc && afterDoc.personId].filter(Boolean))) {
      for (const [uid, user] of await personAccounts(orgId, personId)) accounts.set(uid, user)
    }
    let written = 0
    for (const [uid, user] of accounts) {
      const personIds = await personIdsOf(orgId, uid, user)
      const sheets = (await store.timesheets(orgId, uid)).filter((row) => row.id.startsWith('timesheet_'))
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
function createAdminTimesheetNoticeStore(db) {
  const data = (snap) => (snap.exists ? snap.data() : null)
  return {
    organization: async (orgId) => data(await db.doc(`organizations/${orgId}`).get()),
    user: async (uid) => (uid && !uid.includes('/') ? data(await db.doc(`users/${uid}`).get()) : null),
    operative: async (orgId, id) => (id && !id.includes('/') ? data(await db.doc(`organizations/${orgId}/operatives/${id}`).get()) : null),
    userEmailClaim: async (orgId, email) => (email && !email.includes('/') ? data(await db.doc(`organizations/${orgId}/userEmails/${email}`).get()) : null),
    usersListingId: async (field, id) => {
      const snap = await db.collection('users').where(field, 'array-contains', id).limit(20).get()
      return snap.docs.map((doc) => ({ id: doc.id, data: doc.data() }))
    },
    operativesByEmail: async (orgId, email) => {
      const snap = await db.collection(`organizations/${orgId}/operatives`).where('email', '==', email).limit(20).get()
      return snap.docs.map((doc) => ({ id: doc.id, data: doc.data() }))
    },
    timesheets: async (orgId, uid) => {
      const snap = await db.collection(`organizations/${orgId}/settings`).where('userId', '==', uid).get()
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
