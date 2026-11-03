/**
 * Launch checklist 2.3 — clean-ups of old records. The pure part of `scripts/data-cleanup.mjs`.
 *
 * Every check here is a pure function: given the documents it reads (plain data, already loaded) and the packed
 * rulebook, it returns a plan — the partial updates, the deletes and the rows to review — and never touches Firestore.
 * `scripts/data-cleanup.mjs` loads the documents, prints the plan, writes the backups and, with `--apply`, writes it.
 *
 * Every decision comes from the rulebook's own readers in the packed script (`lib/canonical/dist/canonical-business.js`,
 * read only): `parseBookingDocument` / `normalizeBookingStatus`, `resolveOrganizationCurrency` /
 * `normalizeCurrencyCode`, `parseCompanyDetails`, `parsePayrollTimePolicyState` / `payrollTimePolicyHistoryEntries` /
 * `effectivePayrollTimePolicy`, `isLegacyPlaceholderDocumentId` / `LEGACY_PLACEHOLDER_DOCUMENT_ID` and
 * `isIdentifiablePendingLeftover`. A check never changes what those readers return for the document — each one proves
 * it by reading the document before and after the change and refusing the change when the answers differ.
 *
 * Every check is idempotent: after `--apply`, the same check plans nothing (report-only rows are listed again, they
 * are never changed).
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'

const here = path.dirname(fileURLToPath(import.meta.url))
export const repoRoot = path.resolve(here, '..', '..')

/** Functions each check reads from the packed rulebook. A missing one stops the script before any read. */
export const RULEBOOK_FUNCTIONS = [
  'rulebookStamp',
  'parseBookingDocument',
  'normalizeBookingStatus',
  'isLegacyPlaceholderDocumentId',
  'resolveOrganizationCurrency',
  'normalizeCurrencyCode',
  'parseCompanyDetails',
  'organizationTimeZone',
  'parsePayrollTimePolicyState',
  'payrollTimePolicyHistoryEntries',
  'effectivePayrollTimePolicy',
  'isIdentifiablePendingLeftover',
  'isPushTokenPlaceholderUserId',
  'writeMetadataFields',
]

/** The packed rulebook (`ProjectPlannerCanonical`), read only. */
export function loadRulebook(file = path.join(repoRoot, 'lib/canonical/dist/canonical-business.js')) {
  const context = vm.createContext({})
  vm.runInContext(readFileSync(file, 'utf8'), context)
  const rulebook = context.ProjectPlannerCanonical
  const missing = RULEBOOK_FUNCTIONS.filter((name) => typeof rulebook?.[name] !== 'function')
  if (missing.length > 0) {
    throw new Error(`The packed rulebook is missing ${missing.join(', ')}. Run \`npm run build:canonical\` first.`)
  }
  return rulebook
}

const own = (data, key) => Boolean(data) && Object.prototype.hasOwnProperty.call(data, key)
const isMap = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value)
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)
const withoutKey = (data, key) => {
  const copy = { ...data }
  delete copy[key]
  return copy
}

/** `YYYY-MM-DD` ± days, as calendar dates (the zone does not matter for a day key's neighbour). */
export function shiftDayKey(dayKey, days) {
  const [y, m, d] = dayKey.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d + days))
  return date.toISOString().slice(0, 10)
}

const orgPath = (orgId) => `organizations/${orgId}`

function emptyPlan() {
  return { updates: [], deletes: [], notes: [] }
}

// ─── 1. booking-status-spelling ────────────────────────────────────────────────────────────────────────────────────

/**
 * A booking whose `status` is stored in an old spelling (`confirmed`, `canceled`, `pending` …) gets the rulebook's
 * spelling. Same rows and same fix as Data health → "Fix all" (`lib/dataHealth/bookingHealthActions.ts`): the reader
 * reports `status_alias` and `normalizeBookingStatus` gives the stored spelling. A booking with a tombstone, or the
 * `INITIAL-PLACEHOLDER` row, is never touched.
 *
 * input: { orgId, bookings: [{ id, data }], tombstoneIds: string[] }
 */
export function planBookingStatusSpelling(rulebook, input) {
  const plan = emptyPlan()
  const tombstoned = new Set((input.tombstoneIds || []).map((id) => String(id).trim().toLowerCase()))
  for (const doc of input.bookings || []) {
    const docPath = `${orgPath(input.orgId)}/bookings/${doc.id}`
    if (rulebook.isLegacyPlaceholderDocumentId(doc.id)) continue
    const parsed = rulebook.parseBookingDocument(doc.id, doc.data)
    if (!parsed.ok || !parsed.repairs.includes('status_alias')) continue
    const status = rulebook.normalizeBookingStatus(doc.data.status)
    if (!status || status === doc.data.status) continue
    if (tombstoned.has(doc.id.trim().toLowerCase())) {
      plan.notes.push({ path: docPath, reason: `status "${doc.data.status}" left alone: the booking has a tombstone (deletedBookings)` })
      continue
    }
    plan.updates.push({
      path: docPath,
      set: { status },
      remove: [],
      reason: `status "${doc.data.status}" → "${status}"`,
    })
  }
  return plan
}

// ─── 2. currency-literal-key ───────────────────────────────────────────────────────────────────────────────────────

/**
 * Older iOS builds saved the currency with a merge-set, which stored a top-level field literally named
 * `settings.currencyCode` (rulebook §4.2: "an optional one-off clean-up may delete it with
 * `FieldPath(['settings.currencyCode'])`"). It is deleted only when another saved currency field (`currencyCode`,
 * nested `settings.currencyCode` or `currency`) already gives the same code, so `resolveOrganizationCurrency` and
 * "has a saved currency" are unchanged. Otherwise the organisation is listed for an admin currency save.
 *
 * input: { orgId, org: { id, data } }
 */
export function planCurrencyLiteralKey(rulebook, input) {
  const plan = emptyPlan()
  const data = input.org?.data
  if (!own(data, 'settings.currencyCode')) return plan
  const docPath = orgPath(input.orgId)
  const settings = isMap(data.settings) ? data.settings : {}
  const otherSaved =
    rulebook.normalizeCurrencyCode(data.currencyCode) ??
    rulebook.normalizeCurrencyCode(settings.currencyCode) ??
    rulebook.normalizeCurrencyCode(data.currency) ??
    null
  const before = rulebook.resolveOrganizationCurrency(data)
  const after = rulebook.resolveOrganizationCurrency(withoutKey(data, 'settings.currencyCode'))
  if (otherSaved && before === after) {
    plan.updates.push({
      path: docPath,
      set: {},
      remove: [['settings.currencyCode']],
      reason: `delete the literal "settings.currencyCode" field (${JSON.stringify(data['settings.currencyCode'])}); the currency stays ${before}`,
    })
  } else {
    plan.notes.push({
      path: docPath,
      reason: `literal "settings.currencyCode" kept: it is the only saved currency or deleting it would change the currency (${before} → ${after}). An admin saving Settings → Currency fixes it.`,
    })
  }
  return plan
}

// ─── 3. office-address-map ─────────────────────────────────────────────────────────────────────────────────────────

/**
 * The legacy nested `officeAddress` map (early web setup) is read by `parseCompanyDetails` only as a fallback, and
 * every Company details save deletes it (§4.1). It is deleted here only when it is redundant: the company details
 * read the same without it. When the map still supplies a value, the organisation is listed instead — an admin
 * pressing Save on Company details moves it into the flat fields with `companyDetailsWriteFields`. (Copying it into
 * the flat fields here would change what older iOS builds show, which read only the flat fields.)
 *
 * input: { orgId, org: { id, data } }
 */
export function planOfficeAddressMap(rulebook, input) {
  const plan = emptyPlan()
  const data = input.org?.data
  if (!own(data, 'officeAddress')) return plan
  const docPath = orgPath(input.orgId)
  const before = rulebook.parseCompanyDetails(data)
  const after = rulebook.parseCompanyDetails(withoutKey(data, 'officeAddress'))
  if (same(before, after)) {
    plan.updates.push({
      path: docPath,
      set: {},
      remove: [['officeAddress']],
      reason: 'delete the legacy nested "officeAddress" map; the flat office fields already hold the same address',
    })
  } else {
    const changed = Object.keys(before).filter((key) => !same(before[key], after[key]))
    plan.notes.push({
      path: docPath,
      reason: `"officeAddress" kept: it still supplies ${changed.join(', ')}. An admin opening Settings → Company details and pressing Save moves it into the flat fields.`,
    })
  }
  return plan
}

// ─── 4. payroll-history-seed ───────────────────────────────────────────────────────────────────────────────────────

/**
 * Rulebook 1.19.0 (§1, §4.3): `payrollTimePolicyHistory` is seeded by the first working-hours write after 1.19.0 —
 * `[{ 1970-01-01, prior }, { effectiveFrom, current }]`, or just the current policy (`payrollTimePolicyHistoryEntries`).
 * Until a newer build saves working hours, an older build that only writes the flat fields can overwrite
 * `payrollTimePolicyPrior` and lose the earlier rules. This writes the same seed now, from the stored maps exactly as
 * they are (no re-pricing: a policy without `paidHoursDerived` keeps its stored `standardPaidHours`), and bumps
 * `payrollTimePolicyRevision` as every working-hours write does, so an admin editing working hours at that moment is
 * asked to reload instead of overwriting it.
 *
 * Skipped: an organisation with no saved `payrollTimePolicy` (it would freeze today's defaults), or one that already
 * has a history (append-only, never rewritten). Refused (listed) when the policy in effect on any boundary day would
 * differ after the seed.
 *
 * input: { orgId, org: { id, data } }
 */
export function planPayrollHistorySeed(rulebook, input) {
  const plan = emptyPlan()
  const data = input.org?.data
  if (!data || !isMap(data.payrollTimePolicy)) return plan
  const docPath = orgPath(input.orgId)
  if (own(data, 'payrollTimePolicyHistory')) {
    const stored = data.payrollTimePolicyHistory
    if (Array.isArray(stored) && stored.length === 0) {
      // an empty list is no history: seed it below
    } else {
      if (!Array.isArray(stored)) {
        plan.notes.push({ path: docPath, reason: '"payrollTimePolicyHistory" is not a list; left alone for the owner to review' })
      }
      return plan
    }
  }
  const timeZone = rulebook.organizationTimeZone(data.countryCode)
  const state = rulebook.parsePayrollTimePolicyState(data, timeZone)
  const start = rulebook.PAYROLL_POLICY_HISTORY_START || '1970-01-01'
  const expected = rulebook.payrollTimePolicyHistoryEntries({ ...state, scheduled: null }).map((entry) => entry.effectiveFrom)

  let seed
  if (state.prior && state.effectiveFrom && isMap(data.payrollTimePolicyPrior)) {
    seed = [
      { effectiveFrom: start, policy: data.payrollTimePolicyPrior },
      { effectiveFrom: state.effectiveFrom, policy: data.payrollTimePolicy },
    ]
  } else {
    seed = [{ effectiveFrom: state.effectiveFrom || start, policy: data.payrollTimePolicy }]
  }
  const seedDays = seed.map((entry) => entry.effectiveFrom)
  if (!same(seedDays, expected)) {
    plan.notes.push({ path: docPath, reason: `history not seeded: the rulebook expects entries ${expected.join(', ')}, the stored fields give ${seedDays.join(', ')}` })
    return plan
  }

  const after = { ...data, payrollTimePolicyHistory: seed }
  const days = new Set([start, '9999-12-31'])
  for (const day of [state.effectiveFrom, state.scheduled?.effectiveFrom]) {
    if (!day) continue
    days.add(day)
    days.add(shiftDayKey(day, -1))
  }
  for (const day of days) {
    const a = rulebook.effectivePayrollTimePolicy(data, day, timeZone)
    const b = rulebook.effectivePayrollTimePolicy(after, day, timeZone)
    if (!same(a, b)) {
      plan.notes.push({ path: docPath, reason: `history not seeded: the working hours on ${day} would change` })
      return plan
    }
  }
  plan.updates.push({
    path: docPath,
    set: { payrollTimePolicyHistory: seed, payrollTimePolicyRevision: (state.revision ?? 0) + 1 },
    remove: [],
    reason: `seed "payrollTimePolicyHistory" from the stored fields (${seedDays.join(', ')}); revision ${state.revision ?? 0} → ${(state.revision ?? 0) + 1}`,
  })
  return plan
}

// ─── 5. placeholder-docs ───────────────────────────────────────────────────────────────────────────────────────────

/** Collections whose `INITIAL-PLACEHOLDER` row is deleted: every reader on web, iOS and older iOS skips it by id. */
export const PLACEHOLDER_DELETE_COLLECTIONS = ['projects', 'smallWorks', 'operatives']
/** Collections whose placeholder row is only listed (an older iOS build may still show it, or Data health owns it). */
export const PLACEHOLDER_REPORT_COLLECTIONS = {
  bookings: 'use Data health → "Remove placeholder" (writes the booking tombstone); an older iOS build can read it as a booking',
  clients: 'older iOS builds read clients by the stored "id" field, not the document id, so it may still be listed there',
  managers: 'older iOS builds skip managers by name only, so it may still be listed there',
}

/**
 * Early organisation setup wrote rows with the document id `INITIAL-PLACEHOLDER` (`LEGACY_PLACEHOLDER_DOCUMENT_ID`).
 * They are not records: `workDocuments` / `parseJobDocument` and `parseOperativeDocument` skip them, and older iOS
 * builds skip that exact id in projects, small works and operatives. Only the exact stored id is deleted; another
 * letter case is listed.
 *
 * input: { orgId, collections: { [name]: [{ id, data }] } }
 */
export function planPlaceholderDocs(rulebook, input) {
  const plan = emptyPlan()
  const exact = rulebook.LEGACY_PLACEHOLDER_DOCUMENT_ID || 'INITIAL-PLACEHOLDER'
  for (const [name, docs] of Object.entries(input.collections || {})) {
    for (const doc of docs || []) {
      if (!rulebook.isLegacyPlaceholderDocumentId(doc.id)) continue
      const docPath = `${orgPath(input.orgId)}/${name}/${doc.id}`
      if (PLACEHOLDER_DELETE_COLLECTIONS.includes(name) && doc.id === exact) {
        plan.deletes.push({ path: docPath, reason: 'old setup placeholder; no app lists it' })
      } else if (PLACEHOLDER_REPORT_COLLECTIONS[name]) {
        plan.notes.push({ path: docPath, reason: `setup placeholder left alone: ${PLACEHOLDER_REPORT_COLLECTIONS[name]}` })
      } else {
        plan.notes.push({ path: docPath, reason: `setup placeholder left alone: id "${doc.id}" is not the exact "${exact}" older iOS builds skip` })
      }
    }
  }
  return plan
}

// ─── 6. orphan-invites (report only) ───────────────────────────────────────────────────────────────────────────────

/**
 * Pending invite rows whose `organizations/{orgId}/userEmails/{email}` claim is gone but that still name a person
 * (`isIdentifiablePendingLeftover`, the rule behind `listedRosterUsers`). Never written or deleted: bookings, leave,
 * warning exclusions and another account's `formerUserIds` may name the id, re-invite reuses or replaces it
 * (`resolveInviteEmailClaim`), and older iOS builds list every `users` row of the organisation.
 *
 * input: { orgId, users: [{ id, data }], claimedEmails: string[] | null }
 */
export function planOrphanInvites(rulebook, input) {
  const plan = emptyPlan()
  if (!Array.isArray(input.claimedEmails)) return plan
  for (const doc of input.users || []) {
    if (!rulebook.isIdentifiablePendingLeftover(doc.data || {}, input.claimedEmails)) continue
    const shape = rulebook.isPushTokenPlaceholderUserId(doc.id) ? 'invite placeholder id' : 'account-style id'
    const email = typeof doc.data?.email === 'string' && doc.data.email.trim() ? doc.data.email.trim() : '(no email)'
    plan.notes.push({ path: `users/${doc.id}`, reason: `pending invite with no live userEmails claim (${shape}, ${email}); review in Manage Users — never changed by this script` })
  }
  return plan
}

// ─── registry ──────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * The checks in the recommended order. `reads` names what the loader fetches for one organisation:
 * `org` (the organisation document), `bookings`, `tombstones` (`deletedBookings` ids), `placeholders`
 * (the `INITIAL-PLACEHOLDER` document of each placeholder collection), `users` + `claimedEmails`.
 */
export const CHECKS = [
  {
    id: 'booking-status-spelling',
    title: 'Booking status in an old spelling → the rulebook spelling',
    reads: ['bookings', 'tombstones'],
    writes: 'updates `status` on bookings',
    plan: planBookingStatusSpelling,
  },
  {
    id: 'currency-literal-key',
    title: 'Literal top-level "settings.currencyCode" field left by older iOS builds',
    reads: ['org'],
    writes: 'deletes one field on the organisation',
    plan: planCurrencyLiteralKey,
  },
  {
    id: 'office-address-map',
    title: 'Legacy nested "officeAddress" map that the flat fields already cover',
    reads: ['org'],
    writes: 'deletes one field on the organisation',
    plan: planOfficeAddressMap,
  },
  {
    id: 'payroll-history-seed',
    title: 'Seed the working-hours history (1.19.0) from the stored fields',
    reads: ['org'],
    writes: 'adds `payrollTimePolicyHistory` and bumps `payrollTimePolicyRevision` on the organisation',
    plan: planPayrollHistorySeed,
  },
  {
    id: 'placeholder-docs',
    title: 'Old INITIAL-PLACEHOLDER setup rows in projects, small works and operatives',
    reads: ['placeholders'],
    writes: 'deletes the placeholder documents (backed up first)',
    plan: planPlaceholderDocs,
  },
  {
    id: 'orphan-invites',
    title: 'Pending invites whose email claim is gone (report only)',
    reads: ['users'],
    writes: 'nothing — report only',
    plan: planOrphanInvites,
  },
]

export const PLACEHOLDER_COLLECTIONS = [...PLACEHOLDER_DELETE_COLLECTIONS, ...Object.keys(PLACEHOLDER_REPORT_COLLECTIONS)]

export function checkById(id) {
  return CHECKS.find((check) => check.id === id) || null
}

// ─── report ────────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * The printed report. `results` is `[{ orgId, orgName, checks: [{ id, plan }] }]`; `samples` caps the paths shown per
 * check and kind. Pure (tested): the same results always print the same text.
 */
export function formatReport(results, { apply = false, projectId = '', rulebookVersion = '', samples = 5, backupDir = null } = {}) {
  const lines = []
  lines.push(`Data clean-up — ${apply ? 'APPLY (writing)' : 'DRY RUN (nothing is written)'}`)
  lines.push(`Project: ${projectId}   Rulebook: ${rulebookVersion}   Organisations: ${results.length}`)
  const totals = { updates: 0, deletes: 0, notes: 0 }
  for (const org of results) {
    lines.push('')
    lines.push(`== Organisation ${org.orgId}${org.orgName ? ` (${org.orgName})` : ''}`)
    for (const { id, plan, error } of org.checks) {
      if (error) {
        lines.push(`  ${id}: could not run — ${error}`)
        continue
      }
      const counts = [
        plan.updates.length ? `${plan.updates.length} to update` : null,
        plan.deletes.length ? `${plan.deletes.length} to delete` : null,
        plan.notes.length ? `${plan.notes.length} to review (not changed)` : null,
      ].filter(Boolean)
      lines.push(`  ${id}: ${counts.length ? counts.join(', ') : 'nothing to do'}`)
      const show = (rows, label) => {
        for (const row of rows.slice(0, samples)) lines.push(`    ${label} ${row.path} — ${row.reason}`)
        if (rows.length > samples) lines.push(`    …and ${rows.length - samples} more`)
      }
      show(plan.updates, 'update')
      show(plan.deletes, 'delete')
      show(plan.notes, 'review')
      totals.updates += plan.updates.length
      totals.deletes += plan.deletes.length
      totals.notes += plan.notes.length
    }
  }
  lines.push('')
  lines.push(`Summary: ${totals.updates} to update, ${totals.deletes} to delete, ${totals.notes} to review across ${results.length} organisation(s).`)
  if (apply) {
    if (backupDir) lines.push(`Backups: ${backupDir}`)
  } else {
    lines.push('Dry run: nothing was written. Re-run with --apply to make these changes.')
  }
  return lines.join('\n')
}

// ─── backups (JSON with Firestore types tagged) ────────────────────────────────────────────────────────────────────

/** A Firestore value as JSON: timestamps, references, geo points and bytes are tagged with `__fs` so restore rebuilds them. */
export function encodeValue(value) {
  if (value === null || value === undefined) return value ?? null
  if (Array.isArray(value)) return value.map(encodeValue)
  if (value instanceof Date) return { __fs: 'timestamp', seconds: Math.floor(value.getTime() / 1000), nanoseconds: (value.getTime() % 1000) * 1e6 }
  if (typeof value === 'object') {
    const kind = value.constructor?.name
    if (typeof value.toDate === 'function' && typeof value.seconds === 'number' && typeof value.nanoseconds === 'number') {
      return { __fs: 'timestamp', seconds: value.seconds, nanoseconds: value.nanoseconds }
    }
    if (kind === 'GeoPoint' && typeof value.latitude === 'number') {
      return { __fs: 'geopoint', latitude: value.latitude, longitude: value.longitude }
    }
    if (kind === 'DocumentReference' && typeof value.path === 'string') return { __fs: 'reference', path: value.path }
    if (value instanceof Uint8Array) return { __fs: 'bytes', base64: Buffer.from(value).toString('base64') }
    const out = {}
    for (const [key, inner] of Object.entries(value)) out[key] = encodeValue(inner)
    return out
  }
  return value
}

/** The inverse of `encodeValue`. `types` = `{ Timestamp, GeoPoint, reference(path) }` from firebase-admin. */
export function decodeValue(value, types) {
  if (value === null || value === undefined) return value ?? null
  if (Array.isArray(value)) return value.map((inner) => decodeValue(inner, types))
  if (typeof value === 'object') {
    if (value.__fs === 'timestamp') return new types.Timestamp(value.seconds, value.nanoseconds)
    if (value.__fs === 'geopoint') return new types.GeoPoint(value.latitude, value.longitude)
    if (value.__fs === 'reference') return types.reference(value.path)
    if (value.__fs === 'bytes') return Buffer.from(value.base64, 'base64')
    const out = {}
    for (const [key, inner] of Object.entries(value)) out[key] = decodeValue(inner, types)
    return out
  }
  return value
}

/** A backup file body for one check in one organisation. */
export function backupFileBody({ projectId, orgId, check, createdAt, sequence = 0, documents }) {
  return {
    projectId,
    orgId,
    check,
    createdAt,
    sequence,
    note: 'Each document as it was before the clean-up. Restore: node scripts/data-cleanup.mjs --project <id> --restore <the run folder, or this file> [--apply]',
    documents: documents.map((doc) => ({ path: doc.path, data: encodeValue(doc.data) })),
  }
}

/** Every path a plan writes or deletes (the documents to back up first). */
export function plannedPaths(plan) {
  return [...new Set([...plan.updates.map((row) => row.path), ...plan.deletes.map((row) => row.path)])]
}
