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

const DOC_ID = /^[A-Za-z0-9_-]{1,128}$/

/** A stored labour or manager site booking as the rulebook's `OvertimeBookingInput`. */
function overtimeBooking(canonical, collection, id, data, timeZone) {
  if (!data) return null
  const ms = millis(data.date)
  const dayKey = ms == null ? '' : canonical.dayKeyInOrganizationZone(new Date(ms).toISOString(), timeZone)
  return {
    id,
    collection,
    personId: trimmed(collection === 'bookings' ? data.operativeId : data.userId),
    dayKey,
    timeSlot: data.timeSlot,
    workStartTime: data.workStartTime,
    workEndTime: data.workEndTime,
    isBreakRemoved: data.isBreakRemoved === true,
    otMultiplierOverride: typeof data.otMultiplierOverride === 'number' ? data.otMultiplierOverride : null,
    status: data.status,
    // The booking's job (`bookingJobId`): '' for a place that is not a job. Its number and name are added below.
    jobId: canonical.bookingJobId({ collection, projectId: data.projectId, locationType: data.locationType, locationId: data.locationId }) || '',
    jobCollection: trimmed(data.jobCollection),
    // A manager site booking at a place that is not a job: the app shows its custom name as the job name.
    customLocationName: trimmed(data.customLocationName),
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

/**
 * `store`: { getDoc(path) → data | null, query(collectionPath, field, value) → [{ id, data }], setDoc(path, data) }.
 */
function createReportIntegrityCheck({ store, canonical, logger, serverTimestamp }) {
  async function personIds(orgId, userId) {
    const user = await store.getDoc(`users/${userId}`).catch(() => null)
    const ids = [userId]
    for (const key of ['formerUserIds', 'sameEmailUserIds']) {
      if (user && Array.isArray(user[key])) ids.push(...user[key].map(trimmed).filter(Boolean))
    }
    return ids
  }

  async function checkOvertime(orgId, reportId, report) {
    const org = (await store.getDoc(`organizations/${orgId}`)) || {}
    const timeZone = canonical.organizationTimeZone(org.countryCode)
    const userId = trimmed(report.userId)
    const reviews = userId
      ? await store.query(`organizations/${orgId}/overtimeReviews`, 'userId', userId)
      : []
    const lines = Array.isArray(report.lines) ? report.lines.slice(0, 500) : []
    // Each booking id once (a repeated one is flagged by the rule), read in parallel: labour, else manager site.
    const ids = [...new Set(lines.map((line) => trimmed(line && line.bookingId)).filter((id) => DOC_ID.test(id)))]
    const found = await Promise.all(
      ids.map(async (id) => {
        const [labour, site] = await Promise.all([
          store.getDoc(`organizations/${orgId}/bookings/${id}`),
          store.getDoc(`organizations/${orgId}/managerSiteBookings/${id}`),
        ])
        if (labour) return overtimeBooking(canonical, 'bookings', id, labour, timeZone)
        if (site) return overtimeBooking(canonical, 'managerSiteBookings', id, site, timeZone)
        return null
      })
    )
    const bookings = found.filter(Boolean)
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
      booking.jobNumber = trimmed(job.jobNumber)
      booking.jobName = trimmed(job.siteName)
    }
    // "Declined by {name}": the decider's roster name (first name and surname, else email, as the apps show it).
    const deciders = [
      ...new Set(
        reviews
          .filter((row) => row.data && row.data.decision === 'declined')
          .map((row) => trimmed(row.data.reviewedBy))
          .filter((id) => DOC_ID.test(id))
      ),
    ]
    const reviewerNames = {}
    await Promise.all(
      deciders.map(async (id) => {
        const user = await store.getDoc(`users/${id}`).catch(() => null)
        if (!user) return
        reviewerNames[id] = [trimmed(user.firstName), trimmed(user.surname)].filter(Boolean).join(' ') || trimmed(user.email)
      })
    )
    return canonical.overtimeReportIntegrity({
      reportId,
      report: plain(report),
      reviews: reviews.map((row) => ({ id: row.id, data: plain(row.data) })),
      reviewerNames,
      bookings,
      organization: plain(org),
      timeZone,
    })
  }

  async function checkClaims(orgId, reportId, report) {
    const org = (await store.getDoc(`organizations/${orgId}`)) || {}
    const timeZone = canonical.organizationTimeZone(org.countryCode)
    const kind = trimmed(report.kind) === 'priceWork' ? 'priceWork' : 'expense'
    const collection = kind === 'priceWork' ? 'priceWorkItems' : 'expenseItems'
    const rows = Array.isArray(report.items) ? report.items.slice(0, 500) : []
    // Each item id once (a repeated one is flagged by the rule), item and review read in parallel.
    const ids = [...new Set(rows.map((row) => trimmed(row && row.id)).filter((id) => DOC_ID.test(id)))]
    const found = await Promise.all(
      ids.map(async (id) => {
        const [data, review] = await Promise.all([
          store.getDoc(`organizations/${orgId}/${collection}/${id}`),
          store.getDoc(`organizations/${orgId}/payeClaimReviews/${kind}_${id}`),
        ])
        return { id, data, review }
      })
    )
    const items = found.filter((row) => row.data).map((row) => ({ id: row.id, data: plain(row.data) }))
    const reviews = found.filter((row) => row.review).map((row) => ({ id: `${kind}_${row.id}`, data: plain(row.review) }))
    const userId = trimmed(report.userId)
    return canonical.payeClaimReportIntegrity({
      reportId,
      report: plain(report),
      items,
      reviews,
      timeZone,
      organizationId: orgId,
      organization: plain(org),
      personIds: userId ? await personIds(orgId, userId) : [],
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
      const snap = await db.collection(collectionPath).where(field, '==', value).limit(2000).get()
      return snap.docs.map((doc) => ({ id: doc.id, data: doc.data() }))
    },
    async setDoc(path, data) {
      await db.doc(path).set(data)
    },
  }
}

module.exports = { createReportIntegrityCheck, createAdminReportIntegrityStore }
