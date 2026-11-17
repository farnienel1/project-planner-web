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
    const bookings = []
    const lines = Array.isArray(report.lines) ? report.lines.slice(0, 500) : []
    for (const line of lines) {
      const id = trimmed(line && line.bookingId)
      if (!DOC_ID.test(id)) continue
      for (const collection of ['bookings', 'managerSiteBookings']) {
        const data = await store.getDoc(`organizations/${orgId}/${collection}/${id}`)
        if (data) {
          bookings.push(overtimeBooking(canonical, collection, id, data, timeZone))
          break
        }
      }
    }
    return canonical.overtimeReportIntegrity({
      reportId,
      report: plain(report),
      reviews: reviews.map((row) => ({ id: row.id, data: plain(row.data) })),
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
    const items = []
    const reviews = []
    const rows = Array.isArray(report.items) ? report.items.slice(0, 500) : []
    for (const row of rows) {
      const id = trimmed(row && row.id)
      if (!DOC_ID.test(id)) continue
      const data = await store.getDoc(`organizations/${orgId}/${collection}/${id}`)
      if (data) items.push({ id, data: plain(data) })
      const review = await store.getDoc(`organizations/${orgId}/payeClaimReviews/${kind}_${id}`)
      if (review) reviews.push({ id: `${kind}_${id}`, data: plain(review) })
    }
    const userId = trimmed(report.userId)
    return canonical.payeClaimReportIntegrity({
      reportId,
      report: plain(report),
      items,
      reviews,
      timeZone,
      organizationId: orgId,
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
