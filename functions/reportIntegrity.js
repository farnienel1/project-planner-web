'use strict'

/**
 * Rulebook 1.65.0 §25 / §26 (mass-assignment audit 17 Nov, owner decision B): when a PAYE overtime report
 * (`overtimeReports/{id}`) or a price work / expenses report (`payeClaimReports/{id}`) is created, check it against the
 * records it was built from and store the result for admins at `organizations/{orgId}/reportChecks/{reportId}`.
 *
 * Why on the server: the person writes their own report once from their device, and the security rules cannot walk its
 * lists, so only a server read of the reviews, bookings and items can say whether its figures came from them.
 *
 * It never blocks, edits or deletes the report (the report is already saved when this runs). Every decision is the
 * packed rulebook's (`overtimeReportIntegrity`, `payeClaimReportIntegrity`, `reportCheckWriteFields`); this file only
 * reads documents and writes the one check document.
 */

function trimmed(value) {
  return String(value ?? '').trim()
}

const DOC_ID = /^[A-Za-z0-9_-]{1,128}$/

/**
 * A stored labour or manager site booking as the rulebook's `OvertimeBookingInput`, read through the rulebook's own
 * readers (`parseBookingDocument`, `parseManagerSiteBookingDocument`, rulebook §1), exactly as both apps build it (web
 * `bookingInputFromDoc`): legacy keys (`projectID`), a missing `locationType`, "7:30 AM" or Timestamp clock times all
 * read the same. A manager site booking carries no status (its fingerprint has none, as in the apps). `jobId` is the
 * labour booking's `projectId`, or a manager site booking's `locationId` when its place is a project or small works;
 * '' for any other place (its `customLocationName` is what the app shows). Null when the reader refuses the document.
 */
function overtimeBooking(canonical, collection, id, data, timeZone) {
  if (!data) return null
  if (collection === 'bookings') {
    const parsed = canonical.parseBookingDocument(id, data, { timeZone })
    if (!parsed || !parsed.ok) return null
    const b = parsed.booking
    return {
      id,
      collection,
      personId: trimmed(b.operativeId),
      dayKey: canonical.dayKeyInOrganizationZone(new Date(b.dateMs).toISOString(), timeZone),
      timeSlot: b.timeSlot,
      workStartTime: b.workStartTime ?? null,
      workEndTime: b.workEndTime ?? null,
      isBreakRemoved: b.isBreakRemoved === true,
      otMultiplierOverride: b.otMultiplierOverride ?? null,
      status: b.status,
      jobId: trimmed(b.projectId),
      jobCollection: trimmed(b.jobCollection || data.jobCollection),
      customLocationName: '',
    }
  }
  const parsed = canonical.parseManagerSiteBookingDocument(id, data, { timeZone })
  if (!parsed || !parsed.ok) return null
  const b = parsed.booking
  const type = trimmed(b.locationType)
  const onJob = type === 'project' || type === 'small_work'
  return {
    id,
    collection,
    personId: trimmed(b.userId),
    dayKey: canonical.dayKeyInOrganizationZone(new Date(b.dateMs).toISOString(), timeZone),
    timeSlot: b.timeSlot,
    workStartTime: b.workStartTime ?? null,
    workEndTime: b.workEndTime ?? null,
    isBreakRemoved: b.isBreakRemoved === true,
    otMultiplierOverride: b.otMultiplierOverride ?? null,
    jobId: onJob ? trimmed(b.locationId) : '',
    jobCollection: trimmed(b.jobCollection) || (type === 'small_work' ? 'smallWorks' : 'projects'),
    customLocationName: trimmed(b.customLocationName),
  }
}

/** Plain values for the rulebook (Timestamps as epoch ms). */
function plain(data) {
  if (data == null || typeof data !== 'object') return data
  if (typeof data.toMillis === 'function') return data.toMillis()
  if (Array.isArray(data)) return data.map(plain)
  const out = {}
  for (const [key, value] of Object.entries(data)) out[key] = plain(value)
  return out
}

/** A person's name as both apps show it (web `personName`): the reader's first name and surname, else the email. */
function displayNameOf(canonical, id, data) {
  if (!data) return null
  const user = canonical.parseUserDocument(id, data, {})
  if (!user) return null
  return [trimmed(user.firstName), trimmed(user.surname)].filter(Boolean).join(' ') || trimmed(user.email)
}

/**
 * `store`: { getDoc(path) → data | null, query(collectionPath, field, value) → [{ id, data }], setDoc(path, data) }.
 */
function createReportIntegrityCheck({ store, canonical, logger, serverTimestamp }) {
  /**
   * The report's person: their users document (read through `parseUserDocument`), every id they go by (`personIdSet`
   * over their users document and the `operatives` rows on their email) and whether they have an active line manager
   * (`hasActiveLineManager` over their listed line managers' users documents).
   */
  async function personOf(orgId, userId) {
    const raw = await store.getDoc(`users/${userId}`).catch(() => null)
    if (!raw) return { raw: null, ids: [userId], hasLineManager: null }
    const user = canonical.parseUserDocument(userId, raw, {})
    if (!user) return { raw, ids: [userId], hasLineManager: null, name: null }
    const email = trimmed(user && user.email)
    const emails = [...new Set([email, email.toLowerCase()].filter(Boolean))]
    const managerIds = [
      ...new Set(
        [...(Array.isArray(raw.assignedManagerUserIds) ? raw.assignedManagerUserIds : []), raw.assignedManagerUserId]
          .map(trimmed)
          .filter((id) => DOC_ID.test(id))
      ),
    ]
    const [rows, managers] = await Promise.all([
      Promise.all(emails.map((value) => store.query(`organizations/${orgId}/operatives`, 'email', value).catch(() => []))),
      Promise.all(
        managerIds.map(async (id) => {
          const doc = await store.getDoc(`users/${id}`).catch(() => null)
          return doc ? canonical.parseUserDocument(id, doc, {}) : null
        })
      ),
    ])
    const operativeRows = rows.flat().map((row) => ({ id: row.id, email: trimmed(row.data && row.data.email) }))
    const roster = [user, ...managers.filter(Boolean), ...operativeRows]
    const ids = canonical.personIdSet(user, roster)
    const hasLineManager = canonical.hasActiveLineManager(user, [user, ...managers.filter(Boolean)])
    return { raw, ids: ids.length ? ids : [userId], hasLineManager, name: displayNameOf(canonical, userId, raw) }
  }

  async function organizationOf(orgId) {
    const org = (await store.getDoc(`organizations/${orgId}`)) || {}
    return { org, timeZone: canonical.organizationTimeZone(org.countryCode) }
  }

  async function checkOvertime(orgId, reportId, report) {
    const userId = trimmed(report.userId)
    const lines = Array.isArray(report.lines) ? report.lines.slice(0, 500) : []
    // Each booking id once (a repeated one is flagged by the rule).
    const ids = [...new Set(lines.map((line) => trimmed(line && line.bookingId)).filter((id) => DOC_ID.test(id)))]
    const [{ org, timeZone }, person] = await Promise.all([
      organizationOf(orgId),
      DOC_ID.test(userId) ? personOf(orgId, userId) : Promise.resolve({ raw: null, ids: [userId], hasLineManager: null, name: null }),
    ])
    // Per line, in parallel: its review (`overtimeReviews/{userId}_{bookingId}`, exact), its labour or manager site
    // booking, and — for a declined review — the decider's users document.
    const found = await Promise.all(
      ids.map(async (id) => {
        const reviewId = canonical.overtimeReviewDocId(userId, id)
        const [review, labour, site] = await Promise.all([
          DOC_ID.test(reviewId) ? store.getDoc(`organizations/${orgId}/overtimeReviews/${reviewId}`) : Promise.resolve(null),
          store.getDoc(`organizations/${orgId}/bookings/${id}`),
          store.getDoc(`organizations/${orgId}/managerSiteBookings/${id}`),
        ])
        const booking = labour
          ? overtimeBooking(canonical, 'bookings', id, labour, timeZone)
          : site
            ? overtimeBooking(canonical, 'managerSiteBookings', id, site, timeZone)
            : null
        let decider = null
        const deciderId = review && review.decision === 'declined' ? trimmed(review.reviewedBy) : ''
        if (DOC_ID.test(deciderId)) {
          const doc = await store.getDoc(`users/${deciderId}`).catch(() => null)
          const name = displayNameOf(canonical, deciderId, doc)
          // An unreadable decider is left out: the rule then leaves the name unchecked (with a note).
          if (name != null) decider = [deciderId, name]
        }
        return { id: reviewId, review, booking, decider }
      })
    )
    const bookings = found.map((row) => row.booking).filter(Boolean)
    const reviews = found.filter((row) => row.review).map((row) => ({ id: row.id, data: plain(row.review) }))
    const reviewerNames = Object.fromEntries(found.map((row) => row.decider).filter(Boolean))
    // The job each booking is on (projects, else small works), so the report's job can be compared with it.
    const jobIds = [...new Set(bookings.map((booking) => booking.jobId).filter((id) => DOC_ID.test(id)))]
    const jobs = new Map(
      await Promise.all(
        jobIds.map(async (id) => {
          const [project, smallWork] = await Promise.all([
            store.getDoc(`organizations/${orgId}/projects/${id}`),
            store.getDoc(`organizations/${orgId}/smallWorks/${id}`),
          ])
          return [id, { projects: project, smallWorks: smallWork }]
        })
      )
    )
    for (const booking of bookings) {
      const collection = booking.jobCollection
      delete booking.jobCollection
      if (!booking.jobId) continue
      const both = jobs.get(booking.jobId) || {}
      // The booking's own `jobCollection` decides when both collections hold the id (older iOS builds).
      const job = (collection === 'smallWorks' ? both.smallWorks || both.projects : both.projects || both.smallWorks) || null
      if (!job) {
        // A job that cannot be read: leave the job unchecked rather than flag every line.
        delete booking.jobId
        continue
      }
      const parsed = canonical.parseJobDocument(booking.jobId, job, { timeZone })
      booking.jobNumber = trimmed(parsed ? parsed.jobNumber : job.jobNumber)
      booking.jobName = trimmed(parsed ? parsed.siteName : job.siteName)
    }
    return canonical.overtimeReportIntegrity({
      reportId,
      report: plain(report),
      reviews,
      reviewerNames,
      bookings,
      organization: plain(org),
      timeZone,
      personIds: person.ids,
      personHasLineManager: person.hasLineManager,
      personName: person.name,
      organizationName: canonical.parseOrganizationName(org) || null,
    })
  }

  async function checkClaims(orgId, reportId, report) {
    const kind = trimmed(report.kind) === 'priceWork' ? 'priceWork' : 'expense'
    const collection = kind === 'priceWork' ? 'priceWorkItems' : 'expenseItems'
    const rows = Array.isArray(report.items) ? report.items.slice(0, 500) : []
    const userId = trimmed(report.userId)
    // Each item id once (a repeated one is flagged by the rule); the organisation, the person, every item and its
    // review read in parallel.
    const ids = [...new Set(rows.map((row) => trimmed(row && row.id)).filter((id) => DOC_ID.test(id)))]
    const [{ org, timeZone }, person, found] = await Promise.all([
      organizationOf(orgId),
      DOC_ID.test(userId) ? personOf(orgId, userId) : Promise.resolve({ raw: null, ids: [userId], hasLineManager: null, name: null }),
      Promise.all(
        ids.map(async (id) => {
          const [data, review] = await Promise.all([
            store.getDoc(`organizations/${orgId}/${collection}/${id}`),
            store.getDoc(`organizations/${orgId}/payeClaimReviews/${kind}_${id}`),
          ])
          return { id, data, review }
        })
      ),
    ])
    const items = found.filter((row) => row.data).map((row) => ({ id: row.id, data: plain(row.data) }))
    const reviews = found.filter((row) => row.review).map((row) => ({ id: `${kind}_${row.id}`, data: plain(row.review) }))
    return canonical.payeClaimReportIntegrity({
      reportId,
      report: plain(report),
      items,
      reviews,
      timeZone,
      organizationId: orgId,
      organization: plain(org),
      personIds: person.ids,
      personName: person.name,
      organizationName: canonical.parseOrganizationName(org) || null,
    })
  }

  return {
    /** `collection`: `overtimeReports` or `payeClaimReports`. Never throws to the trigger. */
    async handle({ orgId, collection, reportId, report }) {
      if (!report || !DOC_ID.test(trimmed(orgId)) || !DOC_ID.test(trimmed(reportId))) return null
      try {
        const result =
          collection === 'overtimeReports'
            ? await checkOvertime(orgId, reportId, report)
            : await checkClaims(orgId, reportId, report)
        // The packed rulebook runs in its own VM context: copy its result into this realm's plain objects so the Admin
        // SDK accepts them as maps and arrays.
        const fields = JSON.parse(JSON.stringify(canonical.reportCheckWriteFields({ reportId, collection, result })))
        await store.setDoc(`organizations/${orgId}/${canonical.REPORT_CHECKS_COLLECTION}/${reportId}`, {
          ...fields,
          checkedAt: serverTimestamp(),
        })
        if (!result.ok) {
          logger.warn('report check found differences', { orgId, collection, reportId, problems: result.problems.length })
        }
        return JSON.parse(JSON.stringify(result))
      } catch (error) {
        logger.error('report check failed', { orgId, collection, reportId, message: (error && error.message) || String(error) })
        return null
      }
    },
  }
}

/** The Admin SDK store the trigger uses. */
function createAdminReportIntegrityStore(db) {
  return {
    async getDoc(path) {
      const snap = await db.doc(path).get()
      return snap.exists ? snap.data() : null
    },
    async query(collectionPath, field, value) {
      const snap = await db.collection(collectionPath).where(field, '==', value).get()
      return snap.docs.map((doc) => ({ id: doc.id, data: doc.data() }))
    },
    async setDoc(path, data) {
      await db.doc(path).set(data)
    },
  }
}

module.exports = { createReportIntegrityCheck, createAdminReportIntegrityStore }
