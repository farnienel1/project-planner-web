/**
 * Rulebook 1.82.0 §21 (owner answer 24 Nov, item 1): the site map's "On annual leave" figure is the whole company's
 * approved annual leave on the day shown. Leave is not tied to a job, so it is never limited to the people booked on
 * the job a pin is for, and never to the viewer's Daily Overview scope.
 *
 * The records are the leave the device holds for the open organisation (`parseHolidayDocument` rows, day keys in the
 * organisation zone). A record counts when it is approved and `dayKey` is one of its leave days — exactly
 * `dailyOverviewLeaveRows` (§6: weekends and the region's bank holidays inside a multi-day record are not leave days).
 *
 * People are counted once: records are grouped under the person they belong to — a roster row whose ids
 * (`personIdSet`: own id, former and same-email ids, same-email rows) or email include the record's `userId` /
 * `operativeId` (without case), else an `operatives` row with that id (matched to its account through its email),
 * else the stored id itself. An AM and a PM record of one person on the same day are one person. Never by name. Pure.
 */

import { dailyOverviewLeaveRows, type LeaveCalendarRecord } from './leaveCalendar'
import { idKey, personIdSet, type PersonIdsInput } from './personIds'

export type SiteMapLeaveRecord = LeaveCalendarRecord & {
  userId?: string | null
  operativeId?: string | null
}

export type SiteMapLeavePerson = PersonIdsInput & {
  id: string
  /** Shown on the iPhone list of names; optional. */
  name?: string | null
}

export type SiteMapLeaveOperative = { id: string; email?: string | null; name?: string | null }

export type SiteMapLeaveSummary = {
  /** Distinct people on approved annual leave that day, whole company. */
  onAnnualLeave: number
  /** One row per person, in the order their first record appears. `name` is null when no roster row is known. */
  people: Array<{ key: string; name: string | null; recordIds: string[] }>
}

export function siteMapLeaveSummary(input: {
  records: ReadonlyArray<SiteMapLeaveRecord> | null | undefined
  dayKey: string
  timeZone?: string | null
  nonWorkingDayKeys?: ReadonlyArray<string> | null
  roster?: ReadonlyArray<SiteMapLeavePerson> | null
  operatives?: ReadonlyArray<SiteMapLeaveOperative> | null
}): SiteMapLeaveSummary {
  const onDay = dailyOverviewLeaveRows(input.records, input.dayKey, input.timeZone, input.nonWorkingDayKeys)
  const roster = (input.roster || []).filter((row) => row && idKey(row.id))
  // Every id and email of every roster person, to the person's key (their own id, lower case).
  const byId = new Map<string, { key: string; name: string | null }>()
  const byEmail = new Map<string, { key: string; name: string | null }>()
  for (const row of roster) {
    const owner = { key: `person:${idKey(row.id)}`, name: (row.name ?? '').trim() || null }
    for (const id of personIdSet(row, roster)) {
      const k = idKey(id)
      if (k && !byId.has(k)) byId.set(k, owner)
    }
    const email = idKey(row.email)
    if (email && !byEmail.has(email)) byEmail.set(email, owner)
  }
  const operativeById = new Map<string, SiteMapLeaveOperative>()
  for (const row of input.operatives || []) if (row && idKey(row.id)) operativeById.set(idKey(row.id), row)

  const resolve = (record: SiteMapLeaveRecord): { key: string; name: string | null } | null => {
    for (const raw of [record.userId, record.operativeId]) {
      const k = idKey(raw)
      if (!k) continue
      const hit = byId.get(k) ?? byEmail.get(k)
      if (hit) return hit
      const operative = operativeById.get(k)
      if (operative) {
        const viaEmail = byEmail.get(idKey(operative.email))
        if (viaEmail) return viaEmail
        return { key: `operative:${k}`, name: (operative.name ?? '').trim() || null }
      }
    }
    const fallback = idKey(record.userId) || idKey(record.operativeId)
    return fallback ? { key: `id:${fallback}`, name: null } : null
  }

  const people: SiteMapLeaveSummary['people'] = []
  const index = new Map<string, number>()
  onDay.forEach((record, position) => {
    const owner = resolve(record) ?? { key: `record:${String(record.id ?? position)}`, name: null }
    const recordId = String(record.id ?? '').trim()
    const at = index.get(owner.key)
    if (at === undefined) {
      index.set(owner.key, people.length)
      people.push({ key: owner.key, name: owner.name, recordIds: recordId ? [recordId] : [] })
    } else if (recordId) {
      people[at].recordIds.push(recordId)
    }
  })
  return { onAnnualLeave: people.length, people }
}
