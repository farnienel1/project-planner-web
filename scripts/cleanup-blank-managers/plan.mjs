/**
 * The pure part of `scripts/cleanup-blank-managers.mjs`: which `organizations/{orgId}/managers` rows are the junk
 * "Assigned manager" rows older iPhone builds created, and the partial update that takes each one off a job.
 *
 * How the junk rows were made (iOS before #185, e.g. commit 3fca324): editing a project or small works whose stored
 * manager id was not in the loaded `managers` list, `EditProjectView.hydrateAssignedManagers` put in a stand-in
 * `Manager(id: <stored id>, firstName: "Assigned", lastName: "manager", email: "", mobileNumber: "")`. On save,
 * `ProjectManagerPickerSupport.resolveManagersForSave` looked for a managers row with the same email (""); with none,
 * `OperativeStore.addManager` created `organizations/{orgId}/managers/{UUID upper case}` with `firstName: "Assigned"`,
 * `lastName: "manager"`, `email: ""`, `mobileNumber: ""`, `department: ""`, `notes: ""`, `tradeTypePreset: ""`,
 * `tradeTypeCustom: ""`, `isActive: true`, `organizationId`, `createdAt` and write metadata (`updatedFrom: "ios"`). Every
 * later edit of a job with another unloaded manager matched that row on the empty email and saved the row's id in
 * `managerIds` / `managerId` instead of the job's real (unloaded) manager.
 *
 * A row is junk only when ALL of: the email is blank or missing; the name reads (`parseManagerDocument`) as exactly
 * "Assigned manager"; no linked-account field; no other details typed in (mobile, phone, notes, department, trade, pay);
 * its id is not a users account of the organisation (id, `formerUserIds`, `sameEmailUserIds`, or the iOS
 * `stableManagerId` of one); and no manager site booking uses it. A blank-email row that fails any test is listed as
 * "ambiguous" and is never changed.
 *
 * Rulebook functions read from the packed script (read only): `jobManagerIds` (every manager field on a job:
 * `managerIds`, `managerId`, `assignedManagerUserIds`, `managerUserIds`), `stableManagerId` (how iOS stores a managers
 * row id on a job), `jobManagerRemovalWrites` (the job updates, 1.31.0 §11), `parseManagerDocument`,
 * `parseJobDocument` (job number and site name for the report) and `writeMetadataFields` (used by the runner). No
 * shared rule is added or changed.
 */

export const PLACEHOLDER_MANAGER_NAME = 'assigned manager'
export const JOB_COLLECTIONS = ['projects', 'smallWorks']
/** Functions this clean-up reads from the packed rulebook. */
export const RULEBOOK_FUNCTIONS = [
  'jobManagerIds',
  'jobManagerRemovalWrites',
  'stableManagerId',
  'parseManagerDocument',
  'parseJobDocument',
  'writeMetadataFields',
  'rulebookStamp',
]

const LINK_FIELDS = ['linkedUserId', 'linkedUserID', 'userId', 'userID', 'uid']
const DETAIL_FIELDS = ['mobileNumber', 'mobile', 'phone', 'phoneNumber', 'notes', 'department', 'tradeTypePreset', 'tradeTypeCustom']
const PAY_FIELDS = ['dayRate', 'hourlyRate', 'payBasis']

const text = (value) => (typeof value === 'string' ? value.trim() : '')

/** An id compared without case and without the web picker's `user:` prefix. */
export function idKey(value) {
  const key = text(value).toLowerCase()
  return key.startsWith('user:') ? key.slice(5).trim() : key
}

function idList(value) {
  return Array.isArray(value) ? value.filter((item) => typeof item === 'string' && item.trim()) : []
}

/** Every id a users document answers to, as keys: its id, former and same-email ids, and the iOS stable id of each. */
function accountKeys(rulebook, users) {
  const keys = new Set()
  for (const user of users || []) {
    const data = user?.data || {}
    for (const id of [user?.id, ...idList(data.formerUserIds), ...idList(data.sameEmailUserIds)]) {
      if (!text(id)) continue
      keys.add(idKey(id))
      keys.add(idKey(rulebook.stableManagerId(id)))
    }
  }
  keys.delete('')
  return keys
}

/** The keys a job may hold for a managers row: its document id and the iOS stable id of it. */
export function managerRowKeys(rulebook, rowId) {
  return [...new Set([idKey(rowId), idKey(rulebook.stableManagerId(rowId))].filter(Boolean))]
}

/**
 * Sorts the blank-email managers rows into `junk` (safe to remove) and `ambiguous` (listed, never touched).
 * Rows with an email are not looked at. `input`: `{ managers: [{id, data}], users: [{id, data}], siteBookingUserIds }`.
 */
export function classifyManagerRows(rulebook, input) {
  const accounts = accountKeys(rulebook, input.users)
  const siteBookingKeys = new Set((input.siteBookingUserIds || []).map(idKey).filter(Boolean))
  const junk = []
  const ambiguous = []
  for (const row of input.managers || []) {
    const data = row?.data || {}
    if (text(data.email)) continue
    const parsed = rulebook.parseManagerDocument(row.id, data)
    const name = parsed?.name || ''
    const keys = managerRowKeys(rulebook, row.id)
    const why = []
    if (name.replace(/\s+/g, ' ').toLowerCase() !== PLACEHOLDER_MANAGER_NAME) why.push(`name is "${name}", not "Assigned manager"`)
    const links = LINK_FIELDS.filter((field) => text(data[field]))
    if (links.length > 0) why.push(`has a linked account field (${links.join(', ')})`)
    if (keys.some((key) => accounts.has(key))) why.push('its id is a users account of this organisation')
    const details = [...DETAIL_FIELDS.filter((field) => text(data[field])), ...PAY_FIELDS.filter((field) => data[field] != null && data[field] !== '')]
    if (details.length > 0) why.push(`has other details filled in (${details.join(', ')})`)
    if (keys.some((key) => siteBookingKeys.has(key))) why.push('a manager site booking uses its id')
    const entry = { id: row.id, name, keys }
    if (why.length > 0) ambiguous.push({ ...entry, why })
    else junk.push(entry)
  }
  return { junk, ambiguous }
}

/**
 * The partial updates that take the junk ids off the jobs: the rulebook's own `jobManagerRemovalWrites` (1.31.0 §11,
 * the rule the apps use when a manager is deleted), with the junk rows as the "person" being deleted — every junk id
 * and its iOS `stableManagerId` as that person's ids. It takes them out of `managerIds`, `managerId`,
 * `managerUserIds` and `assignedManagerUserIds` without case, removes a list left empty, moves `managerId` to the first
 * manager left or removes it, and leaves every other id as stored. Returns `{ path, collection, jobId, set, remove }[]`
 * (`remove`: field names).
 */
export function jobPatches(rulebook, orgId, junkIds, jobs) {
  const ids = [...new Set(junkIds.flatMap((id) => [id, rulebook.stableManagerId(id)]).filter(Boolean))]
  if (ids.length === 0) return []
  const rows = []
  for (const collection of JOB_COLLECTIONS) {
    for (const job of jobs?.[collection] || []) rows.push({ ...(job.data || {}), id: job.id, collection })
  }
  // JSON round trip: the packed script runs in its own realm, and Firestore takes plain objects of this realm only.
  const writes = rulebook.jobManagerRemovalWrites({
    organizationId: orgId,
    person: { id: ids[0], formerUserIds: ids.slice(1) },
    change: { kind: 'delete' },
    jobs: rows,
    roster: [],
    managers: [],
  })
  return JSON.parse(JSON.stringify(writes))
}

/** A job's stored data after a planned update. */
export function applyPatch(data, patch) {
  const after = { ...(data || {}), ...patch.set }
  for (const field of patch.remove) delete after[field]
  return after
}

/** A display name for a stored manager id: a users account or a managers row, else the id itself. */
function nameLookup(rulebook, input) {
  const names = new Map()
  for (const user of input.users || []) {
    const data = user?.data || {}
    const name = `${text(data.firstName)} ${text(data.surname) || text(data.lastName)}`.trim() || text(data.name) || text(data.email)
    if (!name) continue
    for (const id of [user.id, ...idList(data.formerUserIds), ...idList(data.sameEmailUserIds)]) {
      names.set(idKey(id), name)
      names.set(idKey(rulebook.stableManagerId(id)), name)
    }
  }
  for (const row of input.managers || []) {
    const parsed = rulebook.parseManagerDocument(row.id, row.data || {})
    const name = parsed?.name || parsed?.email || ''
    if (!name) continue
    for (const key of managerRowKeys(rulebook, row.id)) if (!names.has(key)) names.set(key, name)
  }
  return (id) => {
    const name = names.get(idKey(id))
    return name ? `${name} (${id})` : `${id} (not found)`
  }
}

/**
 * The plan for one organisation. `input`: `{ orgId, managers, users, siteBookingUserIds, jobs: { projects: [{id,
 * data}], smallWorks: [...] } }`. Returns `{ orgId, junk, ambiguous, updates, deletes, leftWithoutManager }`: `junk`
 * rows each with the jobs that use them; `updates` `{ path, set, remove (field names), removedIds, ... }`;
 * `deletes` `{ path, id }`.
 */
export function planOrg(rulebook, input) {
  const { junk, ambiguous } = classifyManagerRows(rulebook, input)
  const nameOf = nameLookup(rulebook, input)
  const byRow = new Map(junk.map((row) => [row.id, { ...row, jobs: [] }]))
  const dataByPath = new Map()
  for (const collection of JOB_COLLECTIONS) {
    for (const job of input.jobs?.[collection] || []) dataByPath.set(`organizations/${input.orgId}/${collection}/${job.id}`, job.data || {})
  }
  const updates = []
  const leftWithoutManager = []
  for (const patch of jobPatches(rulebook, input.orgId, junk.map((row) => row.id), input.jobs)) {
    const data = dataByPath.get(patch.path) || {}
    const stored = rulebook.jobManagerIds(data)
    const after = applyPatch(data, patch)
    const remainingKeys = new Set(rulebook.jobManagerIds(after).map(idKey))
    const hits = junk.filter((row) => stored.some((id) => row.keys.includes(idKey(id))))
    const parsed = rulebook.parseJobDocument(patch.jobId, data, { kind: patch.collection === 'smallWorks' ? 'smallWorks' : 'project' })
    const remaining = rulebook.jobManagerIds(after)
    const summary = {
      path: patch.path,
      collection: patch.collection,
      jobId: patch.jobId,
      jobNumber: parsed?.jobNumber || text(data.jobNumber),
      siteName: parsed?.siteName || text(data.siteName),
      otherManagers: remaining.map(nameOf),
    }
    for (const row of hits) byRow.get(row.id).jobs.push(summary)
    const removedIds = stored.filter((id) => !remainingKeys.has(idKey(id)))
    updates.push({ ...summary, set: patch.set, remove: patch.remove, removedIds })
    if (remaining.length === 0) leftWithoutManager.push(summary)
  }
  const deletes = junk.map((row) => ({ path: `organizations/${input.orgId}/managers/${row.id}`, id: row.id }))
  return { orgId: input.orgId, junk: [...byRow.values()], ambiguous, updates, deletes, leftWithoutManager }
}

/** Every document path a plan writes or deletes (backed up first). */
export function plannedPaths(plan) {
  return [...new Set([...plan.updates.map((row) => row.path), ...plan.deletes.map((row) => row.path)])]
}

const cell = (value, width) => {
  const s = String(value ?? '')
  return s.length > width ? `${s.slice(0, width - 1)}…` : s.padEnd(width)
}

/** The printed report for every organisation (`results`: `[{ orgId, orgName, plan } | { orgId, error }]`). */
export function formatReport(results, { apply, projectId, rulebookVersion }) {
  const lines = []
  lines.push(`${apply ? 'APPLY' : 'DRY RUN (nothing is written)'} — blank "Assigned manager" rows — project ${projectId}, rulebook ${rulebookVersion}`)
  const totals = { junk: 0, jobs: 0, ambiguous: 0, empty: 0 }
  const empty = []
  for (const result of results) {
    lines.push('')
    lines.push(`Organisation ${result.orgId}${result.orgName ? ` (${result.orgName})` : ''}`)
    if (result.error) {
      lines.push(`  ERROR: ${result.error} — nothing changed for this organisation.`)
      continue
    }
    const { plan } = result
    totals.junk += plan.junk.length
    totals.jobs += plan.updates.length
    totals.ambiguous += plan.ambiguous.length
    totals.empty += plan.leftWithoutManager.length
    for (const job of plan.leftWithoutManager) empty.push({ orgId: result.orgId, ...job })
    if (plan.junk.length === 0 && plan.ambiguous.length === 0) {
      lines.push('  nothing to do')
      continue
    }
    for (const row of plan.junk) {
      lines.push(`  ${apply ? 'delete' : 'would delete'} managers/${row.id}  "${row.name}", no email — on ${row.jobs.length} job(s)`)
      if (row.jobs.length > 0) {
        lines.push(`    ${cell('Collection', 11)} ${cell('Job number', 14)} ${cell('Site', 28)} ${cell('Job id', 38)} Other managers`)
        for (const job of row.jobs) {
          lines.push(`    ${cell(job.collection, 11)} ${cell(job.jobNumber || '—', 14)} ${cell(job.siteName || '—', 28)} ${cell(job.jobId, 38)} ${job.otherManagers.join(', ') || 'NONE — will have no manager'}`)
        }
      }
    }
    for (const job of plan.updates) {
      const changes = [
        ...Object.entries(job.set).map(([field, value]) => `${field} → ${JSON.stringify(value)}`),
        ...job.remove.map((field) => `${field} deleted`),
      ]
      lines.push(`  ${apply ? 'update' : 'would update'} ${job.collection}/${job.jobId}: remove ${JSON.stringify(job.removedIds)}; ${changes.join('; ')}`)
    }
    for (const row of plan.ambiguous) {
      lines.push(`  review (never changed) managers/${row.id} "${row.name}", no email: ${row.why.join('; ')}`)
    }
  }
  lines.push('')
  if (empty.length > 0) {
    lines.push(`Jobs left with no manager (assign one in the app — Projects / Small works → edit the job):`)
    for (const job of empty) lines.push(`  ${job.orgId}  ${job.collection}/${job.jobId}  ${job.jobNumber || '—'}  ${job.siteName || '—'}`)
    lines.push('')
  }
  lines.push(
    `Summary: ${totals.junk} junk manager row(s), ${totals.jobs} job(s) ${apply ? 'updated' : 'to update'}, ` +
      `${totals.empty} job(s) left with no manager, ${totals.ambiguous} row(s) to review (never changed).` +
      (apply ? '' : ' Nothing was written (dry run; add --apply to write).')
  )
  return lines.join('\n')
}
