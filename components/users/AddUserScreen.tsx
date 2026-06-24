'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/stores/authStore'
import { useOrgUserStore } from '@/lib/stores/siteAuditStore'
import { useInviteStore } from '@/lib/stores/inviteStore'
import { canInviteOperatives, canManageOperativesOnly, canManageUsers, getAddUserLabel } from '@/lib/navigation/menuPermissions'
import { permissionsForAccountType } from '@/lib/orgSetup/accountPermissions'
import { DEFAULT_ANNUAL_LEAVE } from '@/lib/settings/organizationSettings'
import { STAFF_TRADE_TYPES } from '@/lib/staff/staffTradeTypes'
import { getManagerUsers } from '@/lib/staff/userRosterUtils'
import {
  MANAGER_PERMISSION_TOGGLES,
  OPERATIVE_PERMISSION_TOGGLES,
  type PermissionToggleDef,
} from '@/lib/staff/userPermissionDescriptions'
import { loadOrganizationDetails } from '@/lib/settings/organizationSettings'
import type { UserPermissions } from '@/types'
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

type AccountType = 'admin' | 'manager' | 'operative'

const ACCOUNT_TYPES: {
  id: AccountType
  title: string
  description: string
  badge: string
  badgeCls: string
  ringCls: string
}[] = [
  {
    id: 'admin',
    title: 'Administrator',
    description: 'Full access including user management, organisation settings and billing.',
    badge: 'Admin',
    badgeCls: 'bg-[#FDECF1] text-[#E11D48]',
    ringCls: 'ring-[#E11D48]/30 border-[#E11D48]/40',
  },
  {
    id: 'manager',
    title: 'Manager',
    description: 'Run day-to-day operations — schedules, projects, operatives and approvals.',
    badge: 'Manager',
    badgeCls: 'bg-[#E6F1FB] text-[#185FA5]',
    ringCls: 'ring-[#185FA5]/30 border-[#185FA5]/40',
  },
  {
    id: 'operative',
    title: 'Operative',
    description: 'Field access to their schedule, tasks, materials and site audits as configured.',
    badge: 'Operative',
    badgeCls: 'bg-[#E9F9EF] text-[#15A34A]',
    ringCls: 'ring-[#15A34A]/30 border-[#15A34A]/40',
  },
]

const PERM_CHIP: Partial<Record<string, { bg: string; fg: string }>> = {
  adminAccess: { bg: 'bg-[#FDECF1]', fg: 'text-[#993556]' },
  operatives: { bg: 'bg-[#EEEDFE]', fg: 'text-[#534AB7]' },
  annualLeaveSelfBook: { bg: 'bg-[#E6F1FB]', fg: 'text-[#185FA5]' },
  weeklyReports: { bg: 'bg-[#E1F5EE]', fg: 'text-[#0F6E56]' },
  dailyOverview: { bg: 'bg-[#E1F5EE]', fg: 'text-[#0F6E56]' },
  subContractors: { bg: 'bg-[#E1F5EE]', fg: 'text-[#0F6E56]' },
  skills: { bg: 'bg-[#FBEAF0]', fg: 'text-[#993556]' },
  qualifications: { bg: 'bg-[#FBEAF0]', fg: 'text-[#993556]' },
  projects: { bg: 'bg-[#E6F1FB]', fg: 'text-[#185FA5]' },
  smallWorks: { bg: 'bg-[#E6F1FB]', fg: 'text-[#185FA5]' },
  materials: { bg: 'bg-[#FAEEDA]', fg: 'text-[#854F0B]' },
  siteAudit: { bg: 'bg-[#E1F5EE]', fg: 'text-[#0F6E56]' },
  wholesalersOrderHistory: { bg: 'bg-[#E6F1FB]', fg: 'text-[#185FA5]' },
}

const ICON_PERSON =
  'M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z'

function PermToggleRow({
  def,
  checked,
  onChange,
  disabled = false,
}: {
  def: PermissionToggleDef
  checked: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
}) {
  const chip = PERM_CHIP[def.key] ?? { bg: 'bg-slate-100', fg: 'text-slate-600' }
  return (
    <div className="flex items-start justify-between gap-4 px-4 py-3.5">
      <div className="flex items-start gap-3">
        <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${chip.bg}`}>
          <svg className={`h-4 w-4 ${chip.fg}`} viewBox="0 0 24 24" fill="currentColor">
            <path d={ICON_PERSON} />
          </svg>
        </span>
        <div>
          <div className="text-sm font-semibold text-slate-900">{def.title}</div>
          <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{def.description}</p>
        </div>
      </div>
      <Toggle checked={checked} onChange={onChange} disabled={disabled} />
    </div>
  )
}

export function AddUserScreen() {
  const router = useRouter()
  const { user, organization } = useAuthStore()
  const { users, loadUsers } = useOrgUserStore()
  const { inviteUser } = useInviteStore()

  const canInviteAdmins = canManageUsers(user)
  const operativeInviteOnly = canManageOperativesOnly(user)
  const canAccess = canInviteOperatives(user)
  const pageTitle = operativeInviteOnly ? 'Add operative' : getAddUserLabel(user)
  const backHref = operativeInviteOnly ? '/dashboard/operatives' : '/dashboard/settings/users'

  const [accountType, setAccountType] = useState<AccountType>(
    canInviteAdmins ? 'manager' : 'operative'
  )
  const [permissions, setPermissions] = useState<UserPermissions>(() => permissionsForAccountType('manager'))
  const [form, setForm] = useState({
    firstName: '',
    surname: '',
    email: '',
    mobileNumber: '',
    assignedManagerUserId: '',
    dayRate: '',
    tradeTypePreset: '',
    tradeTypeCustom: '',
    employmentType: 'selfEmployed' as 'paye' | 'selfEmployed',
    timesheetsEnabled: false,
    vatNumber: '',
    utrNumber: '',
    annualLeaveEnabled: true,
    annualLeaveDaysPerYear: String(DEFAULT_ANNUAL_LEAVE.daysPerYear),
  })
  const [annualLeaveDefaults, setAnnualLeaveDefaults] = useState(DEFAULT_ANNUAL_LEAVE)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    if (organization?.id) loadUsers(organization.id)
  }, [organization?.id, loadUsers])

  useEffect(() => {
    if (!organization?.id) return
    loadOrganizationDetails(organization.id)
      .then((details) => {
        const defaults = details?.annualLeaveDefaults ?? DEFAULT_ANNUAL_LEAVE
        setAnnualLeaveDefaults(defaults)
        setForm((prev) => ({
          ...prev,
          annualLeaveDaysPerYear: String(defaults.daysPerYear),
        }))
      })
      .catch(() => {})
  }, [organization?.id])

  const lineManagers = useMemo(
    () => getManagerUsers(users).filter((entry) => entry.isActive),
    [users]
  )

  const availableAccountTypes = useMemo(() => {
    if (canInviteAdmins) return ACCOUNT_TYPES
    return ACCOUNT_TYPES.filter((type) => type.id === 'operative')
  }, [canInviteAdmins])

  const permissionDefs = useMemo(() => {
    if (accountType === 'operative') return OPERATIVE_PERMISSION_TOGGLES
    return MANAGER_PERMISSION_TOGGLES.filter((def) => def.key !== 'adminAccess')
  }, [accountType])

  const adminPermissionDefs = useMemo(() => MANAGER_PERMISSION_TOGGLES, [])

  const showSetup = true
  const showPermissions = accountType !== 'admin'
  const showAdminPermissions = accountType === 'admin'

  function selectAccountType(next: AccountType) {
    setAccountType(next)
    setPermissions(permissionsForAccountType(next))
  }

  function updatePermission(patch: Partial<UserPermissions>) {
    setPermissions((prev) => {
      const next = { ...prev, ...patch }
      if (patch.adminAccess === true) next.manager = true
      return next
    })
  }

  function permissionChecked(key: keyof UserPermissions): boolean {
    if (accountType === 'admin') return true
    if (key === 'dailyOverview') return permissions.dailyOverview !== false
    return permissions[key] === true
  }

  const invitePermissions =
    operativeInviteOnly || accountType === 'operative'
      ? permissionsForAccountType('operative')
      : accountType === 'admin'
        ? permissionsForAccountType('admin')
        : permissions

  const handleSubmit = async (e?: FormEvent) => {
    e?.preventDefault()
    if (!organization?.id || !user) return

    const firstName = form.firstName.trim()
    const surname = form.surname.trim()
    const email = form.email.trim()

    if (!firstName || !surname) {
      setError('First name and surname are required.')
      return
    }
    if (!email.includes('@') || !email.includes('.')) {
      setError('Enter a valid email address.')
      return
    }

    setSaving(true)
    setError(null)
    setSuccess(null)
    setSaved(false)

    try {
      const result = await inviteUser({
        email,
        organizationId: organization.id,
        organizationName: organization.name,
        firstName,
        surname,
        mobileNumber: form.mobileNumber.trim() || undefined,
        permissions: invitePermissions,
        assignedManagerUserId: form.assignedManagerUserId || undefined,
        dayRate: form.dayRate ? Number(form.dayRate) : undefined,
        tradeTypePreset: form.tradeTypePreset || undefined,
        tradeTypeCustom: form.tradeTypePreset === 'Other' ? form.tradeTypeCustom.trim() || undefined : undefined,
        employmentType: form.employmentType,
        timesheetsEnabled: showSetup ? form.timesheetsEnabled : undefined,
        vatNumber: form.vatNumber.trim() || undefined,
        utrNumber: form.utrNumber.trim() || undefined,
        annualLeaveEnabled: form.annualLeaveEnabled,
        annualLeaveDaysPerYear: form.annualLeaveEnabled
          ? Number(form.annualLeaveDaysPerYear) || annualLeaveDefaults.daysPerYear
          : undefined,
        annualLeaveYearStartMonth: form.annualLeaveEnabled ? annualLeaveDefaults.startMonth : undefined,
        annualLeaveYearEndMonth: form.annualLeaveEnabled ? annualLeaveDefaults.endMonth : undefined,
      })

      if (result.inviteType === 'existing_user_org_add') {
        try {
          await fetch('/api/invites/send-org-addition-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              organizationName: organization.name,
              firstName,
              to: email,
            }),
          })
          setSuccess(
            `${email} already has a Project Planner account. They will receive an email and can accept from Change organisation.`
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
            firstName,
            role: operativeInviteOnly || accountType === 'operative' ? 'operative' : accountType === 'admin' ? 'admin' : 'manager',
            to: email,
          })
          setSuccess(`Invitation sent to ${email}. They will receive an email to set their password.`)
        } catch (emailError) {
          setSuccess(
            `User invited but email could not be sent (${emailError instanceof Error ? emailError.message : 'unknown error'}). Add RESEND_API_KEY to .env.local.`
          )
        }
      }

      setSaved(true)
      window.setTimeout(() => router.push(backHref), 2200)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to invite user')
    } finally {
      setSaving(false)
    }
  }

  if (!user) return null

  if (!canAccess) {
    return (
      <div className="mx-auto max-w-2xl rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
        <p className="text-slate-600">You do not have permission to invite users.</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-2xl pb-16">
      <PanelHeader title={pageTitle} onBack={() => router.push(backHref)} />

      <p className="mt-2 text-sm text-slate-500">
        {operativeInviteOnly
          ? 'Invite a new operative to your organisation. They will receive an email to set up their account.'
          : 'Invite someone to your organisation. They&apos;ll receive an email to set up their account — same flow as the iOS app.'}
      </p>

      {error && (
        <div className="mt-4">
          <ErrorBanner message={error} />
        </div>
      )}
      {success && (
        <div className="mt-4">
          <SuccessBanner message={success} />
        </div>
      )}

      {!operativeInviteOnly && (
        <>
          <SectionLabel label="Account type" />
          <div className="space-y-2">
            {availableAccountTypes.map((type) => {
              const selected = accountType === type.id
              return (
                <button
                  key={type.id}
                  type="button"
                  onClick={() => selectAccountType(type.id)}
                  className={`w-full rounded-2xl border bg-white p-4 text-left transition ${
                    selected
                      ? `ring-2 ${type.ringCls} shadow-sm`
                      : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-bold text-slate-900">{type.title}</span>
                        <span className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${type.badgeCls}`}>
                          {type.badge}
                        </span>
                      </div>
                      <p className="mt-1.5 text-xs leading-relaxed text-slate-500">{type.description}</p>
                    </div>
                    <span
                      className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                        selected ? 'border-blue-600 bg-blue-600' : 'border-slate-300 bg-white'
                      }`}
                    >
                      {selected && (
                        <svg className="h-3 w-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
        </>
      )}

      {operativeInviteOnly && (
        <SettingsCard>
          <div className="p-4 text-sm text-slate-600">
            You are inviting an <strong className="font-semibold text-slate-800">operative</strong>. New operatives
            appear in your Operatives roster once they accept the invitation.
          </div>
        </SettingsCard>
      )}

      <SectionLabel label="Identity" />
      <SettingsCard>
        <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2">
          <FormField label="First name" hint="Required">
            <Input
              value={form.firstName}
              required
              autoComplete="given-name"
              onChange={(e) => setForm({ ...form, firstName: e.target.value })}
            />
          </FormField>
          <FormField label="Surname" hint="Required">
            <Input
              value={form.surname}
              required
              autoComplete="family-name"
              onChange={(e) => setForm({ ...form, surname: e.target.value })}
            />
          </FormField>
          <FormField label="Email" hint="Invitation is sent here">
            <Input
              type="email"
              value={form.email}
              required
              autoComplete="email"
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </FormField>
          <FormField label="Mobile number" hint="Optional">
            <Input
              type="tel"
              value={form.mobileNumber}
              autoComplete="tel"
              onChange={(e) => setForm({ ...form, mobileNumber: e.target.value })}
            />
          </FormField>
        </div>
      </SettingsCard>

      {showAdminPermissions && (
        <>
          <SectionLabel label="Administrator permissions" />
          <SettingsCard>
            <div className="border-b border-slate-100 px-4 py-3 text-sm text-slate-600">
              All permissions are enabled for administrators. The only capability managers do not have is{' '}
              <strong className="font-semibold text-slate-800">Organisation settings</strong> in Settings — that hub is
              visible to administrators only and is hidden from managers and operatives.
            </div>
            <div className="divide-y divide-slate-100">
              {adminPermissionDefs.map((def) => (
                <PermToggleRow
                  key={def.key}
                  def={def}
                  checked={permissionChecked(def.key)}
                  onChange={() => {}}
                  disabled
                />
              ))}
            </div>
          </SettingsCard>
        </>
      )}

      {showPermissions && permissionDefs.length > 0 && (
        <>
          <SectionLabel label={`${accountType === 'operative' ? 'Operative' : 'Manager'} permissions`} />
          <SettingsCard>
            <div className="divide-y divide-slate-100">
              {permissionDefs.map((def) => (
                <PermToggleRow
                  key={def.key}
                  def={def}
                  checked={permissionChecked(def.key)}
                  onChange={(checked) => updatePermission({ [def.key]: checked } as Partial<UserPermissions>)}
                />
              ))}
            </div>
          </SettingsCard>
        </>
      )}

      <SectionLabel label="Tax details" />
      <SettingsCard>
        <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2">
          <FormField label="VAT number" hint="Optional. Same as iOS invite setup.">
            <Input
              value={form.vatNumber}
              onChange={(e) => setForm({ ...form, vatNumber: e.target.value })}
            />
          </FormField>
          <FormField label="UTR number" hint="Optional. Same as iOS invite setup.">
            <Input
              value={form.utrNumber}
              onChange={(e) => setForm({ ...form, utrNumber: e.target.value })}
            />
          </FormField>
        </div>
      </SettingsCard>

      <SectionLabel label="Annual leave" />
      <SettingsCard>
        <div className="space-y-4 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-slate-900">Annual leave enabled</div>
              <p className="mt-0.5 text-xs text-slate-500">
                Turn off for self-employed staff who do not use paid annual leave.
              </p>
            </div>
            <Toggle
              checked={form.annualLeaveEnabled}
              onChange={(checked) => setForm({ ...form, annualLeaveEnabled: checked })}
            />
          </div>
          {form.annualLeaveEnabled && (
            <FormField
              label="Days per year"
              hint={`Organisation default is ${annualLeaveDefaults.daysPerYear} days (leave year ${annualLeaveDefaults.startMonth} → ${annualLeaveDefaults.endMonth}).`}
            >
              <Input
                type="number"
                min="0"
                value={form.annualLeaveDaysPerYear}
                onChange={(e) => setForm({ ...form, annualLeaveDaysPerYear: e.target.value })}
              />
            </FormField>
          )}
        </div>
      </SettingsCard>

      {showSetup && (
        <>
          <SectionLabel
            label={
              accountType === 'operative'
                ? 'Operative setup'
                : accountType === 'admin'
                  ? 'Administrator setup'
                  : 'Manager setup'
            }
          />
          <SettingsCard>
            <div className="space-y-4 p-4">
              <FormField label="Line manager" hint="“No line manager” is a valid choice — same as iOS.">
                <Select
                  value={form.assignedManagerUserId}
                  onChange={(e) => setForm({ ...form, assignedManagerUserId: e.target.value })}
                >
                  <option value="">No line manager</option>
                  {lineManagers.map((manager) => (
                    <option key={manager.id} value={manager.id}>
                      {manager.firstName} {manager.surname} ({manager.email})
                    </option>
                  ))}
                </Select>
              </FormField>

              <FormField label="Day rate" hint="Optional. Payroll uses either a day rate or hourly rate, not both.">
                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-slate-400">
                    £
                  </span>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    className="pl-7"
                    value={form.dayRate}
                    onChange={(e) => setForm({ ...form, dayRate: e.target.value })}
                  />
                </div>
              </FormField>

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="Trade type">
                  <Select
                    value={form.tradeTypePreset}
                    onChange={(e) => setForm({ ...form, tradeTypePreset: e.target.value })}
                  >
                    <option value="">Select trade…</option>
                    {STAFF_TRADE_TYPES.map((trade) => (
                      <option key={trade} value={trade}>
                        {trade}
                      </option>
                    ))}
                  </Select>
                </FormField>
                {form.tradeTypePreset === 'Other' && (
                  <FormField label="Custom trade">
                    <Input
                      value={form.tradeTypeCustom}
                      onChange={(e) => setForm({ ...form, tradeTypeCustom: e.target.value })}
                    />
                  </FormField>
                )}
              </div>
            </div>
          </SettingsCard>

          <SectionLabel label="Employment & timesheets" />
          <SettingsCard>
            <div className="space-y-4 p-4">
              <FormField label="Employment type">
                <Select
                  value={form.employmentType}
                  onChange={(e) =>
                    setForm({ ...form, employmentType: e.target.value as 'paye' | 'selfEmployed' })
                  }
                >
                  <option value="selfEmployed">Self-Employed</option>
                  <option value="paye">PAYE</option>
                </Select>
              </FormField>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-slate-900">Timesheets enabled</div>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Allow this person to log timesheets and use My Schedule self-booking (managers).
                  </p>
                </div>
                <Toggle
                  checked={form.timesheetsEnabled}
                  onChange={(checked) => setForm({ ...form, timesheetsEnabled: checked })}
                />
              </div>
            </div>
          </SettingsCard>
        </>
      )}

      <div className="mt-8">
        <SaveButton saving={saving} saved={saved} onClick={() => handleSubmit()} />
        <p className="mt-3 text-center text-xs text-slate-400">
          Creates invitation, user profile and organisation email mapping in Firebase — iOS compatible.
        </p>
      </div>
    </form>
  )
}

/** @deprecated Use AddUserScreen */
export const InviteUserForm = AddUserScreen
