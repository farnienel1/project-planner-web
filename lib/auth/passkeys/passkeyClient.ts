'use client'

import {
  browserSupportsWebAuthn,
  browserSupportsWebAuthnAutofill,
  startAuthentication,
  startRegistration,
  WebAuthnAbortService,
} from '@simplewebauthn/browser'

import { passkeysEnabled } from '@/lib/auth/passkeys/passkeyConfig'
import { getClientAuthHeaders, jsonAuthHeaders } from '@/lib/security/clientAuthHeaders'

const FETCH_OPTS: RequestInit = { credentials: 'include', cache: 'no-store' }

export type PasskeyRow = { id: string; label: string; createdAtMs: number | null; lastUsedAtMs: number | null; backedUp: boolean }

/** Shown only when the switch is on and this browser can use WebAuthn at all. */
export function passkeysAvailableHere(): boolean {
  if (!passkeysEnabled()) return false
  try {
    return browserSupportsWebAuthn()
  } catch {
    return false
  }
}

export async function passkeyAutofillAvailable(): Promise<boolean> {
  if (!passkeysAvailableHere()) return false
  try {
    return await browserSupportsWebAuthnAutofill()
  } catch {
    return false
  }
}

export class PasskeyError extends Error {
  readonly code: string
  constructor(message: string, code = 'passkey_error') {
    super(message)
    this.name = 'PasskeyError'
    this.code = code
  }
}

/** The person closed the browser's passkey prompt (or it timed out): not an error worth showing. */
export function isPasskeyCancelled(error: unknown): boolean {
  const name = error && typeof error === 'object' && 'name' in error ? String((error as { name: unknown }).name) : ''
  const code = error && typeof error === 'object' && 'code' in error ? String((error as { code: unknown }).code) : ''
  return name === 'NotAllowedError' || name === 'AbortError' || code === 'ERROR_CEREMONY_ABORTED'
}

async function readJson(response: Response): Promise<Record<string, unknown>> {
  return (await response.json().catch(() => ({}))) as Record<string, unknown>
}

function fail(data: Record<string, unknown>, fallback: string): never {
  throw new PasskeyError(typeof data.error === 'string' && data.error ? data.error : fallback, typeof data.code === 'string' ? data.code : 'passkey_error')
}

/**
 * Sign in with a passkey. `autofill` waits on the browser's autofill (conditional UI) instead of opening a prompt.
 * Returns the custom token and where to go; the caller hands the token to `useAuthStore().signInWithPasskey`.
 */
export async function passkeySignIn(input: { next?: string; ownerOnly?: boolean; autofill?: boolean } = {}): Promise<{ customToken: string; next: string }> {
  const optionsResponse = await fetch('/api/auth/passkey/login/options', {
    ...FETCH_OPTS,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ next: input.next || '', ownerOnly: input.ownerOnly === true }),
  })
  const optionsData = await readJson(optionsResponse)
  if (!optionsResponse.ok) fail(optionsData, 'Passkey sign-in is unavailable right now.')
  const assertion = await startAuthentication({
    optionsJSON: optionsData.options as Parameters<typeof startAuthentication>[0]['optionsJSON'],
    useBrowserAutofill: input.autofill === true,
  })
  const verifyResponse = await fetch('/api/auth/passkey/login/verify', {
    ...FETCH_OPTS,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ response: assertion }),
  })
  const data = await readJson(verifyResponse)
  if (!verifyResponse.ok || typeof data.customToken !== 'string') fail(data, 'That passkey could not be used to sign in.')
  return { customToken: data.customToken as string, next: typeof data.next === 'string' ? data.next : '' }
}

/** Stop a waiting autofill request (when the page leaves or the button is pressed). */
export function cancelPasskeyCeremony() {
  try {
    WebAuthnAbortService.cancelCeremony()
  } catch {
    /* nothing waiting */
  }
}

export async function listPasskeys(): Promise<PasskeyRow[]> {
  const response = await fetch('/api/auth/passkey/credentials', { ...FETCH_OPTS, headers: await getClientAuthHeaders() })
  const data = await readJson(response)
  if (!response.ok) fail(data, 'Could not load your passkeys.')
  return Array.isArray(data.passkeys) ? (data.passkeys as PasskeyRow[]) : []
}

export async function addPasskey(label?: string): Promise<PasskeyRow> {
  const optionsResponse = await fetch('/api/auth/passkey/register/options', {
    ...FETCH_OPTS,
    method: 'POST',
    headers: await jsonAuthHeaders(),
    body: JSON.stringify({}),
  })
  const optionsData = await readJson(optionsResponse)
  if (!optionsResponse.ok) fail(optionsData, 'Could not start adding a passkey.')
  const attestation = await startRegistration({
    optionsJSON: optionsData.options as Parameters<typeof startRegistration>[0]['optionsJSON'],
  })
  const verifyResponse = await fetch('/api/auth/passkey/register/verify', {
    ...FETCH_OPTS,
    method: 'POST',
    headers: await jsonAuthHeaders(),
    body: JSON.stringify({ response: attestation, label: label || '' }),
  })
  const data = await readJson(verifyResponse)
  if (!verifyResponse.ok) fail(data, 'The passkey could not be saved.')
  return data.passkey as PasskeyRow
}

export async function removePasskey(id: string): Promise<void> {
  const response = await fetch('/api/auth/passkey/credentials', {
    ...FETCH_OPTS,
    method: 'DELETE',
    headers: await jsonAuthHeaders(),
    body: JSON.stringify({ id }),
  })
  const data = await readJson(response)
  if (!response.ok) fail(data, 'Could not remove the passkey.')
}
