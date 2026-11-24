/**
 * Owner console Status page (owner request 24 Nov): pure functions over what the `/api/owner/status` route reads, so
 * they are unit-tested without Google. Display only: nothing here decides a business rule. The switch field names come
 * from the rulebook (`lib/canonical/platformConfig.ts`); the "on for one organisation" test is the same shape as
 * `securitySwitchOn` (exactly `true`, or the id in the list), shown here as "everywhere / N organisations / off".
 *
 * Standing owner rule "useful features only": every tile has a link to somewhere the owner can act or look closer, and
 * a source that cannot be read is listed as "Not connected" with the reason, never shown as a zero.
 */
import {
  DATA_CHECK_PANEL_ORGANIZATION_IDS_FIELD,
  DATA_CHECK_PANEL_SWITCH_FIELD,
  GHOST_ACCOUNTS_ORGANIZATION_IDS_FIELD,
  GHOST_ACCOUNTS_SWITCH_FIELD,
  OPERATIVE_OWN_LEAVE_ORGANIZATION_IDS_FIELD,
  OPERATIVE_OWN_LEAVE_SWITCH_FIELD,
  SECURITY_SWITCH_ORGANIZATION_FIELDS,
} from '@/lib/canonical/platformConfig'

export const STATUS_REPO_URL = 'https://github.com/farnienel1/project-planner-web'
export const STATUS_RULES_WORKFLOW_URL = `${STATUS_REPO_URL}/actions/workflows/firebase-rules-deploy.yml`
/** How far back the email and Cloud Functions tiles look. */
export const STATUS_WINDOW_DAYS = 7
/** Most email log rows read for one Status view (a bigger week says "at least"). */
export const STATUS_EMAIL_READ_MAX = 2000
/** Most Cloud Functions error log entries read for one Status view. */
export const STATUS_FUNCTION_ERRORS_READ_MAX = 500

export type NotConnected = { connected: false; reason: string }

// MARK: - The web deploy

export type BuildInfo = {
  /** The git commit the running site was built from; null when the build did not record it. */
  commit: string | null
  commitShort: string | null
  commitUrl: string | null
  /** Netlify's deploy id, when the build ran on Netlify. */
  deployId: string | null
  /** Netlify's build context (`production`, `deploy-preview`, `branch-deploy`), when known. */
  context: string | null
  branch: string | null
  /** When `next build` ran (ISO), baked in at build time. */
  builtAt: string | null
  /** Where the commit came from: the server's environment now, or the value baked in at build time. */
  source: 'runtime' | 'build' | null
  appVersion: string | null
}

type Env = Record<string, string | undefined>

function clean(value: string | undefined): string | null {
  const text = (value || '').trim()
  return text ? text : null
}

/**
 * The running build: Netlify's `COMMIT_REF` / `DEPLOY_ID` / `CONTEXT` / `BRANCH` when the server can read them now,
 * else the `OWNER_BUILD_*` values `next.config.js` baked in at build time.
 */
export function buildInfo(runtimeEnv: Env, bakedEnv: Env): BuildInfo {
  const runtimeCommit = clean(runtimeEnv.COMMIT_REF)
  const commit = runtimeCommit || clean(bakedEnv.OWNER_BUILD_COMMIT)
  const validCommit = commit && /^[0-9a-f]{7,40}$/i.test(commit) ? commit : null
  return {
    commit: validCommit,
    commitShort: validCommit ? validCommit.slice(0, 7) : null,
    commitUrl: validCommit ? `${STATUS_REPO_URL}/commit/${validCommit}` : null,
    deployId: clean(runtimeEnv.DEPLOY_ID) || clean(bakedEnv.OWNER_BUILD_DEPLOY_ID),
    context: clean(runtimeEnv.CONTEXT) || clean(bakedEnv.OWNER_BUILD_CONTEXT),
    branch: clean(runtimeEnv.BRANCH) || clean(bakedEnv.OWNER_BUILD_BRANCH),
    builtAt: clean(bakedEnv.OWNER_BUILD_TIME),
    source: runtimeCommit ? 'runtime' : validCommit ? 'build' : null,
    appVersion: clean(bakedEnv.NEXT_PUBLIC_APP_VERSION),
  }
}

// MARK: - Rules

export type RulesCompare = {
  label: 'Firestore' | 'Storage'
  releaseId: string
  rulesetId: string | null
  releasedAt: string | null
  /** sha256 of the live ruleset's single file, and of the file this build was made from. */
  liveSha: string | null
  buildSha: string | null
  /** True when the live rules are byte for byte the file in this build (main, for a production deploy). */
  matches: boolean | null
  note: string | null
}

/**
 * Compares a live ruleset (GET firebaserules …/rulesets/{id}) with the build's rules file by sha256, as the rules
 * publish workflow does (`compareRuleset` in scripts/firebase-rules-deploy.mjs). `buildSha` null: the build did not
 * record its rules file, so only the release is shown.
 */
export function compareLiveRules(input: {
  label: RulesCompare['label']
  releaseId: string
  release: { rulesetName?: unknown; updateTime?: unknown } | null
  liveContentSha: string | null
  liveFileCount: number
  buildSha: string | null
}): RulesCompare {
  const rulesetName = typeof input.release?.rulesetName === 'string' ? input.release.rulesetName : ''
  const base = {
    label: input.label,
    releaseId: input.releaseId,
    rulesetId: rulesetName ? rulesetName.split('/').pop() || null : null,
    releasedAt: typeof input.release?.updateTime === 'string' ? input.release.updateTime : null,
    liveSha: input.liveContentSha,
    buildSha: input.buildSha,
  }
  if (!rulesetName) return { ...base, matches: null, note: 'No live release was found.' }
  if (input.liveFileCount !== 1 || !input.liveContentSha) {
    return { ...base, matches: false, note: `The live ruleset has ${input.liveFileCount} source files, expected 1.` }
  }
  if (!input.buildSha) return { ...base, matches: null, note: 'This build did not record its rules file, so it cannot compare.' }
  return input.liveContentSha === input.buildSha
    ? { ...base, matches: true, note: null }
    : { ...base, matches: false, note: 'The live rules differ from the file this site was built from.' }
}

// MARK: - platformConfig/app

export type SwitchRow = {
  field: string
  label: string
  /** "On everywhere", "On for 2 organisations", "Off". */
  state: string
  on: 'everywhere' | 'some' | 'off'
  organizationIds: string[]
}

const SWITCHES: ReadonlyArray<{ field: string; listField: string | null; label: string }> = [
  { field: 'enforcedReads', listField: SECURITY_SWITCH_ORGANIZATION_FIELDS.enforcedReads, label: 'Enforced reads (jobs and bookings)' },
  { field: 'privatePay', listField: SECURITY_SWITCH_ORGANIZATION_FIELDS.privatePay, label: 'Private pay' },
  { field: GHOST_ACCOUNTS_SWITCH_FIELD, listField: GHOST_ACCOUNTS_ORGANIZATION_IDS_FIELD, label: 'Ghost accounts (create toggle)' },
  { field: OPERATIVE_OWN_LEAVE_SWITCH_FIELD, listField: OPERATIVE_OWN_LEAVE_ORGANIZATION_IDS_FIELD, label: "Operatives read only their own leave" },
  { field: DATA_CHECK_PANEL_SWITCH_FIELD, listField: DATA_CHECK_PANEL_ORGANIZATION_IDS_FIELD, label: 'Data check panel' },
  { field: 'organizationErasureEnabled', listField: null, label: 'Company eraser (deletes for real)' },
]

export type PlatformConfigStatus = {
  minimumIosBuild: number | null
  minimumWebVersion: string | null
  switches: SwitchRow[]
}

/**
 * `platformConfig/app` as the Status page shows it (read-only, D17). A switch is on everywhere only when its field is
 * exactly `true`, on for some organisations when its list holds ids, else off — the shape `securitySwitchOn` reads.
 */
export function platformConfigStatus(config: Record<string, unknown> | null): PlatformConfigStatus {
  const data = config || {}
  const ios = data.minimumIosBuild
  const web = data.minimumWebVersion
  return {
    minimumIosBuild: typeof ios === 'number' && Number.isFinite(ios) ? ios : null,
    minimumWebVersion: typeof web === 'string' && web.trim() ? web.trim() : null,
    switches: SWITCHES.map((entry) => {
      const list = entry.listField && Array.isArray(data[entry.listField]) ? (data[entry.listField] as unknown[]) : []
      const ids = list.filter((id): id is string => typeof id === 'string' && id.trim() !== '')
      if (data[entry.field] === true) return { field: entry.field, label: entry.label, state: 'On everywhere', on: 'everywhere', organizationIds: ids }
      if (ids.length) {
        return {
          field: entry.field,
          label: entry.label,
          state: `On for ${ids.length} ${ids.length === 1 ? 'organisation' : 'organisations'}`,
          on: 'some',
          organizationIds: ids,
        }
      }
      return { field: entry.field, label: entry.label, state: 'Off', on: 'off', organizationIds: [] }
    }),
  }
}

// MARK: - Emails (emailLog, D9)

export type EmailLogSummary = {
  connected: true
  total: number
  failed: number
  /** At least this many: the read reached STATUS_EMAIL_READ_MAX. */
  capped: boolean
  /** Failures by email type, most first. */
  failedByType: { type: string; count: number }[]
  lastFailedAt: string | null
}

function rowTimeMs(value: unknown): number | null {
  if (value instanceof Date) return value.getTime()
  if (typeof value === 'string') {
    const ms = Date.parse(value)
    return Number.isFinite(ms) ? ms : null
  }
  if (typeof value === 'number' && Number.isFinite(value)) return value
  return null
}

/** `emailLog` rows of the window (PLAN §3.4: `{ type, status: sent|failed|deduped|rate_limited, at }`, no addresses). */
export function emailLogSummary(rows: readonly Record<string, unknown>[], capped = false): EmailLogSummary {
  const byType = new Map<string, number>()
  let failed = 0
  let lastFailed: number | null = null
  for (const row of rows) {
    if (row.status !== 'failed') continue
    failed += 1
    const type = typeof row.type === 'string' && row.type.trim() ? row.type.trim() : 'unknown'
    byType.set(type, (byType.get(type) || 0) + 1)
    const at = rowTimeMs(row.at)
    if (at != null && (lastFailed == null || at > lastFailed)) lastFailed = at
  }
  return {
    connected: true,
    total: rows.length,
    failed,
    capped,
    failedByType: [...byType.entries()].map(([type, count]) => ({ type, count })).sort((a, b) => b.count - a.count || a.type.localeCompare(b.type)),
    lastFailedAt: lastFailed != null ? new Date(lastFailed).toISOString() : null,
  }
}

// MARK: - Cloud Functions errors (Cloud Logging)

export type FunctionErrorsSummary = {
  connected: true
  total: number
  capped: boolean
  /** Errors by function, most first, each with its newest time. No log message leaves the server (it can hold data). */
  byFunction: { name: string; count: number; lastAt: string | null }[]
}

/** Cloud Logging entries (`entries:list`) of severity ERROR or worse, grouped by function. */
export function functionErrorsSummary(entries: readonly Record<string, unknown>[], capped = false): FunctionErrorsSummary {
  const byName = new Map<string, { count: number; last: number | null }>()
  for (const entry of entries) {
    const resource = (entry.resource && typeof entry.resource === 'object' ? entry.resource : {}) as { labels?: Record<string, unknown> }
    const labels = resource.labels || {}
    const raw = labels.function_name ?? labels.service_name
    const name = typeof raw === 'string' && raw.trim() ? raw.trim() : 'unknown'
    const at = rowTimeMs(entry.timestamp)
    const current = byName.get(name) || { count: 0, last: null }
    current.count += 1
    if (at != null && (current.last == null || at > current.last)) current.last = at
    byName.set(name, current)
  }
  return {
    connected: true,
    total: entries.length,
    capped,
    byFunction: [...byName.entries()]
      .map(([name, value]) => ({ name, count: value.count, lastAt: value.last != null ? new Date(value.last).toISOString() : null }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
  }
}

/** The Cloud Logging filter for the window: Cloud Functions (1st and 2nd gen) at ERROR or worse. */
export function functionErrorsFilter(since: Date): string {
  return `(resource.type="cloud_function" OR resource.type="cloud_run_revision") AND severity>=ERROR AND timestamp>="${since.toISOString()}"`
}

/** Logs Explorer, filtered the same way, for the "open" link. */
export function logsExplorerUrl(projectId: string, since: Date): string {
  const query = encodeURIComponent(functionErrorsFilter(since))
  return `https://console.cloud.google.com/logs/query;query=${query}?project=${encodeURIComponent(projectId)}`
}

/** The Firebase console page of one document (read-only link for platformConfig/app). */
export function firestoreConsoleDocUrl(projectId: string, path: string): string {
  const encoded = path
    .split('/')
    .map((part) => `~2F${encodeURIComponent(part)}`)
    .join('')
  return `https://console.firebase.google.com/project/${encodeURIComponent(projectId)}/firestore/databases/-default-/data/${encoded}`
}
