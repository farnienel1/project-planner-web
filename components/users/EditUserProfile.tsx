'use client'

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { reseedUntouchedPayFields, watchPayEditorPrivatePay, withPayFieldsFrom } from '@/lib/pay/payEditorSwitchReload'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { usePendingNavigation } from '@/lib/navigation/usePendingNavigation'
import { RouteLoading } from '@/components/shell/RouteLoading'
import { format } from 'date-fns'
import { useAuthStore } from '@/lib/stores/authStore'
import { useOperativeStore } from '@/lib/stores/operativeStore'
import { useOrgUserStore, useRosterDocuments } from '@/lib/stores/siteAuditStore'
import { useUserStore } from '@/lib/stores/userStore'
import { useInviteStore } from '@/lib/stores/inviteStore'
import { loadSentInvitation, type SentInvitation } from '@/lib/orgSetup/openInvitation'
import { findOperativeForUser, operativeRecordForUser } from '@/lib/operatives/operativeRosterUtils'
import { personRateHistoryIds } from '@/lib/pay/personRateHistoryIds'
import { displayTradeType, STAFF_TRADE_TYPES } from '@/lib/staff/staffTradeTypes'
import {
  canEditIdentityDetails,
  canEditPermissionsMatrix,
  canEditTargetUser,
  canUseAdminAccountTools,
  roleLabel,
  setupSectionTitle,
} from '@/lib/staff/userEditPermissions'
import { rosterStatusLabel, samePersonIds } from '@/lib/staff/userRosterUtils'
import { userLineManagerRequiredError, userMayHaveNoLineManager } from '@/lib/annualLeave/holidayApprovalUtils'
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
  type SensitiveProfile,
  validateLeaveYearMonths,
  ghostBadgeLabel,
  isGhostUser,
  leaveRecordsForAccount,
} from '@/lib/canonical'
import { loadTaxIds, saveTaxIds } from '@/lib/sensitiveProfile/taxIdsService'
import { LEAVE_DAYS_SAVE_MAX, parseBoundedNumber } from '@/lib/security/boundedValue'
import { useHolidayStore } from '@/lib/stores/holidayStore'
import { useOrgBankHolidays } from '@/components/annual-leave/useOrgBankHolidays'
import {
  leaveBalanceShowsEmploymentType,
  userLeaveBalance,
  userLeaveBankHolidayRange,
} from '@/lib/annualLeave/leaveBalance'
import { useAnnualLeaveAdjustments } from '@/lib/annualLeave/leaveAdjustments'
import { useOrganizationTimeZone } from '@/lib/stores/organizationDocumentStore'
import { useLeaveEmployment } from '@/lib/annualLeave/useLeaveEmployment'
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
import {
  LINE_MANAGER_LOCKED_MESSAGE,
  canChangeLineManager,
  canDeleteUser,
  canManageOperatives,
  lineManagerChanged,
  lineManagerCandidates,
  lineManagerChangeBlock,
  canViewPersonPay,
  annualLeaveBalanceNotes,
  lineManagerSelectedIds,
  SELF_EMAIL_INVALID_MESSAGE,
  selfEmailChangeAction,
  selfEmailChangeSentMessage,
  type LineManagerReport,
  type PersonAccessChange,
} from '@/lib/canonical'
import { PermissionRowsList } from '@/components/users/ProfileExpandablePermissionToggle'
import { userIsOrganizationSuperAdmin } from '@/lib/staff/rulebookPeople'
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
import { Field, FieldGrid, FormSection, SectionBlock, Switch, ToggleRow, ProfileBack, ProfileBand, ProfileBanner, SaveState, type ProfileIconName } from '@/components/users/profile-ui'
import {
  SectionLabel,
  SettingsCard,
  Toggle,
  Input,
  Select,
  FormField,
  SaveButton,
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

/** A `YYYY-MM-DD` key as a local calendar date (for the bank-holiday year range only). */
function dateFromLeaveDayKey(key: string): Date {
  const [year, month, day] = key.split('-').map(Number)
  return new Date(year || 1970, (month || 1) - 1, day || 1)
}

/**
 * Rulebook 1.11.0 `permissionToggleRows` for Edit User: the person at `level` with `permissions` (a pending account
 * type change included). 1.28.0: the Super Admin's self-manage rows are on and locked, a PAYE admin's Timesheet
 * self-sign row is greyed out, and the viewer's own self-manage rows are not editable (`viewerIsSubject`) — all from
 * the rulebook rows.
 */
function editUserPermissionRows(
  user: User,
  level: PermissionLevel,
  permissions: UserPermissions,
  viewerId: string | null | undefined,
  users: ReadonlyArray<User>
) {
  return permissionToggleRows({
    level,
    // 1.28.0: this organisation's Super Admin (its creator included) reads both self-manage toggles on and locked.
    user: { ...user, permissions, organizationSuperAdmin: userIsOrganizationSuperAdmin(user, users) },
    mode: 'edit',
    viewerIsSubject: Boolean(viewerId && viewerId === user.id),
  })
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

/** Icon of the "[Role] setup" section (display only), in the same order as `setupSectionTitle`. */
export function setupSectionIcon(user: User): ProfileIconName {
  if (user.isSuperAdmin || user.permissions.adminAccess || user.role === 'admin') return 'shield'
  if (user.permissions.operativeMode) return 'hat'
  if (user.permissions.manager) return 'brief'
  return 'user'
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
  const { navigate: navigateBack, pending: backPending } = usePendingNavigation()
  const { user: currentUser, organization, reloadSignedInProfile } = useAuthStore()
  const organizationTimeZone = useOrganizationTimeZone()
  const { users, userIdAliases, loadUsers, setListedUserActive, patchListedUser } = useOrgUserStore()
  const { operatives, loadOperatives, patchOperativeQualifications } = useOperativeStore()
  const { getUser, saveUser, setUserActive, deleteUser, sendPasswordReset, applyAccountType, changeAccountType, syncLinkedOperative, transferSuperAdmin, removeFromManagedJobs } =
    useUserStore()
  // Rulebook 1.30.3 / 1.31.0 (audit finding 1): every write builder gets every users document of the organisation (the
  // unfolded roster), so a same-email copy is never missed by a type change, deactivation or the transfer.
  const rosterDocs = useRosterDocuments(organization?.id)
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
  // Rulebook 1.31.0 `lineManagerChangeBlock`: the people who report to this person, listed when a change is refused.
  const [reportsBlock, setReportsBlock] = useState<LineManagerReport[] | null>(null)
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
  // Rulebook 1.35.0 §12: the person's leave under every id they go by (`leaveRecordsForAccount`: former and same-email
  // ids, catalogue rows on their email, the email itself), with the region's bank holidays — the same figure as their
  // Annual leave screen and My Profile. Before 1.35.0 this matched one users id and one operatives row, no bank holidays.
  const personLeave = useMemo(
    () =>
      target
        ? leaveRecordsForAccount(
            holidayBookings,
            {
              id: target.id,
              email: target.email,
              formerIds: target.formerUserIds ?? [],
              aliasIds: [
                ...Array.from(samePersonIds(target.id, users, userIdAliases)),
                ...(rosterDocs || []).filter((row) => row.id !== target.id && target.email && row.email?.trim().toLowerCase() === target.email.trim().toLowerCase()).map((row) => row.id),
              ],
            },
            operatives
          )
        : [],
    [target, holidayBookings, users, userIdAliases, rosterDocs, operatives]
  )
  // Rulebook 1.35.0 `annualLeaveBankHolidayRange`: the previous leave year's bank holidays too (carry-over), the same
  // range My Profile and Annual leave load, so the three show the same figure.
  // Rulebook 1.40.0 (review r306 #2): the employment type from the person's stored pay record (the pay profile while
  // `privatePay` is on), never the unsaved draft and never the users document alone.
  const leaveEmployment = useLeaveEmployment(organization?.id, target ? savedUser.current ?? target : null)
  const leaveBankRange = useMemo(
    () => userLeaveBankHolidayRange({ user: target, employment: leaveEmployment.employment, orgDefaults: orgLeaveDefaults }),
    [target, leaveEmployment.employment, orgLeaveDefaults]
  )
  const leaveBank = useOrgBankHolidays(
    dateFromLeaveDayKey(leaveBankRange.startDayKey),
    dateFromLeaveDayKey(leaveBankRange.endDayKey),
    { years: leaveBankRange.years }
  )
  const leaveBankDayKeys = leaveBank.holidays.map((holiday) => holiday.date).join(',')
  // Rulebook 1.40.0: the person's adjustments (empty when this viewer may not read them).
  const leaveAdjustmentsRead = useAnnualLeaveAdjustments(organization?.id, target?.id)
  const leaveAdjustments = leaveAdjustmentsRead.adjustments
  const leaveBalance = useMemo(
    () =>
      userLeaveBalance({
        user: target,
        employment: leaveEmployment.employment,
        bookings: personLeave,
        orgDefaults: orgLeaveDefaults,
        bankHolidayDayKeys: leaveBankDayKeys ? leaveBankDayKeys.split(',') : [],
        adjustments: leaveAdjustments,
      }),
    [target, leaveEmployment.employment, personLeave, orgLeaveDefaults, leaveBankDayKeys, leaveAdjustments]
  )
  const leaveNotes = annualLeaveBalanceNotes(leaveBalance, {
    showsEmploymentType: leaveBalanceShowsEmploymentType(currentUser, target, users),
  })


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
    // 1.36.0 (FU-5): every id the person's history may be filed under — `personIdSet` over the roster (same-email
    // documents, former invite ids) and every `operatives` row on their email (`bookingIdsForAccount`), not one row.
    // 1.34.0: people with no email (ghosts) never share rate history through the empty email (`personIdSet` folds
    // on a non-empty email only).
    const ids = personRateHistoryIds(target, operatives, { roster: users })
    return mergedDayRateEntries(rateHistory, ids.userIds, ids.operativeIds)
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
        {
          creatorUserId: (organization as { creatorUserId?: string } | null)?.creatorUserId ?? null,
          // 1.31.0 (owner decision 7): a manager with the Operatives permission deletes operatives.
          actorManagesOperatives: canManageOperatives({ ...currentUser.permissions, role: currentUser.role }),
        }
      )
  )

  // Rulebook 1.31.0 (owner decision 7): a manager with the Operatives permission manages operatives (never a manager,
  // an admin or themselves) — deactivate and delete here; the security rules allow the same.
  const mayManageAsOperativesManager = Boolean(
    target &&
      currentUser &&
      !canAdminTools &&
      target.id !== currentUser.id &&
      canManageOperatives({ ...currentUser.permissions, role: currentUser.role }) &&
      currentAccountType(target) === 'operative'
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

  // Rulebook 1.34.0 §11: a ghost is always self-employed and has no login, timesheets, email or phone.
  const ghostTarget = Boolean(target && isGhostUser(target))
  const showEmploymentType = target && canEditMatrix && !target.isSuperAdmin && !ghostTarget
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
    !ghostTarget &&
    canEditMatrix &&
    (target.permissions.operativeMode || target.permissions.manager) &&
    !target.permissions.adminAccess &&
    !target.isSuperAdmin

  const lineManagerFieldShown = Boolean(
    target &&
      showSetupCard &&
      (target.permissions.operativeMode || target.permissions.manager || target.permissions.adminAccess)
  )

  // Rulebook 1.33.0 §11 (`canChangeLineManager`): admins change anyone's line manager; an Operatives-toggle manager
  // only on an operative's invitation they sent that is not accepted yet (adding is Add User). Otherwise locked.
  const [sentInvitation, setSentInvitation] = useState<SentInvitation | null>(null)
  const invitationLookupEmail = target && !target.passwordSet && !canAdminTools ? target.email : ''
  useEffect(() => {
    setSentInvitation(null)
    if (!invitationLookupEmail || !organization?.id || !currentUser?.id) return
    let cancelled = false
    loadSentInvitation({
      organizationId: organization.id,
      uid: currentUser.id,
      email: invitationLookupEmail,
      senderEmail: currentUser.email,
    })
      .then((row) => {
        if (!cancelled) setSentInvitation(row)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [invitationLookupEmail, organization?.id, currentUser?.id, currentUser?.email])
  const mayChangeLineManager = Boolean(
    target &&
      currentUser &&
      canChangeLineManager(
        { ...currentUser.permissions, id: currentUser.id, formerUserIds: currentUser.formerUserIds ?? [], role: currentUser.role, isSuperAdmin: currentUser.isSuperAdmin },
        { ...target.permissions, role: target.role, isSuperAdmin: target.isSuperAdmin },
        { invitation: sentInvitation }
      )
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

  /**
   * Rulebook 1.31.0 `lineManagerChangeBlock`: true (and the reports listed) when `change` would leave people without
   * their line manager — the save is refused until they have another one.
   */
  const lineManagerBlocks = (person: User, change: PersonAccessChange): boolean => {
    const block = lineManagerChangeBlock({ person: person as never, roster: rosterDocs as never, change })
    if (!block.blocked) {
      setReportsBlock(null)
      return false
    }
    setReportsBlock(block.reports)
    setError(block.message)
    return true
  }

  /** Rulebook 1.31.0 `jobManagerRemovalWrites`: off every job they manage after an operative / deactivate / delete change. */
  const removeFromJobs = async (person: User, change: PersonAccessChange) => {
    if (!organization?.id) return
    try {
      const count = await removeFromManagedJobs(person, change, organization.id, rosterDocs)
      if (count > 0) setSuccess(`Removed as manager from ${count === 1 ? '1 job' : `${count} jobs`}.`)
    } catch (err) {
      setError(err instanceof Error ? `Saved, but removing them from their jobs failed: ${err.message}` : 'Removing them from their jobs failed.')
    }
  }

  const runSave = async () => {
    if (!target || !organization?.id || !canEdit) return

    // `lineManagerRequiredError(user, roster)`: every operative and manager needs an active line manager, whatever
    // the self-book permission; 1.28.0: an admin may have none only with both self-manage toggles on.
    // Checked on the person as it will be saved (draft account type and permissions included).
    const asSaved =
      draftAccountType && draftTypePermissions
        ? { ...applyAccountType(target, draftAccountType), permissions: draftTypePermissions }
        : target
    const levelChange: PersonAccessChange | null =
      draftAccountType && draftAccountType !== currentAccountType(target) ? { kind: 'level', to: draftAccountType } : null
    const deactivating = savedUser.current?.isActive !== false && target.isActive === false
    if (levelChange && lineManagerBlocks(target, levelChange)) return
    if (deactivating && lineManagerBlocks(target, { kind: 'deactivate' })) return
    // Rulebook 1.33.0 §11: a line manager once set is changed only by an admin (`canChangeLineManager`).
    if (!mayChangeLineManager && lineManagerChanged(savedUser.current, asSaved)) {
      setLineManagerError(LINE_MANAGER_LOCKED_MESSAGE)
      return
    }
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
      // Rulebook 1.40.0 (13 Nov item 18): "immediately" stores today in the organisation zone.
      timeZone: organizationTimeZone,
    })
    toSave = {
      ...toSave,
      employmentType: employment.employmentType,
      employmentTypeTransitionFrom: employment.employmentTypeTransitionFrom || undefined,
      employmentTypeEffectiveAt: employment.employmentTypeEffectiveAt || undefined,
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
        // Every id the stored history may be filed under: read once from the person as stored (`savedUser`, the
        // loaded profile), never from the email typed in this save — a new email would name another person's rows.
        const historyIds = personRateHistoryIds(savedUser.current ?? previous, operatives, { roster: users })
        payHistoryRows = payHistoryBatchRows({
          history: await loadOperativeDayRateHistoryOrNull(organization.id),
          userId: toSave.id,
          // The row keeps one `operativeId` (the linked catalogue row, as before); the "history loaded and empty?"
          // test reads every id the person's history may be under (1.36.0, FU-5), so no duplicate seed row.
          operativeId: findOperativeForUser(toSave, operatives)?.id,
          historyUserIds: historyIds.userIds,
          historyOperativeIds: historyIds.operativeIds,
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
        const typeNote = await changeAccountType(previous, draftAccountType, organization.id, rosterDocs, draftTypePermissions)
        if (typeNote) setSuccess(typeNote)
        // The type is saved: the profile save below sends only the other edits, never the type fields again.
        if (profileBaseline) {
          const typed = applyAccountType(cloneUser(profileBaseline), draftAccountType)
          profileBaseline = { ...typed, permissions: draftTypePermissions }
        }
      } else if (accountTypeRepair) {
        // Rulebook 1.12.2 `accountTypeSyncState`: a user type only partly saved (older iOS build, interrupted save) is
        // finished on every document from the profile's type.
        await changeAccountType(previous, accountTypeRepair, organization.id, rosterDocs, previous.permissions)
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
      setSaved(true)
      window.setTimeout(() => setSaved(false), 3000)
      setSuccess(emailChangeNote ?? (toSave.isActive ? 'Profile saved.' : 'User deactivated.'))
      if (emailChangeNote) setTarget({ ...toSave })
      void setUserActive(toSave.id, toSave.isActive, organization.id, rosterDocs).catch(() => undefined)
      void syncLinkedOperative(organization.id, toSave, operatives).catch(() => undefined)
      if (draftAccountType === 'operative' && currentAccountType(previous) !== 'operative') {
        await removeFromJobs(previous, { kind: 'level', to: 'operative' })
      } else if (previous.isActive !== false && toSave.isActive === false) {
        await removeFromJobs(previous, { kind: 'deactivate' })
      }
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
    if (!target || !(canAdminTools || mayManageAsOperativesManager) || activeSaving || target.isSuperAdmin) return
    const previous = target
    const next = !target.isActive
    if (!next && lineManagerBlocks(target, { kind: 'deactivate' })) return
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
      await setUserActive(target.id, next, organization?.id, rosterDocs)
      if (savedUser.current) savedUser.current = { ...savedUser.current, isActive: next }
      if (!next) await removeFromJobs(previous, { kind: 'deactivate' })
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
    if (!target || !mayDeleteTarget) return
    setConfirmDelete(false)
    if (lineManagerBlocks(target, { kind: 'delete' })) return
    setBusyAction('delete')
    try {
      await deleteUser(target.id, { organizationId: organization?.id, email: target.email, roster: rosterDocs })
      await removeFromJobs(target, { kind: 'delete' })
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
      await transferSuperAdmin(organization.id, currentUser.id, nextUserId, rosterDocs)
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
    if (accountType !== currentAccountType(target) && lineManagerBlocks(target, { kind: 'level', to: accountType })) return
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
      const typeNote = await changeAccountType(target, accountType, organization.id, rosterDocs, next.permissions)
      if (accountType === 'operative' && currentAccountType(target) !== 'operative') await removeFromJobs(target, { kind: 'level', to: 'operative' })
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

  if (loading) return <RouteLoading variant="form" />

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
  const dirty =
    Boolean(target) &&
    baseline != null &&
    (taxDirty ||
      accountTypeRepair != null ||
      profileSnapshot(target, draftAccountType, draftTypePermissions) !== baseline)
  const pageTitle = currentAccountType(target) === 'operative' ? 'Edit operative' : 'Edit user'
  const status = rosterStatusLabel(target)

  return (
    <form onSubmit={handleSave} className="pu-page up-page">
      {payDialogs}
      {employmentDialogs}
      <ProfileBack
        onClick={() => {
          if (saving || typeSaving) return
          navigateBack(backHref)
        }}
        pending={backPending}
      />

      <ProfileBand
        avatar={<UserAvatar user={target} size={64} className="up-avatar-ring" gradient="from-[#7F77DD] to-[#534AB7]" />}
        eyebrow={pageTitle}
        name={`${target.firstName} ${target.surname}`}
        chips={[
          { label: roleLabel(target), tone: target.isSuperAdmin ? 'super' : undefined },
          target.passwordSet ? { label: 'Verified', dot: 'green' } : { label: 'Pending', dot: 'amber', tone: 'warn' },
          { label: status, dot: status === 'Active' ? 'blue' : 'slate' },
        ]}
        aside={
          canEdit && dirty ? (
            <button
              type="button"
              disabled={saving || typeSaving || payReloading}
              onClick={() => handleSave()}
              className="pu-btn primary"
            >
              {saving || typeSaving ? 'Saving…' : 'Save'}
            </button>
          ) : canEdit ? (
            <SaveState>No changes</SaveState>
          ) : (
            <SaveState tone="view">View only</SaveState>
          )
        }
      />

      {error && <ProfileBanner tone="red">{error}</ProfileBanner>}
      {reportsBlock && reportsBlock.length > 0 ? (
        <ProfileBanner tone="amber">
          <ul>
            {reportsBlock.map((report) => (
              <li key={report.id}>
                <Link href={`/dashboard/users/${encodeURIComponent(report.id)}`}>{report.name}</Link>
              </li>
            ))}
          </ul>
        </ProfileBanner>
      ) : null}
      {canEdit && accountTypeRepair && !draftAccountType ? (
        <ProfileBanner tone="amber">{ACCOUNT_TYPE_OUT_OF_SYNC_MESSAGE}</ProfileBanner>
      ) : null}
      {success && !saved && <ProfileBanner tone="green">{success}</ProfileBanner>}
      {typeSaving && <ProfileBanner tone="blue">Saving account type…</ProfileBanner>}
      {draftAccountType && (
        <ProfileBanner tone="blue">
          Account type will change to <strong className="capitalize">{draftAccountType}</strong> when you press Save.
        </ProfileBanner>
      )}

      {/* Identity */}
      <FormSection title="User details" icon="user" tone="blue">
        <FieldGrid>
          <Field label="First name">
            <Input
              value={target.firstName}
              disabled={!canEditIdentity}
              onChange={(e) => setTarget({ ...target, firstName: e.target.value })}
            />
          </Field>
          <Field label="Surname">
            <Input
              value={target.surname}
              disabled={!canEditIdentity}
              onChange={(e) => setTarget({ ...target, surname: e.target.value })}
            />
          </Field>
          {ghostTarget ? (
            <Field label="App login" hint={target.email ? `Invitation sent to ${target.email}.` : 'An admin can give app access from their profile.'}>
              <Input value={ghostBadgeLabel(target)} disabled />
            </Field>
          ) : (
          <>
          <Field label="Email">
            <Input
              type="email"
              value={target.email}
              disabled={!canEditIdentity}
              onChange={(e) => setTarget({ ...target, email: e.target.value })}
            />
          </Field>
          <Field label="Mobile number">
            <Input
              value={target.mobileNumber || ''}
              disabled={!canEditIdentity}
              onChange={(e) => setTarget({ ...target, mobileNumber: e.target.value })}
            />
          </Field>
          <Field label="Last active">
            <Input
              value={target.lastSeenAt ? format(target.lastSeenAt, "d MMM yyyy 'at' HH:mm") : '—'}
              disabled
            />
          </Field>
          </>
          )}
          {!canEdit && (
            <Field label="Trade type">
              <Input value={displayTradeType(target.tradeTypePreset, target.tradeTypeCustom)} disabled />
            </Field>
          )}
          {showEmploymentType && (
            <>
              <Field label="Employment type">
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
              </Field>
              <Field
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
              </Field>
            </>
          )}
        </FieldGrid>
      </FormSection>

      {showSetupCard && (
        <FormSection
          title={setupSectionTitle(target)}
          icon={setupSectionIcon(target)}
          tone={target.isSuperAdmin ? 'blue' : 'purple'}
        >
          <FieldGrid>
              {(target.permissions.operativeMode || target.permissions.manager || target.permissions.adminAccess) && (
                <Field
                  wide
                  label="Line manager(s)"
                  hint={
                    !mayChangeLineManager
                      ? LINE_MANAGER_LOCKED_MESSAGE
                      : mayHaveNoLineManager
                      ? 'Choose No line manager when this admin has none — Annual Leave Management and Timesheet self-sign must then be on (PAYE: Annual Leave Management).'
                      : 'Required for operatives and managers.'
                  }
                >
                  <Select
                    value={lineManagerSelectedIds(target as never, users as never)[0] ?? displayedLineManagerId(target)}
                    disabled={!canEdit || !mayChangeLineManager || saving || typeSaving}
                    onChange={(e) => {
                      setLineManagerError(null)
                      setTarget(userWithLineManagerChoice(target, e.target.value))
                    }}
                  >
                    {/* "No line manager" only for an admin or super admin (`lineManagerOptions`); enough only with both self-manage toggles on. */}
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
                    <p role="alert" className="up-err">
                      {lineManagerError}
                    </p>
                  ) : null}
                </Field>
              )}

              {/* Rulebook 1.32.0 §8: the rate and its history only for viewers `canViewPersonPay` allows (profile context). */}
              {canViewPersonPay(currentUser as never, target as never, users as never) ? (
              <>
                <PayBasisFields
                  variant="profile"
                  {...payChoiceFromProfile(target)}
                  placeholder="manage"
                  disabled={!canEdit}
                  error={rateError}
                  onChange={(next) => {
                    setRateError(null)
                    setTarget({ ...target, ...payChoiceToRates(next.payBasis, next.amount) })
                  }}
                />
                {previousRateEntries.length > 0 ? (
                  <div className="up-f wide">
                    <PreviousRatesList entries={previousRateEntries} />
                  </div>
                ) : null}
              </>
              ) : null}

              <Field label="Trade type">
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
                </Field>
                {target.tradeTypePreset === 'Other' && (
                  <Field label="Custom trade">
                    <Input
                      value={target.tradeTypeCustom || ''}
                      disabled={!canEdit}
                      onChange={(e) => setTarget({ ...target, tradeTypeCustom: e.target.value })}
                    />
                  </Field>
                )}

              <p className="up-f-hint" style={{ gridColumn: '1 / -1' }}>
                Current trade:{' '}
                <b>{displayTradeType(target.tradeTypePreset, target.tradeTypeCustom)}</b>
              </p>
          </FieldGrid>
        </FormSection>
      )}

      {showQualifications ? (
        <FormSection title="Qualifications" icon="badge" tone="amber">
          <SectionBlock>
              {qualError ? <p className="up-err">{qualError}</p> : null}
              <OperativeQualificationsEditor
                variant="profile"
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
          </SectionBlock>
        </FormSection>
      ) : null}

      {/* Annual leave access */}
      {/* Owner decision 9 (14 Nov): "Annual leave in app" and "Annual leave" are one section; content unchanged and
          shown or hidden exactly as before (the allowance toggle with `showAnnualLeave`, the rest only while it is on). */}
      {showAnnualLeave && (
        <FormSection title="Annual leave" icon="sun" tone="amber">
          <ToggleRow
            title={ANNUAL_LEAVE_ALLOWANCE_COPY.toggleTitle}
            descriptions={[ANNUAL_LEAVE_ALLOWANCE_COPY.toggleDescription, ANNUAL_LEAVE_ALLOWANCE_COPY.toggleNote]}
            control={
              <Switch
                label={ANNUAL_LEAVE_ALLOWANCE_COPY.toggleTitle}
                checked={target.annualLeaveEnabled !== false}
                disabled={!canEdit}
                onChange={(checked) => {
                  setTarget({ ...target, annualLeaveEnabled: checked })
                }}
              />
            }
          />

      {/* Annual leave entitlement */}
      {target.annualLeaveEnabled !== false && (
        <>
            <FieldGrid>
              <Field label="Days per year">
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
              </Field>
              <Field
                label="Company leave year"
                hint="Runs from the first day of the start month through the last day of the end month (e.g. April → March)."
              >
                <div className="up-months">
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
                  <em aria-hidden="true">→</em>
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
              </Field>
              {/* Rulebook 1.13.0 §4.4 (Q4, `proRataLeaveAllowance`): the leave year they joined is pro rata. */}
              <Field
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
              </Field>
            </FieldGrid>
              <ToggleRow
                title="Carry unused days into next leave year"
                descriptions={["Unused allowance from the previous leave year is added to this year's balance."]}
                control={
                  <Switch
                    label="Carry unused days into next leave year"
                    checked={target.annualLeaveCarriesOver === true}
                    disabled={!canEdit}
                    onChange={(checked) => setTarget({ ...target, annualLeaveCarriesOver: checked })}
                  />
                }
              />
              {/* Rulebook 1.40.0 (owner decision 11 Nov H35): the "set remaining" box is replaced by adjustments with a
                  reason, added on the person's annual leave page (Annual leave → Team); a stored override still counts
                  until its leave year ends. */}
              <div className="up-remain">
                {/* The same remaining figure as the line beside it, large (display only). */}
                {!leaveAdjustmentsRead.error &&
                leaveBank.loaded &&
                leaveEmployment.ready &&
                leaveAdjustmentsRead.loaded &&
                leaveBalance.hasAllowance ? (
                  <div className="up-rnum" aria-hidden="true">
                    <b>{leaveBalance.remaining}</b>
                    <span>days remaining</span>
                  </div>
                ) : null}
                <div className="up-remain-text">
                <div>
                {leaveAdjustmentsRead.error
                  ? leaveAdjustmentsRead.error
                  : !leaveBank.loaded || !leaveEmployment.ready || !leaveAdjustmentsRead.loaded
                    ? 'Counting leave taken this year…'
                    : leaveBalance.hasAllowance
                      ? `Remaining this leave year: ${leaveBalance.remaining} (${leaveBalance.shownTaken} taken, ${leaveBalance.shownPending} awaiting approval${leaveBalance.adjustmentDays ? `, ${leaveBalance.adjustmentDays > 0 ? '+' : ''}${leaveBalance.adjustmentDays} adjusted` : ''}).${leaveNotes.notCounted ? ` ${leaveNotes.notCounted}` : ''}`
                      : `${leaveNotes.noAllowance ?? 'No paid allowance.'} ${leaveBalance.taken} days taken this leave year.`}
                </div>
                <p>
                  To add or take off days, open this person on{' '}
                  <Link href={`/dashboard/annual-leave?tab=team&person=${encodeURIComponent(target.id)}`}>
                    Annual leave → Team
                  </Link>{' '}
                  and choose Adjust leave. Each change needs a reason and is kept as history.
                </p>
                </div>
              </div>
        </>
      )}
        </FormSection>
      )}

      {/* Employment & timesheets */}
      {showPayrollFields && (
        <FormSection title="Employment & timesheets" icon="sheet" tone="blue">
              <ToggleRow
                title="Timesheets enabled"
                descriptions={['Allow this person to log and submit timesheets.']}
                control={
                  <Switch
                    label="Timesheets enabled"
                    checked={target.timesheetsEnabled === true}
                    disabled={!canEdit}
                    onChange={(checked) => setTarget({ ...target, timesheetsEnabled: checked })}
                  />
                }
              />
              {canViewTaxIds ? (
                <div>
                  <FieldGrid>
                    {(['vatNumber', 'utrNumber'] as const).map((field) => {
                      const saved = taxIds?.[field] ?? ''
                      const draft = taxDraft[field]
                      const shown = showTaxIds ? saved : maskSensitiveValue(saved)
                      return (
                        <Field
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
                          <div className="up-payrow">
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
                                className="pu-btn"
                                onClick={() => setTaxDraft((current) => ({ ...current, [field]: '' }))}
                              >
                                Remove
                              </button>
                            ) : null}
                          </div>
                        </Field>
                      )
                    })}
                  </FieldGrid>
                  {taxIds && (taxIds.utrNumber || taxIds.vatNumber) ? (
                    <div className="up-block" style={{ paddingTop: 0 }}>
                      <button type="button" className="up-lk" style={{ alignSelf: 'flex-start' }} onClick={() => setShowTaxIds((v) => !v)}>
                        {showTaxIds ? 'Hide' : 'Show'} saved numbers
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : (
                <FieldGrid>
                  <Field label="VAT number">
                    <Input value={SENSITIVE_HELD_BY_ADMIN_COPY} disabled readOnly />
                  </Field>
                  <Field label="UTR number">
                    <Input value={SENSITIVE_HELD_BY_ADMIN_COPY} disabled readOnly />
                  </Field>
                </FieldGrid>
              )}
        </FormSection>
      )}

      {/* Account status */}
      {canAdminTools && (
        <FormSection title="Account status" icon="check" tone="green">
          <ToggleRow
            title="Active"
            descriptions={[ghostTarget ? 'Can be booked and shows in lists. A ghost has no app login.' : 'User can sign in and use the app.']}
            control={
              <Switch
                label="Active"
                checked={target.isActive}
                disabled={!canEdit || activeSaving}
                onChange={() => void handleToggleActive()}
              />
            }
          />
        </FormSection>
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
                rows={editUserPermissionRows(target, effectiveAccountType, effectivePermissions, currentUser?.id, users)}
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
        {ghostTarget ? null : target.passwordSet ? (
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
                      rows={editUserPermissionRows(target, effectiveAccountType, draftTypePermissions, currentUser?.id, users)}
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
            {target.isSuperAdmin || ghostTarget ? null : (
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
        {mayManageAsOperativesManager && (
          <>
            <ActionButton
              title={target.isActive ? 'Deactivate operative' : 'Reactivate operative'}
              subtitle={target.isActive ? 'Suspend access, keep history' : 'Restore sign-in access'}
              tone="amber"
              busy={activeSaving}
              onClick={handleToggleActive}
            />
            {!mayDeleteTarget ? null : (
              <ActionButton
                title="Delete operative"
                subtitle="Permanently remove this operative"
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
