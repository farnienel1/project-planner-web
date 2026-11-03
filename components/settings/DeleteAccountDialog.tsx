'use client'

import { useEffect, useState } from 'react'
import { EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth'
import { useRouter } from 'next/navigation'
import { Modal } from '@/components/ui/overlays'
import { Button } from '@/components/ui/Button'
import { FormField, Input, ErrorBanner, SettingsRow } from '@/components/settings/primitives'
import { ACCOUNT_DELETE_CONFIRMATION, ACCOUNT_DELETE_COPY } from '@/lib/account/accountDelete'
import { requestAccountDelete, type AccountDeleteOrg } from '@/lib/account/requestAccountDelete'
import { ACCOUNT_HANDOVER_REQUIRED_MESSAGE, organizationDeleteConfirmationError } from '@/lib/canonical/organizationDeletion'
import { rosterSegment } from '@/lib/canonical/userRosterSegment'
import { useOrgUserStore } from '@/lib/stores/siteAuditStore'
import { useUserStore } from '@/lib/stores/userStore'
import { SUPER_ADMIN_SUCCESSOR_EMPTY, superAdminSuccessors } from '@/lib/staff/superAdminTransfer'
import type { User } from '@/types'
import { useAuthStore } from '@/lib/stores/authStore'
import { clearWebActiveOrg } from '@/lib/orgMembership/webActiveOrg'
import { clearAnalyticsConsent } from '@/lib/analytics/analyticsConsent'

export function DeleteAccountRow() {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [handover, setHandover] = useState<AccountDeleteOrg | null>(null)
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
        onHandover={(org) => {
          setConfirmOpen(false)
          setHandover(org)
        }}
      />
      <HandoverSuperAdminDialog org={handover} onClose={() => setHandover(null)} />
    </>
  )
}

function DeleteAccountConfirmDialog({
  open,
  onClose,
  onHandover,
}: {
  open: boolean
  onClose: () => void
  onHandover: (org: AccountDeleteOrg) => void
}) {
  const router = useRouter()
  const { firebaseUser, signOut, user } = useAuthStore()
  const [confirmation, setConfirmation] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  // Rulebook 1.15.0 (`accountDeletionPath` delete_with_company): the organisations deleted with the account.
  const [companies, setCompanies] = useState<AccountDeleteOrg[]>([])
  const [companyNames, setCompanyNames] = useState<Record<string, string>>({})
  const companiesConfirmed = companies.every(
    (org) =>
      organizationDeleteConfirmationError({
        organizationName: org.orgName,
        typedName: companyNames[org.orgId] || '',
        typedConfirmation: confirmation.trim(),
      }) === null
  )
  const canSubmit = confirmation.trim() === ACCOUNT_DELETE_CONFIRMATION && password.length > 0 && !saving && companiesConfirmed

  const close = () => {
    if (saving) return
    setConfirmation('')
    setPassword('')
    setError('')
    setCompanies([])
    setCompanyNames({})
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
      const result = await requestAccountDelete({ confirmation, password, companyNames })
      if (!result.ok) {
        if (result.handover) {
          setConfirmation('')
          setPassword('')
          onHandover(result.handover)
          return
        }
        if (result.deleteWithCompany) {
          setCompanies(result.deleteWithCompany)
          setError(result.error)
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
        {companies.length > 0 ? (
          <div className="space-y-2 rounded-lg border border-red-200 p-3">
            <p className="text-sm font-semibold text-red-700">{ACCOUNT_DELETE_COPY.companyTitle}</p>
            <p className="text-sm leading-relaxed text-[var(--ink2)]">{ACCOUNT_DELETE_COPY.companyNote}</p>
            {companies.map((org) => (
              <FormField key={org.orgId} label={ACCOUNT_DELETE_COPY.companyNameLabel(org.orgName)}>
                <Input
                  value={companyNames[org.orgId] || ''}
                  onChange={(event) => setCompanyNames((prev) => ({ ...prev, [org.orgId]: event.target.value }))}
                  autoComplete="off"
                />
              </FormField>
            ))}
          </div>
        ) : null}
        {error ? <ErrorBanner message={error} /> : null}
      </div>
    </Modal>
  )
}

/**
 * Rulebook 1.15.0 (`accountDeletionPath` handover_required): the super admin picks another active admin
 * (`superAdminSuccessors`), or makes an active member an admin first (`accountTypeChangeWrites`), and hands super
 * admin over with the existing ownership transfer (`creatorUserId`, `transferSuperAdmin`).
 */
function HandoverSuperAdminDialog({ org, onClose }: { org: AccountDeleteOrg | null; onClose: () => void }) {
  const { user, organization } = useAuthStore()
  const { users, loadUsers } = useOrgUserStore()
  const { transferSuperAdmin, changeAccountType } = useUserStore()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const sameOrg = !!org && !!organization && org.orgId.toLowerCase() === organization.id.toLowerCase()

  useEffect(() => {
    if (org && sameOrg && organization?.id) void loadUsers(organization.id)
  }, [org, sameOrg, organization?.id, loadUsers])

  const admins = user ? superAdminSuccessors(users, user.id) : []
  const adminIds = new Set(admins.map((row) => row.id))
  const members = users
    .filter((row) => row.id !== user?.id && !adminIds.has(row.id) && rosterSegment(row) === 'active')
    .sort((a, b) => a.email.localeCompare(b.email))

  const handOver = async (target: User, promote: boolean) => {
    if (!user || !organization) return
    setBusy(true)
    setError('')
    try {
      if (promote) await changeAccountType(target, 'admin', organization.id, users)
      await transferSuperAdmin(organization.id, user.id, target.id, users)
      setDone(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not hand over super admin.')
    } finally {
      setBusy(false)
    }
  }

  const close = () => {
    if (busy) return
    setError('')
    if (done) window.location.reload()
    setDone(false)
    onClose()
  }

  return (
    <Modal
      open={Boolean(org)}
      title={ACCOUNT_DELETE_COPY.handoverTitle}
      hue="warn"
      onClose={close}
      footer={
        <Button variant="secondary" onClick={close} disabled={busy}>
          {ACCOUNT_DELETE_COPY.soleAdminClose}
        </Button>
      }
    >
      <div className="space-y-3">
        <p className="text-sm leading-relaxed text-[var(--ink2)]">{ACCOUNT_HANDOVER_REQUIRED_MESSAGE}</p>
        {done ? (
          <p className="text-sm text-emerald-700">{ACCOUNT_DELETE_COPY.handoverDone}</p>
        ) : !sameOrg ? (
          <p className="text-sm leading-relaxed text-[var(--ink2)]">{ACCOUNT_DELETE_COPY.handoverOtherOrg(org?.orgName || '')}</p>
        ) : (
          <>
            <p className="text-sm font-semibold text-[var(--ink)]">{ACCOUNT_DELETE_COPY.handoverPickLabel}</p>
            {admins.length === 0 ? <p className="text-sm text-[var(--ink3)]">{SUPER_ADMIN_SUCCESSOR_EMPTY}</p> : null}
            {admins.map((row) => (
              <Button key={row.id} variant="secondary" disabled={busy} onClick={() => void handOver(row, false)}>
                {`${row.firstName} ${row.surname}`.trim() || row.email}
              </Button>
            ))}
            {members.length > 0 ? (
              <>
                <p className="text-sm font-semibold text-[var(--ink)]">{ACCOUNT_DELETE_COPY.handoverPromoteLabel}</p>
                {members.map((row) => (
                  <Button key={row.id} variant="secondary" disabled={busy} onClick={() => void handOver(row, true)}>
                    {`${row.firstName} ${row.surname}`.trim() || row.email}
                  </Button>
                ))}
              </>
            ) : null}
          </>
        )}
        {error ? <ErrorBanner message={error} /> : null}
      </div>
    </Modal>
  )
}
