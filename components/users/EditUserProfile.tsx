'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { format } from 'date-fns'
import { useAuthStore } from '@/lib/stores/authStore'
import { useOperativeStore } from '@/lib/stores/operativeStore'
import { useOrgUserStore } from '@/lib/stores/siteAuditStore'
import { useUserStore } from '@/lib/stores/userStore'
import { findOperativeForUser } from '@/lib/operatives/operativeRosterUtils'
import { displayTradeType, STAFF_TRADE_TYPES } from '@/lib/staff/staffTradeTypes'
import {
  canEditIdentityDetails,
  canEditPermissionsMatrix,
  canEditTargetUser,
  canUseAdminAccountTools,
  roleLabel,
  setupSectionTitle,
} from '@/lib/staff/userEditPermissions'
import { rosterStatusLabel } from '@/lib/staff/userRosterUtils'
import type { User, UserPermissions } from '@/types'
import { FormInput, FormLabel, FormSelect } from '@/components/forms/FormShell'
import { ErrorBanner } from '@/components/dashboard/PageShell'
import { ProfileActionButton, ProfileSection, ProfileToggleRow } from '@/components/users/ProfileSection'
import { PermissionToggleList } from '@/components/users/ProfileExpandablePermissionToggle'
import {
  MANAGER_PERMISSION_TOGGLES,
  OPERATIVE_PERMISSION_TOGGLES,
} from '@/lib/staff/userPermissionDescriptions'

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

const ACCOUNT_TYPE_OPTIONS: {
  id: 'operative' | 'manager' | 'admin'
  title: string
  description: string
}[] = [
  {
    id: 'operative',
    title: 'Operative',
    description: 'Field access: schedule, tasks, materials lists, and site audits as configured below.',
  },
  {
    id: 'manager',
    title: 'Manager',
    description: 'Can manage projects, operatives, and scheduling. Permissions below match the iOS manager invite flow.',
  },
  {
    id: 'admin',
    title: 'Administrator',
    description: 'Full admin access including user management. Saves with the main Save button.',
  },
]

function currentAccountType(user: User): 'operative' | 'manager' | 'admin' {
  if (user.permissions.operativeMode) return 'operative'
  if (user.permissions.adminAccess || user.isSuperAdmin) return 'admin'
  return 'manager'
}

function cloneUser(user: User): User {
  return {
    ...user,
    permissions: { ...user.permissions },
  }
}

export function EditUserProfile({
  userId,
  backHref,
  suppressAdminAccessToggle,
}: {
  userId: string
  backHref: string
  suppressAdminAccessToggle?: boolean
}) {
  const { user: currentUser, organization } = useAuthStore()
  const { users, loadUsers } = useOrgUserStore()
  const { operatives, loadOperatives } = useOperativeStore()
  const { getUser, saveUser, setUserActive, deleteUser, sendPasswordReset, applyAccountType, syncLinkedOperative } =
    useUserStore()

  const [target, setTarget] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [showChangeType, setShowChangeType] = useState(false)
  const [draftAccountType, setDraftAccountType] = useState<'operative' | 'manager' | 'admin' | null>(null)
  const [draftTypePermissions, setDraftTypePermissions] = useState<UserPermissions | null>(null)

  useEffect(() => {
    if (!organization?.id) return
    loadUsers(organization.id)
    loadOperatives(organization.id)
    getUser(userId)
      .then(setTarget)
      .finally(() => setLoading(false))
  }, [organization?.id, userId, getUser, loadUsers, loadOperatives])

  const managers = useMemo(
    () =>
      users.filter(
        (user) =>
          !user.permissions.operativeMode &&
          user.isActive &&
          (user.permissions.manager || user.permissions.adminAccess)
      ),
    [users]
  )

  const linkedOperative = useMemo(
    () => (target ? findOperativeForUser(target, operatives) : undefined),
    [target, operatives]
  )

  const canEdit = target ? canEditTargetUser(currentUser, target) : false
  const canEditIdentity = target ? canEditIdentityDetails(currentUser, target) : false
  const canEditMatrix = target ? canEditPermissionsMatrix(currentUser, target) : false
  const canAdminTools = canUseAdminAccountTools(currentUser)

  const showSetupCard =
    target &&
    canEditMatrix &&
    (target.permissions.operativeMode || target.permissions.manager || target.permissions.adminAccess)

  const showAnnualLeave =
    target &&
    canEdit &&
    !target.isSuperAdmin &&
    (target.permissions.operativeMode || target.permissions.manager || target.permissions.adminAccess)

  const effectivePermissions = draftTypePermissions ?? target?.permissions

  const updatePermissions = (patch: Partial<UserPermissions>) => {
    if (!target) return
    if (draftTypePermissions) {
      const next = { ...draftTypePermissions, ...patch }
      if (patch.adminAccess === true) next.manager = true
      setDraftTypePermissions(next)
      return
    }
    const next = { ...target.permissions, ...patch }
    if (patch.adminAccess === true) next.manager = true
    setTarget({ ...target, permissions: next })
  }

  const handleSave = async (e: FormEvent) => {
    e.preventDefault()
    if (!target || !organization?.id || !canEdit) return

    if (
      (target.permissions.operativeMode || target.permissions.manager) &&
      !target.permissions.adminAccess &&
      !target.assignedManagerUserId
    ) {
      setError('Line manager is required for operatives and managers.')
      return
    }

    setSaving(true)
    setError(null)
    setSuccess(null)
    try {
      let toSave = { ...target, updatedAt: new Date() }
      if (draftAccountType && draftTypePermissions) {
        toSave = applyAccountType(toSave, draftAccountType)
        toSave = { ...toSave, permissions: draftTypePermissions }
      }
      await saveUser(toSave)
      await syncLinkedOperative(organization.id, toSave, operatives)
      await loadUsers(organization.id)
      setSuccess('Profile saved.')
      setTarget(toSave)
      setDraftAccountType(null)
      setDraftTypePermissions(null)
      setShowChangeType(false)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save user')
    } finally {
      setSaving(false)
    }
  }

  const handlePasswordReset = async () => {
    if (!target?.passwordSet) return
    try {
      await sendPasswordReset(target.email)
      setSuccess('Password reset email sent.')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to send password reset')
    }
  }

  const handleToggleActive = async () => {
    if (!target || !canAdminTools) return
    const next = !target.isActive
    try {
      await setUserActive(target.id, next)
      setTarget({ ...target, isActive: next })
      setSuccess(next ? 'User reactivated.' : 'User deactivated.')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update status')
    }
  }

  const handleDelete = async () => {
    if (!target || !canAdminTools) return
    if (!window.confirm(`Permanently delete ${target.firstName} ${target.surname}? This cannot be undone.`)) return
    try {
      await deleteUser(target.id)
      window.location.href = backHref
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete user')
    }
  }

  const selectDraftAccountType = (accountType: 'operative' | 'manager' | 'admin') => {
    if (!target) return
    setDraftAccountType(accountType)
    setDraftTypePermissions(applyAccountType(cloneUser(target), accountType).permissions)
    setSuccess(`Account type set to ${accountType}. Press Save to apply.`)
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600" />
      </div>
    )
  }

  if (!target) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
        <p className="text-slate-600">User not found.</p>
        <Link href={backHref} className="mt-4 inline-block text-blue-600 hover:underline">
          Go back
        </Link>
      </div>
    )
  }

  if (!canEdit) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
        <p className="text-slate-600">You do not have permission to edit this user.</p>
        <Link href={backHref} className="mt-4 inline-block text-blue-600 hover:underline">
          Go back
        </Link>
      </div>
    )
  }

  const pageTitle = target.permissions.operativeMode ? 'Edit operative' : 'Edit user'
  const status = rosterStatusLabel(target)

  return (
    <form onSubmit={handleSave} className="mx-auto max-w-3xl space-y-5 pb-10">

      {/* ── Top bar ── */}
      <div className="flex items-center justify-between gap-4">
        <Link
          href={backHref}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 shadow-sm hover:bg-slate-50 hover:text-slate-900 transition-colors"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </Link>
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 active:scale-95 disabled:opacity-50 transition-all"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>

      {/* ── Banners ── */}
      {error && <ErrorBanner message={error} />}
      {draftAccountType && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
          Account type will change to <strong className="capitalize">{draftAccountType}</strong> when you press Save.
        </div>
      )}

      {success && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <svg className="h-4 w-4 flex-shrink-0 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          {success}
        </div>
      )}

      {/* ── Profile hero card ── */}
      <div className="rounded-2xl border border-slate-200 bg-white px-6 py-8 shadow-sm text-center">
        {/* Avatar circle */}
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-xl font-bold text-white shadow-md">
          {target.firstName?.[0]}{target.surname?.[0]}
        </div>
        <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-1">{pageTitle}</p>
        <h1 className="text-2xl font-bold text-slate-900">
          {target.firstName} {target.surname}
        </h1>
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700 ring-1 ring-indigo-100">
            {roleLabel(target)}
          </span>
          <span
            className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ring-1 ${
              target.passwordSet
                ? 'bg-emerald-50 text-emerald-700 ring-emerald-100'
                : 'bg-amber-50 text-amber-700 ring-amber-100'
            }`}
          >
            {target.passwordSet ? 'Verified' : 'Pending'}
          </span>
          <span
            className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ring-1 ${
              status === 'Active'
                ? 'bg-blue-50 text-blue-700 ring-blue-100'
                : 'bg-slate-100 text-slate-600 ring-slate-200'
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${status === 'Active' ? 'bg-blue-500' : 'bg-slate-400'}`} />
            {status}
          </span>
        </div>
      </div>

      {/* ── User details ── */}
      <ProfileSection title="User details">
        <div className="grid gap-0 divide-y divide-slate-100">
          <div className="grid gap-4 px-5 py-4 md:grid-cols-2">
            <div>
              <FormLabel>First name</FormLabel>
              <FormInput
                value={target.firstName}
                disabled={!canEditIdentity}
                onChange={(e) => setTarget({ ...target, firstName: e.target.value })}
              />
            </div>
            <div>
              <FormLabel>Surname</FormLabel>
              <FormInput
                value={target.surname}
                disabled={!canEditIdentity}
                onChange={(e) => setTarget({ ...target, surname: e.target.value })}
              />
            </div>
          </div>
          <div className="grid gap-4 px-5 py-4 md:grid-cols-2">
            <div>
              <FormLabel>Email</FormLabel>
              <FormInput
                type="email"
                value={target.email}
                disabled={!canEditIdentity}
                onChange={(e) => setTarget({ ...target, email: e.target.value })}
              />
            </div>
            <div>
              <FormLabel>Mobile number</FormLabel>
              <FormInput
                value={target.mobileNumber || ''}
                disabled={!canEditIdentity}
                onChange={(e) => setTarget({ ...target, mobileNumber: e.target.value })}
              />
            </div>
          </div>
          <div className="grid gap-4 px-5 py-4 md:grid-cols-2">
            <div>
              <FormLabel>Last active</FormLabel>
              <FormInput
                value={target.lastSeenAt ? format(target.lastSeenAt, "d MMM yyyy 'at' HH:mm") : '—'}
                disabled
              />
            </div>
            <div>
              <FormLabel>Employment type</FormLabel>
              <FormSelect
                value={target.employmentType || 'selfEmployed'}
                disabled={!canEditMatrix}
                onChange={(e) => setTarget({ ...target, employmentType: e.target.value })}
              >
                <option value="selfEmployed">Self-Employed</option>
                <option value="paye">PAYE</option>
                <option value="self_employed">Self employed (legacy)</option>
              </FormSelect>
            </div>
          </div>
        </div>
      </ProfileSection>

      {/* ── Operative / manager setup ── */}
      {showSetupCard && (
        <ProfileSection title={setupSectionTitle(target)}>
          <div className="space-y-4 px-5 py-4">
            {(target.permissions.operativeMode || target.permissions.manager) && (
              <div>
                <FormLabel required>Line manager</FormLabel>
                <FormSelect
                  value={target.assignedManagerUserId || ''}
                  onChange={(e) => setTarget({ ...target, assignedManagerUserId: e.target.value })}
                >
                  <option value="">Select manager</option>
                  {managers.map((manager) => (
                    <option key={manager.id} value={manager.id}>
                      {manager.firstName} {manager.surname} ({manager.email})
                    </option>
                  ))}
                </FormSelect>
              </div>
            )}

            <div>
              <FormLabel>Day rate</FormLabel>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-slate-400">£</span>
                <FormInput
                  type="number"
                  step="0.01"
                  value={target.dayRate?.toString() || ''}
                  className="pl-7"
                  onChange={(e) =>
                    setTarget({
                      ...target,
                      dayRate: e.target.value ? Number(e.target.value) : undefined,
                      hourlyRate: undefined,
                    })
                  }
                />
              </div>
              <p className="mt-1.5 text-xs text-slate-400">
                Payroll uses either a day rate or an hourly rate, not both. Setting one clears the other on save.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <FormLabel>Trade type</FormLabel>
                <FormSelect
                  value={target.tradeTypePreset || ''}
                  onChange={(e) => setTarget({ ...target, tradeTypePreset: e.target.value })}
                >
                  <option value="">Select trade</option>
                  {STAFF_TRADE_TYPES.map((trade) => (
                    <option key={trade} value={trade}>
                      {trade}
                    </option>
                  ))}
                </FormSelect>
              </div>
              {target.tradeTypePreset === 'Other' && (
                <div>
                  <FormLabel>Custom trade</FormLabel>
                  <FormInput
                    value={target.tradeTypeCustom || ''}
                    onChange={(e) => setTarget({ ...target, tradeTypeCustom: e.target.value })}
                  />
                </div>
              )}
            </div>

            <p className="text-sm text-slate-500">
              Current trade:{' '}
              <span className="font-medium text-slate-700">
                {displayTradeType(target.tradeTypePreset, target.tradeTypeCustom)}
              </span>
            </p>

            {linkedOperative && (
              <Link
                href={`/dashboard/operatives/${linkedOperative.id}/edit`}
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600 hover:underline"
              >
                Skills &amp; qualifications
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            )}
          </div>
        </ProfileSection>
      )}

      {/* ── Annual leave ── */}
      {showAnnualLeave && (
        <>
          <ProfileSection title="Annual leave in app">
            <ProfileToggleRow
              label="Annual leave enabled"
              description="Turn off for self-employed staff who do not use paid annual leave. Their Holiday tab and annual leave entry points are hidden until this is turned back on here."
              checked={target.annualLeaveEnabled !== false}
              onChange={(checked) => setTarget({ ...target, annualLeaveEnabled: checked })}
            />
          </ProfileSection>

          {target.annualLeaveEnabled !== false && (
            <ProfileSection title="Annual leave">
              <div className="px-5 py-4 space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <FormLabel>Days per year</FormLabel>
                    <FormInput
                      type="number"
                      value={target.annualLeaveDaysPerYear?.toString() || '28'}
                      onChange={(e) =>
                        setTarget({ ...target, annualLeaveDaysPerYear: Number(e.target.value) || undefined })
                      }
                    />
                  </div>
                  <div>
                    <FormLabel>Company leave year</FormLabel>
                    <div className="flex items-center gap-2">
                      <FormSelect
                        value={String(target.annualLeaveYearStartMonth ?? 1)}
                        onChange={(e) =>
                          setTarget({ ...target, annualLeaveYearStartMonth: Number(e.target.value) })
                        }
                      >
                        {MONTHS.map((month, index) => (
                          <option key={month} value={index + 1}>
                            {month}
                          </option>
                        ))}
                      </FormSelect>
                      <span className="flex-shrink-0 text-sm text-slate-400">→</span>
                      <FormSelect
                        value={String(target.annualLeaveYearEndMonth ?? 12)}
                        onChange={(e) =>
                          setTarget({ ...target, annualLeaveYearEndMonth: Number(e.target.value) })
                        }
                      >
                        {MONTHS.map((month, index) => (
                          <option key={month} value={index + 1}>
                            {month}
                          </option>
                        ))}
                      </FormSelect>
                    </div>
                    <p className="mt-1.5 text-xs text-slate-400">
                      Runs from the first day of the start month through the last day of the end month (e.g. April → March).
                    </p>
                  </div>
                </div>
              </div>
              <ProfileToggleRow
                label="Carry unused days into next leave year"
                description="Unused allowance from the previous leave year is added to this year's balance (after booked and pending time in that year)."
                checked={target.annualLeaveCarriesOver === true}
                onChange={(checked) => setTarget({ ...target, annualLeaveCarriesOver: checked })}
              />
            </ProfileSection>
          )}
        </>
      )}

      {/* ── Account status ── */}
      {canAdminTools && (
        <ProfileSection title="Account status">
          <ProfileToggleRow
            label="Active"
            description="User can sign in and use the app"
            checked={target.isActive}
            onChange={(checked) => setTarget({ ...target, isActive: checked })}
          />
        </ProfileSection>
      )}

      {/* ── Permissions ── */}
      {canEditMatrix && effectivePermissions && (
        <ProfileSection title="Permissions">
          {(draftAccountType ?? currentAccountType(target)) === 'operative' ? (
            <PermissionToggleList
              defs={OPERATIVE_PERMISSION_TOGGLES}
              permissions={effectivePermissions}
              onChange={updatePermissions}
            />
          ) : (
            <PermissionToggleList
              defs={MANAGER_PERMISSION_TOGGLES}
              permissions={effectivePermissions}
              onChange={updatePermissions}
              excludeKeys={suppressAdminAccessToggle ? ['adminAccess'] : undefined}
            />
          )}
        </ProfileSection>
      )}

      {/* ── Account actions ── */}
      <ProfileSection title="Account actions">
        {target.passwordSet ? (
          <ProfileActionButton
            label="Send password reset"
            description="Email a password reset link to this user"
            onClick={handlePasswordReset}
          />
        ) : (
          <ProfileActionButton
            label="Resend sign-up invitation"
            description="User has not completed sign-up yet — manage via iOS or invite flow"
            onClick={() => setSuccess('Pending users should be re-invited from Add user if email expired.')}
          />
        )}

        {canAdminTools && (
          <>
            {/* Inline change-type panel */}
            {showChangeType && (
              <div className="mx-4 mb-2 space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-900">Change user type</p>
                <p className="text-xs leading-relaxed text-slate-500">
                  Choose how this account should behave. Changes apply when you press Save at the top of the page.
                </p>
                <div className="space-y-2">
                  {ACCOUNT_TYPE_OPTIONS.map((option) => {
                    const selected = (draftAccountType ?? currentAccountType(target)) === option.id
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => selectDraftAccountType(option.id)}
                        className={`w-full rounded-xl border px-4 py-3 text-left transition-colors ${
                          selected
                            ? 'border-blue-400 bg-blue-50'
                            : 'border-slate-200 bg-white hover:border-slate-300'
                        }`}
                      >
                        <p className="text-sm font-semibold text-slate-900">{option.title}</p>
                        <p className="mt-1 text-xs leading-relaxed text-slate-500">{option.description}</p>
                      </button>
                    )
                  })}
                </div>
                {(draftAccountType ?? currentAccountType(target)) === 'operative' && draftTypePermissions && (
                  <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                    <PermissionToggleList
                      defs={OPERATIVE_PERMISSION_TOGGLES}
                      permissions={draftTypePermissions}
                      onChange={(patch) => setDraftTypePermissions({ ...draftTypePermissions, ...patch })}
                    />
                  </div>
                )}
                {(draftAccountType ?? currentAccountType(target)) === 'manager' && draftTypePermissions && (
                  <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                    <PermissionToggleList
                      defs={MANAGER_PERMISSION_TOGGLES}
                      permissions={draftTypePermissions}
                      onChange={(patch) => {
                        const next = { ...draftTypePermissions, ...patch }
                        if (patch.adminAccess === true) next.manager = true
                        setDraftTypePermissions(next)
                      }}
                      excludeKeys={suppressAdminAccessToggle ? ['adminAccess'] : undefined}
                    />
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setShowChangeType(false)
                    setDraftAccountType(null)
                    setDraftTypePermissions(null)
                  }}
                  className="text-sm font-medium text-slate-500 hover:text-slate-700"
                >
                  Cancel type change
                </button>
              </div>
            )}

            <ProfileActionButton
              label="Change user type"
              description="Switch between operative, manager, or administrator"
              onClick={() => setShowChangeType(true)}
            />
            <ProfileActionButton
              label={target.isActive ? 'Deactivate user' : 'Reactivate user'}
              description={target.isActive ? 'Suspend access, keep history' : 'Restore sign-in access'}
              tone="warning"
              onClick={handleToggleActive}
            />
            <ProfileActionButton
              label="Delete user"
              description="Permanently remove account"
              tone="danger"
              onClick={handleDelete}
            />
          </>
        )}
      </ProfileSection>
    </form>
  )
}
