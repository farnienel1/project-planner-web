/**
 * Rulebook 1.32.4 (§16): the security rules read the caller's role and company facts from the Auth custom claims
 * (`request.auth.token.pp`), which the Cloud Function sets from Firestore with `authClaimsForPerson`. The rules suites
 * build every signed-in context the same way: they read the caller's users document, memberships and the
 * organisations from the emulator (rules off, over REST — no extra SDK client per context) and pass the claims the
 * function would set. So each test runs with the claims of the data it seeded, as a client does once it has refreshed
 * its token after the marker changed.
 */
import type { RulesTestContext, RulesTestEnvironment, TokenOptions } from '@firebase/rules-unit-testing'
import { authClaimsForPerson } from '../lib/canonical/authClaims'

type RestValue = Record<string, unknown>
type RestDocument = { name: string; fields?: Record<string, RestValue> }

/** A Firestore reference read over REST: not a plain map, carries its path (as the SDK DocumentReference does). */
class RestReference {
  constructor(public path: string) {}
}

function decode(value: RestValue): unknown {
  if ('nullValue' in value) return null
  if ('booleanValue' in value) return value.booleanValue
  if ('integerValue' in value) return Number(value.integerValue)
  if ('doubleValue' in value) return Number(value.doubleValue)
  if ('stringValue' in value) return value.stringValue
  if ('timestampValue' in value) return new Date(String(value.timestampValue))
  if ('referenceValue' in value) return new RestReference(String(value.referenceValue).replace(/^projects\/[^/]+\/databases\/[^/]+\/documents\//, ''))
  if ('arrayValue' in value) return (((value.arrayValue as { values?: RestValue[] }).values) ?? []).map(decode)
  if ('mapValue' in value) return decodeFields((value.mapValue as { fields?: Record<string, RestValue> }).fields)
  return value
}

function decodeFields(fields: Record<string, RestValue> | undefined): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(fields ?? {})) out[key] = decode(value)
  return out
}

function emulatorBase(env: RulesTestEnvironment): string {
  const host = env.emulators.firestore
  if (!host) throw new Error('No Firestore emulator in this test environment')
  return `http://${host.host}:${host.port}/v1/projects/${env.projectId}/databases/(default)/documents`
}

async function restGet(url: string): Promise<Record<string, unknown> | null> {
  const response = await fetch(url, { headers: { Authorization: 'Bearer owner' } })
  if (response.status === 404) return null
  if (!response.ok) throw new Error(`emulator read failed ${response.status}: ${await response.text()}`)
  return (await response.json()) as Record<string, unknown>
}

async function restList(url: string): Promise<Record<string, Record<string, unknown>>> {
  const out: Record<string, Record<string, unknown>> = {}
  let pageToken = ''
  do {
    const page = await restGet(`${url}?pageSize=300${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`)
    for (const document of ((page?.documents as RestDocument[] | undefined) ?? [])) {
      out[document.name.split('/').pop() ?? ''] = decodeFields(document.fields)
    }
    pageToken = String(page?.nextPageToken ?? '')
  } while (pageToken)
  return out
}

export async function authClaimsFromEmulator(env: RulesTestEnvironment, uid: string): Promise<Record<string, unknown>> {
  const base = emulatorBase(env)
  const id = encodeURIComponent(uid)
  const [user, organizations, memberships] = await Promise.all([
    restGet(`${base}/users/${id}`),
    restList(`${base}/organizations`),
    restList(`${base}/users/${id}/orgMemberships`),
  ])
  const claims = authClaimsForPerson({
    uid,
    user: user ? decodeFields((user as RestDocument).fields) : null,
    organizations,
    memberships,
    stamp: 1,
  }).claims
  return claims
}

/** A signed-in context whose token carries the claims of the current emulator data (plus `token`). */
export async function claimsContext(env: RulesTestEnvironment, uid: string, token: TokenOptions = {}): Promise<RulesTestContext> {
  return env.authenticatedContext(uid, { ...token, ...(await authClaimsFromEmulator(env, uid)) })
}
