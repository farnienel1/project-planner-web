/**
 * Pure decisions for `scripts/remove-duplicate-project-copy.mjs` (one-off, owner-run; dry run by default).
 *
 * Rulebook §17 "Job kind": older iOS builds saved some jobs under one id in BOTH `projects` and `smallWorks`
 * (`jobIdsInBothCollections`). The collection decides the kind (`jobKind`), so such a job lists under Projects and
 * under Small works. This plan decides whether one copy (by default the `projects` copy) may be deleted, and lists
 * everything that still refers to the job, so the owner can see what — if anything — points at the copy that goes.
 *
 * It never decides to rewrite a record: the only write the script makes is the delete of the removed copy and its
 * subcollections. References that carry the removed copy's collection label (a booking `jobCollection`, a
 * `settings/*_{collection}_{KEY}` document) block `--apply` unless the owner passes `--force-refs`.
 */

export const JOB_COLLECTIONS = ['projects', 'smallWorks']

/** Functions the plan calls from the packed rulebook. */
export const RULEBOOK_FUNCTIONS = [
  'jobIdsInBothCollections',
  'normalizeDocumentId',
  'bookingJobId',
  'deadlineProjectKey',
  'deadlinesDocumentId',
  'healthSafetyDocumentIds',
  'isLegacyPlaceholderDocumentId',
  'documentInstantMs',
  'jobManagerIds',
]

/** Booking collections: a booking that names the removed copy's collection in `jobCollection` blocks `--apply`. */
export const BOOKING_COLLECTIONS = ['bookings', 'managerSiteBookings', 'subcontractorBookings']

/** Other job-scoped collections, with the field that holds the job id (stored case; compared without case). */
export const RECORD_COLLECTIONS = {
  materials: 'projectId',
  materialSendRecords: 'projectId',
  tasks: 'projectId',
  siteAudits: 'projectId',
  variations: 'parentId',
  variationTrackers: 'parentId',
}

export const PICKS_COLLECTION = 'worksListPicks'

/** Every collection the script reads whole for references (besides the two job collections, `settings` and the
 * `notifications` read by `relatedId`). */
export const REFERENCE_COLLECTIONS = [...BOOKING_COLLECTIONS, ...Object.keys(RECORD_COLLECTIONS), PICKS_COLLECTION]

const text = (value) => (value === null || value === undefined ? '' : String(value).trim())

/** `--keep` → `{ keep, remove }`; null for anything else. */
export function keepAndRemove(keep) {
  const value = text(keep) || 'smallWorks'
  if (!JOB_COLLECTIONS.includes(value)) return null
  return { keep: value, remove: value === 'projects' ? 'smallWorks' : 'projects' }
}

/**
 * The `settings` document ids to read for one job: health & safety (`healthSafetyDocumentIds`, both the shared
 * upper-cased key and the stored-case id older web builds wrote) and deadlines (`deadlinesDocumentId`) for both
 * kinds, the variation settings log `variations_{jobId}`, and `deadlineAssignments` (its `projects.{KEY}` map entry).
 */
export function settingsDocumentIds(rulebook, jobIds) {
  const ids = []
  const spellings = [...new Set((Array.isArray(jobIds) ? jobIds : [jobIds]).map(text).filter(Boolean))]
  for (const jobId of spellings) {
    for (const isSmallWorks of [false, true]) {
      ids.push(...Array.from(rulebook.healthSafetyDocumentIds(jobId, isSmallWorks), String))
      ids.push(String(rulebook.deadlinesDocumentId(jobId, isSmallWorks)))
    }
    ids.push(`variations_${jobId}`)
  }
  ids.push('deadlineAssignments')
  return [...new Set(ids)]
}

/** Every spelling of the job id the two copies carry (stored case, upper, lower), for id-keyed reads. */
export function jobIdSpellings(...ids) {
  const out = new Set()
  for (const id of ids.map(text).filter(Boolean)) {
    out.add(id)
    out.add(id.toUpperCase())
    out.add(id.toLowerCase())
  }
  return [...out]
}

/** Fields compared between the two copies in the dry run. */
export const DIFF_FIELDS = [
  'jobNumber',
  'siteName',
  'jobType',
  'customJobType',
  'isLive',
  'managerIds',
  'managerId',
  'managerUserIds',
  'assignedManagerUserIds',
  'hiddenOperativeUserIds',
  'client',
  'clientId',
  'clientName',
  'addressLine1',
  'addressLine2',
  'townCity',
  'postcode',
  'siteAddress',
  'latitude',
  'longitude',
  'startDate',
  'endDate',
  'startDayKey',
  'endDayKey',
  'createdAt',
  'updatedAt',
  'updatedFrom',
]

const DATE_FIELDS = new Set(['startDate', 'endDate', 'createdAt', 'updatedAt'])

/** A stored value as comparable, readable text (dates as ISO instants through `documentInstantMs`). */
export function fieldText(rulebook, field, value) {
  if (value === undefined) return '(missing)'
  if (value === null) return 'null'
  if (DATE_FIELDS.has(field)) {
    // A Date or Timestamp from this realm is read here: the packed rulebook runs in its own vm context.
    const ms =
      typeof value?.getTime === 'function' ? value.getTime() : typeof value?.toMillis === 'function' ? value.toMillis() : rulebook.documentInstantMs(value)
    if (typeof ms === 'number' && Number.isFinite(ms)) return new Date(ms).toISOString()
  }
  if (typeof value === 'object') {
    const plain = (v) =>
      v && typeof v === 'object'
        ? Array.isArray(v)
          ? v.map(plain)
          : Object.fromEntries(Object.keys(v).sort().map((k) => [k, plain(v[k])]))
        : v
    return JSON.stringify(plain(value))
  }
  return JSON.stringify(value)
}

/**
 * The two copies side by side: `{ rows: [{ field, kept, removed, same }], managersOnlyOnRemoved }`.
 * `managersOnlyOnRemoved` are `jobManagerIds` of the removed copy that the kept copy does not list (ids without
 * case). The security rules' job-manager test (`callerManagesJobAt`) reads either copy, so such a manager would lose
 * booking access when the removed copy goes.
 */
export function copyDiff(rulebook, kept, removed) {
  const k = kept?.data && typeof kept.data === 'object' ? kept.data : {}
  const r = removed?.data && typeof removed.data === 'object' ? removed.data : {}
  const rows = DIFF_FIELDS.map((field) => {
    const keptText = fieldText(rulebook, field, k[field])
    const removedText = fieldText(rulebook, field, r[field])
    return { field, kept: keptText, removed: removedText, same: keptText === removedText }
  })
  const keptManagers = new Set(Array.from(rulebook.jobManagerIds(k) || [], (id) => rulebook.normalizeDocumentId(id)))
  const managersOnlyOnRemoved = Array.from(rulebook.jobManagerIds(r) || [], String).filter((id) => !keptManagers.has(rulebook.normalizeDocumentId(id)))
  return { rows, managersOnlyOnRemoved }
}

/**
 * What is stored under the removed copy: `[{ path, fields: [{ name, rows }] }]`, `rows` the length of an array field
 * (else null). A document with any field is a blocker for `--apply` (the owner decides).
 */
export function describeDescendants(subcollectionDocs) {
  return (Array.isArray(subcollectionDocs) ? subcollectionDocs : []).map((doc) => {
    const data = doc?.data && typeof doc.data === 'object' ? doc.data : {}
    return {
      path: String(doc.path),
      fields: Object.keys(data)
        .sort()
        .map((name) => ({ name, rows: Array.isArray(data[name]) ? data[name].length : null })),
    }
  })
}

/** Which job collection a settings document id belongs to (`projects`, `smallWorks`) or null. */
export function settingsDocumentCollection(id) {
  const match = /^(?:healthSafety|deadlines)_(projects|smallWorks)_/.exec(text(id))
  return match ? match[1] : null
}

/** The collection label a record carries (stored text), or `(none)`. */
export function collectionLabel(data) {
  const row = data && typeof data === 'object' ? data : {}
  const parts = []
  if (text(row.jobCollection)) parts.push(`jobCollection=${text(row.jobCollection)}`)
  if (text(row.locationType)) parts.push(`locationType=${text(row.locationType)}`)
  if (text(row.parentType)) parts.push(`parentType=${text(row.parentType)}`)
  if (text(row.projectType)) parts.push(`projectType=${text(row.projectType)}`)
  if (typeof row.isSmallWorks === 'boolean') parts.push(`isSmallWorks=${row.isSmallWorks}`)
  return parts.length ? parts.join(' ') : '(none)'
}

function summarise(rows) {
  const labels = {}
  for (const row of rows) labels[row.label] = (labels[row.label] || 0) + 1
  return { count: rows.length, labels, rows }
}

/** The documents of `docs` whose id equals `jobId` without case (the rulebook's id rule). */
function sameId(rulebook, docs, jobId) {
  const want = rulebook.normalizeDocumentId(jobId)
  return (Array.isArray(docs) ? docs : []).filter((doc) => rulebook.normalizeDocumentId(doc?.id) === want)
}

/**
 * Find the two copies. `jobs` = `{ projects: [{ id, data }], smallWorks: [{ id, data }] }` (the documents whose id
 * matches the job id without case is enough). Returns
 * `{ state, keep, remove, kept, removed, message }` with `state`:
 *   - `ready`         — the id is in both collections (`jobIdsInBothCollections`); `removed` / `kept` are the docs;
 *   - `already-done`  — only the kept copy is left (a second run): nothing to do;
 *   - `refused`       — anything else (bad `--keep`, the id in neither, only in the collection to remove, or more
 *                       than one document per collection matches without case).
 */
export function locateCopies(rulebook, { jobId, keep, jobs }) {
  const sides = keepAndRemove(keep)
  if (!sides) return { state: 'refused', message: `--keep must be "smallWorks" or "projects", not "${text(keep)}".` }
  if (!text(jobId)) return { state: 'refused', message: '--job needs a job id.' }
  if (rulebook.isLegacyPlaceholderDocumentId(text(jobId))) return { state: 'refused', message: `"${text(jobId)}" is the placeholder document id, not a job.` }
  const found = {}
  for (const collection of JOB_COLLECTIONS) {
    const matches = sameId(rulebook, jobs?.[collection], jobId)
    if (matches.length > 1) {
      return {
        state: 'refused',
        ...sides,
        message: `${collection} has ${matches.length} documents whose id is "${text(jobId)}" in another letter case (${matches.map((d) => d.id).join(', ')}). Refusing: decide by hand.`,
      }
    }
    found[collection] = matches[0] || null
  }
  const kept = found[sides.keep]
  const removed = found[sides.remove]
  const both = Array.from(
    rulebook.jobIdsInBothCollections(found.projects ? [found.projects.id] : [], found.smallWorks ? [found.smallWorks.id] : []) || [],
    String
  )
  if (both.length === 1 && kept && removed) return { state: 'ready', ...sides, kept, removed, message: '' }
  if (kept && !removed) {
    return { state: 'already-done', ...sides, kept, removed: null, message: `The job is only in ${sides.keep} (${kept.id}). Nothing to do.` }
  }
  if (removed && !kept) {
    return {
      state: 'refused',
      ...sides,
      kept: null,
      removed,
      message: `The job is only in ${sides.remove}, not in ${sides.keep}. Deleting it would remove the job. Refusing.`,
    }
  }
  return { state: 'refused', ...sides, kept: null, removed: null, message: `The job "${text(jobId)}" is in neither projects nor smallWorks of this organisation.` }
}

/**
 * Everything that still refers to the job. `refs` = `{ [collection]: [{ id, data }] }` for `REFERENCE_COLLECTIONS`
 * and `settings: [{ id, data, exists }]` for `settingsDocumentIds`. `removedCollection` is the collection of the copy
 * being deleted. Returns `{ collections, settings, picks, deadlineAssignment, blockers }`.
 */
export function planReferences(rulebook, { jobId, removedCollection, refs }) {
  const want = rulebook.normalizeDocumentId(jobId)
  const matchesJob = (value) => want !== '' && rulebook.normalizeDocumentId(value) === want
  const blockers = []
  const collections = {}

  for (const collection of BOOKING_COLLECTIONS) {
    const rows = []
    for (const doc of Array.isArray(refs?.[collection]) ? refs[collection] : []) {
      const data = doc?.data && typeof doc.data === 'object' ? doc.data : {}
      const jobOf = rulebook.bookingJobId({ collection, ...data })
      // Older labour bookings stored the job under `projectID`; the security rules read it too.
      const legacy = collection === 'bookings' && !matchesJob(jobOf) && matchesJob(data.projectID)
      if (!matchesJob(jobOf) && !legacy) continue
      const label = legacy ? `${collectionLabel(data)} (job in projectID)` : collectionLabel(data)
      const row = { id: text(doc.id), jobId: text(legacy ? data.projectID : jobOf), jobCollection: text(data.jobCollection), label }
      rows.push(row)
      if (row.jobCollection === removedCollection) {
        blockers.push(`${collection}/${row.id} carries jobCollection "${removedCollection}" (the copy being removed).`)
      }
    }
    collections[collection] = summarise(rows)
  }

  for (const [collection, field] of Object.entries(RECORD_COLLECTIONS)) {
    const rows = []
    for (const doc of Array.isArray(refs?.[collection]) ? refs[collection] : []) {
      const data = doc?.data && typeof doc.data === 'object' ? doc.data : {}
      // A variation tracker's document id is the job id; older trackers may lack `parentId`.
      const ids = collection === 'variationTrackers' ? [data[field], doc?.id] : [data[field]]
      if (!ids.some(matchesJob)) continue
      rows.push({ id: text(doc.id), jobId: text(data[field]) || text(doc.id), label: collectionLabel(data) })
    }
    collections[collection] = summarise(rows)
  }

  const notifications = []
  for (const doc of Array.isArray(refs?.notifications) ? refs.notifications : []) {
    const data = doc?.data && typeof doc.data === 'object' ? doc.data : {}
    if (matchesJob(data.relatedId)) notifications.push({ id: text(doc.id), type: text(data.type) || '(none)' })
  }
  collections.notifications = summarise(notifications.map((row) => ({ ...row, label: `type=${row.type}` })))

  const picks = []
  for (const doc of Array.isArray(refs?.[PICKS_COLLECTION]) ? refs[PICKS_COLLECTION] : []) {
    const data = doc?.data && typeof doc.data === 'object' ? doc.data : {}
    for (const list of JOB_COLLECTIONS) {
      if (Array.isArray(data[list]) && data[list].some(matchesJob)) picks.push({ uid: text(doc.id), list })
    }
  }

  const settings = []
  let deadlineAssignment = null
  for (const doc of Array.isArray(refs?.settings) ? refs.settings : []) {
    const id = text(doc?.id)
    const data = doc?.data && typeof doc.data === 'object' ? doc.data : {}
    if (id === 'deadlineAssignments') {
      const map = data.projects && typeof data.projects === 'object' ? data.projects : {}
      const keys = Object.keys(map).filter(matchesJob)
      if (keys.length) deadlineAssignment = { keys }
      continue
    }
    if (!doc?.exists) continue
    const fieldCount = Object.keys(data).length
    const collection = settingsDocumentCollection(id)
    const label = collection ? `${collection} copy` : `variation log (parentType=${text(data.parentType) || '(none)'})`
    settings.push({ id, fieldCount, collection, label })
    if (collection === removedCollection && fieldCount > 0) {
      blockers.push(`settings/${id} holds data (${fieldCount} field(s)) for the ${removedCollection} copy.`)
    }
  }

  return { collections, settings, picks, deadlineAssignment, blockers }
}

/**
 * The full decision. `copies` from `locateCopies`; `references` from `planReferences`; `diff` from `copyDiff`;
 * `subcollectionDocs` the removed copy's descendant documents (`[{ path, data }]`). `apply` / `forceRefs` are the CLI
 * flags. Blockers (each overridable only with `--force-refs`): the reference blockers, any descendant document that
 * holds fields, and any manager id only the removed copy lists. Returns
 * `{ canApply, refusal, blockers, descendants, deletePaths }`: the paths to delete, deepest first, the copy last.
 */
export function planRemoval({ copies, references, diff, removedPath, subcollectionDocs = [], apply = false, forceRefs = false }) {
  if (!copies || copies.state !== 'ready') return { canApply: false, refusal: copies?.message || 'Not ready.', blockers: [], descendants: [], deletePaths: [] }
  const depth = (p) => String(p).split('/').length
  const deletePaths = [...new Set(subcollectionDocs.map((doc) => String(doc.path)))].sort((a, b) => depth(b) - depth(a) || a.localeCompare(b))
  deletePaths.push(removedPath)
  const descendants = describeDescendants(subcollectionDocs)
  const blockers = [...(references?.blockers || [])]
  for (const doc of descendants) {
    if (doc.fields.length > 0) blockers.push(`${doc.path} holds data (${doc.fields.map((f) => f.name).join(', ')}) and would be deleted with the ${copies.remove} copy.`)
  }
  for (const id of diff?.managersOnlyOnRemoved || []) {
    blockers.push(`Manager id ${id} is on the ${copies.remove} copy but not on the ${copies.keep} copy: they could lose access to this job's bookings.`)
  }
  if (blockers.length > 0 && !forceRefs) {
    return {
      canApply: false,
      refusal: `${blockers.length} blocker(s) listed above. --apply is refused; the owner decides (re-run with --force-refs to delete anyway — no other record is ever rewritten).`,
      blockers,
      descendants,
      deletePaths,
    }
  }
  return { canApply: Boolean(apply), refusal: apply ? '' : 'Dry run: nothing was written. Re-run with --apply to delete.', blockers, descendants, deletePaths }
}

/** Readable report. */
export function formatPlan({ orgId, jobId, copies, references, diff, removal, row }) {
  const out = []
  out.push(`Organisation ${orgId} — job ${jobId}`)
  if (copies.state !== 'ready') {
    out.push(`  ${copies.message}`)
    return out.join('\n')
  }
  out.push(`  Keep:   ${copies.keep}/${copies.kept.id}  ${row(copies.kept)}`)
  out.push(`  Remove: ${copies.remove}/${copies.removed.id}  ${row(copies.removed)}`)
  if (diff) {
    const changed = diff.rows.filter((r) => !r.same)
    out.push(`  Field differences between the copies (${changed.length} of ${diff.rows.length} compared):`)
    if (changed.length === 0) out.push('    (none)')
    for (const r of changed) {
      out.push(`    ${r.field}:`)
      out.push(`      keep   ${r.kept}`)
      out.push(`      remove ${r.removed}`)
    }
  }
  out.push('  References to this job id (compared without case):')
  for (const [collection, summary] of Object.entries(references.collections)) {
    const labels = Object.entries(summary.labels).map(([label, n]) => `${label}: ${n}`).join('; ')
    out.push(`    ${collection.padEnd(22)} ${String(summary.count).padStart(4)}${labels ? `   (${labels})` : ''}`)
  }
  out.push(`    ${'settings'.padEnd(22)} ${String(references.settings.length).padStart(4)}`)
  for (const s of references.settings) out.push(`      settings/${s.id} — ${s.label}, ${s.fieldCount} field(s)`)
  out.push(
    `    ${'deadlineAssignments'.padEnd(22)} ${references.deadlineAssignment ? `projects.${references.deadlineAssignment.keys.join(', projects.')}` : '(none)'}`
  )
  out.push(`    ${PICKS_COLLECTION.padEnd(22)} ${String(references.picks.length).padStart(4)}`)
  for (const p of references.picks) out.push(`      ${PICKS_COLLECTION}/${p.uid} — in its ${p.list} list`)
  out.push(`  Stored under the ${copies.remove} copy (subcollection documents): ${removal.descendants.length}`)
  for (const d of removal.descendants) {
    const fields = d.fields.map((f) => (f.rows === null ? f.name : `${f.name} [${f.rows} row(s)]`)).join(', ')
    out.push(`    ${d.path} — ${fields || '(no fields)'}`)
  }
  out.push(`  Will delete ${removal.deletePaths.length} document(s) (the ${copies.remove} copy and its subcollections):`)
  for (const p of removal.deletePaths) out.push(`    ${p}`)
  if (removal.blockers.length) {
    out.push('  Blocking --apply:')
    for (const b of removal.blockers) out.push(`    - ${b}`)
  } else {
    out.push('  Blocking --apply: none — no booking or settings document names the removed copy, nothing is stored under it, and every manager on it is on the kept copy.')
  }
  out.push(`  The ${copies.keep} copy is never touched. No record above is rewritten.`)
  return out.join('\n')
}
