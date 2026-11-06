'use client'

import { useState } from 'react'
import type { User } from '@/types'
import { giveGhostAppAccess } from '@/lib/staff/ghostWrites'

/**
 * Rulebook 1.34.0 §11 "Give app access" (admins only, `canUpgradeGhost`): the ghost becomes an invite placeholder
 * (`ghostUpgradeWrites`) and the usual set-up email is sent. Pre-filled with the email a converted row kept aside
 * (`inviteEmailHint`).
 */
export function GhostAppAccessCard({
  organizationId,
  organizationName,
  viewer,
  ghost,
  title,
  help,
  onDone,
}: {
  organizationId: string
  organizationName: string
  viewer: User
  ghost: User
  title: string
  help: string
  onDone: () => void
}) {
  const [email, setEmail] = useState(ghost.inviteEmailHint || '')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)

  async function send() {
    setBusy(true)
    setMessage(null)
    try {
      const raw = ghost as unknown as Record<string, unknown>
      const invitationId = await giveGhostAppAccess({ organizationId, viewer, ghostId: ghost.id, ghost: raw, email })
      try {
        const { requestInviteSetupEmail } = await import('@/lib/invites/requestSetupEmail')
        await requestInviteSetupEmail({
          organizationId,
          invitationId,
          organizationName,
          firstName: ghost.firstName,
          role: 'operative',
          to: email.trim().toLowerCase(),
        })
        setMessage({ tone: 'ok', text: `Invitation sent to ${email.trim()}. They stay bookable until they accept.` })
      } catch (error) {
        setMessage({
          tone: 'error',
          text: `App access given, but the email could not be sent (${error instanceof Error ? error.message : 'unknown error'}).`,
        })
      }
      onDone()
    } catch (error) {
      setMessage({ tone: 'error', text: error instanceof Error ? error.message : 'App access could not be given.' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="card pad">
      <h2 className="h2" style={{ marginBottom: 8 }}>
        {title}
      </h2>
      <p className="muted small" style={{ marginBottom: 12 }}>
        {help}
      </p>
      <div className="row wrap" style={{ gap: 8 }}>
        <input
          type="email"
          className="input grow"
          placeholder="Their email address"
          value={email}
          autoComplete="off"
          onChange={(event) => setEmail(event.target.value)}
        />
        <button type="button" className="btn primary" disabled={busy || !email.trim()} onClick={() => void send()}>
          {busy ? 'Sending…' : title}
        </button>
      </div>
      {message ? (
        <p className={`small ${message.tone === 'error' ? 'text-red-600' : 'text-emerald-700'}`} style={{ marginTop: 8 }}>
          {message.text}
        </p>
      ) : null}
    </section>
  )
}
