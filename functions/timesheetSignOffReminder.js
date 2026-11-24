'use strict'

const { bookingDocument } = require('./timesheetBookingNotice')

/**
 * Rulebook 1.78.0 §8 / §13 (owner decisions 23 Nov, point 4, a and b): "Timesheets waiting for your sign-off" — before payday,
 * each line manager (and each admin who reviews a person with no active line manager) gets one inbox row, and through
 * `sendDevicePushOnNotificationCreate` one push, naming how many of that pay run's timesheets still wait for them.
 *
 * Every decision is the packed rulebook's:
 *   - when, per organisation in its own time zone: `timesheetSignOffReminderDue` (08:00 the organisation's 1–3 days,
 *     default 2, before payday);
 *   - who and how many: `timesheetSignOffReminderRecipients` (User Timesheets' Awaiting rows, `userTimesheetQueue`,
 *     and `timesheetSubmittedRecipients`), over the organisation's roster (`timesheetSignOffReminderRosterMember`), each
 *     sheet's booking changes judged as the apps judge them (`timesheetLiveLinesFromBookings`,
 *     `signedTimesheetBookingChanges`, inside the rulebook) from the pay run's booking documents;
 *   - the admin escalation: `timesheetSignOffEscalationDue` (08:00 the day before payday) and
 *     `timesheetSignOffEscalationRecipients` (every active admin, every awaiting sheet), its own text and id
 *     (`timesheetSignOffEscalationNotice`, `timesheetSignOffEscalationNoticeId`), the same notification type;
 *   - the row: `timesheetSignOffReminderNotice`, `notificationCreateFields`, one per recipient per pay run
 *     (`timesheetSignOffReminderNoticeId`, created with `create()`), so a second run — or two at once — adds nothing.
 * This file only reads documents and writes the rows. It never writes a timesheet.
 *
 * Reads per run: one read of every organisation document (the fields it needs only). For an organisation with a run
 * due: its users (one query, at most 2,000), the users documents of the `members` keys and the creator not already
 * read, and their memberships here (batched `getAll`, rulebook §1 anchored people); its `operatives` rows (one query,
 * a few fields); and per pay run its timesheets (three queries: `weekStartKey ==` the run's first day, `weekStart`
 * within a day of it as a Timestamp, and as text) and its labour and manager site bookings dated inside the run (two
 * queries, at most 5,000 each). Organisations are processed four at a time.
 * Known limits: a users document whose stored `organizationId` is a path or a reference is on the roster only when it
 * is anchored (a `members` key or the creator) — the `==` query matches the plain id only; a booking whose `date` is not
 * a Timestamp is not read (it then reads as removed from a signed sheet, which can only take a sheet out of the count);
 * tombstones are not read (a deleted booking has no document, which reads as removed anyway); when a bookings query
 * reaches its limit or fails, that run's sheets are judged on their stored signatures and late extras only (logged).
 */

const SHEET_QUERY_LIMIT = 500
const ROSTER_QUERY_LIMIT = 2000
const BOOKING_QUERY_LIMIT = 5000
const OPERATIVE_QUERY_LIMIT = 5000
const ORGANIZATION_CONCURRENCY = 4
const GET_ALL_CHUNK = 100
const DAY_MS = 24 * 60 * 60 * 1000

function trimmed(value) {
  return String(value ?? '').trim()
}

/** Plain values for the rulebook (Timestamps as epoch ms, document references as their path). */
function plain(data) {
  if (data == null || typeof data !== 'object') return data
  if (typeof data.toMillis === 'function') return data.toMillis()
  if (typeof data.path === 'string' && typeof data.id === 'string' && data.parent && typeof data.firestore === 'object') return data.path
  if (data instanceof Date) return data.getTime()
  if (Array.isArray(data)) return data.map(plain)
  const out = {}
  for (const [key, value] of Object.entries(data)) out[key] = plain(value)
  return out
}

/** Run `worker` over `items`, at most `limit` at a time, results in input order. */
async function mapLimited(items, limit, worker) {
  const out = new Array(items.length)
  let next = 0
  async function lane() {
    while (next < items.length) {
      const at = next
      next += 1
      out[at] = await worker(items[at], at)
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, lane))
  return out
}

/**
 * `store` (the methods marked optional may be missing; the run then reads less, as before):
 *   organizations() → [{ id, data }]                       (every organisation document)
 *   users(orgId) → [{ id, data }]                          (users where organizationId == orgId)
 *   usersByIds?(ids) → [{ id, data }]                      (users/{id} that exist)
 *   memberships?(orgId, ids) → { [id]: data }               (users/{id}/orgMemberships/{orgId} that exist)
 *   memberLineManagers?(orgId, ids) → { [id]: data }        (organizations/{orgId}/memberLineManagers/{id} that exist, 1.88.0)
 *   operatives?(orgId) → [{ id, data }]                    (operatives rows: email, linkedUserId, userId, uid)
 *   sheetsForRun(orgId, startDayKey, startMs) → [{ id, data }]
 *     (settings where weekStartKey == startDayKey, and settings where weekStart within a day of startMs as a Timestamp
 *      or as text; merged by id)
 *   bookingsForRun?(orgId, startMs, endExclusiveMs) → { rows: [{ collection, id, data }], complete }
 *     (bookings and managerSiteBookings whose date is inside the run; complete false when a query hit its limit)
 *   createNotification(orgId, id, fields) → 'created' | 'exists'
 */
function createTimesheetSignOffReminders({ store, canonical, logger = console, serverTimestamp = () => new Date(), now = () => Date.now(), toTimestamp = (ms) => new Date(ms) }) {
  const warn = (...args) => (typeof logger.warn === 'function' ? logger.warn(...args) : logger.info(...args))
  async function runForOrganization(orgId, org, nowMs) {
    if (canonical.organizationDeletionState(org, nowMs).state !== 'active') return { orgId, skipped: 'scheduled for deletion' }
    if (org.billing && !canonical.hasAccess(org.billing, nowMs)) return { orgId, skipped: 'subscription lapsed' }
    const timeZone = canonical.organizationTimeZone(org.countryCode)
    // Two passes, each its own rule: the line-manager reminder (the organisation's days before payday) and the admin
    // escalation (08:00 the day before payday). Separate document ids, so both can fire for one pay run.
    const passes = [
      {
        kind: 'reminder',
        runs: canonical.timesheetSignOffReminderDue({ invoicing: org.invoicing, now: nowMs, timeZone }).runs,
        recipients: canonical.timesheetSignOffReminderRecipients,
        notice: canonical.timesheetSignOffReminderNotice,
        noticeId: canonical.timesheetSignOffReminderNoticeId,
      },
      {
        kind: 'escalation',
        runs: canonical.timesheetSignOffEscalationDue({ invoicing: org.invoicing, now: nowMs, timeZone }).runs,
        recipients: canonical.timesheetSignOffEscalationRecipients,
        notice: canonical.timesheetSignOffEscalationNotice,
        noticeId: canonical.timesheetSignOffEscalationNoticeId,
      },
    ]
    const due = passes.reduce((sum, pass) => sum + pass.runs.length, 0)
    if (due === 0) return { orgId, due: 0 }
    const creatorUserId = trimmed(org.creatorUserId)
    const members = org.members && typeof org.members === 'object' && !Array.isArray(org.members) ? org.members : {}
    const userRows = await store.users(orgId)
    if (userRows.length >= ROSTER_QUERY_LIMIT) warn('timesheet sign-off reminder: roster limit reached', { orgId, limit: ROSTER_QUERY_LIMIT })
    // Rulebook §1 anchored people: every `members` key and the creator, read by id when their users document was not
    // returned by the organisation query (it names another company, or stores the organisation as a path / reference).
    const haveIds = new Set(userRows.map((row) => trimmed(row.id).toLowerCase()))
    const anchoredIds = [...new Set([...Object.keys(members), creatorUserId].map(trimmed).filter(Boolean))].filter((id) => !haveIds.has(id.toLowerCase()))
    const anchoredRows = anchoredIds.length && typeof store.usersByIds === 'function' ? await store.usersByIds(anchoredIds) : []
    const memberships =
      anchoredRows.length && typeof store.memberships === 'function' ? await store.memberships(orgId, anchoredRows.map((row) => row.id)) : {}
    // Rulebook 1.88.0 §8: an anchored person's line manager here is this organisation's `memberLineManagers` record.
    const lineManagerRecords =
      anchoredRows.length && typeof store.memberLineManagers === 'function'
        ? await store.memberLineManagers(orgId, anchoredRows.map((row) => row.id))
        : {}
    const membersRoleOf = (id) => {
      const key = Object.keys(members).find((row) => row.toLowerCase() === trimmed(id).toLowerCase())
      return key == null ? undefined : members[key]
    }
    const roster = [...userRows, ...anchoredRows]
      .map((row) =>
        canonical.timesheetSignOffReminderRosterMember(row.id, plain(row.data || {}), {
          organizationId: orgId,
          creatorUserId,
          membersRole: membersRoleOf(row.id),
          membership: memberships[row.id] ? plain(memberships[row.id]) : null,
          lineManagerRecord: lineManagerRecords[row.id] ? plain(lineManagerRecords[row.id]) : null,
        })
      )
      .filter(Boolean)
    const operatives =
      typeof store.operatives === 'function'
        ? (await store.operatives(orgId)).map((row) => ({ id: row.id, ...plain(row.data || {}) }))
        : null
    // One bookings read per pay run (both passes share it).
    const bookingsByRun = new Map()
    async function bookingsFor(run) {
      const key = `${run.startDayKey}|${run.endDayKey}`
      if (!bookingsByRun.has(key)) {
        let result = { bookings: null, loaded: false }
        if (typeof store.bookingsForRun === 'function' && Number.isFinite(run.startMs) && Number.isFinite(run.endExclusiveMs)) {
          try {
            // A day wider each side (bookings stored at another zone's midnight); the rulebook keeps the run's days only.
            const read = await store.bookingsForRun(orgId, run.startMs - DAY_MS, run.endExclusiveMs + DAY_MS)
            if (read && read.complete) {
              result = {
                loaded: true,
                bookings: read.rows
                  .map((row) => {
                    const data = plain(row.data || {})
                    const doc = bookingDocument(canonical, row.collection, row.id, data, timeZone)
                    return doc && { ...doc, createdAt: data.createdAt ?? null, updatedAt: data.updatedAt ?? null }
                  })
                  .filter(Boolean),
              }
            } else warn('timesheet sign-off reminder: bookings limit reached, stored signatures only', { orgId, run: key, limit: BOOKING_QUERY_LIMIT })
          } catch (error) {
            warn('timesheet sign-off reminder: bookings read failed, stored signatures only', { orgId, run: key, message: (error && error.message) || String(error) })
          }
        }
        bookingsByRun.set(key, result)
      }
      return bookingsByRun.get(key)
    }
    // One sheets read per pay run, shared by both passes.
    const sheetsByRun = new Map()
    async function sheetsFor(run) {
      const key = `${run.startDayKey}|${run.endDayKey}`
      if (!sheetsByRun.has(key)) {
        const startInstant = Number.isFinite(run.startMs) ? run.startMs : null
        const rows = await store.sheetsForRun(orgId, run.startDayKey, startInstant)
        if (rows.length >= SHEET_QUERY_LIMIT) warn('timesheet sign-off reminder: sheet limit reached', { orgId, run: key, limit: SHEET_QUERY_LIMIT })
        sheetsByRun.set(key, rows.map((row) => ({ documentId: row.id, data: plain(row.data || {}) })))
      }
      return sheetsByRun.get(key)
    }
    let written = 0
    let existing = 0
    let recipientsTotal = 0
    for (const pass of passes) {
      for (const run of pass.runs) {
        const startInstant = Number.isFinite(run.startMs) ? run.startMs : null
        const sheets = await sheetsFor(run)
        const read = await bookingsFor(run)
        const recipients = pass.recipients({
          sheets,
          roster,
          payRun: run,
          timeZone,
          bookings: read.bookings,
          bookingsLoaded: read.loaded,
          operatives,
        })
        recipientsTotal += recipients.length
        for (const recipient of recipients) {
          const noticeId = pass.noticeId({
            organizationId: orgId,
            recipientId: recipient.userId,
            startDayKey: run.startDayKey,
            endDayKey: run.endDayKey,
            paymentDayKey: run.paymentDayKey,
          })
          if (!noticeId) continue
          const text = pass.notice({ count: recipient.count, paymentDayKey: run.paymentDayKey, names: recipient.names })
          const created = canonical.notificationCreateFields({
            organizationId: orgId,
            type: canonical.TIMESHEET_SIGNOFF_REMINDER_NOTICE_TYPE,
            title: text.title,
            message: text.message,
            detail: text.detail,
            userId: recipient.userId,
            relatedId: canonical.notificationRelatedIdFor(canonical.TIMESHEET_SIGNOFF_REMINDER_NOTICE_TYPE, run.paymentDayKey),
            dayKey: run.startDayKey,
            // A notice nobody caused: no actorUserId (as the scheduled reminders).
            actorUserId: null,
            serverTimestamp: serverTimestamp(),
          })
          if (!created) continue
          const fields = { ...created.set }
          if (startInstant != null) fields.deepLinkWeekStart = toTimestamp(startInstant)
          const result = await store.createNotification(orgId, noticeId, fields)
          if (result === 'created') written += 1
          else existing += 1
        }
      }
    }
    return { orgId, due, recipients: recipientsTotal, written, existing }
  }

  async function run() {
    const nowMs = now()
    const report = []
    const rows = (await store.organizations()).filter((row) => trimmed(row.id))
    // Four organisations at a time, so one large company never holds up the rest of the hour.
    const results = await mapLimited(rows, ORGANIZATION_CONCURRENCY, async (row) => {
      const orgId = trimmed(row.id)
      try {
        return await runForOrganization(orgId, plain(row.data || {}), nowMs)
      } catch (error) {
        logger.error('timesheet sign-off reminder failed', { orgId, message: (error && error.message) || String(error) })
        return { orgId, error: (error && error.message) || String(error) }
      }
    })
    report.push(...results)
    const due = report.filter((row) => row.due > 0)
    logger.info('timesheet sign-off reminders', {
      organizations: report.length,
      due: due.length,
      written: due.reduce((sum, row) => sum + (row.written || 0), 0),
      alreadyWritten: due.reduce((sum, row) => sum + (row.existing || 0), 0),
      failed: report.filter((row) => row.error).map((row) => row.orgId),
    })
    return report
  }

  return { run, runForOrganization }
}

/** The admin-SDK store for `createTimesheetSignOffReminders`. */
function createAdminSignOffReminderStore(db, Timestamp) {
  return {
    organizations: async () => {
      const snap = await db.collection('organizations').select('invoicing', 'countryCode', 'creatorUserId', 'billing', 'deletion', 'members').get()
      return snap.docs.map((doc) => ({ id: doc.id, data: doc.data() }))
    },
    users: async (orgId) => {
      const snap = await db.collection('users').where('organizationId', '==', orgId).limit(ROSTER_QUERY_LIMIT).get()
      return snap.docs.map((doc) => ({ id: doc.id, data: doc.data() }))
    },
    usersByIds: async (ids) => {
      const out = []
      for (let at = 0; at < ids.length; at += GET_ALL_CHUNK) {
        const refs = ids.slice(at, at + GET_ALL_CHUNK).map((id) => db.doc(`users/${id}`))
        if (refs.length === 0) continue
        for (const doc of await db.getAll(...refs)) if (doc.exists) out.push({ id: doc.id, data: doc.data() })
      }
      return out
    },
    memberships: async (orgId, ids) => {
      const out = {}
      for (let at = 0; at < ids.length; at += GET_ALL_CHUNK) {
        const refs = ids.slice(at, at + GET_ALL_CHUNK).map((id) => db.doc(`users/${id}/orgMemberships/${orgId}`))
        if (refs.length === 0) continue
        for (const doc of await db.getAll(...refs)) if (doc.exists) out[doc.ref.parent.parent.id] = doc.data()
      }
      return out
    },
    memberLineManagers: async (orgId, ids) => {
      const out = {}
      for (let at = 0; at < ids.length; at += GET_ALL_CHUNK) {
        const refs = ids.slice(at, at + GET_ALL_CHUNK).map((id) => db.doc(`organizations/${orgId}/memberLineManagers/${id}`))
        if (refs.length === 0) continue
        for (const doc of await db.getAll(...refs)) if (doc.exists) out[doc.id] = doc.data()
      }
      return out
    },
    operatives: async (orgId) => {
      const snap = await db.collection(`organizations/${orgId}/operatives`).select('email', 'linkedUserId', 'userId', 'uid').limit(OPERATIVE_QUERY_LIMIT).get()
      return snap.docs.map((doc) => ({ id: doc.id, data: doc.data() }))
    },
    bookingsForRun: async (orgId, startMs, endExclusiveMs) => {
      const from = Timestamp.fromMillis(startMs)
      const to = Timestamp.fromMillis(endExclusiveMs)
      const rows = []
      let complete = true
      for (const collection of ['bookings', 'managerSiteBookings']) {
        const snap = await db
          .collection(`organizations/${orgId}/${collection}`)
          .where('date', '>=', from)
          .where('date', '<', to)
          .limit(BOOKING_QUERY_LIMIT)
          .get()
        if (snap.size >= BOOKING_QUERY_LIMIT) complete = false
        for (const doc of snap.docs) rows.push({ collection, id: doc.id, data: doc.data() })
      }
      return { rows, complete }
    },
    sheetsForRun: async (orgId, startDayKey, startMs) => {
      const settings = db.collection(`organizations/${orgId}/settings`)
      const queries = [settings.where('weekStartKey', '==', startDayKey).limit(SHEET_QUERY_LIMIT).get()]
      if (typeof startMs === 'number') {
        queries.push(
          settings
            .where('weekStart', '>=', Timestamp.fromMillis(startMs - DAY_MS))
            .where('weekStart', '<=', Timestamp.fromMillis(startMs + DAY_MS))
            .limit(SHEET_QUERY_LIMIT)
            .get()
        )
        // `weekStart` stored as text (an ISO instant or a day key): a string range a day either side; the rulebook
        // reads each sheet's day in the organisation zone and keeps the run's own.
        const iso = (ms) => new Date(ms).toISOString().slice(0, 10)
        queries.push(
          settings
            .where('weekStart', '>=', iso(startMs - DAY_MS))
            .where('weekStart', '<', iso(startMs + 2 * DAY_MS))
            .limit(SHEET_QUERY_LIMIT)
            .get()
        )
      }
      const byId = new Map()
      for (const snap of await Promise.all(queries)) {
        for (const doc of snap.docs) if (doc.id.startsWith('timesheet_')) byId.set(doc.id, { id: doc.id, data: doc.data() })
      }
      return [...byId.values()]
    },
    createNotification: async (orgId, id, fields) => {
      try {
        await db.doc(`organizations/${orgId}/notifications/${id}`).create(fields)
        return 'created'
      } catch (error) {
        // ALREADY_EXISTS (gRPC 6): this reviewer was already reminded for this pay run.
        if (error && (error.code === 6 || error.code === 'already-exists')) return 'exists'
        throw error
      }
    },
  }
}

module.exports = { createTimesheetSignOffReminders, createAdminSignOffReminderStore }
