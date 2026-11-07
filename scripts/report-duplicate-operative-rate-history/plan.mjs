/**
 * Rulebook 1.36.0 §8 (owner question, 7 Nov): which people's rate changes because web now reads pay-rate history under
 * every `operatives` row on their email (`personRateHistoryIds`, `payRateOnDay` "every id"), not one row.
 *
 * A person is listed when they have two or more `operatives` rows on their email and a row that is NOT their linked row
 * holds a history row dated after the newest history row web read before 1.36.0 (their users ids and the linked row).
 * The linked row is a row whose stored link (`linkedUserId` / `userId` / `uid`) or document id is one of the person's
 * users ids; with no such row the person is listed as "no linked row" when two or more rows have history.
 * Pure: no Firestore. Ids compare without case; emails trimmed and lower-cased.
 */

const key = (value) => String(value ?? '').trim().toLowerCase()

/** Epoch ms of a stored instant: a Firestore Timestamp, `{ seconds }`, a Date, epoch ms or an ISO string. */
export function instantMs(value) {
  if (value == null) return null
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value.getTime() : null
  if (typeof value.toMillis === 'function') return value.toMillis()
  if (typeof value === 'object' && typeof value.seconds === 'number') return value.seconds * 1000 + Math.floor((value.nanoseconds || 0) / 1e6)
  if (typeof value === 'string') {
    const ms = Date.parse(value)
    return Number.isFinite(ms) ? ms : null
  }
  return null
}

function rateOf(row) {
  if (!row) return null
  return { rate: row.dayRate ?? null, payBasis: row.payBasis ?? null, effectiveAt: new Date(row.ms).toISOString().slice(0, 10) }
}

function newest(rows) {
  let best = null
  for (const row of rows) if (row.ms != null && (!best || row.ms > best.ms)) best = row
  return best
}

/**
 * @param {{ users: Array<{ id: string, email?: string }>, operatives: Array<{ id: string, email?: string, linkedUserId?: string, userId?: string, uid?: string }>, history: Array<{ userId?: string, operativeId?: string, dayRate?: number|null, payBasis?: string|null, effectiveAt?: unknown }> }} input
 */
export function duplicateRateHistoryFindings({ users = [], operatives = [], history = [] }) {
  const usersByEmail = new Map()
  for (const user of users) {
    const email = key(user.email)
    if (!email) continue
    if (!usersByEmail.has(email)) usersByEmail.set(email, [])
    usersByEmail.get(email).push(user)
  }
  const rowsByEmail = new Map()
  for (const row of operatives) {
    const email = key(row.email)
    if (!email) continue
    if (!rowsByEmail.has(email)) rowsByEmail.set(email, [])
    rowsByEmail.get(email).push(row)
  }
  const dated = history.map((row) => ({ ...row, ms: instantMs(row.effectiveAt) }))
  const findings = []
  for (const [email, rows] of [...rowsByEmail.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const people = usersByEmail.get(email) || []
    if (rows.length < 2 || people.length === 0) continue
    const userIds = new Set(people.map((user) => key(user.id)))
    const linked = rows.filter((row) =>
      [row.linkedUserId, row.userId, row.uid, row.id].some((id) => id && userIds.has(key(id)))
    )
    const linkedIds = new Set(linked.map((row) => key(row.id)))
    const others = rows.filter((row) => !linkedIds.has(key(row.id)))
    const before = dated.filter((row) => userIds.has(key(row.userId)) || linkedIds.has(key(row.operativeId)))
    const otherRows = new Set(others.map((row) => key(row.id)))
    const fromOthers = dated.filter((row) => otherRows.has(key(row.operativeId)) && !userIds.has(key(row.userId)))
    const base = {
      email,
      userIds: people.map((user) => user.id),
      name: people.map((user) => [user.firstName, user.surname ?? user.lastName].filter(Boolean).join(' ')).find(Boolean) || '',
      operativeIds: rows.map((row) => row.id),
      linkedOperativeIds: linked.map((row) => row.id),
    }
    if (linked.length === 0) {
      const withHistory = rows.filter((row) => dated.some((h) => key(h.operativeId) === key(row.id)))
      if (withHistory.length >= 2) findings.push({ ...base, reason: 'no linked row', before: rateOf(newest(before)), after: rateOf(newest([...before, ...fromOthers])) })
      continue
    }
    const oldNewest = newest(before)
    const newer = fromOthers.filter((row) => row.ms != null && (!oldNewest || row.ms > oldNewest.ms))
    if (newer.length === 0) continue
    findings.push({
      ...base,
      reason: 'newer history on a non-linked row',
      newerOnOperativeIds: [...new Set(newer.map((row) => row.operativeId))],
      before: rateOf(oldNewest),
      after: rateOf(newest(newer)),
    })
  }
  return findings
}
