'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { useAuthStore } from '@/lib/stores/authStore'
import { useOperativeStore } from '@/lib/stores/operativeStore'
import { useOrgUserStore } from '@/lib/stores/siteAuditStore'
import { useUserStore } from '@/lib/stores/userStore'
import { useInviteStore } from '@/lib/stores/inviteStore'
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
import { UserAvatar } from '@/components/users/UserAvatar'
import { normalizeEmploymentType } from '@/lib/ios-parity/enums'
import type { User, UserPermissions } from '@/types'
import { PermissionToggleList } from '@/components/users/ProfileExpandablePermissionToggle'
import {
  MANAGER_PERMISSION_TOGGLES,
  OPERATIVE_PERMISSION_TOGGLES,
} from '@/lib/staff/userPermissionDescriptions'
import {
  PanelHeader,
  SectionLabel,
  SettingsCard,
  Toggle,
  Input,
  Select,
  FormField,
  SaveButton,
  SuccessBanner,
  ErrorBanner,
} from '@/components/settings/primitives'

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

function initialsOf(user: User): string {
  const initials = `${user.firstName?.[0] ?? ''}${user.surname?.[0] ?? ''}`.toUpperCase()
  return initials.trim() || user.email.slice(0, 2).toUpperCase()
}

function ActionButton({
  title,
  subtitle,
  tone = 'neutral',
  busy,
  onClick,
}: {
  title: string
  subtitle?: string
  tone?: 'neutral' | 'amber' | 'red' | 'purple'
  busy?: boolean
  onClick: () => void
}) {
  const toneCls = {
    neutral: 'border-slate-200 text-slate-900 hover:bg-slate-50',
    amber: 'border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100',
    red: 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100',
    purple: 'border-[#EEEDFE] bg-[#EEEDFE] text-[#534AB7] hover:brightness-95',
  }[tone]

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition disabled:opacity-60 ${toneCls}`}
    >
      <span>
        <span className="block text-sm font-semibold">{title}</span>
        {subtitle && <span className="mt-0.5 block text-xs opacity-80">{subtitle}</span>}
      </span>
      {busy && (
        <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4Z" />
        </svg>
      )}
    </button>
  )
}

function profileSnapshot(
  user: User,
  draftAccountType: 'operative' | 'manager' | 'admin' | null,
  draftTypePermissions: UserPermissions | null
) {
  return JSON.stringify({
    firstName: user.firstName,
    surname: user.surname,
    email: user.email,
    mobileNumber: user.mobileNumber || '',
    employmentType: user.employmentType,
    assignedManagerUserId: user.assignedManagerUserId || '',
    dayRate: user.dayRate ?? null,
    hourlyRate: user.hourlyRate ?? null,
    tradeTypePreset: user.tradeTypePreset || '',
    tradeTypeCustom: user.tradeTypeCustom || '',
    annualLeaveEnabled: user.annualLeaveEnabled !== false,
    annualLeaveDaysPerYear: user.annualLeaveDaysPerYear ?? null,
    annualLeaveYearStartMonth: user.annualLeaveYearStartMonth ?? null,
    annualLeaveYearEndMonth: user.annualLeaveYearEndMonth ?? null,
    annualLeaveCarriesOver: user.annualLeaveCarriesOver === true,
    timesheetsEnabled: user.timesheetsEnabled === true,
    vatNumber: user.vatNumber || '',
    utrNumber: user.utrNumber || '',
    isActive: user.isActive,
    permissions: draftTypePermissions ?? user.permissions,
    draftAccountType,
  })
}

export function EditUserProfile({
  userId,
  backHref,
  suppressAdminAccessToggle,
  hubHref,
}: {
  userId: string
  backHref: string
  suppressAdminAccessToggle?: boolean
  hubHref?: string
}) {
  const router = useRouter()
  const { user: currentUser, organization } = useAuthStore()
  const { users, loadUsers } = useOrgUserStore()
  const { operatives, loadOperatives } = useOperativeStore()
  const { getUser, saveUser, setUserActive, deleteUser, sendPasswordReset, applyAccountType, syncLinkedOperative } =
    useUserStore()
  const { inviteUser } = useInviteStore()

  const [target, setTarget] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [showChangeType, setShowChangeType] = useState(false)
  const [draftAccountType, setDraftAccountType] = useState<'operative' | 'manager' | 'admin' | null>(null)
  const [draftTypePermissions, setDraftTypePermissions] = useState<UserPermissions | null>(null)
  const [busyAction, setBusyAction] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [confirmAdmin, setConfirmAdmin] = useState(false)
  const [baseline, setBaseline] = useState<string | null>(null)
  const [originalDayRate, setOriginalDayRate] = useState<number | undefined>(undefined)
  const [fixEmail, setFixEmail] = useState('')
  const [fixNote, setFixNote] = useState('')
  const [fixOpen, setFixOpen] = useState(false)

  useEffect(() => {
    if (!organization?.id) return
    loadUsers(organization.id)
    loadOperatives(organization.id)
    getUser(userId)
      .then((row) => {
        setTarget(row)
        setOriginalDayRate(row?.dayRate)
        if (row) setBaseline(profileSnapshot(row, null, null))
      })
      .finally(() => setLoading(false))
  }, [organization?.id, userId, getUser, loadUsers, loadOperatives])

  const managers = useMemo(
    () =>
      users.filter(
        (user) =>
          user.id !== target?.id &&
          !user.permissions.operativeMode &&
          user.isActive &&
          (user.permissions.manager || user.permissions.adminAccess)
      ),
    [users, target?.id]
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

  const showEmploymentType = target && canEditMatrix && !target.isSuperAdmin

  const showPayrollFields =
    target &&
    canEditMatrix &&
    (target.permissions.operativeMode || target.permissions.manager) &&
    !target.permissions.adminAccess &&
    !target.isSuperAdmin

  const effectivePermissions = draftTypePermissions ?? target?.permissions
  const effectiveAccountType = draftAccountType ?? (target ? currentAccountType(target) : 'manager')

  const updatePermissions = (patch: Partial<UserPermissions>) => {
    if (!target) return
    if (patch.adminAccess === true && currentAccountType(target) !== 'admin') {
      setConfirmAdmin(true)
      return
    }
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

  const handleSave = async (e?: FormEvent) => {
    e?.preventDefault()
    if (!target || !organization?.id || !canEdit) return

    setSaving(true)
    setError(null)
    setSuccess(null)
    setSaved(false)
    try {
      let toSave = { ...target, updatedAt: new Date() }
      if (draftAccountType && draftTypePermissions) {
        toSave = applyAccountType(toSave, draftAccountType)
        toSave = { ...toSave, permissions: draftTypePermissions }
      }
      await saveUser(toSave)
      await syncLinkedOperative(organization.id, toSave, operatives)
      try {
        const { loadOperativeDayRateHistory, recordDayRateChangeIfNeeded } = await import(
          '@/lib/timesheets/dayRateHistoryStorage'
        )
        const history = await loadOperativeDayRateHistory(organization.id)
        await recordDayRateChangeIfNeeded({
          organizationId: organization.id,
          userId: toSave.id,
          operativeId: findOperativeForUser(toSave, operatives)?.id,
          previousDayRate: originalDayRate,
          nextDayRate: toSave.dayRate ?? null,
          createdAt: toSave.createdAt,
          history,
        })
        setOriginalDayRate(toSave.dayRate)
      } catch {
        // History write is best-effort so a profile save still succeeds.
      }
      await loadUsers(organization.id)
      setSuccess('Profile saved.')
      setSaved(true)
      window.setTimeout(() => setSaved(false), 3000)
      setTarget(toSave)
      setDraftAccountType(null)
      setDraftTypePermissions(null)
      setShowChangeType(false)
      setBaseline(profileSnapshot(toSave, null, null))
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save user')
    } finally {
      setSaving(false)
    }
  }

  const handlePasswordReset = async () => {
    if (!target?.passwordSet) return
    setBusyAction('reset')
    try {
      await sendPasswordReset(target.email)
      setSuccess('Password reset email sent.')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to send password reset')
    } finally {
      setBusyAction(null)
    }
  }

  const handleResendInvite = async () => {
    if (!target || !organization?.id) return
    setBusyAction('invite')
    try {
      await inviteUser({
        email: target.email,
        organizationId: organization.id,
        organizationName: organization.name,
        firstName: target.firstName,
        surname: target.surname,
        mobileNumber: target.mobileNumber,
        permissions: target.permissions,
        assignedManagerUserId: target.assignedManagerUserId,
        dayRate: target.dayRate,
        tradeTypePreset: target.tradeTypePreset,
        tradeTypeCustom: target.tradeTypeCustom,
      })
      setSuccess(`Sign-up email sent to ${target.email}.`)
      loadUsers(organization.id)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to send sign-up email')
    } finally {
      setBusyAction(null)
    }
  }

  const handleToggleActive = async () => {
    if (!target || !canAdminTools) return
    const next = !target.isActive
    setBusyAction('active')
    try {
      await setUserActive(target.id, next)
      setTarget({ ...target, isActive: next })
      setSuccess(next ? 'User reactivated.' : 'User deactivated.')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update status')
    } finally {
      setBusyAction(null)
    }
  }

  const handleDelete = async () => {
    if (!target || !canAdminTools) return
    setConfirmDelete(false)
    setBusyAction('delete')
    try {
      await deleteUser(target.id)
      router.push(hubHref || backHref)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete user')
    } finally {
      setBusyAction(null)
    }
  }

  const selectDraftAccountType = (accountType: 'operative' | 'manager' | 'admin') => {
    if (!target) return
    if (accountType === 'admin' && currentAccountType(target) !== 'admin') {
      setConfirmAdmin(true)
      return
    }
    applyDraftAccountType(accountType)
  }

  const applyDraftAccountType = (accountType: 'operative' | 'manager' | 'admin') => {
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
      <div className="mx-auto max-w-2xl card p-8 text-center">
        <p className="text-slate-600">User not found.</p>
        <Link href={backHref} className="mt-4 inline-block text-blue-600 hover:underline">
          Go back
        </Link>
      </div>
    )
  }

  const dirty =
    Boolean(target) &&
    baseline != null &&
    profileSnapshot(target, draftAccountType, draftTypePermissions) !== baseline
  const pageTitle = target.permissions.operativeMode ? 'Edit operative' : 'Edit user'
  const status = rosterStatusLabel(target)
  const isPendingMgrOrOp =
    !target.passwordSet &&
    (target.permissions.manager || target.permissions.operativeMode) &&
    !target.permissions.adminAccess &&
    !target.isSuperAdmin

  return (
    <form onSubmit={handleSave} className="mx-auto max-w-2xl pb-16">
      <PanelHeader
        title={pageTitle}
        onBack={() => router.push(backHref)}
        rightAction={
          canEdit && dirty ? (
            <button
              type="button"
              disabled={saving}
              onClick={() => handleSave()}
              className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          ) : canEdit ? (
            <span className="px-2 text-[11px] font-medium text-slate-400">No changes</span>
          ) : (
            <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-500">
              View only
            </span>
          )
        }
      />

      {error && (
        <div className="mt-4">
          <ErrorBanner message={error} />
        </div>
      )}
      {success && !saved && (
        <div className="mt-4">
          <SuccessBanner message={success} />
        </div>
      )}
      {draftAccountType && (
        <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
          Account type will change to <strong className="capitalize">{draftAccountType}</strong> when you press Save.
        </div>
      )}

      {/* Profile header */}
      <div className="mt-4 flex items-center gap-4 card p-5 shadow-sm">
        <UserAvatar user={target} size={64} className="rounded-2xl" gradient="from-[#7F77DD] to-[#534AB7]" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-lg font-bold text-[var(--ink)]">
            {target.firstName} {target.surname}
          </div>
          <div className="text-sm text-slate-500">{roleLabel(target)}</div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ${
                target.passwordSet
                  ? 'bg-emerald-50 text-emerald-700 ring-emerald-100'
                  : 'bg-amber-50 text-amber-700 ring-amber-100'
              }`}
            >
              {target.passwordSet ? 'Verified' : 'Pending'}
            </span>
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ${
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
      </div>

      {/* Identity */}
      <SectionLabel label="Identity" />
      <SettingsCard>
        <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2">
          <FormField label="First name">
            <Input
              value={target.firstName}
              disabled={!canEditIdentity}
              onChange={(e) => setTarget({ ...target, firstName: e.target.value })}
            />
          </FormField>
          <FormField label="Surname">
            <Input
              value={target.surname}
              disabled={!canEditIdentity}
              onChange={(e) => setTarget({ ...target, surname: e.target.value })}
            />
          </FormField>
          <FormField label="Email">
            <Input
              type="email"
              value={target.email}
              disabled={!canEditIdentity}
              onChange={(e) => setTarget({ ...target, email: e.target.value })}
            />
          </FormField>
          <FormField label="Mobile number">
            <Input
              value={target.mobileNumber || ''}
              disabled={!canEditIdentity}
              onChange={(e) => setTarget({ ...target, mobileNumber: e.target.value })}
            />
          </FormField>
          <FormField label="Last active">
            <Input
              value={target.lastSeenAt ? format(target.lastSeenAt, "d MMM yyyy 'at' HH:mm") : '—'}
              disabled
            />
          </FormField>
          {!canEdit && (
            <FormField label="Trade type">
              <Input value={displayTradeType(target.tradeTypePreset, target.tradeTypeCustom)} disabled />
            </FormField>
          )}
          {showEmploymentType && (
            <FormField label="Employment type">
              <Select
                value={normalizeEmploymentType(target.employmentType)}
                disabled={!canEditMatrix}
                onChange={(e) => setTarget({ ...target, employmentType: e.target.value })}
              >
                <option value="self_employed">Self-Employed</option>
                <option value="paye">PAYE</option>
              </Select>
            </FormField>
          )}
        </div>
      </SettingsCard>

      {/* Permissions */}
      {canEditMatrix && effectivePermissions && (
        <>
          <SectionLabel label={`${roleLabel(target)} access`} />
          <SettingsCard>
            <div className="divide-y divide-slate-100">
              {effectiveAccountType === 'operative' ? (
                <PermissionToggleList
                  defs={OPERATIVE_PERMISSION_TOGGLES}
                  permissions={effectivePermissions}
                  onChange={updatePermissions}
                  disabled={!canEdit}
                />
              ) : (
                <PermissionToggleList
                  defs={MANAGER_PERMISSION_TOGGLES}
                  permissions={effectivePermissions}
                  onChange={updatePermissions}
                  disabled={!canEdit}
                  excludeKeys={suppressAdminAccessToggle ? ['adminAccess'] : undefined}
                />
              )}
            </div>
          </SettingsCard>
        </>
      )}

      {showSetupCard && (
        <>
          <SectionLabel label={setupSectionTitle(target)} />
          <SettingsCard>
            <div className="space-y-4 p-4">
              {(target.permissions.operativeMode || target.permissions.manager) && (
                <FormField label="Line manager" hint="Same as iOS — leave as “No line manager” if not applicable.">
                  <Select
                    value={target.assignedManagerUserId || ''}
                    disabled={!canEdit}
                    onChange={(e) => setTarget({ ...target, assignedManagerUserId: e.target.value })}
                  >
                    <option value="">No line manager</option>
                    {managers.map((manager) => (
                      <option key={manager.id} value={manager.id}>
                        {manager.firstName} {manager.surname} ({manager.email})
                      </option>
                    ))}
                  </Select>
                </FormField>
              )}

              <FormField label="Day rate" hint="Payroll uses either a day rate or an hourly rate, not both.">
                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-slate-400">
                    £
                  </span>
                  <Input
                    type="number"
                    step="0.01"
                    value={target.dayRate?.toString() || ''}
                    className="pl-7"
                    disabled={!canEdit}
                    onChange={(e) =>
                      setTarget({
                        ...target,
                        dayRate: e.target.value ? Number(e.target.value) : undefined,
                        hourlyRate: undefined,
                      })
                    }
                  />
                </div>
              </FormField>

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="Trade type">
                  <Select
                    value={target.tradeTypePreset || ''}
                    disabled={!canEdit}
                    onChange={(e) => setTarget({ ...target, tradeTypePreset: e.target.value })}
                  >
                    <option value="">Select trade</option>
                    {STAFF_TRADE_TYPES.map((trade) => (
                      <option key={trade} value={trade}>
                        {trade}
                      </option>
                    ))}
                  </Select>
                </FormField>
                {target.tradeTypePreset === 'Other' && (
                  <FormField label="Custom trade">
                    <Input
                      value={target.tradeTypeCustom || ''}
                      disabled={!canEdit}
                      onChange={(e) => setTarget({ ...target, tradeTypeCustom: e.target.value })}
                    />
                  </FormField>
                )}
              </div>

              <p className="text-sm text-[var(--ink2)]">
                Current trade:{' '}
                <span className="font-medium text-[var(--ink)]">
                  {displayTradeType(target.tradeTypePreset, target.tradeTypeCustom)}
                </span>
              </p>
            </div>
          </SettingsCard>
        </>
      )}

      {/* Annual leave access */}
      {showAnnualLeave && (
        <>
          <SectionLabel label="Annual leave in app" />
          <SettingsCard>
            <div className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-[var(--ink)]">Annual leave enabled</div>
                  <p className="mt-0.5 text-xs text-[var(--ink3)]">
                    Turn off for self-employed staff who do not use paid annual leave.
                  </p>
                </div>
                <Toggle
                  checked={target.annualLeaveEnabled !== false}
                  disabled={!canEdit}
                  onChange={(checked) => setTarget({ ...target, annualLeaveEnabled: checked })}
                />
              </div>
              <p className="mt-2 text-xs text-slate-400">
                When off, their Holiday tab and annual leave entry points are hidden until turned back on here.
              </p>
            </div>
          </SettingsCard>
        </>
      )}

      {/* Annual leave entitlement */}
      {showAnnualLeave && target.annualLeaveEnabled !== false && (
        <>
          <SectionLabel label="Annual leave" />
          <SettingsCard>
            <div className="space-y-5 p-4">
              <FormField label="Days per year">
                <Input
                  type="number"
                  value={target.annualLeaveDaysPerYear?.toString() || '28'}
                  disabled={!canEdit}
                  onChange={(e) =>
                    setTarget({ ...target, annualLeaveDaysPerYear: Number(e.target.value) || undefined })
                  }
                />
              </FormField>
              <FormField
                label="Company leave year"
                hint="Runs from the first day of the start month through the last day of the end month (e.g. April → March)."
              >
                <div className="flex items-center gap-3">
                  <Select
                    value={String(target.annualLeaveYearStartMonth ?? 1)}
                    disabled={!canEdit}
                    onChange={(e) =>
                      setTarget({ ...target, annualLeaveYearStartMonth: Number(e.target.value) })
                    }
                  >
                    {MONTHS.map((month, index) => (
                      <option key={month} value={index + 1}>
                        {month}
                      </option>
                    ))}
                  </Select>
                  <span className="text-slate-400">→</span>
                  <Select
                    value={String(target.annualLeaveYearEndMonth ?? 12)}
                    disabled={!canEdit}
                    onChange={(e) =>
                      setTarget({ ...target, annualLeaveYearEndMonth: Number(e.target.value) })
                    }
                  >
                    {MONTHS.map((month, index) => (
                      <option key={month} value={index + 1}>
                        {month}
                      </option>
                    ))}
                  </Select>
                </div>
              </FormField>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-[var(--ink)]">Carry unused days into next leave year</div>
                  <p className="mt-0.5 text-xs text-[var(--ink3)]">
                    Unused allowance from the previous leave year is added to this year&apos;s balance.
                  </p>
                </div>
                <Toggle
                  checked={target.annualLeaveCarriesOver === true}
                  disabled={!canEdit}
                  onChange={(checked) => setTarget({ ...target, annualLeaveCarriesOver: checked })}
                />
              </div>
            </div>
          </SettingsCard>
        </>
      )}

      {/* Employment & timesheets */}
      {showPayrollFields && (
        <>
          <SectionLabel label="Employment & timesheets" />
          <SettingsCard>
            <div className="space-y-4 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-[var(--ink)]">Timesheets enabled</div>
                  <p className="mt-0.5 text-xs text-[var(--ink3)]">Allow this person to log and submit timesheets.</p>
                </div>
                <Toggle
                  checked={target.timesheetsEnabled === true}
                  disabled={!canEdit}
                  onChange={(checked) => setTarget({ ...target, timesheetsEnabled: checked })}
                />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField label="VAT number" hint="Optional.">
                  <Input
                    value={target.vatNumber || ''}
                    disabled={!canEdit}
                    onChange={(e) => setTarget({ ...target, vatNumber: e.target.value })}
                  />
                </FormField>
                <FormField label="UTR number" hint="Optional.">
                  <Input
                    value={target.utrNumber || ''}
                    disabled={!canEdit}
                    onChange={(e) => setTarget({ ...target, utrNumber: e.target.value })}
                  />
                </FormField>
              </div>
            </div>
          </SettingsCard>
        </>
      )}

      {/* Account status */}
      {canAdminTools && (
        <>
          <SectionLabel label="Account status" />
          <SettingsCard>
            <div className="p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-[var(--ink)]">Active</div>
                  <p className="mt-0.5 text-xs text-[var(--ink3)]">User can sign in and use the app.</p>
                </div>
                <Toggle
                  checked={target.isActive}
                  disabled={!canEdit}
                  onChange={(checked) => setTarget({ ...target, isActive: checked })}
                />
              </div>
            </div>
          </SettingsCard>
        </>
      )}

      {canEdit && dirty ? (
        <div className="mt-6">
          <SaveButton saving={saving} saved={saved} onClick={() => handleSave()} />
        </div>
      ) : null}

      {/* Account actions */}
      {canEdit ? <SectionLabel label="Account actions" /> : null}
      {canEdit ? (
      <div className="space-y-2">
        {target.passwordSet ? (
          <ActionButton
            title="Send password reset"
            subtitle="Email a password reset link to this user"
            busy={busyAction === 'reset'}
            onClick={handlePasswordReset}
          />
        ) : (
          <ActionButton
            title={isPendingMgrOrOp ? 'Resend sign-up email (verification code)' : 'Resend verification email'}
            subtitle="They haven't finished setting a password yet."
            busy={busyAction === 'invite'}
            onClick={handleResendInvite}
          />
        )}
        {canAdminTools ? (
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-sm font-semibold text-slate-900">Wrong login email? Ask Project Planner to fix it</p>
            <p className="mt-1 text-xs text-slate-500">
              Sends a support request to the platform owner. They will change the login email; you never see or set a password.
            </p>
            {fixOpen ? (
              <div className="mt-3 space-y-2">
                <input
                  className="pp-in"
                  placeholder="Correct email"
                  value={fixEmail}
                  onChange={(e) => setFixEmail(e.target.value)}
                />
                <textarea
                  className="pp-in min-h-[72px]"
                  placeholder="Note (optional)"
                  value={fixNote}
                  onChange={(e) => setFixNote(e.target.value)}
                />
                <button
                  type="button"
                  className="btn sm primary"
                  disabled={busyAction === 'fix-email'}
                  onClick={async () => {
                    if (!organization?.id || !target) return
                    setBusyAction('fix-email')
                    setError(null)
                    try {
                      const { jsonAuthHeaders } = await import('@/lib/security/clientAuthHeaders')
                      const response = await fetch('/api/support/login-email', {
                        method: 'POST',
                        headers: await jsonAuthHeaders(),
                        body: JSON.stringify({
                          orgId: organization.id,
                          targetUid: target.id,
                          suggestedEmail: fixEmail,
                          note: fixNote,
                          targetName: `${target.firstName} ${target.surname}`.trim(),
                        }),
                      })
                      const data = (await response.json().catch(() => ({}))) as { error?: string }
                      if (!response.ok) throw new Error(data.error || 'Could not send that request.')
                      setSuccess('Project Planner has been asked to fix this login email.')
                      setFixOpen(false)
                    } catch (err) {
                      setError(err instanceof Error ? err.message : 'Could not send that request.')
                    } finally {
                      setBusyAction(null)
                    }
                  }}
                >
                  Send request
                </button>
              </div>
            ) : (
              <button type="button" className="btn sm ghost mt-2" onClick={() => setFixOpen(true)}>
                Ask Project Planner to fix it
              </button>
            )}
          </div>
        ) : null}

        {canAdminTools && (
          <>
            {showChangeType && (
              <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-900">Change user type</p>
                <p className="text-xs leading-relaxed text-slate-500">
                  Choose how this account should behave. Changes apply when you press Save.
                </p>
                <div className="space-y-2">
                  {ACCOUNT_TYPE_OPTIONS.map((option) => {
                    const selected = effectiveAccountType === option.id
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
                {effectiveAccountType === 'operative' && draftTypePermissions && (
                  <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                    <PermissionToggleList
                      defs={OPERATIVE_PERMISSION_TOGGLES}
                      permissions={draftTypePermissions}
                      onChange={(patch) => setDraftTypePermissions({ ...draftTypePermissions, ...patch })}
                    />
                  </div>
                )}
                {(effectiveAccountType === 'manager' || effectiveAccountType === 'admin') && draftTypePermissions && (
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

            <ActionButton
              title="Change user type"
              subtitle="Switch between operative, manager, or administrator"
              tone="purple"
              onClick={() => setShowChangeType(true)}
            />
            <ActionButton
              title={target.isActive ? 'Deactivate user' : 'Reactivate user'}
              subtitle={target.isActive ? 'Suspend access, keep history' : 'Restore sign-in access'}
              tone="amber"
              busy={busyAction === 'active'}
              onClick={handleToggleActive}
            />
            <ActionButton
              title="Delete user"
              subtitle="Permanently remove account"
              tone="red"
              onClick={() => setConfirmDelete(true)}
            />
          </>
        )}
      </div>
      ) : null}

      {confirmDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setConfirmDelete(false)}
        >
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-slate-900">Delete user</h2>
            <p className="mt-2 text-sm text-slate-600">
              Are you sure you want to delete {target.firstName} {target.surname}? This action cannot be undone.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={busyAction === 'delete'}
                className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmAdmin && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setConfirmAdmin(false)}
        >
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-slate-900">Make this user an administrator?</h2>
            <p className="mt-2 text-sm text-slate-600">
              Administrators have full access, including user management, organisation settings, and warnings. This
              takes effect when you press Save.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmAdmin(false)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmAdmin(false)
                  applyDraftAccountType('admin')
                }}
                className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
              >
                Make administrator
              </button>
            </div>
          </div>
        </div>
      )}
    </form>
  )
}
