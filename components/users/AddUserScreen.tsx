'use client'

import { FormEvent, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/stores/authStore'
import { useOrgUserStore } from '@/lib/stores/siteAuditStore'
import { useInviteStore } from '@/lib/stores/inviteStore'
import { canInviteOperatives, canManageOperativesOnly, canManageUsers, getAddUserLabel } from '@/lib/navigation/menuPermissions'
import { timesheetsEnabledForAccount } from '@/lib/orgSetup/accountPermissions'
import {
  addUserPermissionDefaults,
  permissionToggleRows,
  permissionsWriteMap,
  PAYE_RATE_NOT_USED_NOTE,
  type PermissionToggleRow as RulebookPermissionRow,
} from '@/lib/canonical/permissionLevels'
import { staffAccountRole } from '@/lib/permissions'
import {
  ANNUAL_LEAVE_ALLOWANCE_COPY,
  applyRemainingOverride,
  CANONICAL_TIME_ZONE,
  canViewSensitiveProfile,
  leaveYearBounds,
  lineManagerRequiredError,
  snapLeaveDays,
  GHOST_OPERATIVE_EXPLANATION,
  GHOST_TOGGLE_HELP,
  GHOST_TOGGLE_LABEL,
  canCreateGhost,
  ghostAddFormRows,
  ghostToggleVisible,
  type GhostAddFormField,
  DUPLICATE_NAME_CANCEL_LABEL,
  DUPLICATE_NAME_CONFIRM_LABEL,
  DUPLICATE_NAME_WARNING_MESSAGE,
  DUPLICATE_NAME_WARNING_TITLE,
  sameNamePersonContactLabel,
  type GhostDraft,
  type SameNamePerson,
} from '@/lib/canonical'
import { Modal } from '@/components/ui/overlays'
import { addUserNameCheck } from '@/lib/users/addUserNameCheck'
import { Button } from '@/components/ui/Button'
import { useUserStore } from '@/lib/stores/userStore'
import { dayKeyInZone } from '@/lib/orgTime/zoneTime'
import { DEFAULT_ANNUAL_LEAVE } from '@/lib/settings/organizationSettings'
import { STAFF_TRADE_TYPES } from '@/lib/staff/staffTradeTypes'
import {
  INVITE_DRAFT_PERSON_ID,
  inviteDraftLineManagerSubject,
  lineManagerCandidates,
  lineManagerOptions,
  lineManagerSelectionAfterLevelChange,
} from '@/lib/canonical/lineManagers'
import { rulebookRoster } from '@/lib/staff/rulebookPeople'
import {
  type PermissionToggleDef,
} from '@/lib/staff/userPermissionDescriptions'
import { loadOrganizationDetails } from '@/lib/settings/organizationSettings'
import type { UserPermissions } from '@/types'
import { LineManagerMultiSelect } from '@/components/users/LineManagerMultiSelect'
import { PayBasisFields, payChoiceToRates } from '@/components/users/PayBasisFields'
import { maySetPayOf, userPayRateRequiredError } from '@/lib/staff/payRateRequired'
import { ghostAccountsEnabledFor, onPlatformConfigChange } from '@/lib/access/securitySwitches'
import { LEAVE_DAYS_SAVE_MAX, parseBoundedNumber } from '@/lib/security/boundedValue'
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

function FormSection({ label, children }: { label?: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      {label ? <SectionLabel label={label} /> : null}
      {children}
    </section>
  )
}

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
    badgeCls: 'bg-[var(--blue-t)] text-[var(--blue)]',
    ringCls: 'ring-[#185FA5]/30 border-[var(--blue)]/40',
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
  annualLeaveSelfBook: { bg: 'bg-[var(--blue-t)]', fg: 'text-[var(--blue)]' },
  weeklyReports: { bg: 'bg-[#E1F5EE]', fg: 'text-[#0F6E56]' },
  dailyOverview: { bg: 'bg-[#E1F5EE]', fg: 'text-[#0F6E56]' },
  subContractors: { bg: 'bg-[#E1F5EE]', fg: 'text-[#0F6E56]' },
  skills: { bg: 'bg-[#FBEAF0]', fg: 'text-[#993556]' },
  qualifications: { bg: 'bg-[#FBEAF0]', fg: 'text-[#993556]' },
  projects: { bg: 'bg-[var(--blue-t)]', fg: 'text-[var(--blue)]' },
  smallWorks: { bg: 'bg-[var(--blue-t)]', fg: 'text-[var(--blue)]' },
  materials: { bg: 'bg-[#FAEEDA]', fg: 'text-[#854F0B]' },
  siteAudit: { bg: 'bg-[#E1F5EE]', fg: 'text-[#0F6E56]' },
  wholesalersOrderHistory: { bg: 'bg-[var(--blue-t)]', fg: 'text-[var(--blue)]' },
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
  // Tax ids go to the new person's private document, which only admins may write.
  const canEnterTaxIds = Boolean(
    user && canViewSensitiveProfile({ viewerRole: staffAccountRole(user), viewerUserId: user.id, subjectUserId: '' })
  )
  const { users, loadUsers, claimedEmails } = useOrgUserStore()
  const { inviteUser } = useInviteStore()
  const createGhost = useUserStore((state) => state.createGhost)
  // Rulebook 1.34.0 §11: the Ghost account toggle (`canCreateGhost`, `ghostAddFormRows`) sits at the very top. It is
  // shown only while `platformConfig/app` switches ghost accounts on for this organisation (`ghostAccountsEnabled`;
  // owner decision 7 Nov "1b": hidden until the iPhone 1.34 update is out).
  const mayCreateGhost = Boolean(user && canCreateGhost(user))
  const organizationId = organization?.id ?? null
  const [ghostSwitchOn, setGhostSwitchOn] = useState(() => ghostAccountsEnabledFor(organizationId))
  useEffect(() => {
    setGhostSwitchOn(ghostAccountsEnabledFor(organizationId))
    return onPlatformConfigChange(() => setGhostSwitchOn(ghostAccountsEnabledFor(organizationId)))
  }, [organizationId])
  const ghostToggleShown = ghostToggleVisible({ canCreateGhost: mayCreateGhost, ghostAccountsEnabled: ghostSwitchOn })
  const [ghost, setGhost] = useState(false)
  const ghostOn = ghost && ghostToggleShown
  const formRows = useMemo(
    () => ghostAddFormRows({ ghost: ghostOn, canCreateGhost: mayCreateGhost, ghostAccountsEnabled: ghostSwitchOn }),
    [ghostOn, mayCreateGhost, ghostSwitchOn]
  )
  const shows = (field: GhostAddFormField) => formRows.find((row) => row.field === field)?.visible !== false

  const canInviteAdmins = canManageUsers(user)
  const operativeInviteOnly = canManageOperativesOnly(user)
  const canAccess = canInviteOperatives(user)
  const pageTitle = operativeInviteOnly ? 'Add operative' : getAddUserLabel(user)
  function toggleGhost(next: boolean) {
    setGhost(next)
    setError(null)
    // A ghost is always an operative (rulebook 1.34.0).
    if (next) selectAccountType('operative')
  }
  const backHref = operativeInviteOnly ? '/dashboard/operatives' : '/dashboard/settings/users'

  const [accountType, setAccountType] = useState<AccountType>(
    canInviteAdmins ? 'manager' : 'operative'
  )
  const [permissions, setPermissions] = useState<UserPermissions>(() => addUserPermissionDefaults('manager') as UserPermissions)
  const [form, setForm] = useState({
    firstName: '',
    surname: '',
    email: '',
    mobileNumber: '',
    assignedManagerUserIds: [] as string[],
    payBasis: 'day' as 'day' | 'hourly',
    rateAmount: '',
    tradeTypePreset: 'Electrician',
    hasNoLineManager: false,
    tradeTypeCustom: '',
    employmentType: 'self_employed' as 'paye' | 'self_employed',
    timesheetsEnabled: true,
    vatNumber: '',
    utrNumber: '',
    annualLeaveEnabled: true,
    annualLeaveDaysPerYear: String(DEFAULT_ANNUAL_LEAVE.daysPerYear),
    remainingDays: String(DEFAULT_ANNUAL_LEAVE.daysPerYear),
    remainingTouched: false,
  })
  const [annualLeaveDefaults, setAnnualLeaveDefaults] = useState(DEFAULT_ANNUAL_LEAVE)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rateError, setRateError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  // Rulebook 1.36.0 §11 (owner decision 10 Nov): people with the same first and last name (`usersWithSameName`).
  // A warning only — Add anyway saves as before, Cancel returns to the form.
  const [duplicateMatches, setDuplicateMatches] = useState<SameNamePerson[] | null>(null)

  useEffect(() => {
    if (organization?.id) loadUsers(organization.id)
  }, [organization?.id, loadUsers])

  // `?ghost=1` (the old "Create New Operative" link) opens with the Ghost account toggle on.
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (new URLSearchParams(window.location.search).get('ghost') === '1') setGhost(true)
  }, [])
  useEffect(() => {
    if (ghostOn && accountType !== 'operative') selectAccountType('operative')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ghostOn])

  useEffect(() => {
    if (!organization?.id) return
    loadOrganizationDetails(organization.id)
      .then((details) => {
        const defaults = details?.annualLeaveDefaults ?? DEFAULT_ANNUAL_LEAVE
        setAnnualLeaveDefaults(defaults)
        setForm((prev) => ({
          ...prev,
          annualLeaveDaysPerYear: String(defaults.daysPerYear),
          remainingDays: prev.remainingTouched ? prev.remainingDays : String(defaults.daysPerYear),
        }))
      })
      .catch(() => {})
  }, [organization?.id])

  // Rulebook 1.27.0 §11 `inviteDraftLineManagerSubject`: the invite as it will be saved (typed email, chosen level) is
  // the `person` — as iOS AddUserView passes its invite draft — so the invitee's own email row is never offered as
  // their own line manager.
  const invitePerson = useMemo(
    () => inviteDraftLineManagerSubject({ email: form.email, level: operativeInviteOnly ? 'operative' : accountType }),
    [form.email, operativeInviteOnly, accountType]
  )

  // Rulebook §11 `lineManagerCandidates(person, roster)`: the picker list (iOS AddUserView the same).
  const lineManagers = useMemo(() => {
    const byId = new Map(users.map((row) => [row.id, row]))
    return lineManagerCandidates(invitePerson, users as never)
      .map((candidate) => byId.get(candidate.id))
      .filter((row): row is (typeof users)[number] => Boolean(row))
  }, [users, invitePerson])

  const availableAccountTypes = useMemo(() => {
    if (canInviteAdmins) return ACCOUNT_TYPES
    return ACCOUNT_TYPES.filter((type) => type.id === 'operative')
  }, [canInviteAdmins])

  // Rulebook 1.11.0 `permissionToggleRows`: the same rows, values and locks as iOS Add User, its summary and Edit User.
  const permissionLevel: AccountType = operativeInviteOnly ? 'operative' : accountType
  const permissionRows = useMemo(
    // 1.28.0: `employmentType` greys out a PAYE admin's Timesheet self-sign row (`TIMESHEET_SELF_SIGN_PAYE_NOTE`).
    () =>
      permissionToggleRows({ level: permissionLevel, user: { permissions, employmentType: form.employmentType }, mode: 'add' }).filter(
        (row) => row.visible
      ),
    [permissionLevel, permissions, form.employmentType]
  )
  const summaryRows = useMemo(
    () =>
      permissionToggleRows({ level: permissionLevel, user: { permissions, employmentType: form.employmentType }, mode: 'summary' }).filter(
        (row) => row.visible
      ),
    [permissionLevel, permissions, form.employmentType]
  )

  const showSetup = true

  function selectAccountType(next: AccountType) {
    if (next !== accountType) {
      // Rulebook 1.24.0 `lineManagerSelectionAfterLevelChange`: keep the picks that are still candidates, drop the rest;
      // "No line manager" stays only for an admin.
      setForm((prev) => {
        const kept = lineManagerSelectionAfterLevelChange(
          { lineManagerIds: prev.assignedManagerUserIds, hasNoLineManager: prev.hasNoLineManager },
          next,
          users as never,
          // 1.27.0: the invite draft as `person`, as `lineManagerCandidates` gets it (iOS the same).
          inviteDraftLineManagerSubject({ email: prev.email, level: next })
        )
        return { ...prev, assignedManagerUserIds: kept.lineManagerIds, hasNoLineManager: kept.hasNoLineManager }
      })
    }
    setAccountType(next)
    setPermissions(addUserPermissionDefaults(next) as UserPermissions)
  }

  function updatePermission(row: RulebookPermissionRow, checked: boolean) {
    if (!row.editable) return
    setPermissions((prev) => ({ ...prev, [row.field]: checked }))
  }

  // What the invitation and placeholder store (`permissionsWriteMap`): the effective values for the level.
  const invitePermissions = useMemo(
    () => permissionsWriteMap({ permissions }, permissionLevel) as UserPermissions,
    [permissionLevel, permissions]
  )

  // Rulebook 1.11.0 `lineManagerOptions`: "No line manager" only when `lineManagerRequired` is false (admins).
  const mayHaveNoLineManager = lineManagerOptions({
    isActive: true,
    role: permissionLevel,
    adminAccess: invitePermissions.adminAccess === true,
    operativeMode: invitePermissions.operativeMode === true,
  }).allowsNoLineManager

  // Rulebook 1.36.0 `usersWithSameName` (and, for a ghost, `ghostCreateError` first) through `addUserNameCheck`: true
  // when the save must stop — a refusal, or the duplicate-name confirmation. Add anyway submits again with
  // `nameConfirmed`, which goes straight through.
  const stopBeforeSave = (
    firstName: string,
    surname: string,
    nameConfirmed: boolean,
    ghostDraft?: GhostDraft
  ): boolean => {
    const check = addUserNameCheck({
      firstName,
      surname,
      roster: users as never,
      claimedEmails,
      nameConfirmed,
      ghost: ghostDraft ? { draft: ghostDraft, lineManagerRoster: rulebookRoster(users) } : null,
    })
    if (check.kind === 'refuse') {
      setError(check.message)
      return true
    }
    if (check.kind === 'warn') {
      setDuplicateMatches(check.matches)
      return true
    }
    return false
  }

  const handleSubmit = async (e?: FormEvent, options?: { nameConfirmed?: boolean }) => {
    e?.preventDefault()
    if (!organization?.id || !user) return
    const nameConfirmed = options?.nameConfirmed === true

    const firstName = form.firstName.trim()
    const surname = form.surname.trim()
    const email = form.email.trim()

    if (ghostOn) {
      // Rulebook 1.34.0 `ghostCreateWrites` / `ghostCreateError`: names, rate above 0, line manager; trade optional.
      const ghostDraft: GhostDraft = {
            firstName,
            surname,
            ...payChoiceToRates(form.payBasis, form.rateAmount),
            lineManagerIds: form.assignedManagerUserIds,
            tradeTypePreset: form.tradeTypePreset || null,
            tradeTypeCustom: form.tradeTypePreset === 'Other' ? form.tradeTypeCustom.trim() || null : null,
            annualLeave: {
              enabled: form.annualLeaveEnabled,
              daysPerYear: form.annualLeaveEnabled
                ? parseBoundedNumber(form.annualLeaveDaysPerYear, { min: 0, max: LEAVE_DAYS_SAVE_MAX }) ??
                  annualLeaveDefaults.daysPerYear
                : null,
              startMonth: annualLeaveDefaults.startMonth,
              endMonth: annualLeaveDefaults.endMonth,
              carriesOver: annualLeaveDefaults.carriesOver,
            },
      }
      // The ghost's own refusal first (the store checks it again), then the duplicate-name warning.
      if (stopBeforeSave(firstName, surname, nameConfirmed, ghostDraft)) return
      setSaving(true)
      setError(null)
      try {
        await createGhost({
          organizationId: organization.id,
          actor: user,
          roster: users,
          draft: ghostDraft,
        })
        setSuccess(`${firstName} ${surname} was added. They have no app login and can be booked straight away.`)
        setSaved(true)
        window.setTimeout(() => router.push(backHref), 1800)
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to add this person')
      } finally {
        setSaving(false)
      }
      return
    }

    if (!firstName || !surname) {
      setError('First name and surname are required.')
      return
    }
    if (!email.includes('@') || !email.includes('.')) {
      setError('Enter a valid email address.')
      return
    }
    if ((accountType === 'operative' || accountType === 'manager' || accountType === 'admin') && !form.tradeTypePreset.trim()) {
      setError('Trade is required.')
      return
    }
    if (mayHaveNoLineManager && !form.hasNoLineManager && form.assignedManagerUserIds.length === 0) {
      setError('Choose a line manager, or No line manager.')
      return
    }
    // `lineManagerRequiredError(user, roster)`: every operative and manager needs an active line manager, whatever
    // the self-book permission. 1.28.0: an admin may have none only with both self-manage toggles on (Annual Leave
    // Management, and Timesheet self-sign unless PAYE).
    const lineManagerMessage = lineManagerRequiredError(
      {
        // 1.27.0: the invite draft id (`INVITE_DRAFT_PERSON_ID`, iOS the same), so `personIdSet` reaches the rows on
        // this email and a pick of the invitee themself never counts as their line manager (an empty id reached none).
        id: INVITE_DRAFT_PERSON_ID,
        email,
        isActive: true,
        role: accountType,
        adminAccess: invitePermissions.adminAccess === true,
        operativeMode: invitePermissions.operativeMode === true,
        annualLeaveSelfBook: invitePermissions.annualLeaveSelfBook === true,
        timesheetSelfSign: invitePermissions.timesheetSelfSign === true,
        employmentType: form.employmentType,
        assignedManagerUserIds: form.hasNoLineManager ? [] : form.assignedManagerUserIds,
        hasNoLineManager: mayHaveNoLineManager && form.hasNoLineManager,
        annualLeaveEnabled: form.annualLeaveEnabled,
      },
      rulebookRoster(users)
    )
    if (lineManagerMessage) {
      setError(lineManagerMessage)
      return
    }
    // Rulebook 1.14.0 `payRateRequiredError`: a self-employed person must have a day or hourly rate above 0. Checked
    // only when the adder may set this person's pay (`canChangePersonPay`).
    const isOperativeInvite = operativeInviteOnly || accountType === 'operative'
    const payMessage = maySetPayOf(user, { id: '', isOperative: isOperativeInvite })
      ? userPayRateRequiredError({ employmentType: form.employmentType, ...payChoiceToRates(form.payBasis, form.rateAmount) })
      : null
    setRateError(payMessage)
    if (payMessage) {
      setError(payMessage)
      return
    }
    if (stopBeforeSave(firstName, surname, nameConfirmed)) return

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
        role: permissionLevel,
        assignedManagerUserId: form.hasNoLineManager ? undefined : form.assignedManagerUserIds[0],
        assignedManagerUserIds:
          form.hasNoLineManager || form.assignedManagerUserIds.length === 0 ? undefined : form.assignedManagerUserIds,
        ...payChoiceToRates(form.payBasis, form.rateAmount),
        tradeTypePreset: form.tradeTypePreset || undefined,
        tradeTypeCustom: form.tradeTypePreset === 'Other' ? form.tradeTypeCustom.trim() || undefined : undefined,
        employmentType: form.employmentType,
        timesheetsEnabled: timesheetsEnabledForAccount(accountType, form.employmentType),
        vatNumber: canEnterTaxIds ? form.vatNumber.trim() || undefined : undefined,
        utrNumber: canEnterTaxIds ? form.utrNumber.trim() || undefined : undefined,
        annualLeaveEnabled: form.annualLeaveEnabled,
        annualLeaveDaysPerYear: form.annualLeaveEnabled
          ? parseBoundedNumber(form.annualLeaveDaysPerYear, { min: 0, max: LEAVE_DAYS_SAVE_MAX }) ??
            annualLeaveDefaults.daysPerYear
          : undefined,
        annualLeaveYearStartMonth: form.annualLeaveEnabled ? annualLeaveDefaults.startMonth : undefined,
        annualLeaveYearEndMonth: form.annualLeaveEnabled ? annualLeaveDefaults.endMonth : undefined,
        annualLeaveCarriesOver: form.annualLeaveEnabled ? annualLeaveDefaults.carriesOver : undefined,
        ...(form.annualLeaveEnabled && form.remainingTouched
          ? applyRemainingOverride({
              remaining: snapLeaveDays(
                parseBoundedNumber(form.remainingDays, { min: 0, max: LEAVE_DAYS_SAVE_MAX }) ?? 0
              ),
              taken: 0,
              pending: 0,
              yearKey: leaveYearBounds({
                startMonth: annualLeaveDefaults.startMonth,
                endMonth: annualLeaveDefaults.endMonth,
                onDayKey: dayKeyInZone(new Date(), CANONICAL_TIME_ZONE),
              }).yearKey,
            })
          : {}),
        hasNoLineManager: mayHaveNoLineManager && form.hasNoLineManager,
      })

      if (result.inviteType === 'existing_user_org_add') {
        try {
          const { jsonAuthHeaders } = await import('@/lib/security/clientAuthHeaders')
          await fetch('/api/invites/send-org-addition-email', {
            method: 'POST',
            headers: await jsonAuthHeaders(),
            body: JSON.stringify({
              organizationId: organization.id,
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
            organizationId: organization.id,
            invitationId: result.invitationId,
            organizationName: organization.name,
            firstName,
            role: operativeInviteOnly || accountType === 'operative' ? 'operative' : accountType === 'admin' ? 'admin' : 'manager',
            to: email,
          })
          setSuccess(`Invitation sent to ${email}. They will receive an email to set their password.`)
        } catch (emailError) {
          setSuccess(
            `User invited but email could not be sent (${emailError instanceof Error ? emailError.message : 'unknown error'}).`
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
      <div className="mx-auto max-w-2xl empty card pad px-6 py-16 text-center">
        <p className="text-slate-600">You do not have permission to invite users.</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-2xl space-y-8 pb-16">
      <div className="space-y-3">
        <PanelHeader title={pageTitle} onBack={() => router.push(backHref)} />

        <p className="text-sm text-slate-500">
          {ghostOn
            ? 'Add someone who works for you but does not use the app. They get no email and no login.'
            : operativeInviteOnly
            ? 'Invite a new operative to your organisation. They will receive an email to set up their account.'
            : "Invite someone to your organisation. They'll receive an email to set up their account — same flow as the iOS app."}
        </p>

        {error && <ErrorBanner message={error} />}
        {success && <SuccessBanner message={success} />}
      </div>

      {shows('ghostToggle') && (
        <FormSection>
          <SettingsCard>
            <div className="space-y-2 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-slate-900">{GHOST_TOGGLE_LABEL}</div>
                  <p className="mt-0.5 text-xs text-slate-500">{GHOST_TOGGLE_HELP}</p>
                </div>
                <Toggle checked={ghostOn} onChange={toggleGhost} />
              </div>
              <details className="text-xs text-slate-600">
                <summary className="cursor-pointer select-none font-medium text-slate-700">What is a ghost account?</summary>
                <p className="mt-1 leading-relaxed">{GHOST_OPERATIVE_EXPLANATION}</p>
              </details>
            </div>
          </SettingsCard>
        </FormSection>
      )}

      {!operativeInviteOnly && shows('accountType') && (
        <FormSection label="Account type">
          <div className="space-y-2">
            {availableAccountTypes.map((type) => {
              const selected = accountType === type.id
              return (
                <button
                  key={type.id}
                  type="button"
                  onClick={() => selectAccountType(type.id)}
                  data-hue={type.id === 'admin' ? 'user' : type.id === 'operative' ? 'ops' : 'blue'}
                  className={`optcard ${selected ? 'on' : ''}`}
                >
                  <span className="ico-chip">{type.badge.slice(0, 1)}</span>
                  <span className="grow">
                    <span className="t">{type.title}</span>
                    <span className="s" style={{ whiteSpace: 'normal' }}>{type.description}</span>
                  </span>
                </button>
              )
            })}
          </div>
        </FormSection>
      )}

      {operativeInviteOnly && !ghostOn && (
        <FormSection>
          <SettingsCard>
            <div className="p-4 text-sm text-slate-600">
              You are inviting an <strong className="font-semibold text-slate-800">operative</strong>. New operatives
              appear in your Operatives roster once they accept the invitation.
            </div>
          </SettingsCard>
        </FormSection>
      )}

      <FormSection label="Identity">
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
          {shows('email') ? (
          <FormField label="Email" hint="Invitation is sent here">
            <Input
              type="email"
              value={form.email}
              required
              autoComplete="email"
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </FormField>
          ) : null}
          {shows('mobileNumber') ? (
          <FormField label="Mobile number" hint="Optional">
            <Input
              type="tel"
              value={form.mobileNumber}
              autoComplete="tel"
              onChange={(e) => setForm({ ...form, mobileNumber: e.target.value })}
            />
          </FormField>
          ) : null}
        </div>
      </SettingsCard>
      </FormSection>

      {permissionRows.length > 0 && shows('permissions') && (
        <FormSection
          label={
            permissionLevel === 'admin'
              ? 'Administrator permissions'
              : `${permissionLevel === 'operative' ? 'Operative' : 'Manager'} permissions`
          }
        >
          <SettingsCard>
            <div className="border-b border-slate-100 px-4 py-3 text-sm text-slate-600">
              {permissionLevel === 'admin'
                ? 'Administrators have every permission. Only Annual Leave Management and Timesheet self-sign can be changed. With no line manager, both must be on (PAYE: Annual Leave Management).'
                : permissionLevel === 'manager'
                  ? 'Materials and Site audit are always on for managers. Anything left off can be turned on later in Manage Users.'
                  : 'Choose what this operative can open. Anything left off can be turned on later in Manage Users.'}
            </div>
            <div className="divide-y divide-slate-100">
              {permissionRows.map((row) => (
                <PermToggleRow
                  key={row.field}
                  def={{ key: row.field, title: row.label, description: row.help }}
                  checked={row.value}
                  onChange={(checked) => updatePermission(row, checked)}
                  disabled={!row.editable}
                />
              ))}
            </div>
          </SettingsCard>
        </FormSection>
      )}

      {shows('permissions') ? (
      <FormSection label="Permissions summary">
        <SettingsCard>
          <div className="grid grid-cols-1 gap-4 p-4 text-sm sm:grid-cols-2">
            <div>
              <div className="mb-2 font-semibold text-slate-900">Can access</div>
              <ul className="space-y-1 text-slate-700">
                {summaryRows.filter((row) => row.value).map((row) => (
                  <li key={row.field}>{row.label}</li>
                ))}
              </ul>
            </div>
            <div>
              <div className="mb-2 font-semibold text-slate-900">Can&apos;t access</div>
              <ul className="space-y-1 text-slate-500">
                {summaryRows.filter((row) => !row.value).map((row) => (
                  <li key={row.field}>{row.label}</li>
                ))}
              </ul>
            </div>
          </div>
          {form.employmentType === 'paye' && form.rateAmount.trim() ? (
            <p className="border-t border-slate-100 px-4 py-3 text-xs text-slate-500">Rate: {PAYE_RATE_NOT_USED_NOTE}</p>
          ) : null}
        </SettingsCard>
      </FormSection>
      ) : null}

      {canEnterTaxIds && shows('taxIds') ? (
      <FormSection label="Tax details">
        <SettingsCard>
        <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2">
          <FormField label="VAT number" hint="Optional. Only admins and this person can see it.">
            <Input
              autoComplete="off"
              value={form.vatNumber}
              onChange={(e) => setForm({ ...form, vatNumber: e.target.value })}
            />
          </FormField>
          <FormField label="UTR number" hint="Optional. Only admins and this person can see it.">
            <Input
              autoComplete="off"
              value={form.utrNumber}
              onChange={(e) => setForm({ ...form, utrNumber: e.target.value })}
            />
          </FormField>
        </div>
      </SettingsCard>
      </FormSection>
      ) : null}

      {shows('annualLeave') ? (
      <FormSection label="Annual leave">
        <SettingsCard>
        <div className="space-y-4 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-slate-900">{ANNUAL_LEAVE_ALLOWANCE_COPY.toggleTitle}</div>
              <p className="mt-0.5 text-xs text-slate-500">
                {ANNUAL_LEAVE_ALLOWANCE_COPY.toggleDescription}
              </p>
            </div>
            <Toggle
              checked={form.annualLeaveEnabled}
              onChange={(checked) => setForm({ ...form, annualLeaveEnabled: checked })}
            />
          </div>
          <p className="text-xs text-slate-400">{ANNUAL_LEAVE_ALLOWANCE_COPY.toggleNote}</p>
          {form.annualLeaveEnabled && (
            <>
              <FormField
                label="Days per year"
                hint={`Organisation default is ${annualLeaveDefaults.daysPerYear} days (leave year ${annualLeaveDefaults.startMonth} → ${annualLeaveDefaults.endMonth}).`}
              >
                <Input
                  type="number"
                  min="0"
                  step="0.5"
                  value={form.annualLeaveDaysPerYear}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      annualLeaveDaysPerYear: e.target.value,
                      remainingDays: form.remainingTouched ? form.remainingDays : e.target.value,
                    })
                  }
                />
              </FormField>
              <FormField
                label={ANNUAL_LEAVE_ALLOWANCE_COPY.remainingTitle}
                hint={ANNUAL_LEAVE_ALLOWANCE_COPY.remainingNote}
              >
                <Input
                  type="number"
                  min="0"
                  step="0.5"
                  value={form.remainingDays}
                  onChange={(e) =>
                    setForm({ ...form, remainingDays: e.target.value, remainingTouched: true })
                  }
                />
              </FormField>
            </>
          )}
        </div>
      </SettingsCard>
      </FormSection>
      ) : null}

      {showSetup && (
        <>
          <FormSection
            label={
              accountType === 'operative'
                ? 'Operative setup'
                : accountType === 'admin'
                  ? 'Administrator setup'
                  : 'Manager setup'
            }
          >
            <SettingsCard>
              <div className="space-y-4 p-4">
                <FormField
                  label="Line managers"
                  hint={mayHaveNoLineManager ? 'Required unless No line manager is set.' : 'Required for operatives and managers.'}
                >
                  <LineManagerMultiSelect
                    managers={lineManagers}
                    selectedIds={form.hasNoLineManager ? [] : form.assignedManagerUserIds}
                    onChange={(assignedManagerUserIds) =>
                      setForm({ ...form, assignedManagerUserIds, hasNoLineManager: false })
                    }
                  />
                </FormField>
                {mayHaveNoLineManager && !ghostOn ? (
                  <label className="flex items-center gap-2 text-sm text-slate-800">
                    <input
                      type="checkbox"
                      checked={form.hasNoLineManager}
                      onChange={(event) => {
                        const hasNoLineManager = event.target.checked
                        // 1.28.0: the self-manage toggles are kept — with no line manager both must be on
                        // (`lineManagerRequiredError`).
                        setForm({
                          ...form,
                          hasNoLineManager,
                          assignedManagerUserIds: hasNoLineManager ? [] : form.assignedManagerUserIds,
                        })
                      }}
                    />
                    No line manager
                  </label>
                ) : null}

              <div className="grid gap-4 sm:grid-cols-2">
                <PayBasisFields
                  payBasis={form.payBasis}
                  amount={form.rateAmount}
                  error={rateError}
                  onChange={(next) => {
                    setRateError(null)
                    setForm({ ...form, payBasis: next.payBasis, rateAmount: next.amount })
                  }}
                />
              </div>

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
          </FormSection>

          {shows('employmentType') ? (
          <FormSection label="Employment & timesheets">
            <SettingsCard>
              <div className="space-y-4 p-4">
              <FormField label="Employment type">
                <Select
                  value={form.employmentType}
                  onChange={(e) =>
                    {
                      setRateError(null)
                      setForm({ ...form, employmentType: e.target.value as 'paye' | 'self_employed' })
                    }
                  }
                >
                  <option value="self_employed">Self-Employed</option>
                  <option value="paye">PAYE</option>
                </Select>
              </FormField>
              <p className="text-xs text-slate-500">
                Timesheets are on for operatives and for self-employed managers and administrators. PAYE managers and administrators do not get timesheets.
              </p>
              </div>
            </SettingsCard>
          </FormSection>
          ) : null}
        </>
      )}

      <Modal
        open={duplicateMatches !== null}
        title={DUPLICATE_NAME_WARNING_TITLE}
        hue="user"
        onClose={() => setDuplicateMatches(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDuplicateMatches(null)}>
              {DUPLICATE_NAME_CANCEL_LABEL}
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                setDuplicateMatches(null)
                void handleSubmit(undefined, { nameConfirmed: true })
              }}
            >
              {DUPLICATE_NAME_CONFIRM_LABEL}
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-700">{DUPLICATE_NAME_WARNING_MESSAGE}</p>
        <ul className="mt-3 space-y-2 pb-2">
          {(duplicateMatches ?? []).map((person) => (
            <li key={person.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--line)] px-3 py-2 text-sm">
              <span className="font-semibold text-slate-900">{person.displayName}</span>
              {person.email ? (
                <span className="text-slate-500">{person.email}</span>
              ) : (
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                  {sameNamePersonContactLabel(person)}
                </span>
              )}
              {person.segment !== 'active' ? (
                <span className="text-xs text-slate-500">{person.segment === 'inactive' ? 'Inactive' : 'Pending'}</span>
              ) : null}
            </li>
          ))}
        </ul>
      </Modal>

      <div className="space-y-3 pt-2">
        {/* Repeat the refusal next to the button, so the reason is visible where the person pressed Save. */}
        {error && <ErrorBanner message={error} />}
        <SaveButton saving={saving} saved={saved} onClick={() => handleSubmit()} />
        <p className="mt-3 text-center text-xs text-slate-400">
          {ghostOn
            ? 'Creates a ghost operative (no login, no invitation) — iOS compatible.'
            : 'Creates invitation, user profile and organisation email mapping in Firebase — iOS compatible.'}
        </p>
      </div>
    </form>
  )
}

/** @deprecated Use AddUserScreen */
export const InviteUserForm = AddUserScreen
