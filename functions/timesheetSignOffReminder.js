'use strict'

/**
 * Rulebook 1.78.0 §8 / §13 (owner decisions 23 Nov, point 4, a and b): "Timesheets waiting for your sign-off" — before payday,
 * each line manager (and each admin who reviews a person with no active line manager) gets one inbox row, and through
 * `sendDevicePushOnNotificationCreate` one push, naming how many of that pay run's timesheets still wait for them.
 *
 * Every decision is the packed rulebook's:
 *   - when, per organisation in its own time zone: `timesheetSignOffReminderDue` (08:00 two days before payday);
 *   - who and how many: `timesheetSignOffReminderRecipients` (User Timesheets' Awaiting rows, `userTimesheetQueue`,
 *     and `timesheetSubmittedRecipients`), over the organisation's users (`timesheetSignOffReminderRosterMember`);
 *   - the admin escalation: `timesheetSignOffEscalationDue` (08:00 the day before payday) and
 *     `timesheetSignOffEscalationRecipients` (every active admin, every awaiting sheet), its own text and id
 *     (`timesheetSignOffEscalationNotice`, `timesheetSignOffEscalationNoticeId`), the same notification type;
 *   - the row: `timesheetSignOffReminderNotice`, `notificationCreateFields`, one per recipient per pay run
 *     (`timesheetSignOffReminderNoticeId`, created with `create()`), so a second run — or two at once — adds nothing.
 * This file only reads documents and writes the rows. It never writes a timesheet.
 *
 * Reads per run: one read of every organisation document (the field it needs only). For an organisation with a run
 * due: its users (one query) and that run's timesheets (two queries: `weekStartKey ==` the run's first day, and
 * `weekStart` within a day of it, for sheets stored without the key), each at most 500 documents. Nothing else.
 * Known limits: a member who belongs only through a membership (their users document names another company) is not
 * on the roster and is neither reminded nor counted; a sheet whose bookings changed after signing (1.47.0) is judged
 * on its stored signatures only (the server has no live bookings).
 */

const SHEET_QUERY_LIMIT = 500
const ROSTER_QUERY_LIMIT = 2000
const DAY_MS = 24 * 60 * 60 * 1000

function trimmed(value) {
  return String(value ?? '').trim()
}

/** Plain values for the rulebook (Timestamps as epoch ms). */
function plain(data) {
  if (data == null || typeof data !== 'object') return data
  if (typeof data.toMillis === 'function') return data.toMillis()
  if (data instanceof Date) return data.getTime()
  if (Array.isArray(data)) return data.map(plain)
  const out = {}
  for (const [key, value] of Object.entries(data)) out[key] = plain(value)
  return out
}

/**
 * `store`:
 *   organizations() → [{ id, data }]                       (every organisation document)
 *   users(orgId) → [{ id, data }]                          (users where organizationId == orgId)
 *   sheetsForRun(orgId, startDayKey, startMs) → [{ id, data }]
 *     (settings where weekStartKey == startDayKey, and settings where weekStart within a day of startMs; merged by id)
 *   createNotification(orgId, id, fields) → 'created' | 'exists'
 */
function createTimesheetSignOffReminders({ store, canonical, logger = console, serverTimestamp = () => new Date(), now = () => Date.now(), toTimestamp = (ms) => new Date(ms) }) {
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
    const userRows = await store.users(orgId)
    const roster = userRows
      .map((row) => canonical.timesheetSignOffReminderRosterMember(row.id, plain(row.data || {}), { organizationId: orgId, creatorUserId: trimmed(org.creatorUserId) }))
      .filter(Boolean)
    // One sheets read per pay run, shared by both passes.
    const sheetsByRun = new Map()
    async function sheetsFor(run) {
      const key = `${run.startDayKey}|${run.endDayKey}`
      if (!sheetsByRun.has(key)) {
        const startInstant = Number.isFinite(run.startMs) ? run.startMs : null
        const rows = await store.sheetsForRun(orgId, run.startDayKey, startInstant)
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
        const recipients = pass.recipients({ sheets, roster, payRun: run, timeZone })
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
    for (const row of await store.organizations()) {
      const orgId = trimmed(row.id)
      if (!orgId) continue
      try {
        report.push(await runForOrganization(orgId, plain(row.data || {}), nowMs))
      } catch (error) {
        report.push({ orgId, error: (error && error.message) || String(error) })
        logger.error('timesheet sign-off reminder failed', { orgId, message: (error && error.message) || String(error) })
      }
    }
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
      const snap = await db.collection('organizations').select('invoicing', 'countryCode', 'creatorUserId', 'billing', 'deletion').get()
      return snap.docs.map((doc) => ({ id: doc.id, data: doc.data() }))
    },
    users: async (orgId) => {
      const snap = await db.collection('users').where('organizationId', '==', orgId).limit(ROSTER_QUERY_LIMIT).get()
      return snap.docs.map((doc) => ({ id: doc.id, data: doc.data() }))
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
