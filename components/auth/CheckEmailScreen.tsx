'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuthStore } from '@/lib/stores/authStore'
import { requestFounderConfirmEmail } from '@/lib/orgSetup/requestFounderConfirmEmail'
import {
  loadFounderConfirmEmailPayload,
  saveFounderConfirmEmailPayload,
  type FounderConfirmEmailPayload,
} from '@/lib/orgSetup/founderConfirmEmail'
import { formatSetupError } from '@/lib/orgSetup/formatSetupError'
import { SUPPORT_EMAIL } from '@/lib/marketing/content'
import { MarketingShell } from '@/components/marketing/MarketingShell'
import { MktIcon } from '@/components/marketing/icons'
import { StoreBadge } from '@/components/marketing/StoreBadge'

export function CheckEmailScreen({ email, publicLayout = false }: { email?: string | null; publicLayout?: boolean }) {
  const { user, organization, signOut } = useAuthStore()
  const [stored, setStored] = useState<FounderConfirmEmailPayload | null>(null)
  const [sending, setSending] = useState(false)
  const [status, setStatus] = useState<'idle' | 'sent' | 'error'>('idle')
  const [message, setMessage] = useState('')
  const [resendIn, setResendIn] = useState(0)

  useEffect(() => {
    const payload = loadFounderConfirmEmailPayload()
    setStored(payload)
    if (payload?.lastError) {
      setStatus('error')
      setMessage(payload.lastError)
    }
  }, [])

  useEffect(() => {
    if (resendIn <= 0) return
    const t = window.setInterval(() => setResendIn((n) => Math.max(0, n - 1)), 1000)
    return () => window.clearInterval(t)
  }, [resendIn])

  const displayEmail = stored?.to || email || user?.email || 'the address you used at setup'
  const canResend = Boolean(
    (stored?.confirmationToken || user?.accountConfirmToken) && (stored?.to || user?.email)
  )

  async function handleResend() {
    if (resendIn > 0) return
    const confirmationToken = stored?.confirmationToken || user?.accountConfirmToken || ''
    const to = (stored?.to || user?.email || '').trim().toLowerCase()
    const payload = {
      confirmationToken,
      organizationName: stored?.organizationName || organization?.name || 'your organisation',
      firstName: stored?.firstName || user?.firstName || 'there',
      to,
    }
    if (!payload.confirmationToken || !payload.to) {
      setStatus('error')
      setMessage('We do not have a confirmation link to resend. Stay signed in and try Activate again.')
      return
    }
    setSending(true)
    setStatus('idle')
    setMessage('')
    try {
      await requestFounderConfirmEmail(payload)
      saveFounderConfirmEmailPayload(payload)
      setStored(payload)
      setStatus('sent')
      setResendIn(30)
    } catch (error) {
      const formatted = formatSetupError(error)
      const failed = { ...payload, lastError: formatted }
      saveFounderConfirmEmailPayload(failed)
      setStored(failed)
      setStatus('error')
      setMessage(formatted)
    } finally {
      setSending(false)
    }
  }

  const inner = (
    <div className="card wz-card" style={{ maxWidth: 640, margin: '0 auto' }}>
      <div className="ico-chip lg" data-hue="blue" style={{ margin: '0 auto 16px', width: 72, height: 72, borderRadius: 22 }}>
        <MktIcon name="mail" size={32} />
      </div>
      <h1 style={{ textAlign: 'center', fontSize: 32 }}>Check your email</h1>
      <p className="muted" style={{ textAlign: 'center', marginTop: 10 }}>
        We send a confirmation link to <b style={{ color: 'var(--ink)' }}>{displayEmail}</b>. Open that email and click
        the link to open your account. Then sign in with the password you chose during setup.
      </p>
      <div className="grid g3" style={{ margin: '22px 0' }}>
        {(
          [
            ['1', 'Open the email'],
            ['2', 'Click confirm'],
            ['3', 'Sign in'],
          ] as const
        ).map(([n, label]) => (
          <div key={n} className="card pad" style={{ boxShadow: 'none', background: 'var(--soft)', textAlign: 'center' }}>
            <b style={{ fontFamily: 'var(--head)', fontSize: 22 }}>{n}</b>
            <div className="small ink2">{label}</div>
          </div>
        ))}
      </div>
      {status === 'sent' ? (
        <div className="banner" data-hue="green">
          <span className="ico-chip">
            <MktIcon name="check" size={18} />
          </span>
          <div className="small">Another confirmation email is on its way. Check spam too.</div>
        </div>
      ) : status === 'error' ? (
        <div className="banner" data-hue="red">
          <span className="ico-chip">
            <MktIcon name="alert" size={18} />
          </span>
          <div className="small">{message || 'The confirmation email did not send. Tap Resend below.'}</div>
        </div>
      ) : (
        <div className="banner" data-hue="blue">
          <span className="ico-chip">
            <MktIcon name="mail" size={18} />
          </span>
          <div className="small ink2">
            Until you click that link, your email and password will not work on the web or the iOS / Android apps.
          </div>
        </div>
      )}
      <div className="stack" style={{ marginTop: 22 }}>
        {canResend ? (
          <button type="button" className="btn primary block" onClick={() => void handleResend()} disabled={sending || resendIn > 0}>
            {sending ? 'Sending…' : resendIn > 0 ? `Resend email in ${resendIn}s` : 'Resend confirmation email'}
          </button>
        ) : null}
        <div className="row wr" style={{ justifyContent: 'center' }}>
          <a className="btn" href="https://mail.google.com" target="_blank" rel="noopener noreferrer">
            Open Gmail
          </a>
          <a className="btn" href="https://outlook.live.com" target="_blank" rel="noopener noreferrer">
            Open Outlook
          </a>
        </div>
        <Link href="/login" className="btn block">
          Go to sign in
        </Link>
        {user ? (
          <button type="button" className="btn ghost block" onClick={() => void signOut()}>
            Sign out
          </button>
        ) : null}
      </div>
      <p className="muted xs" style={{ textAlign: 'center', marginTop: 18 }}>
        Can&apos;t find it? Check spam, then contact <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
      </p>
      <div className="row wr" style={{ justifyContent: 'center', marginTop: 18 }}>
        <StoreBadge store="ios" />
        <StoreBadge store="android" />
      </div>
    </div>
  )

  if (publicLayout) {
    return (
      <MarketingShell>
        <section className="s">
          <div className="wrap">{inner}</div>
        </section>
      </MarketingShell>
    )
  }

  return <div className="mkt min-h-screen px-5 py-10">{inner}</div>
}
