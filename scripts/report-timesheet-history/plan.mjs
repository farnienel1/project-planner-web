/**
 * READ-ONLY report plan (pure — no Firestore): which stored timesheets the User Timesheets → Exported list shows, and
 * which it leaves out and why. Owner steps: docs/scripts/report-timesheet-history.md.
 *
 * It follows, with the packed rulebook functions the apps call, the two apps' Exported loaders as they are on main:
 *
 *   web  `loadExportedTimesheetHistory` (lib/timesheets/timesheetStorage.ts): one organisation-wide `settings` query on
 *        `exportedAt != null` (allowed for admins), `timesheet_` ids only, the person by stored `userId` else
 *        `timesheetDocumentSubjectId`, matched to the people of `exportedTimesheetHistorySubjects` under every id they go
 *        by (`personIdSet`), a stored id nobody in the roster goes by listed as "Unknown person" for admins, `weekStart`
 *        required, exported by `parseTimesheetStatusFields` / `isTimesheetExported` (which ignores an `exportedAt` an old
 *        web build copied from `invoiceGeneratedAt`), one row per person and `weekStart` (versions folded).
 *   iOS  `loadExportedHistory` (InvoicingView.swift): per person of `exportedTimesheetHistorySubjects`, a `settings`
 *        query on `userId ==` that person's own id ONLY (exact case), plus sheets stored without `userId` whose id names
 *        one of the person's ids; deleted people are not in the roster, so their sheets are never asked for.
 *
 * The viewer is an admin (the organisation's creator unless another uid is given): the Super Admin sees every sheet a
 * manager could. A manager's own list is narrower by design (their reports only).
 */

const lower = (value) => String(value ?? '').trim().toLowerCase()
const text = (value) => (typeof value === 'string' ? value.trim() : '')
const isMap = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value)
const has = (data, key) => isMap(data) && Object.prototype.hasOwnProperty.call(data, key)

/** A stored value with Firestore Timestamps turned into `{ seconds, nanoseconds }` (the rulebook runs in its own realm). */
export function plain(value) {
  if (value == null || typeof value !== 'object') return value
  if (typeof value.toMillis === 'function') {
    const ms = value.toMillis()
    return { seconds: Math.floor(ms / 1000), nanoseconds: (((ms % 1000) + 1000) % 1000) * 1e6 }
  }
  if (value instanceof Date) return { seconds: Math.floor(value.getTime() / 1000), nanoseconds: 0 }
  if (Array.isArray(value)) return value.map(plain)
  if (typeof value.path === 'string' && typeof value.id === 'string' && value.firestore) return value.path
  const out = {}
  for (const [k, v] of Object.entries(value)) out[k] = plain(v)
  return out
}

/** The packed rulebook functions this report calls. A missing one stops the script before any read. */
export const RULEBOOK_FUNCTIONS = [
  'exportedTimesheetHistorySubjects',
  'parseTimesheetStatusFields',
  'isTimesheetExported',
  'isTimesheetOperativeSigned',
  'isTimesheetManagerSigned',
  'timesheetDocumentSubjectId',
  'parseTimesheetRevisionDocId',
  'timesheetVersionSignedOff',
  'documentInstantMs',
  'permissionLevelOf',
  'effectivePermissions',
  'personIdSet',
  'isGhostUser',
]

/** web `staffAccountRole` (lib/permissions.ts) on a stored users document. */
function staffRole(rulebook, data) {
  const level = rulebook.permissionLevelOf(data)
  const effective = rulebook.effectivePermissions(data) || {}
  return {
    isSuperAdmin: data?.isSuperAdmin === true,
    isAdmin: level === 'admin',
    isManager: effective.manager === true || lower(data?.role) === 'manager',
    isOperativeMode: level === 'operative',
  }
}

function personInput(user) {
  return {
    id: user.id,
    email: text(user.data?.email),
    formerUserIds: Array.isArray(user.data?.formerUserIds) ? user.data.formerUserIds : [],
    sameEmailUserIds: Array.isArray(user.data?.sameEmailUserIds) ? user.data.sameEmailUserIds : [],
    isActive: user.data?.isActive !== false,
  }
}

function displayName(user) {
  const data = user?.data || {}
  const name = [text(data.firstName), text(data.surname) || text(data.lastName)].filter(Boolean).join(' ') || text(data.name)
  const email = text(data.email)
  if (name && email) return `${name} <${email}>`
  return name || email || `(no name) ${user?.id || ''}`
}

/** `bookingPersonIdHint`-style short id shown for a stored id nobody goes by. */
const hint = (id) => String(id || '').slice(0, 8)

/**
 * @param {object} rulebook the packed rulebook
 * @param {{ settings: Array<{id:string,data:object}>, users: Array<{id:string,data:object}>, viewerId: string }} input
 *   `settings`: every document of `organizations/{org}/settings`; `users`: the organisation roster (users documents
 *   whose organisationId is the organisation, plus the members-map people); data already passed through `plain`.
 */
export function timesheetHistoryReport(rulebook, input) {
  const users = (input.users || []).filter((row) => row && text(row.id))
  const roster = users.map(personInput)
  const viewerRow = users.find((row) => lower(row.id) === lower(input.viewerId))
  const viewerData = viewerRow?.data || {}
  const viewer = {
    id: input.viewerId,
    formerIds: Array.isArray(viewerData.formerUserIds) ? viewerData.formerUserIds : [],
    aliasIds: users
      .filter((row) => row.id !== input.viewerId && lower(row.data?.email) && lower(row.data?.email) === lower(viewerData.email))
      .map((row) => row.id),
    role: staffRole(rulebook, viewerData),
  }
  const viewerIsAdmin = viewer.role.isAdmin || viewer.role.isSuperAdmin
  const members = users.map((row) => ({
    id: row.id,
    email: text(row.data?.email),
    isActive: row.data?.isActive !== false,
    role: staffRole(rulebook, row.data || {}),
    assignedManagerUserIds: Array.isArray(row.data?.assignedManagerUserIds) ? row.data.assignedManagerUserIds : [],
    assignedManagerUserId: text(row.data?.assignedManagerUserId) || null,
    hasNoLineManager: row.data?.hasNoLineManager === true,
    ghost: rulebook.isGhostUser(row.data || {}) === true,
  }))
  const subjectIds = (rulebook.exportedTimesheetHistorySubjects({ viewer, members }) || []).map((row) => row.userId)
  const subjectSet = new Set(subjectIds.map(lower))
  const usersById = new Map(users.map((row) => [lower(row.id), row]))
  const subjects = subjectIds.map((id) => usersById.get(lower(id)) || { id, data: {} })

  // The roster person a stored id belongs to (exact id first, then any id they go by), as web `timesheetOwnerResolver`.
  const idsOf = new Map(users.map((row) => [row.id, (rulebook.personIdSet(personInput(row), roster) || [row.id]).map(lower)]))
  const resolver = (candidates) => {
    const exact = new Map(candidates.map((row) => [lower(row.id), row]))
    const alias = new Map()
    for (const row of candidates) for (const id of idsOf.get(row.id) || [lower(row.id)]) if (!exact.has(id) && !alias.has(id)) alias.set(id, row)
    return (id) => (lower(id) ? exact.get(lower(id)) ?? alias.get(lower(id)) ?? null : null)
  }
  const subjectOwner = resolver(subjects)
  const rosterOwner = resolver(users)

  const totals = {
    settingsDocs: 0,
    timesheetDocs: 0,
    originals: 0,
    revisions: 0,
    noUserId: 0,
    noWeekStart: 0,
    operativeSigned: 0,
    managerSigned: 0,
    signedOff: 0,
    marker_exportedAt_present: 0,
    marker_exportedAt_real: 0,
    marker_exportedAt_ignoredAsInvoiceLeftover: 0,
    marker_exportedAt_notADate: 0,
    marker_exportedAtMs: 0,
    marker_exported: 0,
    marker_exportedBy: 0,
    marker_status_exported: 0,
    marker_invoiceGeneratedAt: 0,
    signedOffNotExported: 0,
    otherSettingsLookingLikeTimesheets: 0,
  }
  const web = { listed: 0, listedRows: 0, listedAsUnknownPerson: 0, dropped: {} }
  const ios = { listed: 0, listedRows: 0, dropped: {} }
  const drop = (bucket, reason) => {
    bucket.dropped[reason] = (bucket.dropped[reason] || 0) + 1
  }
  const people = new Map()
  const personRow = (key, label) => {
    if (!people.has(key)) people.set(key, { person: label, stored: 0, signedOff: 0, exported: 0, webListed: 0, iosListed: 0, notes: new Set() })
    return people.get(key)
  }
  const webRows = new Set()
  const iosRows = new Set()
  const otherIds = []

  for (const doc of input.settings || []) {
    totals.settingsDocs += 1
    const data = isMap(doc.data) ? doc.data : {}
    if (!doc.id.startsWith('timesheet_')) {
      if (has(data, 'weekStart') || has(data, 'weekStartKey') || has(data, 'operativeSignedAt') || has(data, 'exportedAt')) {
        totals.otherSettingsLookingLikeTimesheets += 1
        otherIds.push(doc.id)
      }
      continue
    }
    totals.timesheetDocs += 1
    const version = rulebook.parseTimesheetRevisionDocId(doc.id)
    if (version && version.revision > 0) totals.revisions += 1
    else totals.originals += 1
    const storedUserId = text(data.userId)
    if (!storedUserId) totals.noUserId += 1
    const subjectId = storedUserId || text(rulebook.timesheetDocumentSubjectId(doc.id))
    const weekStartMs = rulebook.documentInstantMs(data.weekStart)
    if (weekStartMs == null) totals.noWeekStart += 1

    const status = rulebook.parseTimesheetStatusFields(data)
    const operativeSigned = rulebook.isTimesheetOperativeSigned(status) === true
    const managerSigned = rulebook.isTimesheetManagerSigned(status) === true
    const signedOff = rulebook.timesheetVersionSignedOff(data) === true
    const exported = rulebook.isTimesheetExported(status) === true
    if (operativeSigned) totals.operativeSigned += 1
    if (managerSigned) totals.managerSigned += 1
    if (signedOff) totals.signedOff += 1

    const exportedAtPresent = has(data, 'exportedAt') && data.exportedAt != null
    const exportedAtMs = exportedAtPresent ? rulebook.documentInstantMs(data.exportedAt) : null
    if (exportedAtPresent) totals.marker_exportedAt_present += 1
    if (exported) totals.marker_exportedAt_real += 1
    else if (exportedAtPresent && exportedAtMs != null && exportedAtMs > Date.parse('2020-01-01T00:00:00Z')) totals.marker_exportedAt_ignoredAsInvoiceLeftover += 1
    else if (exportedAtPresent) totals.marker_exportedAt_notADate += 1
    if (has(data, 'exportedAtMs') && data.exportedAtMs != null) totals.marker_exportedAtMs += 1
    if (has(data, 'exported') && data.exported != null && data.exported !== false) totals.marker_exported += 1
    if (has(data, 'exportedBy') && data.exportedBy != null && data.exportedBy !== '') totals.marker_exportedBy += 1
    if (lower(data.status) === 'exported') totals.marker_status_exported += 1
    if (has(data, 'invoiceGeneratedAt') && data.invoiceGeneratedAt != null) totals.marker_invoiceGeneratedAt += 1
    if (signedOff && !exported) totals.signedOffNotExported += 1

    const owner = rosterOwner(subjectId)
    const key = owner ? owner.id : `?${lower(subjectId)}`
    const row = personRow(key, owner ? displayName(owner) : `nobody in the roster (stored id ${hint(subjectId) || '—'})`)
    row.stored += 1
    if (signedOff) row.signedOff += 1
    if (exported) row.exported += 1
    if (owner && owner.data?.isActive === false) row.notes.add('inactive')
    if (!owner) row.notes.add('deleted or never a roster person')

    // ---- web (admin): fast path `exportedAt != null` ----
    if (!exportedAtPresent) {
      if (signedOff) drop(web, 'signed off but never exported (no exportedAt)')
    } else if (weekStartMs == null) {
      drop(web, 'exportedAt set but no weekStart')
    } else {
      let member = subjectOwner(subjectId)
      let unknown = false
      if (!member && viewerIsAdmin && subjectId && !rosterOwner(subjectId)) unknown = true
      if (!member && !unknown) {
        drop(web, owner ? 'person not on the Exported people list (ghost, no level, or out of scope)' : 'no person id')
      } else if (!exported) {
        drop(web, exportedAtMs != null && exportedAtMs > Date.parse('2020-01-01T00:00:00Z') ? 'exportedAt ignored (copied from invoiceGeneratedAt)' : 'exportedAt not a real date')
      } else {
        web.listed += 1
        if (unknown) web.listedAsUnknownPerson += 1
        row.webListed += 1
        webRows.add(`${unknown ? lower(subjectId) : member.id}|${Math.floor(weekStartMs / 1000)}`)
      }
    }

    // ---- iOS: per subject `userId ==` own id; unowned sheets by document id ----
    if (exported) {
      let iosMember = null
      if (storedUserId) {
        iosMember = subjects.find((subject) => subject.id === storedUserId) || null
      } else {
        iosMember =
          subjects.find((subject) => (idsOf.get(subject.id) || [lower(subject.id)]).includes(lower(subjectId))) || null
      }
      if (!iosMember) {
        drop(ios, !owner ? 'person deleted / not in the roster' : storedUserId && subjectSet.has(lower(owner.id)) ? 'filed under a former or second id of the person' : 'person not on the Exported people list')
      } else if (weekStartMs == null) {
        drop(ios, 'no weekStart')
      } else {
        ios.listed += 1
        row.iosListed += 1
        iosRows.add(`${iosMember.id}|${Math.floor(weekStartMs / 1000)}`)
      }
    }
  }
  web.listedRows = webRows.size
  ios.listedRows = iosRows.size

  const perPerson = Array.from(people.values())
    .map((row) => ({ ...row, notes: Array.from(row.notes).join(', ') }))
    .sort((a, b) => b.stored - a.stored || a.person.localeCompare(b.person))
  return {
    viewer: { id: input.viewerId, name: viewerRow ? displayName(viewerRow) : '(not in the roster)', admin: viewerIsAdmin },
    exportedPeople: subjectIds.length,
    rosterPeople: users.length,
    totals,
    web,
    ios,
    perPerson,
    otherSettingsIds: otherIds.slice(0, 20),
  }
}

export function formatReport(orgId, name, report, extra = {}) {
  const t = report.totals
  const lines = []
  lines.push(`=== Organisation ${orgId}${name ? ` (${name})` : ''}`)
  lines.push(`Viewer (as on User Timesheets → Exported): ${report.viewer.name}${report.viewer.admin ? ' [admin]' : ' [NOT admin]'}`)
  lines.push(`Roster people: ${report.rosterPeople}   people the Exported list may show: ${report.exportedPeople}`)
  lines.push('')
  lines.push(`Timesheet documents (settings/timesheet_*): ${t.timesheetDocs}  (originals ${t.originals}, revisions ${t.revisions})`)
  lines.push(`  without userId:                       ${t.noUserId}`)
  lines.push(`  without weekStart:                    ${t.noWeekStart}`)
  lines.push(`  person signed:                        ${t.operativeSigned}`)
  lines.push(`  line manager signed:                  ${t.managerSigned}`)
  lines.push(`  signed off (counter-signed / self):   ${t.signedOff}`)
  lines.push(`  signed off but NOT exported:          ${t.signedOffNotExported}`)
  lines.push('Export markers (each counted separately):')
  lines.push(`  exportedAt present:                   ${t.marker_exportedAt_present}`)
  lines.push(`    real export (rulebook):             ${t.marker_exportedAt_real}`)
  lines.push(`    ignored, copied from invoice stamp: ${t.marker_exportedAt_ignoredAsInvoiceLeftover}`)
  lines.push(`    not a usable date:                  ${t.marker_exportedAt_notADate}`)
  lines.push(`  exportedAtMs:                         ${t.marker_exportedAtMs}`)
  lines.push(`  exported (flag):                      ${t.marker_exported}`)
  lines.push(`  exportedBy:                           ${t.marker_exportedBy}`)
  lines.push(`  status = "exported":                  ${t.marker_status_exported}`)
  lines.push(`  invoiceGeneratedAt (not an export):   ${t.marker_invoiceGeneratedAt}`)
  lines.push(`Other settings documents that look like timesheets: ${t.otherSettingsLookingLikeTimesheets}${report.otherSettingsIds.length ? ` (${report.otherSettingsIds.join(', ')})` : ''}`)
  if (extra.otherCollections && extra.otherCollections.length) {
    lines.push(`Other collections with "timesheet" in the name: ${extra.otherCollections.map((c) => `${c.name} (${c.count})`).join(', ')}`)
  }
  lines.push('')
  lines.push(`Web Exported list would show: ${report.web.listedRows} row(s) from ${report.web.listed} document(s)${report.web.listedAsUnknownPerson ? `, ${report.web.listedAsUnknownPerson} as "Unknown person"` : ''}`)
  for (const [reason, count] of Object.entries(report.web.dropped)) lines.push(`  left out — ${reason}: ${count}`)
  lines.push(`iPhone Exported list would show: ${report.ios.listedRows} row(s) from ${report.ios.listed} document(s)`)
  for (const [reason, count] of Object.entries(report.ios.dropped)) lines.push(`  left out — ${reason}: ${count}`)
  lines.push('')
  lines.push('Per person: stored | signed off | exported | web lists | iPhone lists | notes')
  for (const row of report.perPerson) {
    lines.push(`  ${row.person}: ${row.stored} | ${row.signedOff} | ${row.exported} | ${row.webListed} | ${row.iosListed}${row.notes ? ` | ${row.notes}` : ''}`)
  }
  return lines.join('\n')
}
