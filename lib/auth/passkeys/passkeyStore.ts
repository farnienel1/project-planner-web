import { adminGoogleAccessToken, adminSignCustomToken } from '@/lib/owner/identityToolkitAdmin'
import { firestoreDocumentsBase, identityToolkitBase } from '@/lib/owner/googleApis'
import { sessionCookieAllowsUnsigned, sessionProjectId } from '@/lib/auth/mfa/mfaSessionCookie'

/**
 * Server-only storage for passkeys, through the Firestore REST API with the service account (rules do not apply).
 *
 * - `webauthnCredentials/c_{credentialId}`: one passkey — `uid`, `publicKey` (base64url COSE key), `counter`,
 *   `transports`, `label`, `createdAt`, `lastUsedAt`, `backedUp`, `deviceType`, `rpId`. No secret: a public key and a
 *   counter. The `c_` prefix keeps a credential id that starts with `__` a legal document id.
 * - `webauthnUsedChallenges/{sha256}`: a challenge already used (single-use), with `expireAt` for a TTL policy.
 *
 * Both are top-level collections that `firestore.rules` does not match, so every client read and write is denied by
 * default (`tests/passkeys.rules.test.ts`). Only these server routes touch them.
 */

export const PASSKEY_COLLECTION = 'webauthnCredentials'
export const PASSKEY_USED_CHALLENGES_COLLECTION = 'webauthnUsedChallenges'

export type StoredPasskey = {
  id: string
  uid: string
  publicKey: string
  counter: number
  transports: string[]
  label: string
  createdAtMs: number | null
  lastUsedAtMs: number | null
  backedUp: boolean
  deviceType: string
  rpId: string
  /**
   * The WebAuthn user handle (base64url) given to the authenticator at registration. Compared at sign-in, so
   * rotating MFA_SIGNING_SECRET never breaks a saved passkey. '' for passkeys saved before it was stored.
   */
  userHandle: string
  /** The document's update time, for a conditional counter update. */
  updateTime?: string
}

export type NewPasskey = Omit<StoredPasskey, 'createdAtMs' | 'lastUsedAtMs' | 'updateTime'> & { createdAtMs: number }

export interface PasskeyStore {
  /** `used` when the challenge was consumed before (a replay); `consumed` the first time. */
  consumeChallenge(challengeId: string, expiresAtMs: number): Promise<'consumed' | 'used'>
  get(credentialId: string): Promise<StoredPasskey | null>
  listForUser(uid: string): Promise<StoredPasskey[]>
  create(passkey: NewPasskey): Promise<'created' | 'exists'>
  /** `conflict` when the document changed since it was read (another sign-in with the same passkey raced it). */
  recordUse(passkey: StoredPasskey, use: { counter: number; lastUsedAtMs: number }): Promise<'ok' | 'conflict'>
  delete(credentialId: string): Promise<void>
  deleteAllForUser(uid: string): Promise<number>
}

export type AuthAccount = {
  exists: boolean
  disabled: boolean
  email: string | null
  emailVerified: boolean
  /** When the account's password was last set or changed (Auth `passwordUpdatedAt`, ms); null when unknown. */
  passwordUpdatedAtMs?: number | null
}

export interface PasskeyAuthAccounts {
  /** Throws when Auth cannot be asked; callers refuse rather than guess. */
  lookup(uid: string): Promise<AuthAccount>
  customToken(uid: string): Promise<string>
  /** The uid for a sign-in email, or null when there is no such account. Throws when Auth cannot be asked. */
  uidForEmail?(email: string): Promise<string | null>
}

export function passkeyDocumentId(credentialId: string): string {
  return `c_${credentialId}`
}

/** A credential id as WebAuthn gives it: base64url, 16–1023 characters (the spec allows up to 1023 bytes). */
export function isPasskeyCredentialId(value: unknown): value is string {
  return typeof value === 'string' && value.length >= 16 && value.length <= 1400 && /^[A-Za-z0-9_-]+$/.test(value)
}

async function adminBearer(): Promise<string> {
  if (sessionCookieAllowsUnsigned()) return 'owner'
  const access = await adminGoogleAccessToken([
    'https://www.googleapis.com/auth/datastore',
    'https://www.googleapis.com/auth/identitytoolkit',
    'https://www.googleapis.com/auth/firebase',
  ])
  return access.token
}

type RestFields = Record<string, Record<string, unknown>>

function str(fields: RestFields | undefined, key: string): string {
  const value = fields?.[key]?.stringValue
  return typeof value === 'string' ? value : ''
}

function num(fields: RestFields | undefined, key: string): number {
  const raw = fields?.[key]
  if (!raw) return 0
  if (typeof raw.integerValue === 'string') return Number(raw.integerValue) || 0
  if (typeof raw.doubleValue === 'number') return raw.doubleValue
  return 0
}

function ms(fields: RestFields | undefined, key: string): number | null {
  const value = fields?.[key]?.timestampValue
  if (typeof value !== 'string') return null
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : null
}

export function passkeyFromDocument(document: { name?: string; fields?: RestFields; updateTime?: string }): StoredPasskey | null {
  const name = document.name || ''
  const docId = decodeURIComponent(name.slice(name.lastIndexOf('/') + 1))
  if (!docId.startsWith('c_')) return null
  const fields = document.fields
  const uid = str(fields, 'uid')
  const publicKey = str(fields, 'publicKey')
  if (!uid || !publicKey) return null
  const transports = (fields?.transports?.arrayValue as { values?: { stringValue?: string }[] } | undefined)?.values || []
  return {
    id: docId.slice(2),
    uid,
    publicKey,
    counter: num(fields, 'counter'),
    transports: transports.map((row) => row.stringValue || '').filter(Boolean),
    label: str(fields, 'label'),
    createdAtMs: ms(fields, 'createdAt'),
    lastUsedAtMs: ms(fields, 'lastUsedAt'),
    backedUp: fields?.backedUp?.booleanValue === true,
    deviceType: str(fields, 'deviceType'),
    rpId: str(fields, 'rpId'),
    userHandle: str(fields, 'userHandle'),
    ...(document.updateTime ? { updateTime: document.updateTime } : {}),
  }
}

function passkeyFields(passkey: NewPasskey): RestFields {
  return {
    uid: { stringValue: passkey.uid },
    publicKey: { stringValue: passkey.publicKey },
    counter: { integerValue: String(Math.max(0, Math.floor(passkey.counter))) },
    transports: { arrayValue: { values: passkey.transports.map((value) => ({ stringValue: value })) } },
    label: { stringValue: passkey.label },
    createdAt: { timestampValue: new Date(passkey.createdAtMs).toISOString() },
    backedUp: { booleanValue: passkey.backedUp },
    deviceType: { stringValue: passkey.deviceType },
    rpId: { stringValue: passkey.rpId },
    userHandle: { stringValue: passkey.userHandle || '' },
  }
}

async function failure(response: Response, what: string): Promise<Error> {
  const text = (await response.text().catch(() => '')).slice(0, 300)
  return new Error(`${what} failed (${response.status})${text ? `: ${text}` : ''}`)
}

/** The Firestore REST store. `fetchImpl` and `bearer` are for tests. */
export function firestorePasskeyStore(options: { fetchImpl?: typeof fetch; bearer?: () => Promise<string>; base?: string } = {}): PasskeyStore {
  const doFetch = options.fetchImpl || fetch
  const bearer = options.bearer || adminBearer
  const base = () => options.base || firestoreDocumentsBase()
  const headers = async () => ({ Authorization: `Bearer ${await bearer()}`, 'Content-Type': 'application/json' })

  async function createNamed(collection: string, id: string, fields: RestFields): Promise<'created' | 'exists'> {
    const response = await doFetch(`${base()}/${collection}?documentId=${encodeURIComponent(id)}`, {
      method: 'POST',
      headers: await headers(),
      body: JSON.stringify({ fields }),
    })
    if (response.status === 409) return 'exists'
    if (!response.ok) {
      const text = await response.text().catch(() => '')
      if (text.includes('ALREADY_EXISTS')) return 'exists'
      throw new Error(`Creating ${collection} failed (${response.status})`)
    }
    return 'created'
  }

  return {
    async consumeChallenge(challengeId, expiresAtMs) {
      const result = await createNamed(PASSKEY_USED_CHALLENGES_COLLECTION, challengeId, {
        usedAt: { timestampValue: new Date().toISOString() },
        expireAt: { timestampValue: new Date(expiresAtMs).toISOString() },
      })
      return result === 'created' ? 'consumed' : 'used'
    },
    async get(credentialId) {
      if (!isPasskeyCredentialId(credentialId)) return null
      const response = await doFetch(`${base()}/${PASSKEY_COLLECTION}/${encodeURIComponent(passkeyDocumentId(credentialId))}`, {
        headers: await headers(),
        cache: 'no-store',
      })
      if (response.status === 404) return null
      if (!response.ok) throw await failure(response, 'Reading a passkey')
      return passkeyFromDocument((await response.json()) as { name?: string; fields?: RestFields; updateTime?: string })
    },
    async listForUser(uid) {
      const response = await doFetch(`${base()}:runQuery`, {
        method: 'POST',
        headers: await headers(),
        body: JSON.stringify({
          structuredQuery: {
            from: [{ collectionId: PASSKEY_COLLECTION }],
            where: { fieldFilter: { field: { fieldPath: 'uid' }, op: 'EQUAL', value: { stringValue: uid } } },
            limit: 50,
          },
        }),
      })
      if (!response.ok) throw await failure(response, 'Listing passkeys')
      const rows = (await response.json()) as { document?: { name?: string; fields?: RestFields; updateTime?: string } }[]
      return rows
        .map((row) => (row.document ? passkeyFromDocument(row.document) : null))
        .filter((row): row is StoredPasskey => Boolean(row && row.uid === uid))
    },
    async create(passkey) {
      return createNamed(PASSKEY_COLLECTION, passkeyDocumentId(passkey.id), passkeyFields(passkey))
    },
    async recordUse(passkey, use) {
      // A :commit write, because its precondition (`currentDocument.updateTime`) is honoured by Firestore and the
      // emulator alike; the PATCH query-parameter form is ignored by the emulator.
      const documents = base()
      const name = `${documents.slice(documents.indexOf('/v1/') + 4)}/${PASSKEY_COLLECTION}/${passkeyDocumentId(passkey.id)}`
      const response = await doFetch(`${documents}:commit`, {
        method: 'POST',
        headers: await headers(),
        body: JSON.stringify({
          writes: [
            {
              update: {
                name,
                fields: {
                  counter: { integerValue: String(Math.max(0, Math.floor(use.counter))) },
                  lastUsedAt: { timestampValue: new Date(use.lastUsedAtMs).toISOString() },
                },
              },
              updateMask: { fieldPaths: ['counter', 'lastUsedAt'] },
              currentDocument: passkey.updateTime ? { updateTime: passkey.updateTime } : { exists: true },
            },
          ],
        }),
      })
      if (response.status === 400 || response.status === 404 || response.status === 409) {
        const text = await response.text().catch(() => '')
        if (response.status !== 400 || /FAILED_PRECONDITION|NOT_FOUND/.test(text)) return 'conflict'
        throw new Error(`Recording a passkey sign-in failed (${response.status})`)
      }
      if (!response.ok) throw await failure(response, 'Recording a passkey sign-in')
      return 'ok'
    },
    async delete(credentialId) {
      if (!isPasskeyCredentialId(credentialId)) return
      const response = await doFetch(`${base()}/${PASSKEY_COLLECTION}/${encodeURIComponent(passkeyDocumentId(credentialId))}`, {
        method: 'DELETE',
        headers: await headers(),
      })
      if (!response.ok && response.status !== 404) throw await failure(response, 'Removing a passkey')
    },
    async deleteAllForUser(uid) {
      const rows = await this.listForUser(uid)
      for (const row of rows) await this.delete(row.id)
      return rows.length
    },
  }
}

/** Auth with the service account: the account's state, and a custom token for it. */
export function firebasePasskeyAuthAccounts(options: { fetchImpl?: typeof fetch; bearer?: () => Promise<string> } = {}): PasskeyAuthAccounts {
  const doFetch = options.fetchImpl || fetch
  const bearer = options.bearer || adminBearer
  return {
    async lookup(uid) {
      const projectId = sessionProjectId()
      if (!projectId) throw new Error('NEXT_PUBLIC_FIREBASE_PROJECT_ID is not set')
      const response = await doFetch(`${identityToolkitBase()}/projects/${encodeURIComponent(projectId)}/accounts:lookup`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${await bearer()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ localId: [uid] }),
      })
      if (!response.ok) throw new Error(`Looking up the account failed (${response.status})`)
      const data = (await response.json()) as {
        users?: { localId?: string; disabled?: boolean; email?: string; emailVerified?: boolean; passwordUpdatedAt?: number | string }[]
      }
      const user = data.users?.find((row) => row.localId === uid)
      if (!user) return { exists: false, disabled: false, email: null, emailVerified: false, passwordUpdatedAtMs: null }
      const passwordUpdatedAtMs = Number(user.passwordUpdatedAt)
      return {
        exists: true,
        disabled: user.disabled === true,
        email: user.email ? user.email.trim().toLowerCase() : null,
        emailVerified: user.emailVerified === true,
        passwordUpdatedAtMs: Number.isFinite(passwordUpdatedAtMs) && passwordUpdatedAtMs > 0 ? passwordUpdatedAtMs : null,
      }
    },
    async customToken(uid) {
      return adminSignCustomToken(uid, { emulator: sessionCookieAllowsUnsigned() })
    },
    async uidForEmail(email) {
      const projectId = sessionProjectId()
      const clean = email.trim().toLowerCase()
      if (!projectId || !clean) return null
      const response = await doFetch(`${identityToolkitBase()}/projects/${encodeURIComponent(projectId)}/accounts:lookup`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${await bearer()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: [clean] }),
      })
      if (!response.ok) throw new Error(`Looking up the account failed (${response.status})`)
      const data = (await response.json()) as { users?: { localId?: string }[] }
      return data.users?.[0]?.localId || null
    },
  }
}
