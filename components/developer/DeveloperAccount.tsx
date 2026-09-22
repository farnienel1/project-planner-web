'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useAuthStore } from '@/lib/stores/authStore'
import { useAnalyticsStore } from '@/lib/analytics/analyticsStore'
import { DeveloperShell, DeveloperStatus, MetricCard } from '@/components/developer/DeveloperShell'
import { PLATFORM_OWNER_EMAIL } from '@/lib/platform/owner'

function AccountForm() {
  const search = useSearchParams()
  const first = search.get('first') === '1'
  const { changePassword, user } = useAuthStore()
  const { organisations, users, loading, error, warning, load, refresh } = useAnalyticsStore()
  const [currentPassword, setCurrentPassword] = useState('')
  const [nextPassword, setNextPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [formError, setFormError] = useState('')
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    void load()
  }, [load])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError('')
    setSaved(false)
    if (nextPassword.length < 10) {
      setFormError('Use at least 10 characters.')
      return
    }
    if (nextPassword !== confirm) {
      setFormError('New passwords do not match.')
      return
    }
    try {
      setSaving(true)
      await changePassword(currentPassword, nextPassword)
      setCurrentPassword('')
      setNextPassword('')
      setConfirm('')
      setSaved(true)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not change password.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <DeveloperShell
      title="Account"
      actions={
        <button type="button" className="btn sm ghost" onClick={() => void refresh()} disabled={loading}>
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      }
    >
      {first ? (
        <p className="banner" data-hue="warn">
          First login complete. Change the password now so the temporary or newly created one is not kept.
        </p>
      ) : null}
      <DeveloperStatus error={error} warning={warning} loading={loading && users.length > 0} />
      <div className="grid gap-3 sm:grid-cols-2">
        <MetricCard label="Organisations" value={organisations.length} href="/developer/organisations" />
        <MetricCard label="Registered users" value={users.length} href="/developer/users" />
      </div>
      <section className="card pad">
        <p className="eyebrow">Signed in as</p>
        <p className="mt-1 text-lg font-extrabold">{user?.email || PLATFORM_OWNER_EMAIL}</p>
        <p className="mt-2 text-sm text-[var(--ink2)]">
          This console is only for you. Organisation users never see it, and they cannot be granted access from User
          settings.
        </p>
      </section>
      <form className="card pad space-y-3" onSubmit={(e) => void submit(e)}>
        <h2 className="h2">Change password</h2>
        {formError ? (
          <p className="banner" data-hue="red">
            {formError}
          </p>
        ) : null}
        {saved ? (
          <p className="banner" data-hue="green">
            Password updated.
          </p>
        ) : null}
        <label className="f">
          Current password
          <input
            type="password"
            autoComplete="current-password"
            className="pp-in"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
          />
        </label>
        <label className="f">
          New password
          <input
            type="password"
            autoComplete="new-password"
            className="pp-in"
            value={nextPassword}
            onChange={(e) => setNextPassword(e.target.value)}
          />
        </label>
        <label className="f">
          Confirm new password
          <input
            type="password"
            autoComplete="new-password"
            className="pp-in"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </label>
        <button type="submit" className="btn primary" disabled={saving || !currentPassword || !nextPassword}>
          {saving ? 'Saving…' : 'Update password'}
        </button>
      </form>
    </DeveloperShell>
  )
}

export function DeveloperAccountScreen() {
  return (
    <Suspense fallback={<p className="text-sm text-[var(--ink3)]">Loading…</p>}>
      <AccountForm />
    </Suspense>
  )
}
