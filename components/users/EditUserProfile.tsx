'use client'

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { reseedUntouchedPayFields, watchPayEditorPrivatePay, withPayFieldsFrom } from '@/lib/pay/payEditorSwitchReload'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { useAuthStore } from '@/lib/stores/authStore'
import { useOperativeStore } from '@/lib/stores/operativeStore'
import { useOrgUserStore } from '@/lib/stores/siteAuditStore'
import { useUserStore } from '@/lib/stores/userStore'
import { useInviteStore } from '@/lib/stores/inviteStore'
import { findOperativeForUser, operativeRecordForUser } from '@/lib/operatives/operativeRosterUtils'
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
import { userLineManagerRequiredError, userMayHaveNoLineManager } from '@/lib/annualLeave/holidayApprovalUtils'
import { userTimesheetSelfSigned } from '@/lib/timesheets/timesheetApprovalPolicy'
import { UserAvatar } from '@/components/users/UserAvatar'
import { PayBasisFields, payChoiceFromProfile, payChoiceToRates } from '@/components/users/PayBasisFields'
import { maySetPayOf, userPayRateRequiredError } from '@/lib/staff/payRateRequired'
import { PreviousRatesList, usePaySaveGate } from '@/components/users/PayRateChangeDialogs'
import {
  emptyDayRateHistory,
  loadOperativeDayRateHistory,
  mergedDayRateEntries,
  watchOperativeDayRateHistory,
  type OperativeDayRateHistoryCollection,
} from '@/lib/timesheets/dayRateHistoryStorage'
import {
  accountKindFromFlags,
  applyEmploymentTypeChange,
  employmentEffectiveLabel,
  normalizeEmploymentType,
} from '@/lib/canonical/userProfile'
import {
  ANNUAL_LEAVE_ALLOWANCE_COPY,
  SENSITIVE_HELD_BY_ADMIN_COPY,
  canViewSensitiveProfile,
  maskSensitiveValue,
  leaveYearEndMonth,
  leaveYearStartMonth,
  snapLeaveDays,
  type SensitiveProfile,
  validateLeaveYearMonths,
} from '@/lib/canonical'
import { loadTaxIds, saveTaxIds } from '@/lib/sensitiveProfile/taxIdsService'
import { LEAVE_DAYS_SAVE_MAX, parseBoundedNumber } from '@/lib/security/boundedValue'
import { useHolidayStore } from '@/lib/stores/holidayStore'
import {
  bookingsForPerson,
  remainingOverrideFromBalance,
  userLeaveBalance,
} from '@/lib/annualLeave/leaveBalance'
import {
  DEFAULT_ANNUAL_LEAVE,
  loadOrganizationDetails,
  type OrgAnnualLeaveDefaults,
} from '@/lib/settings/organizationSettings'
import { useEmploymentTypeSaveGate } from '@/components/users/EmploymentTypeChangeDialog'
import type { Qualification, User, UserPermissions } from '@/types'
import { OperativeQualificationsEditor } from '@/components/qualifications/OperativeQualificationsEditor'
import {
  mergeQualificationTemplates,
  assignedQualificationTemplates,
} from '@/lib/qualifications/orgQualificationStorage'
import { loadOrganisationQualificationsEnsuringStarter } from '@/lib/qualifications/starterLibrary'
import { canonicalCertificateUrls, formatCertificateSaveError } from '@/lib/qualifications/certificateUpload'
import { canManageOrganisationQualifications, staffAccountRole } from '@/lib/permissions'
import { canDeleteUser, lineManagerCandidates, lineManagerSelectedIds, SELF_EMAIL_INVALID_MESSAGE, selfEmailChangeAction, selfEmailChangeSentMessage } from '@/lib/canonical'
import { PermissionRowsList } from '@/components/users/ProfileExpandablePermissionToggle'
import { useOrganizationDocument } from '@/lib/stores/organizationDocumentStore'
import { accountTypeSubject } from '@/lib/staff/accountTypeChange'
import {
  ACCOUNT_TYPE_OUT_OF_SYNC_MESSAGE,
  ADMIN_LOCKED_PERMISSION_MESSAGE,
  accountTypeSyncState,
  permissionToggleRows,
  type PermissionLevel,
} from '@/lib/canonical/permissionLevels'
import {
  ADMIN_ACCESS_LOCKED_MESSAGE,
} from '@/lib/staff/userPermissionDescriptions'
import { SUPER_ADMIN_SUCCESSOR_EMPTY, superAdminSuccessors } from '@/lib/staff/superAdminTransfer'
import { displayedLineManagerId, userWithLineManagerChoice } from '@/lib/firebase/userPayload'
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

/**
 * Rulebook 1.11.0 `permissionToggleRows` for Edit User: the person at `level` with `permissions` (a pending account
 * type change included). A self-approved admin's self-book row shows on and locked (`canSelfBookAnnualLeave`).
 */
function editUserPermissionRows(
  user: User,
  level: PermissionLevel,
  permissions: UserPermissions,
  users: ReadonlyArray<User>
) {
  const selfSigned = userTimesheetSelfSigned(user, users)
  return permissionToggleRows({ level, user: { ...user, permissions }, mode: 'edit' }).map((row) =>
    row.field === 'annualLeaveSelfBook' && selfSigned ? { ...row, value: true, editable: false } : row
  )
}

function lockedPermissionMessage(level: PermissionLevel): string {
  return level === 'admin' ? ADMIN_LOCKED_PERMISSION_MESSAGE : 'Always on for managers.'
}

function currentAccountType(user: User): 'operative' | 'manager' | 'admin' {
  return accountKindFromFlags({
    isSuperAdmin: user.isSuperAdmin,
    role: user.role,
    adminAccess: user.permissions.adminAccess,
    manager: user.permissions.manager,
    operativeMode: user.permissions.operativeMode,
  })
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
    employmentTypeTransitionFrom: user.employmentTypeTransitionFrom || '',
    employmentTypeEffectiveAt: user.employmentTypeEffectiveAt?.toISOString?.() || '',
    assignedManagerUserId: user.assignedManagerUserId || '',
    assignedManagerUserIds: user.assignedManagerUserIds ?? [],
    hasNoLineManager: user.hasNoLineManager === true,
    dayRate: user.dayRate ?? null,
    hourlyRate: user.hourlyRate ?? null,
    payBasis: user.payBasis ?? null,
    tradeTypePreset: user.tradeTypePreset || '',
    tradeTypeCustom: user.tradeTypeCustom || '',
    annualLeaveEnabled: user.annualLeaveEnabled !== false,
    annualLeaveDaysPerYear: user.annualLeaveDaysPerYear ?? null,
    annualLeaveYearStartMonth: user.annualLeaveYearStartMonth ?? null,
    annualLeaveYearEndMonth: user.annualLeaveYearEndMonth ?? null,
    annualLeaveCarriesOver: user.annualLeaveCarriesOver === true,
    annualLeaveYearAllowance: user.annualLeaveYearAllowance ?? null,
    annualLeaveYearAllowanceKey: user.annualLeaveYearAllowanceKey || '',
    timesheetsEnabled: user.timesheetsEnabled === true,
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
  const { user: currentUser, organization, reloadSignedInProfile } = useAuthStore()
  const { users, loadUsers, setListedUserActive, patchListedUser } = useOrgUserStore()
  const { operatives, loadOperatives, patchOperativeQualifications } = useOperativeStore()
  const { getUser, saveUser, setUserActive, deleteUser, sendPasswordReset, applyAccountType, changeAccountType, syncLinkedOperative, transferSuperAdmin } =
    useUserStore()
  const { inviteUser } = useInviteStore()
  const { bookings: holidayBookings, loadBookings: loadHolidays } = useHolidayStore()

  const [target, setTarget] = useState<User | null>(null)
  // The copy last loaded or saved. Saves write only what changed against it.
  const savedUser = useRef<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [typeSaving, setTypeSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lineManagerError, setLineManagerError] = useState<string | null>(null)
  const [rateError, setRateError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [showChangeType, setShowChangeType] = useState(false)
  const [draftAccountType, setDraftAccountType] = useState<'operative' | 'manager' | 'admin' | null>(null)
  const [draftTypePermissions, setDraftTypePermissions] = useState<UserPermissions | null>(null)
  const [busyAction, setBusyAction] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [confirmAdmin, setConfirmAdmin] = useState(false)
  const [showTransfer, setShowTransfer] = useState(false)
  const [transferring, setTransferring] = useState(false)
  const [lockedNotice, setLockedNotice] = useState<string | null>(null)
  const [baseline, setBaseline] = useState<string | null>(null)
  // Tax ids live at users/{uid}/private/taxIds. Draft null = unchanged, '' = remove.
  const [taxIds, setTaxIds] = useState<SensitiveProfile | null>(null)
  const [taxDraft, setTaxDraft] = useState<{ utrNumber: string | null; vatNumber: string | null }>({
    utrNumber: null,
    vatNumber: null,
  })
  const [showTaxIds, setShowTaxIds] = useState(false)
  const [originalDayRate, setOriginalDayRate] = useState<number | undefined>(undefined)
  const [originalPayBasis, setOriginalPayBasis] = useState<'day' | 'hourly' | undefined>(undefined)
  const [originalEmploymentType, setOriginalEmploymentType] = useState<string | undefined>(undefined)
  const [fixEmail, setFixEmail] = useState('')
  const [fixNote, setFixNote] = useState('')
  const [fixOpen, setFixOpen] = useState(false)
  const [activeSaving, setActiveSaving] = useState(false)
  const [rateHistory, setRateHistory] = useState<OperativeDayRateHistoryCollection>(emptyDayRateHistory())
  const [orgLeaveDefaults, setOrgLeaveDefaults] = useState<OrgAnnualLeaveDefaults>(DEFAULT_ANNUAL_LEAVE)
  const [remainingDraft, setRemainingDraft] = useState('')
  const [remainingTouched, setRemainingTouched] = useState(false)
  const [qualificationTemplates, setQualificationTemplates] = useState<Qualification[]>([])
  const [qualSaving, setQualSaving] = useState(false)
  const [qualError, setQualError] = useState<string | null>(null)
  const { request: requestPaySave, ui: payDialogs } = usePaySaveGate()
  const { request: requestEmploymentSave, ui: employmentDialogs } = useEmploymentTypeSaveGate()
  const profileLoadGen = useRef(0)
  // Rulebook 1.12.2: one save at a time. A second press (or Enter) while a save is in flight is ignored, so a role
  // change is never sent twice from a stale copy.
  const saveInFlight = useRef(false)
  // Rulebook 1.26.1 §8 (`payEditorStartingValues`): true while the starting record is read again after `privatePay`
  // changed for the open organisation; Save is disabled until it is applied.
  const [payReloading, setPayReloading] = useState(false)
  const payReloadingRef = useRef(false)
  // The live `organizations/{orgId}` document (members map), shared listener.
  const liveOrganization = useOrganizationDocument()
  const liveMembers =
    liveOrganization.loaded && liveOrganization.data && typeof liveOrganization.data.members === 'object'
      ? (liveOrganization.data.members as Record<string, unknown>)
      : undefined
  // Rulebook 1.12.2 `accountTypeSyncState`: the type differs between this profile and `members.{uid}`.
  const accountTypeRepair =
    target && liveMembers
      ? accountTypeSyncState({ person: accountTypeSubject(target), organizationId: organization?.id || '', members: liveMembers }).repair
      : null

  // Rulebook 1.9.0 §1: pay history is live while this profile is open (a rate change on iOS shows here).
  useEffect(() => {
    if (!organization?.id) return
    return watchOperativeDayRateHistory(organization.id, setRateHistory)
  }, [organization?.id])

  useEffect(() => {
    if (!organization?.id) return
    const generation = ++profileLoadGen.current
    loadUsers(organization.id)
    loadOperatives(organization.id)
    void loadHolidays(organization.id)
    void loadOrganizationDetails(organization.id)
      .then((details) => {
        if (details?.annualLeaveDefaults) setOrgLeaveDefaults(details.annualLeaveDefaults)
      })
      .catch(() => undefined)
    void loadOrganisationQualificationsEnsuringStarter(organization.id, { fromServer: true })
      .then((existing) => {
        const assigned = assignedQualificationTemplates(useOperativeStore.getState().operatives)
        setQualificationTemplates(mergeQualificationTemplates(existing, assigned))
      })
      .catch(() => undefined)
    // Rulebook 1.26.1 §8 (`payEditorStartingValues`): the form, `savedUser` (the save diff) and the original rate /
    // basis / employment type (the rate-history "previous" row) all start from the same copy — the pay profile laid
    // over the users document while `privatePay` is on, the users document as stored while it is off.
    getUser(userId, { payEditor: true })
      .then((row) => {
        if (generation !== profileLoadGen.current) return
        setTarget(row)
        savedUser.current = row
        setOriginalDayRate(row?.payBasis === 'hourly' ? row?.hourlyRate : row?.dayRate)
        setOriginalPayBasis(row?.payBasis)
        setOriginalEmploymentType(row?.employmentType)
        if (row) setBaseline(profileSnapshot(row, null, null))
        setRemainingTouched(false)
      })
      .finally(() => {
        if (generation === profileLoadGen.current) setLoading(false)
      })
  }, [organization?.id, userId, getUser, loadUsers, loadOperatives, loadHolidays])

  // Rulebook 1.26.1 §8 (`payEditorStartingValues`): when `privatePay` changes for the open organisation while this
  // form is open, read the starting record again (`getUser` → `payEditorRecord`), re-seed only the pay fields the
  // admin has not touched, and move the save baseline — `savedUser` (the save diff), the original rate / basis /
  // employment type (the rate-history "previous" row) and the dirty snapshot — to the reloaded pay. Save stays
  // disabled until that is done. While the switch does not change nothing is read.
  useEffect(() => {
    const organizationId = organization?.id
    if (!organizationId || !userId) return
    const setReloading = (value: boolean) => {
      payReloadingRef.current = value
      setPayReloading(value)
    }
    const stop = watchPayEditorPrivatePay<User>({
      organizationId: () => organizationId,
      reload: () => getUser(userId, { payEditor: true }),
      onReloading: setReloading,
      onReloaded: (next) => {
        const start = savedUser.current
        if (!start) return
        const nextBaseline = withPayFieldsFrom(start, next)
        savedUser.current = nextBaseline
        setTarget((current) => (current ? reseedUntouchedPayFields(current, start, next) : current))
        setOriginalDayRate(nextBaseline.payBasis === 'hourly' ? nextBaseline.hourlyRate : nextBaseline.dayRate)
        setOriginalPayBasis(nextBaseline.payBasis)
        setOriginalEmploymentType(nextBaseline.employmentType)
        setBaseline(profileSnapshot(nextBaseline, null, null))
      },
      onFailed: () => setError('Pay settings changed while this form was open and could not be reloaded. Reopen this person before saving.'),
    })
    return () => {
      stop()
      setReloading(false)
    }
  }, [organization?.id, userId, getUser])

  const linkedOperative = target ? operativeRecordForUser(target, operatives) : undefined
  const leaveBalance = useMemo(
    () =>
      userLeaveBalance({
        user: target,
        bookings: bookingsForPerson(holidayBookings, target?.id, linkedOperative?.id),
        orgDefaults: orgLeaveDefaults,
      }),
    [target, holidayBookings, linkedOperative?.id, orgLeaveDefaults]
  )

  useEffect(() => {
    if (!target || remainingTouched) return
    setRemainingDraft(
      leaveBalance.remaining == null ? '' : String(leaveBalance.remaining)
    )
  }, [target, leaveBalance.remaining, remainingTouched])

  // Rulebook §11 `lineManagerCandidates(person, roster)`: the picker list, never the person under any of their ids.
  const managers = useMemo(() => {
    const byId = new Map(users.map((row) => [row.id, row]))
    const subject = target?.id ? users.find((row) => row.id === target.id) ?? { id: target.id } : null
    return lineManagerCandidates(subject as never, users as never)
      .map((candidate) => byId.get(candidate.id))
      .filter((row): row is (typeof users)[number] => Boolean(row))
  }, [users, target?.id])

  const previousRateEntries = useMemo(() => {
    if (!target) return []
    const email = target.email.trim().toLowerCase()
    const ids = users
      .filter((row) => row.email.trim().toLowerCase() === email)
      .map((row) => row.id)
    if (!ids.includes(target.id)) ids.push(target.id)
    return mergedDayRateEntries(rateHistory, ids, findOperativeForUser(target, operatives)?.id)
  }, [target, users, operatives, rateHistory])

  const canEdit = target ? canEditTargetUser(currentUser, target) : false
  const canEditIdentity = target ? canEditIdentityDetails(currentUser, target) : false
  const canEditMatrix = target ? canEditPermissionsMatrix(currentUser, target) : false
  const canAdminTools = canUseAdminAccountTools(currentUser)
  // Rulebook 1.10.0 section 11: Delete shows only when `canDeleteUser` allows it (the store checks again).
  const mayDeleteTarget = Boolean(
    target &&
      currentUser &&
      canDeleteUser(
        { id: currentUser.id, email: currentUser.email, role: staffAccountRole(currentUser), formerUserIds: currentUser.formerUserIds },
        { id: target.id, email: target.email, role: staffAccountRole(target), formerUserIds: target.formerUserIds },
        { creatorUserId: (organization as { creatorUserId?: string } | null)?.creatorUserId ?? null }
      )
  )

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
  const showQualifications = Boolean(target && canEdit)
  const canManageOrgQuals = canManageOrganisationQualifications(currentUser)
  const canViewTaxIds = Boolean(
    target &&
      currentUser &&
      canViewSensitiveProfile({
        viewerRole: staffAccountRole(currentUser),
        viewerUserId: currentUser.id,
        subjectUserId: target.id,
      })
  )
  const taxSubjectId = target?.id
  useEffect(() => {
    setTaxIds(null)
    setTaxDraft({ utrNumber: null, vatNumber: null })
    setShowTaxIds(false)
    if (!taxSubjectId || !canViewTaxIds) return
    let cancelled = false
    const legacy = target ? { utrNumber: target.utrNumber, vatNumber: target.vatNumber } : null
    loadTaxIds(taxSubjectId, legacy)
      .then((value) => {
        if (!cancelled) setTaxIds(value)
      })
      .catch(() => {
        if (!cancelled) setTaxIds({ utrNumber: '', vatNumber: '', source: 'none' })
      })
    return () => {
      cancelled = true
    }
    // Reload only when the person or the viewer's access changes, not on every field edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taxSubjectId, canViewTaxIds])

  const showPayrollFields =
    target &&
    canEditMatrix &&
    (target.permissions.operativeMode || target.permissions.manager) &&
    !target.permissions.adminAccess &&
    !target.isSuperAdmin

  const lineManagerFieldShown = Boolean(
    target &&
      showSetupCard &&
      (target.permissions.operativeMode || target.permissions.manager || target.permissions.adminAccess)
  )

  const effectivePermissions = draftTypePermissions ?? target?.permissions
  const effectiveAccountType = draftAccountType ?? (target ? currentAccountType(target) : 'manager')
  // The person as this screen would save them (a pending account-type change included).
  const mayHaveNoLineManager = target
    ? userMayHaveNoLineManager(
        draftAccountType && draftTypePermissions
          ? { ...applyAccountType(cloneUser(target), draftAccountType), permissions: draftTypePermissions }
          : target,
        users
      )
    : false

  const updatePermissions = (patch: Partial<UserPermissions>) => {
    if (!target || target.isSuperAdmin) return
    if (patch.adminAccess != null && currentAccountType(target) === 'manager') {
      setLockedNotice(ADMIN_ACCESS_LOCKED_MESSAGE)
      return
    }
    if (draftTypePermissions) {
      setDraftTypePermissions({ ...draftTypePermissions, ...patch })
      return
    }
    setTarget({ ...target, permissions: { ...target.permissions, ...patch } })
  }

  const handleSave = async (e?: FormEvent) => {
    e?.preventDefault()
    if (!target || !organization?.id || !canEdit) return
    if (saveInFlight.current || saving || typeSaving || payReloadingRef.current) return
    saveInFlight.current = true
    try {
      await runSave()
    } finally {
      saveInFlight.current = false
    }
  }

  const runSave = async () => {
    if (!target || !organization?.id || !canEdit) return

    // `lineManagerRequiredError(user, roster)`: every operative and manager needs an active line manager, whatever
    // the self-book permission; only admins outside operative mode may have none.
    // Checked on the person as it will be saved (draft account type and permissions included).
    const asSaved =
      draftAccountType && draftTypePermissions
        ? { ...applyAccountType(target, draftAccountType), permissions: draftTypePermissions }
        : target
    const lineManagerMessage = userLineManagerRequiredError(asSaved, users)
    setLineManagerError(lineManagerMessage)
    if (lineManagerMessage) {
      if (!lineManagerFieldShown) setError(lineManagerMessage)
      return
    }
    // Rulebook 1.14.0 `payRateRequiredError`: a self-employed person (including a change to self-employed, immediate
    // or effective-dated — `employmentType` is the new type) must have a day or hourly rate above 0. Only when the
    // signed-in user may set this person's pay (`canChangePersonPay`).
    const payMessage = maySetPayOf(currentUser, {
      id: asSaved.id,
      isOperative: Boolean(asSaved.permissions?.operativeMode || asSaved.role === 'operative'),
    })
      ? userPayRateRequiredError(asSaved)
      : null
    setRateError(payMessage)
    if (payMessage) {
      if (!showSetupCard) setError(payMessage)
      return
    }

    const previous = target
    const previousBaseline = baseline
    const decision = await requestPaySave({
      existing: true,
      employmentType: target.employmentType,
      previous: {
        payBasis: originalPayBasis,
        dayRate: originalPayBasis === 'hourly' ? undefined : originalDayRate,
        hourlyRate: originalPayBasis === 'hourly' ? originalDayRate : undefined,
      },
      next: target,
      createdAt: target.createdAt,
    })
    if (decision === 'cancel') return
    const employmentWhen = await requestEmploymentSave({
      previous: originalEmploymentType,
      next: target.employmentType,
    })
    if (employmentWhen === 'cancel') return
    setError(null)
    setSuccess(null)
    let toSave = { ...target, updatedAt: new Date() }
    // Rulebook 1.13.0 §14 (`selfEmailChangeAction`): a person's own email changes through Firebase Auth first
    // (verifyBeforeUpdateEmail); this save keeps the stored email and the sign-in sync writes the new one later.
    let emailChangeNote: string | null = null
    if (currentUser?.id === target.id && savedUser.current) {
      const action = selfEmailChangeAction({ storedEmail: savedUser.current.email, nextEmail: target.email })
      if (action === 'invalid') {
        setError(SELF_EMAIL_INVALID_MESSAGE)
        return
      }
      if (action === 'verifyBeforeUpdate') {
        try {
          const [{ verifyBeforeUpdateEmail }, { getFirebaseAuth }] = await Promise.all([
            import('firebase/auth'),
            import('@/lib/firebase/ensureFirebase'),
          ])
          const signedIn = getFirebaseAuth().currentUser
          if (!signedIn) throw new Error('Sign in again to change your email.')
          await verifyBeforeUpdateEmail(signedIn, target.email.trim().toLowerCase())
          emailChangeNote = selfEmailChangeSentMessage(target.email)
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Could not send the confirmation email.')
          return
        }
        toSave = { ...toSave, email: savedUser.current.email }
      }
    }
    if (draftAccountType && draftTypePermissions) {
      toSave = applyAccountType(toSave, draftAccountType)
      toSave = { ...toSave, permissions: draftTypePermissions }
    }
    const employment = applyEmploymentTypeChange({
      previousType: originalEmploymentType,
      nextType: toSave.employmentType,
      previousTransitionFrom: toSave.employmentTypeTransitionFrom,
      previousEffectiveAt: toSave.employmentTypeEffectiveAt,
      effectiveAt: employmentWhen === 'immediate' ? 'immediate' : employmentWhen,
    })
    toSave = {
      ...toSave,
      employmentType: employment.employmentType,
      employmentTypeTransitionFrom: employment.employmentTypeTransitionFrom || undefined,
      employmentTypeEffectiveAt: employment.employmentTypeEffectiveAt || undefined,
    }
    if (toSave.annualLeaveEnabled !== false && remainingTouched && remainingDraft !== '') {
      const remaining = parseBoundedNumber(remainingDraft, { min: 0, max: LEAVE_DAYS_SAVE_MAX })
      if (remaining == null) {
        setError('Enter remaining leave days between 0 and 365.')
        return
      }
      const override = remainingOverrideFromBalance(snapLeaveDays(remaining), leaveBalance)
      toSave = {
        ...toSave,
        annualLeaveYearAllowance: override.annualLeaveYearAllowance,
        annualLeaveYearAllowanceKey: override.annualLeaveYearAllowanceKey,
      }
    }
    // Rulebook 1.12.0 §4.4: refuse a leave year that is not 12 months, when this save changes the months.
    const leaveYearChanged =
      toSave.annualLeaveYearStartMonth !== savedUser.current?.annualLeaveYearStartMonth ||
      toSave.annualLeaveYearEndMonth !== savedUser.current?.annualLeaveYearEndMonth
    const leaveYearError = leaveYearChanged
      ? validateLeaveYearMonths(toSave.annualLeaveYearStartMonth ?? 1, toSave.annualLeaveYearEndMonth ?? 12)
      : null
    if (leaveYearError) {
      setError(leaveYearError)
      return
    }
    setSaving(true)
    try {
      // Rulebook 1.10.0 §8 (`payRateChangeWrites`): pay history rows go in the profile's batch; a history that did
      // not load refuses the save instead of writing a duplicate seed row.
      const nextRate = (toSave.payBasis === 'hourly' ? toSave.hourlyRate : toSave.dayRate) ?? null
      const rateChanged = (originalDayRate ?? null) !== nextRate || (originalPayBasis ?? null) !== (toSave.payBasis ?? null)
      let payHistoryRows: Array<{ id: string; fields: Record<string, unknown> }> = []
      if (rateChanged) {
        const { loadOperativeDayRateHistoryOrNull, payHistoryBatchRows } = await import('@/lib/timesheets/dayRateHistoryStorage')
        payHistoryRows = payHistoryBatchRows({
          history: await loadOperativeDayRateHistoryOrNull(organization.id),
          userId: toSave.id,
          operativeId: findOperativeForUser(toSave, operatives)?.id,
          previous: { rate: originalDayRate ?? null, payBasis: originalPayBasis ?? null },
          next: { rate: nextRate, payBasis: toSave.payBasis ?? null },
          effectiveAt: decision instanceof Date ? decision : new Date(),
          seedEffective: toSave.createdAt ?? null,
        })
      }
      let profileBaseline = savedUser.current
      if (draftAccountType && draftTypePermissions && draftAccountType !== currentAccountType(previous)) {
        // Rulebook 1.11.0 `accountTypeChangeWrites`: the new type on every document that decides it here, in one batch
        // (1.12.2).
        const typeNote = await changeAccountType(previous, draftAccountType, organization.id, users, draftTypePermissions)
        if (typeNote) setSuccess(typeNote)
        // The type is saved: the profile save below sends only the other edits, never the type fields again.
        if (profileBaseline) {
          const typed = applyAccountType(cloneUser(profileBaseline), draftAccountType)
          profileBaseline = { ...typed, permissions: draftTypePermissions }
        }
      } else if (accountTypeRepair) {
        // Rulebook 1.12.2 `accountTypeSyncState`: a user type only partly saved (older iOS build, interrupted save) is
        // finished on every document from the profile's type.
        await changeAccountType(previous, accountTypeRepair, organization.id, users, previous.permissions)
      }
      await saveUser(toSave, organization.id, previous.email, { baseline: profileBaseline, payHistoryRows })
      savedUser.current = toSave
      if (canViewTaxIds && taxDirty && currentUser?.id) {
        const next = {
          utrNumber: taxDraft.utrNumber ?? taxIds?.utrNumber ?? '',
          vatNumber: taxDraft.vatNumber ?? taxIds?.vatNumber ?? '',
        }
        await saveTaxIds(toSave.id, next, currentUser.id)
        setTaxIds({ ...next, source: 'private' })
        setTaxDraft({ utrNumber: null, vatNumber: null })
      }
      patchListedUser(toSave)
      setListedUserActive(toSave.id, toSave.isActive)
      setTarget(toSave)
      setDraftAccountType(null)
      setDraftTypePermissions(null)
      setShowChangeType(false)
      setBaseline(profileSnapshot(toSave, null, null))
      setOriginalEmploymentType(toSave.employmentType)
      setRemainingTouched(false)
      setSaved(true)
      window.setTimeout(() => setSaved(false), 3000)
      setSuccess(emailChangeNote ?? (toSave.isActive ? 'Profile saved.' : 'User deactivated.'))
      if (emailChangeNote) setTarget({ ...toSave })
      void setUserActive(toSave.id, toSave.isActive, organization.id).catch(() => undefined)
      void syncLinkedOperative(organization.id, toSave, operatives).catch(() => undefined)
    } catch (err: unknown) {
      setTarget(previous)
      setListedUserActive(previous.id, previous.isActive)
      setBaseline(previousBaseline)
      setSaved(false)
      setSuccess(null)
      setError(err instanceof Error ? err.message : 'Failed to save user')
      setSaving(false)
      return
    }
    setSaving(false)
    setOriginalDayRate(toSave.payBasis === 'hourly' ? toSave.hourlyRate : toSave.dayRate)
    setOriginalPayBasis(toSave.payBasis)
    void import('@/lib/timesheets/dayRateHistoryStorage').then(({ loadOperativeDayRateHistory }) =>
      loadOperativeDayRateHistory(organization.id).then(setRateHistory)
    )
    // Owner request (1.12.2): a saved profile closes and returns to the people list.
    router.push(hubHref || backHref)
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
    if (!target || !canAdminTools || activeSaving || target.isSuperAdmin) return
    const previous = target
    const next = !target.isActive
    const nextUser = { ...target, isActive: next, updatedAt: new Date() }
    // Reactivating is a save too: `lineManagerRequiredError` refuses an active operative or manager with no active
    // line manager (an inactive person is not checked).
    if (next) {
      const lineManagerMessage = userLineManagerRequiredError(nextUser, users)
      if (lineManagerMessage) {
        setLineManagerError(lineManagerMessage)
        setError(lineManagerMessage)
        return
      }
    }
    profileLoadGen.current += 1
    setActiveSaving(true)
    setError(null)
    setTarget(nextUser)
    setListedUserActive(target.id, next)
    setBaseline(profileSnapshot(nextUser, null, null))
    setSuccess(next ? 'User reactivated.' : 'User deactivated.')
    try {
      await setUserActive(target.id, next, organization?.id)
      if (savedUser.current) savedUser.current = { ...savedUser.current, isActive: next }
      if (organization?.id) void syncLinkedOperative(organization.id, nextUser, operatives).catch(() => undefined)
    } catch (err: unknown) {
      setTarget(previous)
      setListedUserActive(previous.id, previous.isActive)
      setBaseline(profileSnapshot(previous, null, null))
      setSuccess(null)
      setError(err instanceof Error ? err.message : 'Failed to update status')
    } finally {
      setActiveSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!target || !canAdminTools || !mayDeleteTarget) return
    setConfirmDelete(false)
    setBusyAction('delete')
    try {
      await deleteUser(target.id, { organizationId: organization?.id, email: target.email })
      router.push(hubHref || backHref)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete user')
    } finally {
      setBusyAction(null)
    }
  }

  const handleTransfer = async (nextUserId: string) => {
    if (!currentUser?.isSuperAdmin || !target || target.id !== currentUser.id || !organization?.id || transferring) return
    setTransferring(true)
    setError(null)
    try {
      await transferSuperAdmin(organization.id, currentUser.id, nextUserId, users)
      await reloadSignedInProfile()
      await loadUsers(organization.id, { force: true })
      const refreshed = await getUser(target.id, { payEditor: true })
      if (refreshed) {
        setTarget(refreshed)
        savedUser.current = refreshed
      }
      setShowTransfer(false)
      setSuccess('Super admin updated.')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not change super admin')
    } finally {
      setTransferring(false)
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

  const persistAccountType = async (accountType: 'operative' | 'manager' | 'admin') => {
    if (!target || !organization?.id || typeSaving || payReloadingRef.current) return
    const next = applyAccountType(cloneUser(target), accountType)
    // `lineManagerRequiredError` on the person as this change would save them.
    const lineManagerMessage = userLineManagerRequiredError(next, users)
    if (lineManagerMessage) {
      setLineManagerError(lineManagerMessage)
      setError(lineManagerMessage)
      return
    }
    setTypeSaving(true)
    setError(null)
    setSuccess(null)
    try {
      // Rulebook 1.11.0 `accountTypeChangeWrites`: users docs, `members.{uid}` and the membership together.
      const typeNote = await changeAccountType(target, accountType, organization.id, users, next.permissions)
      if (typeNote) {
        // Rulebook 1.11.0: a profile of another company is not rewritten; only this organisation's entry changed.
        savedUser.current = next
        patchListedUser(next)
        setTarget(next)
        setDraftAccountType(null)
        setDraftTypePermissions(null)
        setShowChangeType(false)
        setSuccess(typeNote)
        return
      }
      await saveUser(next, organization.id, target.email, { baseline: next })
      savedUser.current = next
      patchListedUser(next)
      setTarget(next)
      setDraftAccountType(null)
      setDraftTypePermissions(null)
      setShowChangeType(false)
      setBaseline(profileSnapshot(next, null, null))
      setSuccess(accountType === 'admin' ? 'This user is now an administrator.' : `Account type set to ${accountType}.`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not change account type')
    } finally {
      setTypeSaving(false)
    }
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

  const taxDirty = taxDraft.utrNumber !== null || taxDraft.vatNumber !== null
  // Typing the remaining days back to the worked-out figure is not a change.
  const remainingChanged =
    remainingTouched && remainingDraft !== (leaveBalance.remaining == null ? '' : String(leaveBalance.remaining))
  const dirty =
    Boolean(target) &&
    baseline != null &&
    (remainingChanged ||
      taxDirty ||
      accountTypeRepair != null ||
      profileSnapshot(target, draftAccountType, draftTypePermissions) !== baseline)
  const pageTitle = currentAccountType(target) === 'operative' ? 'Edit operative' : 'Edit user'
  const status = rosterStatusLabel(target)

  return (
    <form onSubmit={handleSave} className="mx-auto max-w-2xl pb-16">
      {payDialogs}
      {employmentDialogs}
      <PanelHeader
        title={pageTitle}
        onBack={() => {
          if (saving || typeSaving) return
          router.push(backHref)
        }}
        rightAction={
          canEdit && dirty ? (
            <button
              type="button"
              disabled={saving || typeSaving || payReloading}
              onClick={() => handleSave()}
              className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
            >
              {saving || typeSaving ? 'Saving…' : 'Save'}
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
      {canEdit && accountTypeRepair && !draftAccountType ? (
        <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {ACCOUNT_TYPE_OUT_OF_SYNC_MESSAGE}
        </div>
      ) : null}
      {success && !saved && (
        <div className="mt-4">
          <SuccessBanner message={success} />
        </div>
      )}
      {typeSaving && (
        <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
          Saving account type…
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
      <SectionLabel label="User details" />
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
            <>
              <FormField label="Employment type">
                <Select
                  value={normalizeEmploymentType(target.employmentType)}
                  disabled={!canEditMatrix}
                  onChange={(e) => {
                    setRateError(null)
                    setTarget({ ...target, employmentType: e.target.value })
                  }}
                >
                  <option value="self_employed">Self-Employed</option>
                  <option value="paye">PAYE</option>
                </Select>
              </FormField>
              <FormField
                label="Employment date"
                hint="PAYE and self-employed take effect from the working day you choose when you save a change."
              >
                <Input
                  value={
                    normalizeEmploymentType(target.employmentType) !==
                    normalizeEmploymentType(originalEmploymentType)
                      ? 'Asked when you save'
                      : employmentEffectiveLabel(target)
                  }
                  disabled
                />
              </FormField>
            </>
          )}
        </div>
      </SettingsCard>

      {showSetupCard && (
        <>
          <SectionLabel label={setupSectionTitle(target)} />
          <SettingsCard>
            <div className="space-y-4 p-4">
              {(target.permissions.operativeMode || target.permissions.manager || target.permissions.adminAccess) && (
                <FormField
                  label="Line manager(s)"
                  hint={
                    mayHaveNoLineManager
                      ? 'Choose No line manager when this admin has none.'
                      : 'Required for operatives and managers.'
                  }
                >
                  <Select
                    value={lineManagerSelectedIds(target as never, users as never)[0] ?? displayedLineManagerId(target)}
                    disabled={!canEdit || saving || typeSaving}
                    onChange={(e) => {
                      setLineManagerError(null)
                      setTarget(userWithLineManagerChoice(target, e.target.value))
                    }}
                  >
                    {/* "No line manager" only for an admin or super admin (`lineManagerRequired` false). */}
                    <option value="" disabled={!mayHaveNoLineManager}>
                      {mayHaveNoLineManager ? 'No line manager' : 'Choose a line manager'}
                    </option>
                    {managers.map((manager) => (
                      <option key={manager.id} value={manager.id}>
                        {manager.firstName} {manager.surname} ({manager.email})
                      </option>
                    ))}
                  </Select>
                  {lineManagerError ? (
                    <p role="alert" className="mt-1.5 text-sm font-medium text-[var(--red,#dc2626)]">
                      {lineManagerError}
                    </p>
                  ) : null}
                </FormField>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <PayBasisFields
                  {...payChoiceFromProfile(target)}
                  placeholder="manage"
                  disabled={!canEdit}
                  error={rateError}
                  onChange={(next) => {
                    setRateError(null)
                    setTarget({ ...target, ...payChoiceToRates(next.payBasis, next.amount) })
                  }}
                />
                <PreviousRatesList entries={previousRateEntries} />
              </div>

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

      {showQualifications ? (
        <>
          <SectionLabel label="Qualifications" />
          <SettingsCard>
            <div className="p-4">
              {qualError ? <p className="mb-3 text-sm font-medium text-red-600">{qualError}</p> : null}
              <OperativeQualificationsEditor
                linked={linkedOperative}
                templates={qualificationTemplates}
                saving={qualSaving}
                organizationId={organization?.id || ''}
                canManageOrg={canManageOrgQuals}
                showReportLink={Boolean(target && currentUser && target.id !== currentUser.id)}
                onSave={async (next) => {
                  if (!organization?.id) return
                  setQualSaving(true)
                  setQualError(null)
                  try {
                    const urls = canonicalCertificateUrls(next.qualifications, next.qualificationCertificateURLs)
                    await patchOperativeQualifications(organization.id, {
                      ...next,
                      qualificationCertificateURLs: urls,
                    })
                  } catch (err: unknown) {
                    const message = formatCertificateSaveError(err)
                    setQualError(message)
                    throw err instanceof Error ? err : new Error(message)
                  } finally {
                    setQualSaving(false)
                  }
                }}
              />
            </div>
          </SettingsCard>
        </>
      ) : null}

      {/* Annual leave access */}
      {showAnnualLeave && (
        <>
          <SectionLabel label="Annual leave in app" />
          <SettingsCard>
            <div className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-[var(--ink)]">
                    {ANNUAL_LEAVE_ALLOWANCE_COPY.toggleTitle}
                  </div>
                  <p className="mt-0.5 text-xs text-[var(--ink3)]">
                    {ANNUAL_LEAVE_ALLOWANCE_COPY.toggleDescription}
                  </p>
                </div>
                <Toggle
                  checked={target.annualLeaveEnabled !== false}
                  disabled={!canEdit}
                  onChange={(checked) => {
                    setTarget({ ...target, annualLeaveEnabled: checked })
                    setRemainingTouched(false)
                  }}
                />
              </div>
              <p className="mt-2 text-xs text-slate-400">{ANNUAL_LEAVE_ALLOWANCE_COPY.toggleNote}</p>
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
                  min="0"
                  step="0.5"
                  value={target.annualLeaveDaysPerYear?.toString() || String(orgLeaveDefaults.daysPerYear)}
                  disabled={!canEdit}
                  onChange={(e) =>
                    setTarget({
                      ...target,
                      annualLeaveDaysPerYear:
                        parseBoundedNumber(e.target.value, { min: 0, max: LEAVE_DAYS_SAVE_MAX }) ?? undefined,
                    })
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
                    onChange={(e) => {
                      // 1.12.0 §4.4: a leave year is 12 months — the end follows the start (`leaveYearEndMonth`).
                      const start = Number(e.target.value)
                      setTarget({ ...target, annualLeaveYearStartMonth: start, annualLeaveYearEndMonth: leaveYearEndMonth(start) })
                    }}
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
                    onChange={(e) => {
                      const end = Number(e.target.value)
                      setTarget({ ...target, annualLeaveYearEndMonth: end, annualLeaveYearStartMonth: leaveYearStartMonth(end) })
                    }}
                  >
                    {MONTHS.map((month, index) => (
                      <option key={month} value={index + 1}>
                        {month}
                      </option>
                    ))}
                  </Select>
                </div>
              </FormField>
              {/* Rulebook 1.13.0 §4.4 (Q4, `proRataLeaveAllowance`): the leave year they joined is pro rata. */}
              <FormField
                label="Start date"
                hint="The day this person started. Their allowance for that leave year is pro rata from it. Leave blank for a full allowance."
              >
                <Input
                  type="date"
                  value={target.employmentStartDate || ''}
                  disabled={
                    !canEdit ||
                    (currentUser?.id === target.id && !currentUser?.permissions.adminAccess && !currentUser?.isSuperAdmin)
                  }
                  onChange={(e) => setTarget({ ...target, employmentStartDate: e.target.value || undefined })}
                />
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
              <FormField
                label={ANNUAL_LEAVE_ALLOWANCE_COPY.remainingTitle}
                hint={`${ANNUAL_LEAVE_ALLOWANCE_COPY.remainingNote} Currently ${leaveBalance.taken} taken and ${leaveBalance.pending} awaiting approval this leave year.`}
              >
                <Input
                  type="number"
                  min="0"
                  step="0.5"
                  value={remainingDraft}
                  disabled={!canEdit}
                  onChange={(e) => {
                    setRemainingDraft(e.target.value)
                    setRemainingTouched(true)
                  }}
                />
              </FormField>
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
              {canViewTaxIds ? (
                <div className="space-y-2">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {(['vatNumber', 'utrNumber'] as const).map((field) => {
                      const saved = taxIds?.[field] ?? ''
                      const draft = taxDraft[field]
                      const shown = showTaxIds ? saved : maskSensitiveValue(saved)
                      return (
                        <FormField
                          key={field}
                          label={field === 'vatNumber' ? 'VAT number' : 'UTR number'}
                          hint={
                            taxIds == null
                              ? 'Loading…'
                              : draft === ''
                                ? 'Will be removed when you save.'
                                : saved
                                  ? `Saved: ${shown} — type to replace.`
                                  : 'Optional.'
                          }
                        >
                          <div className="flex gap-2">
                            <Input
                              value={draft ?? ''}
                              autoComplete="off"
                              placeholder={saved ? shown : ''}
                              disabled={!canEdit || taxIds == null}
                              onChange={(e) => setTaxDraft((current) => ({ ...current, [field]: e.target.value || null }))}
                            />
                            {saved && canEdit ? (
                              <button
                                type="button"
                                className="btn sm ghost"
                                onClick={() => setTaxDraft((current) => ({ ...current, [field]: '' }))}
                              >
                                Remove
                              </button>
                            ) : null}
                          </div>
                        </FormField>
                      )
                    })}
                  </div>
                  {taxIds && (taxIds.utrNumber || taxIds.vatNumber) ? (
                    <button type="button" className="text-xs font-semibold text-[var(--blue)]" onClick={() => setShowTaxIds((v) => !v)}>
                      {showTaxIds ? 'Hide' : 'Show'} saved numbers
                    </button>
                  ) : null}
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <FormField label="VAT number">
                    <Input value={SENSITIVE_HELD_BY_ADMIN_COPY} disabled readOnly />
                  </FormField>
                  <FormField label="UTR number">
                    <Input value={SENSITIVE_HELD_BY_ADMIN_COPY} disabled readOnly />
                  </FormField>
                </div>
              )}
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
                  disabled={!canEdit || activeSaving}
                  onChange={() => void handleToggleActive()}
                />
              </div>
            </div>
          </SettingsCard>
        </>
      )}

      {target.isSuperAdmin ? (
        <>
          <SectionLabel label="Permissions" />
          <SettingsCard>
            <div className="flex items-start gap-3 p-4">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-orange-600">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M12 2a5 5 0 0 0-5 5v3H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-1V7a5 5 0 0 0-5-5Zm-3 8V7a3 3 0 1 1 6 0v3H9Z" />
                </svg>
              </div>
              <div>
                <p className="text-[13px] font-semibold text-orange-600">Super Admin</p>
                <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                  The Super Admin&apos;s permissions cannot be changed. Super Admin is passed on with Change Super Admin.
                </p>
              </div>
            </div>
          </SettingsCard>
        </>
      ) : canEditMatrix && effectivePermissions ? (
        <>
          <SectionLabel label="Permissions" />
          <SettingsCard>
            <div className="divide-y divide-slate-100">
              <PermissionRowsList
                rows={editUserPermissionRows(target, effectiveAccountType, effectivePermissions, users)}
                onChange={updatePermissions}
                disabled={!canEdit || target.isSuperAdmin}
                excludeFields={suppressAdminAccessToggle ? ['adminAccess'] : undefined}
                lockedMessage={lockedPermissionMessage(effectiveAccountType)}
                onLocked={setLockedNotice}
              />
              {lockedNotice ? <p className="px-5 py-3 text-sm text-slate-600">{lockedNotice}</p> : null}
            </div>
          </SettingsCard>
        </>
      ) : null}

      {canEdit && dirty ? (
        <div className="mt-6">
          <SaveButton saving={saving} saved={saved} dirty={!payReloading} onClick={() => handleSave()} />
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
            title="Resend sign-up email with verification code"
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
                          orgName: organization.name,
                          targetUid: target.id,
                          targetName: `${target.firstName} ${target.surname}`.trim(),
                          currentEmail: target.email,
                          suggestedEmail: fixEmail,
                          note: fixNote,
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
                {draftTypePermissions && (
                  <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                    <PermissionRowsList
                      rows={editUserPermissionRows(target, effectiveAccountType, draftTypePermissions, users)}
                      onChange={(patch) => setDraftTypePermissions({ ...draftTypePermissions, ...patch })}
                      excludeFields={suppressAdminAccessToggle ? ['adminAccess'] : undefined}
                      lockedMessage={lockedPermissionMessage(effectiveAccountType)}
                      onLocked={setLockedNotice}
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

            {currentUser?.isSuperAdmin && target.id === currentUser.id ? (
              <ActionButton
                title="Change Super Admin"
                subtitle="Pass super admin to another administrator"
                tone="purple"
                onClick={() => setShowTransfer(true)}
              />
            ) : null}
            {target.isSuperAdmin ? null : (
              <ActionButton
                title="Change user type"
                subtitle="Switch between operative, manager, or administrator"
                tone="purple"
                onClick={() => setShowChangeType(true)}
              />
            )}
            {target.isSuperAdmin ? null : (
              <ActionButton
                title={target.isActive ? 'Deactivate user' : 'Reactivate user'}
                subtitle={target.isActive ? 'Suspend access, keep history' : 'Restore sign-in access'}
                tone="amber"
                busy={activeSaving}
                onClick={handleToggleActive}
              />
            )}
            {!mayDeleteTarget ? null : (
              <ActionButton
                title="Delete user"
                subtitle="Permanently remove account"
                tone="red"
                onClick={() => setConfirmDelete(true)}
              />
            )}
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
            <h2 className="text-lg font-bold text-slate-900">Delete user?</h2>
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

      {showTransfer && target && currentUser?.isSuperAdmin && target.id === currentUser.id && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setShowTransfer(false)}
        >
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-slate-900">Change Super Admin</h2>
            {superAdminSuccessors(users, currentUser.id).length === 0 ? (
              <p className="mt-2 text-sm text-slate-600">{SUPER_ADMIN_SUCCESSOR_EMPTY}</p>
            ) : (
              <ul className="mt-3 max-h-64 space-y-2 overflow-y-auto">
                {superAdminSuccessors(users, currentUser.id).map((person) => (
                  <li key={person.id}>
                    <button
                      type="button"
                      disabled={transferring}
                      onClick={() => void handleTransfer(person.id)}
                      className="w-full rounded-xl border border-slate-200 px-4 py-3 text-left hover:bg-slate-50 disabled:opacity-60"
                    >
                      <span className="block text-sm font-semibold text-slate-900">
                        {person.firstName} {person.surname}
                      </span>
                      <span className="mt-0.5 block text-xs text-slate-500">{person.email}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setShowTransfer(false)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Cancel
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
              {target.firstName} {target.surname} will get full administrator access, including user management and
              organisation settings. Only another administrator can change this later.
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
                  void persistAccountType('admin')
                }}
                disabled={typeSaving}
                className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {typeSaving ? 'Saving…' : 'Yes, make administrator'}
              </button>
            </div>
          </div>
        </div>
      )}
    </form>
  )
}
