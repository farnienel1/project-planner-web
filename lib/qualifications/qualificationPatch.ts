/**
 * What one qualifications save changes on an `operatives` row (owner issue 16; reviews of #415).
 *
 * A three-way change: `baseline` is the row as the editor loaded it, `draft` is the person's edited copy and `live`
 * is the row in the store now (it may hold changes another device made after the editor loaded). Only what the
 * person changed against the baseline is written:
 * - a map key is set when the draft's value differs from the baseline's;
 * - a map key is deleted only when the baseline had it and the draft does not (a cleared expiry, a removed
 *   certificate, or a date / link moved to another spelling of the same id); a renewed certificate also deletes the
 *   live row's other spellings of that same id, so no reader keeps opening the old file (the old Storage object is
 *   kept, §24);
 * - a key the baseline did not have is never deleted, and a qualification or spelling the person did not act on is
 *   never written;
 * - the assignment list is the live list with the person's additions and changes laid over it and their removals
 *   taken out (each row in the rulebook's write shape, `assignedQualificationWriteFields`).
 * Ids and keys compare without case where they name the same qualification.
 */
import type { Operative, Qualification } from '@/types'
import { assignedQualificationWriteFields } from '@/lib/canonical/operativeQualifications'
import { canonicalCertificateUrls } from '@/lib/qualifications/certificateUpload'
import type { QualificationMapWrite } from '@/lib/qualifications/personQualifications'

export type OperativeQualificationPatch = {
  /** The assignment list to write (the live list with the person's changes). */
  qualifications: Qualification[]
  /** The live maps with this save's writes applied (for the store's in-memory row). */
  qualificationExpiryDates: Record<string, Date>
  qualificationCertificateURLs: Record<string, string>
  /** Field-path changes of the two maps; empty when the person changed nothing in them. */
  mapWrites: QualificationMapWrite[]
  /** Whether the assignment list differs from the live list (only then is it written). */
  qualificationsChanged: boolean
}

function key(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

function validDate(value: unknown): Date | undefined {
  return value instanceof Date && !Number.isNaN(value.getTime()) ? value : undefined
}

function sameDate(a: unknown, b: unknown): boolean {
  const x = validDate(a)
  const y = validDate(b)
  return x && y ? x.getTime() === y.getTime() : !x && !y
}

function sameUrl(a: unknown, b: unknown): boolean {
  const x = typeof a === 'string' ? a.trim() : ''
  const y = typeof b === 'string' ? b.trim() : ''
  return x === y
}

function rowFingerprint(row: Qualification | undefined): string {
  const write = assignedQualificationWriteFields(row)
  if (!write) return ''
  return JSON.stringify([write.id, write.name, write.hasEndDate, write.endDateIso || ''])
}

function mapWritesFor<T>(input: {
  field: QualificationMapWrite['field']
  baseline: Record<string, T>
  draft: Record<string, T>
  live: Record<string, T>
  same: (a: unknown, b: unknown) => boolean
  present: (value: unknown) => boolean
  /** Also delete the live row's other spellings of an id the person set (certificates). */
  supersedeLiveSpellings: boolean
}): QualificationMapWrite[] {
  const writes: QualificationMapWrite[] = []
  const deleted = new Set<string>()
  const setKeys = new Set<string>()
  for (const [k, value] of Object.entries(input.draft)) {
    if (!k.trim() || !input.present(value)) continue
    if (input.same(input.baseline[k], value)) continue
    writes.push({ field: input.field, key: k, value } as QualificationMapWrite)
    setKeys.add(k)
  }
  const drop = (k: string) => {
    if (!k.trim() || deleted.has(k) || setKeys.has(k)) return
    deleted.add(k)
    writes.push({ field: input.field, key: k, delete: true })
  }
  for (const [k, value] of Object.entries(input.baseline)) {
    if (!input.present(value)) continue
    if (input.present(input.draft[k])) continue
    drop(k)
    // A removed certificate also goes under the live row's other spellings of that id (mixed web / iOS keys),
    // so the stored link cannot come back on the next load.
    if (input.supersedeLiveSpellings) {
      for (const liveKey of Object.keys(input.live)) {
        if (liveKey !== k && key(liveKey) === key(k)) drop(liveKey)
      }
    }
  }
  if (input.supersedeLiveSpellings) {
    for (const setKey of setKeys) {
      for (const liveKey of Object.keys(input.live)) {
        if (liveKey !== setKey && key(liveKey) === key(setKey)) drop(liveKey)
      }
    }
  }
  return writes
}

function applyWrites<T>(live: Record<string, T>, writes: QualificationMapWrite[], field: QualificationMapWrite['field']): Record<string, T> {
  const next: Record<string, T> = { ...live }
  for (const write of writes) {
    if (write.field !== field) continue
    if ('delete' in write) delete next[write.key]
    else next[write.key] = write.value as T
  }
  return next
}

export function operativeQualificationPatch(input: {
  /** The row as the editor loaded it. Missing: the live row (no edits made elsewhere can be told apart). */
  baseline?: Operative
  draft: Operative
  /** The row in the store now; missing for a row not created yet. */
  live?: Operative
}): OperativeQualificationPatch {
  const live = input.live
  const baseline = input.baseline ?? live
  const draft = input.draft

  // The assignment list: live, less what the person removed, with what they added or changed laid over it.
  const baselineRows = new Map((baseline?.qualifications || []).map((row) => [key(row?.id), row]))
  const draftRows = new Map((draft.qualifications || []).map((row) => [key(row?.id), row]))
  const removed = new Set([...baselineRows.keys()].filter((id) => id && !draftRows.has(id)))
  const changed = new Map(
    [...draftRows.entries()].filter(([id, row]) => id && rowFingerprint(row) !== rowFingerprint(baselineRows.get(id)))
  )
  const qualifications: Qualification[] = []
  const seen = new Set<string>()
  for (const row of live?.qualifications || []) {
    const id = key(row?.id)
    if (!id || seen.has(id) || removed.has(id)) continue
    seen.add(id)
    qualifications.push(changed.get(id) ?? row)
  }
  for (const [id, row] of changed) {
    if (seen.has(id)) continue
    seen.add(id)
    qualifications.push(row)
  }
  const liveFingerprint = (live?.qualifications || []).map(rowFingerprint).join('|')
  const qualificationsChanged = !live || qualifications.map(rowFingerprint).join('|') !== liveFingerprint

  // Certificate links compared in one spelling per qualification on both sides, so an id stored in another letter
  // case than its assignment is never read as a change.
  const baselineUrls = canonicalCertificateUrls(baseline?.qualifications || [], baseline?.qualificationCertificateURLs)
  const draftUrls = canonicalCertificateUrls(draft.qualifications || [], draft.qualificationCertificateURLs)
  const liveExpiry = live?.qualificationExpiryDates || {}
  const liveUrls = live?.qualificationCertificateURLs || {}

  const mapWrites = [
    ...mapWritesFor<Date>({
      field: 'qualificationExpiryDates',
      baseline: baseline?.qualificationExpiryDates || {},
      draft: draft.qualificationExpiryDates || {},
      live: liveExpiry,
      same: sameDate,
      present: (value) => Boolean(validDate(value)),
      supersedeLiveSpellings: false,
    }),
    ...mapWritesFor<string>({
      field: 'qualificationCertificateURLs',
      baseline: baselineUrls,
      draft: draftUrls,
      live: liveUrls,
      same: sameUrl,
      present: (value) => typeof value === 'string' && value.trim().length > 0,
      supersedeLiveSpellings: true,
    }),
  ]

  return {
    qualifications,
    qualificationExpiryDates: applyWrites(liveExpiry, mapWrites, 'qualificationExpiryDates'),
    qualificationCertificateURLs: applyWrites(liveUrls, mapWrites, 'qualificationCertificateURLs'),
    mapWrites,
    qualificationsChanged,
  }
}
