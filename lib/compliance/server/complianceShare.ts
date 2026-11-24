import { createHash, randomBytes } from 'node:crypto'
import { adminGoogleAccessToken, signWithServiceAccount } from '@/lib/owner/identityToolkitAdmin'
import { firestoreDocumentsBase } from '@/lib/owner/googleApis'
import { firestoreValue } from '@/lib/stripe/writeOrgBilling'
import { FirestoreReadError, firestoreGet, restFieldsToPlain } from '@/lib/owner/firestoreRest'
import {
  ORG_COMPLIANCE_AUDIT_COLLECTION,
  ORG_COMPLIANCE_SHARE_LINKS_COLLECTION,
  orgComplianceDocumentPath,
  parseOrgComplianceDocuments,
  parseOrgComplianceShareLink,
  orgComplianceShareCreatorActive,
  type OrgComplianceDocuments,
  type OrgComplianceShareLink,
} from '@/lib/canonical/orgCompliance'

/**
 * Server side of rulebook 1.83.0 §31 share links. The service account (`FIREBASE_SERVICE_ACCOUNT_JSON`) reads and
 * writes the server-only collections (`complianceShareLinks`, `complianceAudit`: no security rule, so apps can neither
 * read nor write them) and signs short-lived Storage URLs. Who may create, list or revoke a link is decided by the
 * security rules themselves: the caller's own ID token must be able to read `orgCompliance/documents` (admins of
 * that organisation only, billing open, active).
 */

/** A share token: 32 random bytes, base64url. Only its sha256 is ever stored. */
export function newShareToken(): string {
  return randomBytes(32).toString('base64url')
}

/** The stored id of a token (sha256 hex). Null for a value that cannot be a token. */
export function shareLinkIdForToken(token: unknown): string | null {
  if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{40,60}$/.test(token)) return null
  return createHash('sha256').update(token).digest('hex')
}

async function adminSession() {
  const { token, projectId } = await adminGoogleAccessToken(['https://www.googleapis.com/auth/datastore'])
  const project = projectId || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || ''
  if (!project) throw new Error('Firebase project id is missing.')
  return { base: firestoreDocumentsBase(project), headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
}

function plainToFields(plain: Record<string, unknown>): Record<string, unknown> {
  const mapValue = firestoreValue(plain) as { mapValue: { fields: Record<string, unknown> } }
  return mapValue.mapValue.fields
}

async function adminGet(path: string): Promise<Record<string, unknown> | null> {
  const session = await adminSession()
  const response = await fetch(`${session.base}/${path}`, { headers: session.headers, cache: 'no-store' })
  if (response.status === 404) return null
  if (!response.ok) throw new Error(`read ${response.status}`)
  const body = (await response.json()) as { fields?: Record<string, unknown> }
  return restFieldsToPlain(body.fields)
}

async function adminPatch(path: string, plain: Record<string, unknown>, options: { mustNotExist?: boolean } = {}) {
  const session = await adminSession()
  const mask = Object.keys(plain).map((key) => `updateMask.fieldPaths=${encodeURIComponent(key)}`)
  if (options.mustNotExist) mask.push('currentDocument.exists=false')
  const response = await fetch(`${session.base}/${path}?${mask.join('&')}`, {
    method: 'PATCH',
    headers: session.headers,
    body: JSON.stringify({ fields: plainToFields(plain) }),
  })
  if (!response.ok) throw new Error(`write ${response.status}`)
}

/** One audit row (never a token, an address or a person's name): created, revoked, opened, file opened. */
export async function writeComplianceAudit(row: {
  organizationId: string
  action: 'link_created' | 'link_revoked' | 'link_opened' | 'file_opened'
  linkId: string
  actorUid?: string | null
  documentCount?: number
  documentKey?: string
}): Promise<void> {
  try {
    const session = await adminSession()
    const nowMs = Date.now()
    await fetch(`${session.base}/${ORG_COMPLIANCE_AUDIT_COLLECTION}`, {
      method: 'POST',
      headers: session.headers,
      body: JSON.stringify({
        fields: plainToFields({
          organizationId: row.organizationId,
          action: row.action,
          linkId: row.linkId,
          actorUid: row.actorUid ?? null,
          documentCount: row.documentCount ?? null,
          documentKey: row.documentKey ?? null,
          atMs: nowMs,
          // Firestore TTL field (kept two years).
          expireAt: new Date(nowMs + 2 * 365 * 24 * 60 * 60 * 1000),
        }),
      }),
    })
  } catch {
    // Audit is best effort; it never blocks the action.
  }
}

/**
 * The organisation's documents, read WITH THE CALLER'S OWN ID TOKEN: the security rules allow it only to an admin of
 * that organisation (active, billing open). `refused` for anyone else.
 */
export async function readComplianceAsCaller(
  idToken: string,
  organizationId: string
): Promise<{ ok: true; documents: OrgComplianceDocuments } | { ok: false; status: 403 | 400 | 503 }> {
  const path = orgComplianceDocumentPath(organizationId)
  if (!path) return { ok: false, status: 400 }
  try {
    const doc = await firestoreGet(idToken, path)
    return { ok: true, documents: parseOrgComplianceDocuments(doc ? restFieldsToPlain(doc.fields) : null, { organizationId }) }
  } catch (error) {
    // 401 / 403: the rules refused this caller. Anything else (a network error, a 5xx) is an outage, never a 403.
    const status = error instanceof FirestoreReadError ? error.status : 0
    return { ok: false, status: status === 401 || status === 403 ? 403 : 503 }
  }
}

/** The organisation's documents read with the service account (public share page only, after the link checks). */
export async function readComplianceAsServer(organizationId: string): Promise<OrgComplianceDocuments> {
  const path = orgComplianceDocumentPath(organizationId)
  if (!path) return parseOrgComplianceDocuments(null)
  return parseOrgComplianceDocuments(await adminGet(path), { organizationId })
}

export async function readOrganizationPublicName(organizationId: string): Promise<string> {
  const org = await adminGet(`organizations/${encodeURIComponent(organizationId)}`).catch(() => null)
  const name = org && typeof org.name === 'string' ? org.name.trim() : ''
  return name || 'Company'
}

/**
 * Whether the link's creator is still an active admin of the organisation (`orgComplianceShareCreatorActive`). Reads
 * their users document, and their membership here only when that document names another company. A read that fails
 * counts as not an admin, so the link shares nothing.
 */
export async function shareLinkCreatorStillAdmin(link: OrgComplianceShareLink, organization: Record<string, unknown>): Promise<boolean> {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(link.createdBy)) return false
  try {
    const user = await adminGet(`users/${encodeURIComponent(link.createdBy)}`)
    const home = user && typeof user.organizationId === 'string' ? user.organizationId.trim().toLowerCase() : ''
    const membership = home === link.organizationId.toLowerCase()
      ? null
      : await adminGet(`users/${encodeURIComponent(link.createdBy)}/orgMemberships/${encodeURIComponent(link.organizationId)}`)
    return orgComplianceShareCreatorActive({ organizationId: link.organizationId, createdBy: link.createdBy, organization, user, membership })
  } catch {
    return false
  }
}

export async function readShareLink(id: string): Promise<OrgComplianceShareLink | null> {
  return parseOrgComplianceShareLink(id, await adminGet(`${ORG_COMPLIANCE_SHARE_LINKS_COLLECTION}/${id}`))
}

export async function createShareLink(id: string, fields: Record<string, unknown>, expiresAtMs: number): Promise<void> {
  // Firestore TTL field: a link document is deleted 30 days after it expires.
  await adminPatch(`${ORG_COMPLIANCE_SHARE_LINKS_COLLECTION}/${id}`, { ...fields, expireAt: new Date(expiresAtMs + 30 * 24 * 60 * 60 * 1000) }, { mustNotExist: true })
}

export async function revokeShareLink(id: string, actorUid: string): Promise<void> {
  await adminPatch(`${ORG_COMPLIANCE_SHARE_LINKS_COLLECTION}/${id}`, { revokedAtMs: Date.now(), revokedBy: actorUid })
}

export async function noteShareLinkOpened(link: OrgComplianceShareLink): Promise<void> {
  await adminPatch(`${ORG_COMPLIANCE_SHARE_LINKS_COLLECTION}/${link.id}`, { openCount: link.openCount + 1, lastOpenedAtMs: Date.now() }).catch(() => {})
}

/** The organisation's links (newest first), at most 100. */
export async function listShareLinks(organizationId: string): Promise<OrgComplianceShareLink[]> {
  const session = await adminSession()
  const response = await fetch(`${session.base}:runQuery`, {
    method: 'POST',
    headers: session.headers,
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: ORG_COMPLIANCE_SHARE_LINKS_COLLECTION }],
        where: { fieldFilter: { field: { fieldPath: 'organizationId' }, op: 'EQUAL', value: { stringValue: organizationId } } },
        limit: 100,
      },
    }),
  })
  if (!response.ok) throw new Error(`query ${response.status}`)
  const rows = (await response.json()) as { document?: { name?: string; fields?: Record<string, unknown> } }[]
  return rows
    .map((row) => {
      const name = row.document?.name || ''
      return parseOrgComplianceShareLink(name.slice(name.lastIndexOf('/') + 1), restFieldsToPlain(row.document?.fields))
    })
    .filter((link): link is OrgComplianceShareLink => link !== null)
    .sort((a, b) => (b.createdAtMs ?? 0) - (a.createdAtMs ?? 0))
}

function rfc3986(value: string): string {
  return encodeURIComponent(value).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)
}

/**
 * A V4 signed GET URL for one Storage object, valid `seconds`, signed with the service account's key (no SDK).
 * `disposition` sets the download name. Null when no key or bucket is configured.
 */
export function signedStorageUrl(objectPath: string, seconds: number, disposition: { inline: boolean; fileName: string }, nowMs = Date.now()): string | null {
  const bucket = (process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || '').trim()
  if (!bucket || !objectPath || objectPath.includes('..')) return null
  const date = new Date(nowMs).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  const datestamp = date.slice(0, 8)
  const scope = `${datestamp}/auto/storage/goog4_request`
  const probe = signWithServiceAccount('probe')
  if (!probe) return null
  const host = 'storage.googleapis.com'
  const uri = `/${bucket}/${objectPath.split('/').map(rfc3986).join('/')}`
  const safeName = disposition.fileName.replace(/["\\\r\n]/g, '_') || 'document'
  const params: Record<string, string> = {
    'X-Goog-Algorithm': 'GOOG4-RSA-SHA256',
    'X-Goog-Credential': `${probe.clientEmail}/${scope}`,
    'X-Goog-Date': date,
    'X-Goog-Expires': String(Math.max(1, Math.min(604800, Math.floor(seconds)))),
    'X-Goog-SignedHeaders': 'host',
    'response-content-disposition': `${disposition.inline ? 'inline' : 'attachment'}; filename="${safeName.replace(/[^\x20-\x7e]/g, '_')}"; filename*=UTF-8''${rfc3986(safeName)}`,
  }
  const query = Object.keys(params)
    .sort()
    .map((key) => `${rfc3986(key)}=${rfc3986(params[key])}`)
    .join('&')
  const canonicalRequest = ['GET', uri, query, `host:${host}\n`, 'host', 'UNSIGNED-PAYLOAD'].join('\n')
  const stringToSign = ['GOOG4-RSA-SHA256', date, scope, createHash('sha256').update(canonicalRequest).digest('hex')].join('\n')
  const signed = signWithServiceAccount(stringToSign)
  if (!signed) return null
  return `https://${host}${uri}?${query}&X-Goog-Signature=${signed.signatureHex}`
}
