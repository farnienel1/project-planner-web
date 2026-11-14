'use client'

import { useState } from 'react'
import type { User } from '@/types'
import { giveGhostAppAccess } from '@/lib/staff/ghostWrites'
import { IconTile } from '@/components/ui/page'
import { ProfileIcon } from '@/components/users/profile-ui'

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
  variant,
}: {
  organizationId: string
  organizationName: string
  viewer: User
  ghost: User
  title: string
  help: string
  onDone: () => void
  /** `profile`: the User profile UI pack look (docs/design/user-profile-ui/). Same fields, text and handler. */
  variant?: 'profile'
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

  if (variant === 'profile') {
    return (
      <section className="pu-card">
        <div className="up-card-h">
          <IconTile tone="purple" size="sm">
            <ProfileIcon name="mail" />
          </IconTile>
          <h2>{title}</h2>
        </div>
        <div className="up-block">
          <p className="up-f-hint" style={{ fontSize: 13 }}>
            {help}
          </p>
          <div className="up-payrow">
            <input
              type="email"
              className="pp-in"
              style={{ flex: '1 1 200px' }}
              placeholder="Their email address"
              value={email}
              autoComplete="off"
              onChange={(event) => setEmail(event.target.value)}
            />
            <button type="button" className="pu-btn primary" disabled={busy || !email.trim()} onClick={() => void send()}>
              {busy ? 'Sending…' : title}
            </button>
          </div>
          {message ? (
            <p className={message.tone === 'error' ? 'up-err' : 'up-f-hint'} style={message.tone === 'error' ? undefined : { color: 'var(--pu-c-green-ink)', fontWeight: 600 }}>
              {message.text}
            </p>
          ) : null}
        </div>
      </section>
    )
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
