'use client'

import { useCallback, useRef, useState } from 'react'
import { verifyEmailMfa } from '@/lib/auth/mfa/mfaClient'
import { isOwnerReverifyRequired, ownerRequestReverify } from '@/lib/owner/ownerActions'

/**
 * Owner console "enter a new code" step (PLAN A3, spec §1.3). `run(action)` runs an owner action; when the server
 * answers that the last emailed code is older than 10 minutes, a new code is emailed, the dialog asks for it, and the
 * action runs again once it is accepted. Asking for a code never signs the owner out.
 */
export function useOwnerFreshAction() {
  const [open, setOpen] = useState(false)
  const pending = useRef<{ action: () => Promise<unknown>; resolve: (value: unknown) => void; reject: (error: unknown) => void } | null>(null)

  const run = useCallback(<T,>(action: () => Promise<T>): Promise<T> => {
    return action().catch(async (error: unknown) => {
      if (!isOwnerReverifyRequired(error)) throw error
      await ownerRequestReverify()
      return new Promise<T>((resolve, reject) => {
        pending.current = { action, resolve: resolve as (value: unknown) => void, reject }
        setOpen(true)
      })
    })
  }, [])

  const dialog = open ? (
    <OwnerReverifyDialog
      onVerified={async () => {
        const job = pending.current
        pending.current = null
        setOpen(false)
        if (!job) return
        try {
          job.resolve(await job.action())
        } catch (error) {
          job.reject(error)
        }
      }}
      onCancel={() => {
        const job = pending.current
        pending.current = null
        setOpen(false)
        job?.reject(new Error('Cancelled. Nothing was changed.'))
      }}
    />
  ) : null

  return { run, dialog }
}

function OwnerReverifyDialog({ onVerified, onCancel }: { onVerified: () => void; onCancel: () => void }) {
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  return (
    <div className="fixed inset-0 z-90 grid place-items-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby="owner-reverify-title">
      <form
        className="w-full max-w-sm rounded-2xl bg-(--card) p-5 shadow-xl"
        onSubmit={async (event) => {
          event.preventDefault()
          setBusy(true)
          setError('')
          try {
            await verifyEmailMfa(code)
            onVerified()
          } catch (err) {
            // The shared verify route tells a signing-in user to sign in again; here the owner just asks for a new code.
            const message = err instanceof Error ? err.message : 'That code was not accepted.'
            setError(message.replace(/Sign in again to receive a new (one|code)\./i, 'Press “Send a new code”.'))
          } finally {
            setBusy(false)
          }
        }}
      >
        <h2 id="owner-reverify-title" className="text-lg font-extrabold">
          Enter a new code
        </h2>
        <p className="mt-2 text-sm text-(--ink2)">
          This action needs a code from the last 10 minutes. We have emailed you a new one. You stay signed in.
        </p>
        <label className="f mt-4 block text-sm font-semibold">
          6-digit code
          <input
            className="pp-in mt-1"
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            value={code}
            onChange={(event) => setCode(event.target.value)}
            data-testid="owner-reverify-code"
          />
        </label>
        {error ? (
          <p className="banner mt-3" data-hue="red" role="alert">
            {error}
          </p>
        ) : null}
        {notice ? (
          <p className="banner mt-3" data-hue="green">
            {notice}
          </p>
        ) : null}
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            className="btn sm ghost"
            disabled={busy}
            onClick={async () => {
              setError('')
              try {
                await ownerRequestReverify()
                setNotice('A new code is on its way.')
              } catch (err) {
                setError(err instanceof Error ? err.message : 'Could not email a code.')
              }
            }}
          >
            Send a new code
          </button>
          <button type="button" className="btn sm ghost" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button type="submit" className="btn sm primary" disabled={busy || code.trim().length < 6}>
            {busy ? 'Checking…' : 'Confirm'}
          </button>
        </div>
      </form>
    </div>
  )
}
