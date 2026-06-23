'use client'

import { FormEvent, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/stores/authStore'
import { useOrgUserStore } from '@/lib/stores/siteAuditStore'
import { useInviteStore } from '@/lib/stores/inviteStore'
import { canManageUsers } from '@/lib/navigation/menuPermissions'
import type { UserPermissions } from '@/types'
import { FormActions, FormInput, FormLabel, FormSelect } from '@/components/forms/FormShell'
import { ErrorBanner } from '@/components/dashboard/PageShell'

const defaultPermissions = (): UserPermissions => ({
  adminAccess: false,
  manager: false,
  operatives: false,
  skills: false,
  qualifications: false,
  materials: false,
  projects: true,
  smallWorks: true,
  operativeMode: false,
  siteAudit: true,
  subContractors: false,
  wholesalersOrderHistory: true,
})

export function InviteUserForm() {
  const router = useRouter()
  const { user, organization } = useAuthStore()
  const { users, loadUsers } = useOrgUserStore()
  const { inviteUser } = useInviteStore()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [accountType, setAccountType] = useState<'admin' | 'manager' | 'operative'>('operative')
  const [form, setForm] = useState({
    firstName: '',
    surname: '',
    email: '',
    mobileNumber: '',
    assignedManagerUserId: '',
    dayRate: '',
  })

  useEffect(() => {
    if (organization?.id) loadUsers(organization.id)
  }, [organization, loadUsers])

  const managers = users.filter((u) => u.permissions.manager && !u.permissions.operativeMode && u.isActive)

  const buildPermissions = (): UserPermissions => {
    const base = defaultPermissions()
    if (accountType === 'admin') {
      return { ...base, adminAccess: true, manager: true, operatives: true, skills: true, qualifications: true, projects: true, smallWorks: true, subContractors: true }
    }
    if (accountType === 'manager') {
      return { ...base, manager: true, operatives: true, projects: true, smallWorks: true, subContractors: true, skills: true, qualifications: true }
    }
    return { ...base, operativeMode: true, materials: true, siteAudit: true, projects: true }
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!organization?.id || !user) return
    const permissions = buildPermissions()
    if ((permissions.operativeMode || permissions.manager) && !form.assignedManagerUserId && accountType !== 'admin') {
      setError('Line manager is required for managers and operatives.')
      return
    }
    setSaving(true)
    setError(null)
    setSuccess(null)
    try {
      const result = await inviteUser({
        email: form.email,
        organizationId: organization.id,
        organizationName: organization.name,
        firstName: form.firstName,
        surname: form.surname,
        mobileNumber: form.mobileNumber,
        permissions,
        assignedManagerUserId: form.assignedManagerUserId || undefined,
        dayRate: form.dayRate ? Number(form.dayRate) : undefined,
      })
      if (result.inviteType === 'existing_user_org_add') {
        try {
          await fetch('/api/invites/send-org-addition-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              organizationName: organization.name,
              firstName: form.firstName,
              to: form.email,
            }),
          })
          setSuccess(
            `${form.email.trim()} already has a Project Planner account. They will receive an email and can accept the invitation from Change organisation — no new password needed.`
          )
        } catch (emailError) {
          setSuccess(
            `User linked to ${organization.name}, but notification email could not be sent (${emailError instanceof Error ? emailError.message : 'unknown error'}).`
          )
        }
      } else {
        try {
          const { requestInviteSetupEmail } = await import('@/lib/invites/requestSetupEmail')
          await requestInviteSetupEmail({
            invitationId: result.invitationId,
            organizationName: organization.name,
            firstName: form.firstName,
            role: accountType === 'operative' ? 'operative' : 'manager',
            to: form.email,
          })
          setSuccess(
            `Invitation sent to ${form.email.trim()}. They will receive an email to set their password.`
          )
        } catch (emailError) {
          setSuccess(
            `User invited but email could not be sent (${emailError instanceof Error ? emailError.message : 'unknown error'}). Add RESEND_API_KEY to .env.local.`
          )
        }
      }
      setTimeout(() => router.push('/dashboard/settings/users'), 2000)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to invite user')
    } finally {
      setSaving(false)
    }
  }

  if (!canManageUsers(user) && user && !user.permissions.manager) {
    return <p className="text-slate-600">You do not have permission to invite users.</p>
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      {error && <ErrorBanner message={error} />}
      {success && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{success}</div>}

      <div>
        <FormLabel>Account type</FormLabel>
        <FormSelect value={accountType} onChange={(e) => setAccountType(e.target.value as typeof accountType)}>
          {canManageUsers(user) && <option value="admin">Admin</option>}
          <option value="manager">Manager</option>
          <option value="operative">Operative</option>
        </FormSelect>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div><FormLabel required>First name</FormLabel><FormInput value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} required /></div>
        <div><FormLabel required>Surname</FormLabel><FormInput value={form.surname} onChange={(e) => setForm({ ...form, surname: e.target.value })} required /></div>
        <div><FormLabel required>Email</FormLabel><FormInput type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></div>
        <div><FormLabel>Mobile</FormLabel><FormInput value={form.mobileNumber} onChange={(e) => setForm({ ...form, mobileNumber: e.target.value })} /></div>
        {accountType !== 'admin' && (
          <>
            <div>
              <FormLabel required>Line manager</FormLabel>
              <FormSelect value={form.assignedManagerUserId} onChange={(e) => setForm({ ...form, assignedManagerUserId: e.target.value })} required>
                <option value="">Select manager</option>
                {managers.map((m) => (
                  <option key={m.id} value={m.id}>{m.firstName} {m.surname} ({m.email})</option>
                ))}
              </FormSelect>
            </div>
            {(accountType === 'operative' || accountType === 'manager') && (
              <div>
                <FormLabel>Day rate</FormLabel>
                <FormInput type="number" step="0.01" value={form.dayRate} onChange={(e) => setForm({ ...form, dayRate: e.target.value })} />
              </div>
            )}
          </>
        )}
      </div>

      <p className="text-xs text-slate-500">
        Creates documents in Firebase: invitations/{'{id}'}, users/{'{userId}'}, and organizations/{'{orgId}'}/userEmails/{'{email}'} — same as iOS AddUserView.
      </p>

      <FormActions saving={saving} submitLabel="Send invitation" cancelHref="/dashboard/settings/users" />
    </form>
  )
}
