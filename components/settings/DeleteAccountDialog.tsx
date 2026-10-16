'use client'

import { useState } from 'react'
import { EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth'
import { useRouter } from 'next/navigation'
import { Modal } from '@/components/ui/overlays'
import { Button } from '@/components/ui/Button'
import { FormField, Input, ErrorBanner, SettingsRow } from '@/components/settings/primitives'
import { ACCOUNT_DELETE_CONFIRMATION, ACCOUNT_DELETE_COPY } from '@/lib/account/accountDelete'
import { requestAccountDelete } from '@/lib/account/requestAccountDelete'
import { useAuthStore } from '@/lib/stores/authStore'
import { clearWebActiveOrg } from '@/lib/orgMembership/webActiveOrg'
import { clearAnalyticsConsent } from '@/lib/analytics/analyticsConsent'

export function DeleteAccountRow() {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [soleAdminName, setSoleAdminName] = useState('')
  return (
    <>
      <SettingsRow
        danger
        icon="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
        iconBg="bg-red-50"
        iconColor="text-red-600"
        label={ACCOUNT_DELETE_COPY.rowLabel}
        description={ACCOUNT_DELETE_COPY.rowDescription}
        onClick={() => setConfirmOpen(true)}
      />
      <DeleteAccountConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onSoleAdmin={(orgName) => {
          setConfirmOpen(false)
          setSoleAdminName(orgName)
        }}
      />
      <SoleAdminDialog orgName={soleAdminName} open={Boolean(soleAdminName)} onClose={() => setSoleAdminName('')} />
    </>
  )
}

function DeleteAccountConfirmDialog({
  open,
  onClose,
  onSoleAdmin,
}: {
  open: boolean
  onClose: () => void
  onSoleAdmin: (orgName: string) => void
}) {
  const router = useRouter()
  const { firebaseUser, signOut, user } = useAuthStore()
  const [confirmation, setConfirmation] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const canSubmit = confirmation.trim() === ACCOUNT_DELETE_CONFIRMATION && password.length > 0 && !saving

  const close = () => {
    if (saving) return
    setConfirmation('')
    setPassword('')
    setError('')
    onClose()
  }

  const submit = async () => {
    if (!canSubmit) {
      setError('Type DELETE and enter your password to delete your account.')
      return
    }
    const email = firebaseUser && 'email' in firebaseUser ? String(firebaseUser.email || '') : user?.email || ''
    if (!email || !firebaseUser) {
      setError('Sign in again, then try deleting your account.')
      return
    }
    setSaving(true)
    setError('')
    try {
      const credential = EmailAuthProvider.credential(email, password)
      await reauthenticateWithCredential(
        firebaseUser as Parameters<typeof reauthenticateWithCredential>[0],
        credential
      )
      const result = await requestAccountDelete({ confirmation, password })
      if (!result.ok) {
        if (result.soleAdmin) {
          setConfirmation('')
          setPassword('')
          onSoleAdmin(result.soleAdmin.orgName)
          return
        }
        setError(result.error)
        return
      }
      if (user?.id) clearWebActiveOrg(user.id)
      clearAnalyticsConsent()
      await signOut()
      router.replace('/')
      window.location.assign('/')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Could not delete your account.'
      setError(message.includes('auth/') || message.toLowerCase().includes('password') ? 'Password is incorrect.' : message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      title={ACCOUNT_DELETE_COPY.title}
      hue="red"
      onClose={close}
      footer={
        <>
          <Button variant="secondary" onClick={close} disabled={saving}>
            {ACCOUNT_DELETE_COPY.cancelButton}
          </Button>
          <Button variant="danger" onClick={submit} disabled={!canSubmit}>
            {saving ? 'Deleting…' : ACCOUNT_DELETE_COPY.confirmButton}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        {ACCOUNT_DELETE_COPY.body.map((paragraph) => (
          <p key={paragraph} className="text-sm leading-relaxed text-[var(--ink2)]">
            {paragraph}
          </p>
        ))}
        <FormField label={ACCOUNT_DELETE_COPY.typeLabel}>
          <Input
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            autoComplete="off"
            placeholder={ACCOUNT_DELETE_CONFIRMATION}
          />
        </FormField>
        <FormField label={ACCOUNT_DELETE_COPY.passwordLabel}>
          <Input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
          />
        </FormField>
        {error ? <ErrorBanner message={error} /> : null}
      </div>
    </Modal>
  )
}

function SoleAdminDialog({
  orgName,
  open,
  onClose,
}: {
  orgName: string
  open: boolean
  onClose: () => void
}) {
  return (
    <Modal
      open={open}
      title={ACCOUNT_DELETE_COPY.soleAdminTitle}
      hue="warn"
      onClose={onClose}
      footer={
        <Button variant="secondary" onClick={onClose}>
          {ACCOUNT_DELETE_COPY.soleAdminClose}
        </Button>
      }
    >
      <p className="text-sm leading-relaxed text-[var(--ink2)]">{ACCOUNT_DELETE_COPY.soleAdminBody(orgName)}</p>
    </Modal>
  )
}
