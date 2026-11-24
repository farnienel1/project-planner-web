/**
 * Server reads behind the owner console Status page. Each source is read on its own and fails on its own: a source
 * that cannot be read with the credentials the server already has comes back "Not connected" with the reason, never a
 * zero and never a failed page. No new credential is added: the owner's own ID token (platformConfig/app, readable by
 * anyone) and the existing service-account key (FIREBASE_SERVICE_ACCOUNT_JSON) for the rest.
 */
import { createHash } from 'node:crypto'
import { PLATFORM_CONFIG_APP_PATH } from '@/lib/canonical/platformConfig'
import { firestoreGet, restFieldsToPlain, restTimeRange, structuredQuery } from '@/lib/owner/firestoreRest'
import { adminCountCollection, adminGoogleAccessToken, firebaseAdminConfigured } from '@/lib/owner/identityToolkitAdmin'
import {
  STATUS_EMAIL_READ_MAX,
  STATUS_FUNCTION_ERRORS_READ_MAX,
  compareLiveRules,
  emailLogSummary,
  functionErrorsFilter,
  functionErrorsSummary,
  platformConfigStatus,
  type EmailLogSummary,
  type FunctionErrorsSummary,
  type NotConnected,
  type PlatformConfigStatus,
  type RulesCompare,
} from '@/lib/owner/platformStatus'

const NO_SERVER_KEY = 'Needs the server key (FIREBASE_SERVICE_ACCOUNT_JSON) on Netlify.'

function notConnected(reason: string): NotConnected {
  return { connected: false, reason }
}

const sha256 = (text: string) => createHash('sha256').update(text, 'utf8').digest('hex')

export async function readPlatformConfig(token: string): Promise<{ connected: true; config: PlatformConfigStatus } | NotConnected> {
  try {
    const doc = await firestoreGet(token, PLATFORM_CONFIG_APP_PATH)
    return { connected: true, config: platformConfigStatus(doc ? restFieldsToPlain(doc.fields) : null) }
  } catch (error) {
    console.error('[owner/status] platformConfig', error instanceof Error ? error.name : 'error')
    return notConnected('platformConfig/app could not be read just now. Try Refresh.')
  }
}

async function googleGet(url: string, token: string): Promise<{ status: number; body: Record<string, unknown> | null }> {
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' })
  const body = (await response.json().catch(() => null)) as Record<string, unknown> | null
  return { status: response.status, body }
}

/**
 * The live Firestore and Storage rules, compared by sha256 with the rules files this build was made from
 * (`OWNER_FIRESTORE_RULES_SHA256`, `OWNER_STORAGE_RULES_SHA256`, baked in by next.config.js). Read with the server key
 * through the Firebase Rules API, the same calls the rules publish workflow's `verify` makes.
 */
export async function readLiveRules(input: {
  firestoreBuildSha: string | null
  storageBuildSha: string | null
  bucket: string | null
}): Promise<{ connected: true; rules: RulesCompare[] } | NotConnected> {
  if (!firebaseAdminConfigured()) return notConnected(NO_SERVER_KEY)
  try {
    const { token, projectId } = await adminGoogleAccessToken(['https://www.googleapis.com/auth/firebase.readonly'])
    if (!projectId) return notConnected('The Firebase project id is missing on the server.')
    const api = 'https://firebaserules.googleapis.com/v1'
    const targets: { label: RulesCompare['label']; releaseId: string; buildSha: string | null }[] = [
      { label: 'Firestore', releaseId: 'cloud.firestore', buildSha: input.firestoreBuildSha },
    ]
    if (input.bucket) targets.push({ label: 'Storage', releaseId: `firebase.storage/${input.bucket}`, buildSha: input.storageBuildSha })
    const rules: RulesCompare[] = []
    for (const target of targets) {
      const release = await googleGet(`${api}/projects/${projectId}/releases/${target.releaseId}`, token)
      if (release.status === 403 || release.status === 401) {
        return notConnected('The server key may not read the Firebase rules (it needs the Firebase Rules Viewer role).')
      }
      const rulesetName = typeof release.body?.rulesetName === 'string' ? release.body.rulesetName : ''
      let liveSha: string | null = null
      let fileCount = 0
      if (rulesetName.startsWith(`projects/${projectId}/rulesets/`)) {
        const ruleset = await googleGet(`${api}/${rulesetName}`, token)
        const files = (ruleset.body?.source as { files?: { content?: unknown }[] } | undefined)?.files
        fileCount = Array.isArray(files) ? files.length : 0
        if (fileCount === 1 && typeof files?.[0]?.content === 'string') liveSha = sha256(files[0].content)
      }
      rules.push(
        compareLiveRules({
          label: target.label,
          releaseId: target.releaseId,
          release: release.status === 200 ? release.body : null,
          liveContentSha: liveSha,
          liveFileCount: fileCount,
          buildSha: target.buildSha,
        })
      )
    }
    return { connected: true, rules }
  } catch (error) {
    console.error('[owner/status] rules', error instanceof Error ? error.name : 'error')
    return notConnected('The live rules could not be read just now. Try Refresh.')
  }
}

/** Runs a structured query with the server key (rules do not apply). Throws when it is refused. */
async function adminRunQuery(query: Record<string, unknown>): Promise<Record<string, unknown>[]> {
  const { token, projectId } = await adminGoogleAccessToken(['https://www.googleapis.com/auth/datastore'])
  if (!projectId) throw new Error('Firebase project id is missing.')
  const response = await fetch(`https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/documents:runQuery`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ structuredQuery: query }),
    cache: 'no-store',
  })
  if (!response.ok) throw new Error(`Query refused (${response.status})`)
  const rows = (await response.json().catch(() => [])) as { document?: { fields?: Record<string, unknown> } }[]
  return (Array.isArray(rows) ? rows : []).filter((row) => row.document).map((row) => restFieldsToPlain(row.document?.fields))
}

/**
 * `emailLog` (D9) for the window, with the server key (the security rules give the collection to nobody). Until the
 * email function writes it (owner console PR 11) the collection is empty: that is "Not connected", never "0 failed".
 */
export async function readEmailLog(since: Date, until: Date): Promise<EmailLogSummary | NotConnected> {
  if (!firebaseAdminConfigured()) return notConnected(NO_SERVER_KEY)
  try {
    const rows = await adminRunQuery(structuredQuery('emailLog', restTimeRange('at', since, until), { limit: STATUS_EMAIL_READ_MAX }))
    if (rows.length === 0 && (await adminCountCollection('emailLog', 1)) === 0) {
      return notConnected('Nothing writes emailLog yet (the email function records sends from owner console PR 11).')
    }
    return emailLogSummary(rows, rows.length >= STATUS_EMAIL_READ_MAX)
  } catch (error) {
    console.error('[owner/status] emailLog', error instanceof Error ? error.name : 'error')
    return notConnected('emailLog could not be read just now. Try Refresh.')
  }
}

/**
 * Cloud Functions errors of the window from Cloud Logging, with the server key. The Firebase Admin service account
 * usually has no Logs Viewer role: a refusal is "Not connected" with that reason. Only the function name and time are
 * kept; no log message leaves the server.
 */
export async function readFunctionErrors(since: Date): Promise<FunctionErrorsSummary | NotConnected> {
  if (!firebaseAdminConfigured()) return notConnected(NO_SERVER_KEY)
  try {
    const { token, projectId } = await adminGoogleAccessToken(['https://www.googleapis.com/auth/logging.read'])
    if (!projectId) return notConnected('The Firebase project id is missing on the server.')
    const response = await fetch('https://logging.googleapis.com/v2/entries:list', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        resourceNames: [`projects/${projectId}`],
        filter: functionErrorsFilter(since),
        orderBy: 'timestamp desc',
        pageSize: STATUS_FUNCTION_ERRORS_READ_MAX,
      }),
      cache: 'no-store',
    })
    if (response.status === 403 || response.status === 401) {
      return notConnected('The server key may not read Cloud Logging (it needs the Logs Viewer role on the project).')
    }
    if (!response.ok) return notConnected('Cloud Logging could not be read just now. Try Refresh.')
    const body = (await response.json().catch(() => null)) as { entries?: Record<string, unknown>[]; nextPageToken?: string } | null
    const entries = body?.entries || []
    return functionErrorsSummary(entries, Boolean(body?.nextPageToken) || entries.length >= STATUS_FUNCTION_ERRORS_READ_MAX)
  } catch (error) {
    console.error('[owner/status] logging', error instanceof Error ? error.name : 'error')
    return notConnected('Cloud Logging could not be read just now. Try Refresh.')
  }
}
