/**
 * Pure decisions for `scripts/report-job-collection-mismatch.mjs` (READ-ONLY report, never writes).
 *
 * Rulebook §21 / `jobKind(doc, collection)`: the collection decides whether a job is a project or a small works job.
 * A job the owner thinks of as small works but stored in `projects` therefore lists under Projects (and in the My
 * Projects ⚙ picker) on web and iOS alike. This plan finds, for one organisation:
 *   (a) `projects` documents whose `jobType` or `customJobType` says Small Works (`jobKind(doc, null)` read without
 *       the collection, the rulebook's own job-type test);
 *   (b) ids stored in both `projects` and `smallWorks` (`jobIdsInBothCollections`);
 *   (c) the document count per collection (the legacy placeholder document, `isLegacyPlaceholderDocumentId`, counted
 *       apart);
 *   (d) job numbers used in both collections under different ids (a copy that was saved with a new id).
 * Also listed, for completeness: `smallWorks` documents typed as something other than Small Works (harmless — they
 * list under Small works — but they show which writer saved them).
 */

export const JOB_COLLECTIONS = ['projects', 'smallWorks']

/** Functions the plan calls from the packed rulebook. */
export const RULEBOOK_FUNCTIONS = ['jobKind', 'jobIdsInBothCollections', 'isLegacyPlaceholderDocumentId', 'documentInstantMs']

const text = (value) => (value === null || value === undefined ? '' : String(value).trim())
const key = (value) => text(value).toLowerCase()

function isoOf(rulebook, value) {
  const ms = value === undefined || value === null ? null : rulebook.documentInstantMs(value)
  return typeof ms === 'number' && Number.isFinite(ms) ? new Date(ms).toISOString() : ''
}

/** Whether a stored job-type text means Small Works, by the rulebook's own test (`jobKind` without a collection). */
export function typeSaysSmallWorks(rulebook, value) {
  if (!text(value)) return false
  return rulebook.jobKind({ jobType: value }, null) === 'smallWorks'
}

/** One document as a report row (stored values, nothing re-derived). */
export function reportRow(rulebook, collection, doc) {
  const data = doc?.data && typeof doc.data === 'object' ? doc.data : {}
  return {
    collection,
    id: text(doc?.id),
    jobNumber: text(data.jobNumber),
    siteName: text(data.siteName),
    jobType: text(data.jobType),
    customJobType: text(data.customJobType),
    isLive: data.isLive === false ? 'no' : 'yes',
    createdAt: isoOf(rulebook, data.createdAt),
    updatedAt: isoOf(rulebook, data.updatedAt),
    updatedFrom: text(data.updatedFrom),
  }
}

/**
 * The report for one organisation. `input` is `{ projects: [{ id, data }], smallWorks: [{ id, data }] }`.
 * Returns `{ counts, typedSmallWorksInProjects, inBoth, sharedJobNumbers, otherTypeInSmallWorks }`.
 */
export function planOrg(input, rulebook) {
  const split = {}
  const counts = {}
  for (const collection of JOB_COLLECTIONS) {
    const docs = Array.isArray(input?.[collection]) ? input[collection] : []
    const real = docs.filter((doc) => text(doc?.id) && !rulebook.isLegacyPlaceholderDocumentId(text(doc.id)))
    split[collection] = real
    counts[collection] = real.length
    counts[`${collection}Placeholders`] = docs.length - real.length
  }

  const typedSmallWorksInProjects = split.projects
    .filter((doc) => typeSaysSmallWorks(rulebook, doc.data?.jobType) || typeSaysSmallWorks(rulebook, doc.data?.customJobType))
    .map((doc) => reportRow(rulebook, 'projects', doc))

  const otherTypeInSmallWorks = split.smallWorks
    .filter((doc) => text(doc.data?.jobType) && !typeSaysSmallWorks(rulebook, doc.data?.jobType))
    .map((doc) => reportRow(rulebook, 'smallWorks', doc))

  // Copied into this realm: the packed rulebook runs in its own vm context.
  const both = Array.from(
    rulebook.jobIdsInBothCollections(
      split.projects.map((doc) => text(doc.id)),
      split.smallWorks.map((doc) => text(doc.id))
    ) || [],
    (id) => String(id)
  )
  const byKey = (docs) => new Map(docs.map((doc) => [key(doc.id), doc]))
  const projectsById = byKey(split.projects)
  const smallById = byKey(split.smallWorks)
  const inBoth = both.map((id) => ({
    id,
    project: reportRow(rulebook, 'projects', projectsById.get(key(id))),
    smallWorks: reportRow(rulebook, 'smallWorks', smallById.get(key(id))),
  }))

  const bothKeys = new Set(both.map(key))
  const numbers = (docs) => {
    const map = new Map()
    for (const doc of docs) {
      const number = key(doc.data?.jobNumber)
      if (!number || bothKeys.has(key(doc.id))) continue
      if (!map.has(number)) map.set(number, [])
      map.get(number).push(doc)
    }
    return map
  }
  const projectNumbers = numbers(split.projects)
  const smallNumbers = numbers(split.smallWorks)
  const sharedJobNumbers = []
  for (const [number, projectDocs] of projectNumbers) {
    const smallDocs = smallNumbers.get(number)
    if (!smallDocs) continue
    sharedJobNumbers.push({
      jobNumber: text(projectDocs[0].data?.jobNumber),
      projects: projectDocs.map((doc) => reportRow(rulebook, 'projects', doc)),
      smallWorks: smallDocs.map((doc) => reportRow(rulebook, 'smallWorks', doc)),
    })
  }

  return { counts, typedSmallWorksInProjects, inBoth, sharedJobNumbers, otherTypeInSmallWorks }
}

const TABLE_COLUMNS = ['collection', 'id', 'jobNumber', 'siteName', 'jobType', 'customJobType', 'isLive', 'updatedFrom', 'updatedAt']

function table(rows) {
  if (rows.length === 0) return '    (none)'
  const width = (column) => Math.min(40, Math.max(column.length, ...rows.map((row) => String(row[column] ?? '').length)))
  const widths = TABLE_COLUMNS.map(width)
  const line = (cells) => '    ' + cells.map((cell, i) => String(cell ?? '').slice(0, widths[i]).padEnd(widths[i])).join('  ')
  return [line(TABLE_COLUMNS), line(widths.map((w) => '-'.repeat(w))), ...rows.map((row) => line(TABLE_COLUMNS.map((c) => row[c])))].join('\n')
}

/** Readable text for one organisation. */
export function formatReport(orgId, orgName, plan) {
  const c = plan.counts
  const out = []
  out.push(`Organisation ${orgId}${orgName ? ` (${orgName})` : ''}`)
  out.push(
    `  (c) Documents: projects ${c.projects}, smallWorks ${c.smallWorks}` +
      (c.projectsPlaceholders || c.smallWorksPlaceholders
        ? ` (plus placeholder documents: projects ${c.projectsPlaceholders}, smallWorks ${c.smallWorksPlaceholders})`
        : '')
  )
  out.push(`  (a) projects documents typed Small Works — these list under Projects on web and iPhone: ${plan.typedSmallWorksInProjects.length}`)
  out.push(table(plan.typedSmallWorksInProjects))
  out.push(`  (b) ids stored in BOTH projects and smallWorks — listed under Projects AND Small works: ${plan.inBoth.length}`)
  out.push(table(plan.inBoth.flatMap((pair) => [pair.project, pair.smallWorks])))
  out.push(`  (d) job numbers in both collections under different ids: ${plan.sharedJobNumbers.length}`)
  out.push(table(plan.sharedJobNumbers.flatMap((group) => [...group.projects, ...group.smallWorks])))
  out.push(`  (info) smallWorks documents typed something else (they still list under Small works): ${plan.otherTypeInSmallWorks.length}`)
  out.push(table(plan.otherTypeInSmallWorks))
  return out.join('\n')
}

export const CSV_COLUMNS = ['orgId', 'finding', 'collection', 'id', 'jobNumber', 'siteName', 'jobType', 'customJobType', 'isLive', 'createdAt', 'updatedAt', 'updatedFrom']

const csvCell = (value) => {
  const s = String(value ?? '')
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** CSV lines (no header) for one organisation: one line per document in a finding. */
export function csvLines(orgId, plan) {
  const lines = []
  const push = (finding, row) => lines.push(CSV_COLUMNS.map((column) => csvCell(column === 'orgId' ? orgId : column === 'finding' ? finding : row[column])).join(','))
  for (const row of plan.typedSmallWorksInProjects) push('a_projects_typed_small_works', row)
  for (const pair of plan.inBoth) {
    push('b_id_in_both', pair.project)
    push('b_id_in_both', pair.smallWorks)
  }
  for (const group of plan.sharedJobNumbers) for (const row of [...group.projects, ...group.smallWorks]) push('d_job_number_in_both', row)
  for (const row of plan.otherTypeInSmallWorks) push('info_small_works_other_type', row)
  return lines
}

export const csvHeader = () => CSV_COLUMNS.join(',')
