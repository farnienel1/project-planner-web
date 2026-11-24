'use client'

import { useCallback, useEffect, useState } from 'react'

import {
  addPasskey,
  isPasskeyCancelled,
  listPasskeys,
  passkeysAvailableHere,
  removePasskey,
  type PasskeyRow,
} from '@/lib/auth/passkeys/passkeyClient'
import { useOrganizationTimeZone } from '@/lib/stores/organizationDocumentStore'

/** Display only, in the organisation's zone (rulebook §1). */
function dateText(ms: number | null, timeZone: string): string {
  if (!ms) return '—'
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone }).format(ms)
}

/**
 * Settings → Sign-in & password → Passkeys: add a passkey (needs an emailed code or passkey sign-in within the last
 * 30 minutes), list them, remove one. Hidden while the passkeys switch is off or the browser cannot use passkeys.
 */
export function PasskeysSection() {
  const timeZone = useOrganizationTimeZone()
  const [available, setAvailable] = useState(false)
  const [rows, setRows] = useState<PasskeyRow[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [label, setLabel] = useState('')

  const load = useCallback(async () => {
    try {
      setRows(await listPasskeys())
    } catch (loadError) {
      setRows([])
      setError(loadError instanceof Error ? loadError.message : 'Could not load your passkeys.')
    }
  }, [])

  useEffect(() => {
    const ok = passkeysAvailableHere()
    setAvailable(ok)
    if (ok) void load()
  }, [load])

  // "Take me to passkeys" (the passkey reminder) links here with #passkeys; this section renders after the page, so
  // scroll to it once it is on screen.
  useEffect(() => {
    if (!available || typeof window === 'undefined' || window.location.hash !== '#passkeys') return
    document.getElementById('passkeys')?.scrollIntoView({ block: 'start' })
  }, [available])

  if (!available) return null

  const add = async () => {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const row = await addPasskey(label)
      setLabel('')
      setNotice(`Passkey added${row?.label ? ` (${row.label})` : ''}. Next time, choose "Sign in with a passkey".`)
      await load()
    } catch (addError) {
      if (!isPasskeyCancelled(addError)) setError(addError instanceof Error ? addError.message : 'The passkey could not be saved.')
    } finally {
      setBusy(false)
    }
  }

  const remove = async (row: PasskeyRow) => {
    if (!window.confirm(`Remove the passkey "${row.label || 'Passkey'}"? You can still sign in with your email and password.`)) return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await removePasskey(row.id)
      setNotice('Passkey removed. You may also want to delete it from your device or password manager.')
      await load()
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : 'Could not remove the passkey.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section id="passkeys" className="space-y-3 card pad scroll-mt-24" aria-labelledby="passkeys-heading" data-testid="passkeys-section">
      <div>
        <h2 id="passkeys-heading" className="text-lg font-bold">Passkeys</h2>
        <p className="muted small mt-1">
          Sign in with Touch ID, Face ID, Windows Hello or your phone instead of typing your password and the emailed
          code. Your password still works.
        </p>
      </div>
      {error ? (
        <p className="banner" data-hue="red" role="alert">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="banner" data-hue="green" role="status">
          {notice}
        </p>
      ) : null}
      {rows === null ? (
        <p className="muted small">Loading passkeys…</p>
      ) : rows.length === 0 ? (
        <p className="muted small">No passkeys yet.</p>
      ) : (
        <ul className="divide-y divide-(--line)">
          {rows.map((row) => (
            <li key={row.id} className="flex items-center justify-between gap-3 py-2">
              <div className="min-w-0">
                <p className="font-semibold truncate">{row.label || 'Passkey'}</p>
                <p className="muted xs">
                  Added {dateText(row.createdAtMs, timeZone)} · Last used {dateText(row.lastUsedAtMs, timeZone)}
                  {row.backedUp ? ' · Synced' : ''}
                </p>
              </div>
              <button type="button" className="btn sm ghost" disabled={busy} onClick={() => void remove(row)}>
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <label className="f flex-1">
          Name (optional)
          <input
            className="pp-in"
            value={label}
            maxLength={60}
            placeholder="e.g. Work laptop"
            onChange={(event) => setLabel(event.target.value)}
          />
        </label>
        <button type="button" className="btn primary" disabled={busy} onClick={() => void add()} data-testid="passkey-add">
          {busy ? 'Working…' : 'Add a passkey'}
        </button>
      </div>
    </section>
  )
}
