'use client'

import { useState, type ReactNode } from 'react'
import { ownerChangeUserEmail, ownerSendPasswordReset } from '@/lib/owner/ownerActions'
import { ownerPersonName } from '@/lib/analytics/ownerDirectory'
import { isPlatformOwnerEmail } from '@/lib/platform/owner'
import type { User } from '@/types'

export function OwnerUserAccountMenu({
  user,
  onDone,
  extra,
}: {
  user: User
  onDone: (message: string) => void
  extra?: ReactNode
}) {
  const lockedOwner = isPlatformOwnerEmail(user.email)
  const [open, setOpen] = useState(false)
  const [emailOpen, setEmailOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [reason, setReason] = useState('')
  const [sendReset, setSendReset] = useState(true)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')

  const close = () => {
    setOpen(false)
    setEmailOpen(false)
    setError('')
  }

  return (
    <td className="relative px-4 py-3">
      <button type="button" className="btn sm ghost" onClick={() => setOpen((value) => !value)}>
        ⋯
      </button>
      {open ? (
        <div className="absolute right-4 z-20 mt-1 w-56 rounded-xl border border-[var(--line)] bg-white p-1 shadow-lg">
          {extra}
          {lockedOwner ? (
            <p className="px-3 py-2 text-xs text-[var(--ink3)]">Owner login email is locked.</p>
          ) : (
            <>
          <button
            type="button"
            className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-[var(--soft)]"
            disabled={Boolean(busy)}
            onClick={async () => {
              setBusy('reset')
              setError('')
              try {
                await ownerSendPasswordReset(user.id, user.email)
                onDone(`Password reset emailed to ${ownerPersonName(user)}.`)
                close()
              } catch (err) {
                setError(err instanceof Error ? err.message : 'Could not send a reset.')
              } finally {
                setBusy('')
              }
            }}
          >
            {busy === 'reset' ? 'Sending reset…' : 'Send password reset'}
          </button>
          <button
            type="button"
            className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-[var(--soft)]"
            onClick={() => {
              setEmail(user.email || '')
              setEmailOpen(true)
            }}
          >
            Change login email…
          </button>
            </>
          )}
          <button
            type="button"
            className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-[var(--soft)]"
            onClick={() => {
              void navigator.clipboard.writeText(user.id)
              onDone('User id copied.')
              close()
            }}
          >
            Copy user ID
          </button>
          {error ? <p className="px-3 py-2 text-xs text-[var(--red)]">{error}</p> : null}
        </div>
      ) : null}
      {emailOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <h2 className="text-lg font-extrabold">Change login email</h2>
            <p className="mt-2 text-sm text-[var(--ink2)]">
              Updates Firebase Auth for {ownerPersonName(user)} using their account id, then the user record. They sign in
              with the new email after that.
            </p>
            <label className="f mt-4 block text-sm font-semibold">
              New login email
              <input className="pp-in mt-1" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
            </label>
            <label className="f mt-3 block text-sm font-semibold">
              Reason (optional)
              <input className="pp-in mt-1" value={reason} onChange={(event) => setReason(event.target.value)} />
            </label>
            <label className="mt-3 flex items-center gap-2 text-sm">
              <input type="checkbox" checked={sendReset} onChange={(event) => setSendReset(event.target.checked)} />
              Email a password reset to the new address
            </label>
            {error ? (
              <p className="banner mt-3" data-hue="red">
                {error}
              </p>
            ) : null}
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className="btn sm ghost" onClick={close}>
                Cancel
              </button>
              <button
                type="button"
                className="btn sm primary"
                disabled={busy === 'email'}
                onClick={async () => {
                  setBusy('email')
                  setError('')
                  try {
                    await ownerChangeUserEmail({
                      uid: user.id,
                      newEmail: email,
                      reason,
                      sendReset,
                    })
                    onDone(`Login email updated for ${ownerPersonName(user)}.`)
                    close()
                  } catch (err) {
                    setError(err instanceof Error ? err.message : 'Could not change that email.')
                  } finally {
                    setBusy('')
                  }
                }}
              >
                {busy === 'email' ? 'Saving…' : 'Update email'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </td>
  )
}
