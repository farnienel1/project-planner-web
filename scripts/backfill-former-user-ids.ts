/**
 * One-off: give people who accepted an invite before `formerUserIds` existed
 * their invite placeholder id back, so bookings, leave, and warning exclusions
 * saved under it show on Daily Overview and stop flagging them as unbooked.
 *
 * Nothing stored the placeholder id next to an email, so matches are proposals
 * from timing evidence (see lib/maintenance/formerUserIdBackfill.ts). Review the
 * file before writing. The write only appends to `users/{uid}.formerUserIds`.
 *
 * Needs FIREBASE_SERVICE_ACCOUNT_JSON (or FIRESTORE_EMULATOR_HOST for a local run).
 *
 *   npx tsx scripts/backfill-former-user-ids.ts                      # dry run, all companies
 *   npx tsx scripts/backfill-former-user-ids.ts --org ORG_ID --out proposals.json
 *   npx tsx scripts/backfill-former-user-ids.ts --write --proposals proposals.json
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { USER_FORMER_IDS_FIELD, parseFormerUserIds, parseWarningDetection } from '../lib/canonical'
import { restFieldsToPlain } from '../lib/owner/firestoreRest'
import { adminGoogleAccessToken, firebaseAdminConfigured } from '../lib/owner/identityToolkitAdmin'
import {
  formerUserIdWritesFromProposals,
  proposeFormerUserIdBackfill,
  type BackfillReference,
  type OrphanProposal,
} from '../lib/maintenance/formerUserIdBackfill'

type RestDocument = { name?: string; fields?: Record<string, unknown> }
type Plain = Record<string, unknown>

function argValue(flag: string): string | null {
  const index = process.argv.indexOf(flag)
  return index >= 0 ? process.argv[index + 1] || null : null
}

const write = process.argv.includes('--write')
const onlyOrg = argValue('--org')
const proposalsPath = argValue('--proposals')
const outPath = argValue('--out') || join(tmpdir(), `former-user-ids-proposals-${Date.now()}.json`)

function projectId(fallback = ''): string {
  return fallback || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'project-planner-f986c'
}

async function documentsRoot(): Promise<{ root: string; headers: Record<string, string> }> {
  const emulator = process.env.FIRESTORE_EMULATOR_HOST?.trim()
  if (emulator) {
    const origin = emulator.startsWith('http') ? emulator.replace(/\/$/, '') : `http://${emulator}`
    return {
      root: `${origin}/v1/projects/${encodeURIComponent(projectId())}/databases/(default)/documents`,
      headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' },
    }
  }
  if (!firebaseAdminConfigured()) {
    throw new Error('Set FIREBASE_SERVICE_ACCOUNT_JSON (or FIRESTORE_EMULATOR_HOST) before running this script.')
  }
  const { token, projectId: fromAccount } = await adminGoogleAccessToken(['https://www.googleapis.com/auth/datastore'])
  return {
    root: `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId(fromAccount))}/databases/(default)/documents`,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  }
}

function idOf(document: RestDocument): string {
  const parts = String(document.name || '').split('/')
  return parts[parts.length - 1] || ''
}

async function listCollection(api: Awaited<ReturnType<typeof documentsRoot>>, path: string) {
  const rows: { id: string; data: Plain }[] = []
  let pageToken = ''
  do {
    const url = `${api.root}/${path}?pageSize=300${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`
    const response = await fetch(url, { headers: api.headers })
    if (!response.ok) throw new Error(`Reading ${path} failed: ${response.status} ${await response.text()}`)
    const body = (await response.json()) as { documents?: RestDocument[]; nextPageToken?: string }
    for (const document of body.documents || []) rows.push({ id: idOf(document), data: restFieldsToPlain(document.fields) })
    pageToken = body.nextPageToken || ''
  } while (pageToken)
  return rows
}

async function queryByOrganization(api: Awaited<ReturnType<typeof documentsRoot>>, collectionId: string, organizationId: string) {
  const response = await fetch(`${api.root}:runQuery`, {
    method: 'POST',
    headers: api.headers,
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId }],
        where: {
          fieldFilter: { field: { fieldPath: 'organizationId' }, op: 'EQUAL', value: { stringValue: organizationId } },
        },
      },
    }),
  })
  if (!response.ok) throw new Error(`Querying ${collectionId} failed: ${response.status} ${await response.text()}`)
  const rows = (await response.json()) as { document?: RestDocument }[]
  return rows
    .filter((row) => row.document)
    .map((row) => ({ id: idOf(row.document!), data: restFieldsToPlain(row.document!.fields) }))
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function date(value: unknown): Date | null {
  return value instanceof Date && !Number.isNaN(value.getTime()) ? value : null
}

async function proposalsForOrganization(
  api: Awaited<ReturnType<typeof documentsRoot>>,
  organizationId: string,
  organization: Plain
): Promise<OrphanProposal[]> {
  const base = `organizations/${organizationId}`
  const [users, operatives, bookings, managerSiteBookings, holidays, invitations] = await Promise.all([
    queryByOrganization(api, 'users', organizationId),
    listCollection(api, `${base}/operatives`),
    listCollection(api, `${base}/bookings`),
    listCollection(api, `${base}/managerSiteBookings`),
    listCollection(api, `${base}/holidayBookings`),
    queryByOrganization(api, 'invitations', organizationId),
  ])

  const references: BackfillReference[] = []
  for (const { data } of bookings) {
    references.push({
      personId: text(data.operativeId) || text(data.operativeID),
      source: 'booking',
      createdAt: date(data.createdAt),
    })
  }
  for (const { data } of managerSiteBookings) {
    references.push({ personId: text(data.userId), source: 'managerSiteBooking', createdAt: date(data.createdAt) })
  }
  for (const { data } of holidays) {
    for (const personId of [text(data.userId), text(data.operativeId)]) {
      if (personId) references.push({ personId, source: 'holiday', createdAt: date(data.createdAt) })
    }
  }
  for (const personId of parseWarningDetection(organization).excludedUserIdsFromUnbookedWarnings ?? []) {
    references.push({ personId, source: 'warningExclusion' })
  }

  return proposeFormerUserIdBackfill({
    organizationId,
    users: users.map(({ id, data }) => ({
      id,
      email: text(data.email),
      name: `${text(data.firstName)} ${text(data.surname)}`.trim() || text(data.email) || id,
      formerIds: parseFormerUserIds(data),
    })),
    operativeIds: operatives.map((row) => row.id),
    references,
    invitations: invitations.map(({ data }) => ({
      email: text(data.email),
      isUsed: data.isUsed === true,
      createdAt: date(data.createdAt),
      usedAt: date(data.usedAt),
    })),
  })
}

async function dryRun() {
  const api = await documentsRoot()
  const organizations = (await listCollection(api, 'organizations')).filter((row) => !onlyOrg || row.id === onlyOrg)
  const proposals: OrphanProposal[] = []
  for (const organization of organizations) {
    proposals.push(...(await proposalsForOrganization(api, organization.id, organization.data)))
  }
  writeFileSync(outPath, `${JSON.stringify(proposals, null, 2)}\n`)
  const count = (status: OrphanProposal['status']) => proposals.filter((row) => row.status === status).length
  console.log(
    JSON.stringify(
      {
        mode: 'dry-run',
        organizations: organizations.length,
        orphanedIds: proposals.length,
        matched: count('matched'),
        ambiguous: count('ambiguous'),
        unmatched: count('unmatched'),
        proposals: outPath,
        next: 'Review the file. Set "apply": true and "userId" only where you are sure, then re-run with --write --proposals <file>.',
      },
      null,
      2
    )
  )
}

async function applyProposals(path: string) {
  const proposals = JSON.parse(readFileSync(path, 'utf8')) as OrphanProposal[]
  const writes = formerUserIdWritesFromProposals(proposals)
  if (writes.size === 0) {
    console.log('Nothing marked "apply": true with a userId. No writes.')
    return
  }
  const api = await documentsRoot()
  const documentPrefix = api.root.replace(/^.*\/v1\//, '')
  let written = 0
  for (const [userId, ids] of writes) {
    const response = await fetch(`${api.root.replace(/\/documents$/, '')}/documents:commit`, {
      method: 'POST',
      headers: api.headers,
      body: JSON.stringify({
        writes: [
          {
            transform: {
              document: `${documentPrefix}/users/${userId}`,
              // arrayUnion: keeps every id already recorded, never removes one.
              fieldTransforms: [
                {
                  fieldPath: USER_FORMER_IDS_FIELD,
                  appendMissingElements: { values: ids.map((id) => ({ stringValue: id })) },
                },
              ],
            },
            currentDocument: { exists: true },
          },
        ],
      }),
    })
    if (!response.ok) {
      console.error(`users/${userId}: failed ${response.status} ${await response.text()}`)
      process.exitCode = 1
      continue
    }
    written += 1
    console.log(`users/${userId}.${USER_FORMER_IDS_FIELD} += ${ids.join(', ')}`)
  }
  console.log(JSON.stringify({ mode: 'write', accountsUpdated: written, accountsPlanned: writes.size }, null, 2))
}

async function main() {
  if (write) {
    if (!proposalsPath) throw new Error('--write needs --proposals <reviewed file from a dry run>.')
    await applyProposals(proposalsPath)
    return
  }
  await dryRun()
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
