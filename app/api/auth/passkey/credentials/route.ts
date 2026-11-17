import { NextRequest, NextResponse } from 'next/server'

import { isPasskeyAccount, passkeysOffResponse, passkeyUnavailable, requirePasskeyAccount } from '@/lib/auth/passkeys/passkeyRoute'
import { passkeySummary, pruneStalePasskeys } from '@/lib/auth/passkeys/passkeyService'
import { firebasePasskeyAuthAccounts, firestorePasskeyStore, isPasskeyCredentialId } from '@/lib/auth/passkeys/passkeyStore'
import { enforceRateLimit, jsonError, readJsonBody } from '@/lib/security/apiGuard'

export const runtime = 'nodejs'

/** The signed-in account's own passkeys (never anyone else's). */
export async function GET(request: NextRequest) {
  const off = passkeysOffResponse()
  if (off) return off
  const limited = enforceRateLimit(request, 'passkey-list', 60, 10 * 60 * 1000)
  if (limited) return limited
  const account = await requirePasskeyAccount(request)
  if (!isPasskeyAccount(account)) return account
  try {
    const store = firestorePasskeyStore()
    // Passkeys made before the last password change no longer work: remove them before listing.
    await pruneStalePasskeys({ uid: account.uid, store, auth: firebasePasskeyAuthAccounts() })
    const rows = await store.listForUser(account.uid)
    const passkeys = rows
      .map(passkeySummary)
      .sort((a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0))
    return NextResponse.json({ passkeys }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return passkeyUnavailable('list', error)
  }
}

/** Remove one of the signed-in account's own passkeys. Removing never needs a fresh code (it only takes access away). */
export async function DELETE(request: NextRequest) {
  const off = passkeysOffResponse()
  if (off) return off
  const limited = enforceRateLimit(request, 'passkey-remove', 30, 10 * 60 * 1000)
  if (limited) return limited
  const account = await requirePasskeyAccount(request)
  if (!isPasskeyAccount(account)) return account
  const body = await readJsonBody<{ id?: unknown }>(request)
  if (!body.ok) return body.response
  const id = body.value.id
  if (!isPasskeyCredentialId(id)) return jsonError('Passkey not found', 404)
  try {
    const store = firestorePasskeyStore()
    const row = await store.get(id)
    if (!row || row.uid !== account.uid) return jsonError('Passkey not found', 404)
    await store.delete(id)
    return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return passkeyUnavailable('remove', error)
  }
}
