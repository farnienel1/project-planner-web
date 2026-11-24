'use client'

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { reseedUntouchedPayFields, watchPayEditorPrivatePay, withPayFieldsFrom } from '@/lib/pay/payEditorSwitchReload'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/ui/ToastProvider'
import { FORMER_PERSON_RECORD_SKIPPED_MESSAGE } from '@/lib/canonical/formerPeople'
import { MEMBER_NAME_REFUSED_MESSAGE, canWriteMemberName } from '@/lib/canonical/memberNames'
import { usePendingNavigation } from '@/lib/navigation/usePendingNavigation'
import { EditUserSkeleton } from '@/components/users/profile-ui/skeletons'
import { useAuthStore } from '@/lib/stores/authStore'
import { resendInvitationEmail } from '@/lib/orgSetup/resendInvitation'
import { useOperativeStore } from '@/lib/stores/operativeStore'
import { useOrgUserStore, useRosterDocuments } from '@/lib/stores/siteAuditStore'
import { useUserStore } from '@/lib/stores/userStore'
import { loadSentInvitation, type SentInvitation } from '@/lib/orgSetup/openInvitation'
import { findOperativeForUser, operativeRecordForUser } from '@/lib/operatives/operativeRosterUtils'
import { personRateHistoryIds } from '@/lib/pay/personRateHistoryIds'
import { displayTradeType, STAFF_TRADE_TYPES } from '@/lib/staff/staffTradeTypes'
import {
  canEditIdentityDetails,
  canEditPermissionsMatrix,
  canEditTargetUser,
  canUseAdminAccountTools,
  isManageableOperative,
  roleLabel,
  setupSectionTitle,
} from '@/lib/staff/userEditPermissions'
import { rosterStatusLabel, samePersonIds } from '@/lib/staff/userRosterUtils'
import { userLineManagerRequiredError, userMayHaveNoLineManager } from '@/lib/annualLeave/holidayApprovalUtils'
import { UserAvatar } from '@/components/users/UserAvatar'
import { setupSectionIcon } from '@/lib/users/profileUi'
import { PayBasisFields, payChoiceFromProfile, payChoiceToRates } from '@/components/users/PayBasisFields'
import { maySetPayOf, userPayRateRequiredError } from '@/lib/staff/payRateRequired'
import { editUserAnnualLeaveSection, editUserEmploymentTypeSection, editUserTaxIdsSectionShown } from '@/lib/staff/editUserSections'
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
import { loadTaxIds, saveTaxIds, taxIdsValidationError } from '@/lib/sensitiveProfile/taxIdsService'
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
import { lastActiveText, personLastSeenAt } from '@/lib/users/lastActive'
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
import { canManageOperativesOnly, canManageOrganisationQualifications, staffAccountRole } from '@/lib/permissions'
import {
  LINE_MANAGER_LOCKED_MESSAGE,
  canChangeLineManager,
  canDeleteUser,
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
import { confirmWriteWithin, whenQueued } from '@/lib/works/watchWrite'
import {
  profileSaveNoticeFor,
  profileSaveStepFailedMessage,
  useProfileSaveNotice,
  type ProfileSaveTarget,
} from '@/lib/users/profileSaveNotice'
import { useWarnBeforeUnload } from '@/lib/client/useWarnBeforeUnload'
import { withTimeout, withTimeoutFallback } from '@/lib/client/withTimeout'
import { afterPrimaryWrite } from '@/lib/client/afterPrimaryWrite'
import { PROFILE_SAVE_READ_TIMEOUT_MS, PROFILE_SAVE_READ_TIMEOUT_MESSAGE } from '@/lib/users/profileSaveReads'
import { ProfileSaveStageError, sequenceProfileSave } from '@/lib/users/profileSaveSequence'
import { ActionPanel, ActionRow, Field, FieldGrid, FormSection, SectionBlock, Switch, ToggleRow, ProfileBack, ProfileBand, ProfileBanner, SaveState, ProfileIcon, type ProfileIconName } from '@/components/users/profile-ui'
import {
  Input,
  Select,
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

/** An account action row (`ActionRow`): same title, subtitle, busy state and handler as before; colour by consequence. */
function ActionButton({
  title,
  subtitle,
  tone = 'neutral',
  icon,
  busy,
  onClick,
}: {
  title: string
  subtitle?: string
  tone?: 'neutral' | 'amber' | 'red' | 'purple'
  icon: ProfileIconName
  busy?: boolean
  onClick: () => void
}) {
  return (
    <ActionRow
      title={title}
      subtitle={subtitle}
      tone={tone === 'neutral' ? 'blue' : tone}
      icon={icon}
      busy={busy}
      onClick={onClick}
    />
  )
}

/** Change user type chooser: icon and tile colour per option (display only). */
const ACCOUNT_TYPE_ICON: Record<'operative' | 'manager' | 'admin', ProfileIconName> = {
  operative: 'hat',
  manager: 'brief',
  admin: 'shield',
}
const ACCOUNT_TYPE_TONE: Record<'operative' | 'manager' | 'admin', 'amber' | 'purple' | 'blue'> = {
  operative: 'amber',
  manager: 'purple',
  admin: 'blue',
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
  const toast = useToast()
  const { navigate: navigateBack, pending: backPending } = usePendingNavigation()
  const { user: currentUser, organization, reloadSignedInProfile } = useAuthStore()
  const organizationTimeZone = useOrganizationTimeZone()
  const { users, userIdAliases, loadUsers, setListedUserActive, patchListedUser, removeListedUser } = useOrgUserStore()
  const { operatives, loadOperatives, patchOperativeQualifications } = useOperativeStore()
  const {
    getUser,
    saveUser,
    prepareSaveUser,
    setUserActive,
    deleteUser,
    sendPasswordReset,
    applyAccountType,
    prepareChangeAccountType,
    syncLinkedOperative,
    transferSuperAdmin,
    removeFromManagedJobs,
  } = useUserStore()
  // Rulebook 1.30.3 / 1.31.0 (audit finding 1): every write builder gets every users document of the organisation (the
  // unfolded roster), so a same-email copy is never missed by a type change, deactivation or the transfer.
  const rosterDocs = useRosterDocuments(organization?.id)
  const { bookings: holidayBookings, loadBookings: loadHolidays } = useHolidayStore()

  const [target, setTarget] = useState<User | null>(null)
  // The copy last loaded or saved. Saves write only what changed against it.
  const savedUser = useRef<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  // Owner answer 17 Nov (#371): a save the server has not confirmed within 15 s keeps this page open with an amber note
  // (red after `WRITE_UNCONFIRMED_AFTER_MS`); it returns to the list once the server confirms. The note lives in
  // `useProfileSaveNotice`, so the people list shows it too if the person leaves the page.
  const mountedRef = useRef(true)
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])
  const anySaveNotice = useProfileSaveNotice((state) => state.notice)
  // Second review of #371: the save this page is waiting on (queued, not answered yet). While it is set, Save and every
  // edit are off, and a late answer is applied only when it belongs to this save and this person.
  const [serverWaitSaveId, setServerWaitSaveId] = useState<number | null>(null)
  const serverWaitRef = useRef<number | null>(null)
  // The person this page shows, and whether it has unsaved edits (read by late answers).
  const personIdRef = useRef<string | null>(null)
  const dirtyRef = useRef(false)
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
  // This person's save note (this organisation only, review of #371), and a reload warning while it waits.
  const thisPersonNotice = profileSaveNoticeFor(anySaveNotice, organization?.id)
  const pageSaveNotice = thisPersonNotice && target && thisPersonNotice.personId === target.id ? thisPersonNotice : null
  // From the moment a batch is queued until the server answers (and while it reads "not confirmed"): Firestore keeps
  // queued writes in memory only, so a reload would lose them.
  useWarnBeforeUnload(
    serverWaitSaveId != null || pageSaveNotice?.status === 'pending' || pageSaveNotice?.status === 'unconfirmed'
  )
  // Nothing on this page can be edited or saved while one of its saves waits for the server (second review of #371).
  const saveLocked = serverWaitSaveId != null || pageSaveNotice?.status === 'pending'
  // What a late answer reads: the person on this page and whether it has edits not saved yet.
  const unsavedEdits =
    Boolean(target) &&
    baseline != null &&
    (taxDraft.utrNumber !== null ||
      taxDraft.vatNumber !== null ||
      accountTypeRepair != null ||
      (target ? profileSnapshot(target, draftAccountType, draftTypePermissions) !== baseline : false))
  useEffect(() => {
    personIdRef.current = target?.id ?? null
    dirtyRef.current = unsavedEdits
  }, [target?.id, unsavedEdits])
  const canEditIdentity = target ? canEditIdentityDetails(currentUser, target) : false
  // Rulebook 1.82.0 §11 "Names per organisation" (`memberNameEditPlan`): the name edited here is always this company's
  // own name for them (its `memberNames` entry); only an admin, the person, or an Operatives manager for an operative
  // may set it (the security rules hold the same).
  const canEditName =
    canEditIdentity &&
    canWriteMemberName({
      writerUserId: currentUser?.id,
      subjectUserId: target?.id,
      writerIsAdmin: Boolean(currentUser && (currentUser.isSuperAdmin || currentUser.permissions.adminAccess)),
      writerManagesOperative:
        Boolean(currentUser && currentUser.permissions.operatives && currentUser.permissions.manager && !currentUser.permissions.operativeMode) &&
        Boolean(target && (target.permissions.operativeMode || target.role === 'operative')),
    })
  const nameHint = target
    ? canEditName
      ? `The name ${organization?.name || 'this company'} uses for them. Their other companies keep their own.`
      : MEMBER_NAME_REFUSED_MESSAGE
    : undefined
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
          // Where the security rules accept an Operatives manager's writes (`canManageOperativesOnly`).
          actorManagesOperatives: canManageOperativesOnly(currentUser),
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
      // Rulebook `canManageOperatives`, only where firestore.rules `managerMayManageOperative` accepts it.
      canManageOperativesOnly(currentUser) &&
      isManageableOperative(target, currentUser.organizationId)
  )

  const showSetupCard =
    target &&
    canEditMatrix &&
    (target.permissions.operativeMode || target.permissions.manager || target.permissions.adminAccess)

  // 17 Nov (owner bug): never hidden for the Super Admin — `editUserAnnualLeaveSection` / `editUserEmploymentTypeSection`
  // decide every level the same way; locked sections show their reason.
  const annualLeaveSection = editUserAnnualLeaveSection(currentUser, target)
  const showAnnualLeave = annualLeaveSection.shown

  // Rulebook 1.34.0 §11: a ghost is always self-employed and has no login, timesheets, email or phone.
  const ghostTarget = Boolean(target && isGhostUser(target))
  const employmentTypeSection = editUserEmploymentTypeSection(currentUser, target, users)
  const showEmploymentType = employmentTypeSection.shown
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

  // Review of #385: VAT / UTR follow the rulebook (`canViewSensitiveProfile`, §12) — the person and admins — for every
  // level, the Super Admin and admins included; before, they sat inside the operative / manager-only block above.
  // Viewers who may edit the person but not see them keep "Held by admin" where they saw it before.
  const showTaxIdFields = editUserTaxIdsSectionShown({
    target,
    viewerMaySee: canViewTaxIds,
    shownBefore: Boolean(showPayrollFields),
  })

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
    if (saveInFlight.current || saving || typeSaving || payReloadingRef.current || serverWaitRef.current != null) return
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

  const beginServerWait = (saveId: number) => {
    serverWaitRef.current = saveId
    setServerWaitSaveId(saveId)
  }
  const endServerWait = (saveId: number) => {
    if (serverWaitRef.current !== saveId) return
    serverWaitRef.current = null
    if (mountedRef.current) setServerWaitSaveId(null)
  }
  /** Still on this person's page (a late answer never navigates or rewrites another person's page). */
  const stillOnPerson = (personId: string) => mountedRef.current && personIdRef.current === personId
  const reportStepFailure = (noticeTarget: ProfileSaveTarget, step: string) => (error: unknown) => {
    const reason = error instanceof Error && error.message ? error.message : 'the server refused it.'
    useProfileSaveNotice.getState().failed(noticeTarget, profileSaveStepFailedMessage(noticeTarget.name, step, reason))
  }

  /**
   * Every write from this page goes through here (second review of #371): it is waited for at most
   * `WRITE_CONFIRM_TIMEOUT_MS` — a refusal in that time is thrown, so the caller shows it and gives Save back; no answer
   * yet returns 'pending' and the amber note shows (red after `WRITE_UNCONFIRMED_AFTER_MS`). Call it straight after the
   * write is queued. A late answer runs `saved` / `refused` only when this page is still on that save and person.
   */
  const confirmPersonWrite = async (
    noticeTarget: ProfileSaveTarget,
    write: Promise<unknown>,
    handlers: {
      saved?: () => void
      refused?: (message: string) => void
      /** The note to show for a late refusal instead of the default "changes were not saved". */
      refusedNotice?: (message: string) => string | null
      pendingMessage?: string
    } = {}
  ): Promise<'saved' | 'pending'> => {
    beginServerWait(noticeTarget.saveId)
    const notices = useProfileSaveNotice.getState()
    let answeredLate = false
    let result: 'saved' | 'pending'
    try {
      result = await confirmWriteWithin(write, (outcome) => {
        if (outcome.status === 'unconfirmed') {
          notices.settled(noticeTarget, outcome)
          return
        }
        answeredLate = true
        const applies = stillOnPerson(noticeTarget.personId) && serverWaitRef.current === noticeTarget.saveId
        endServerWait(noticeTarget.saveId)
        if (outcome.status === 'saved') {
          notices.settled(noticeTarget, outcome)
          if (applies) handlers.saved?.()
          return
        }
        const custom = handlers.refusedNotice?.(outcome.message) ?? null
        if (custom) notices.failed(noticeTarget, custom)
        else notices.settled(noticeTarget, outcome)
        if (applies) handlers.refused?.(outcome.message)
      })
    } catch (error) {
      endServerWait(noticeTarget.saveId)
      throw error
    }
    if (result === 'saved') endServerWait(noticeTarget.saveId)
    // The answer may already have come in the moment between the time limit and here: never show a stale "waiting".
    else if (!answeredLate) notices.pending(noticeTarget, handlers.pendingMessage)
    return result
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
    // Everything a late refusal puts back (second review of #371): the stored copy, the draft type, the tax draft and
    // the starting pay figures, so the next Save sends the same change again — the type with it — never half of it.
    const storedBefore = savedUser.current
    const draftTypeBefore = draftAccountType
    const draftPermissionsBefore = draftTypePermissions
    const taxDraftBefore = taxDraft
    const taxIdsBefore = taxIds
    const originalDayRateBefore = originalDayRate
    const originalPayBasisBefore = originalPayBasis
    const originalEmploymentTypeBefore = originalEmploymentType
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
    // (verifyBeforeUpdateEmail, sent by Project Planner from 17 Nov: requestEmailChange); this save keeps the stored email and the sign-in sync writes the new one later.
    let emailChangeNote: string | null = null
    if (currentUser?.id === target.id && savedUser.current) {
      const action = selfEmailChangeAction({ storedEmail: savedUser.current.email, nextEmail: target.email })
      if (action === 'invalid') {
        setError(SELF_EMAIL_INVALID_MESSAGE)
        return
      }
      if (action === 'verifyBeforeUpdate') {
        try {
          const [{ requestEmailChange }, { getFirebaseAuth }] = await Promise.all([
            import('@/lib/auth/requestAccountEmails'),
            import('@/lib/firebase/ensureFirebase'),
          ])
          const signedIn = getFirebaseAuth().currentUser
          if (!signedIn) throw new Error('Sign in again to change your email.')
          // The branded confirm-new-email (owner request 17 Nov); Firebase's own email only when the server cannot send.
          await requestEmailChange(signedIn, target.email.trim().toLowerCase())
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
    let confirmed: 'saved' | 'pending' = 'saved'
    const restoreBeforeSave = () => {
      savedUser.current = storedBefore
      if (storedBefore) {
        patchListedUser(storedBefore)
        setListedUserActive(storedBefore.id, storedBefore.isActive)
      }
      setTarget(previous)
      setDraftAccountType(draftTypeBefore)
      setDraftTypePermissions(draftPermissionsBefore)
      setBaseline(previousBaseline)
      setTaxDraft(taxDraftBefore)
      setTaxIds(taxIdsBefore)
      setOriginalDayRate(originalDayRateBefore)
      setOriginalPayBasis(originalPayBasisBefore)
      setOriginalEmploymentType(originalEmploymentTypeBefore)
      setSaved(false)
      setSuccess(null)
    }
    try {
      // One overall budget for every read before the batches are queued (second review of #371): the pay history and
      // the prepare step together never wait longer than `PROFILE_SAVE_READ_TIMEOUT_MS`.
      const readDeadline = Date.now() + PROFILE_SAVE_READ_TIMEOUT_MS
      const readTimeLeft = () => Math.max(0, readDeadline - Date.now())
      const taxNext =
        canViewTaxIds && taxDirty && currentUser?.id
          ? {
              utrNumber: taxDraft.utrNumber ?? taxIds?.utrNumber ?? '',
              vatNumber: taxDraft.vatNumber ?? taxIds?.vatNumber ?? '',
            }
          : null
      const writerId = currentUser?.id ?? ''
      // Checked before anything is queued (second review of #371): a tax id refusal never comes after the profile.
      const taxError = taxNext ? taxIdsValidationError(taxNext, writerId) : null
      if (taxError) throw new Error(taxError)
      // Rulebook 1.10.0 §8 (`payRateChangeWrites`): pay history rows go in the profile's batch; a history that did
      // not load refuses the save instead of writing a duplicate seed row.
      const nextRate = (toSave.payBasis === 'hourly' ? toSave.hourlyRate : toSave.dayRate) ?? null
      const rateChanged = (originalDayRate ?? null) !== nextRate || (originalPayBasis ?? null) !== (toSave.payBasis ?? null)
      let payHistoryRows: Array<{ id: string; fields: Record<string, unknown> }> = []
      if (rateChanged) {
        const { loadOperativeDayRateHistoryOrNull, payHistoryBatchRows } = await import('@/lib/timesheets/dayRateHistoryStorage')
        // Every id the stored history may be filed under: read once from the person as stored (`savedUser`, the
        // loaded profile), never from the email typed in this save — a new email would name another person's rows.
        const historyIds = personRateHistoryIds(storedBefore ?? previous, operatives, { roster: users })
        payHistoryRows = payHistoryBatchRows({
          // Bounded (review of #371): a history that does not load in time is "not loaded", so the save is refused
          // with PAY_HISTORY_NOT_LOADED_MESSAGE (nothing written) instead of waiting with no limit.
          history: await withTimeoutFallback(loadOperativeDayRateHistoryOrNull(organization.id), readTimeLeft(), null),
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
      let profileBaseline = storedBefore
      const typeChange = Boolean(
        draftAccountType && draftTypePermissions && draftAccountType !== currentAccountType(previous)
      )
      if (typeChange && draftAccountType && draftTypePermissions && profileBaseline) {
        // The type is saved by the type batch first: the profile batch sends only the other edits, never the type
        // fields again.
        const typed = applyAccountType(cloneUser(profileBaseline), draftAccountType)
        profileBaseline = { ...typed, permissions: draftTypePermissions }
      }
      // Review of #371: the reads come first, bounded, and nothing is written if they fail or time out.
      const prepared = await withTimeout(
        (async () => {
          const typePlan =
            typeChange && draftAccountType && draftTypePermissions
              ? // Rulebook 1.11.0 `accountTypeChangeWrites`: the new type on every document that decides it here, in
                // one batch (1.12.2).
                await prepareChangeAccountType(previous, draftAccountType, organization.id, rosterDocs, draftTypePermissions)
              : accountTypeRepair
                ? // Rulebook 1.12.2 `accountTypeSyncState`: a user type only partly saved (older iOS build, interrupted
                  // save) is finished on every document from the profile's type.
                  await prepareChangeAccountType(previous, accountTypeRepair, organization.id, rosterDocs, previous.permissions)
                : null
          const profilePlan = await prepareSaveUser(toSave, organization.id, previous.email, {
            baseline: profileBaseline,
            payHistoryRows,
          })
          return { typePlan, profilePlan }
        })(),
        readTimeLeft(),
        PROFILE_SAVE_READ_TIMEOUT_MESSAGE
      )
      // Second review of #371: the batches are queued one after another, each only once the one before is confirmed —
      // the type, then the profile, then the tax ids (`sequenceProfileSave`, the order before the split). A refused or
      // unanswered type batch never lets the profile's fields go out on their own.
      const typePlan = prepared.typePlan
      const sequence = sequenceProfileSave({
        type: typePlan ? () => typePlan.commit() : null,
        profile: () => prepared.profilePlan.commit(),
        tax: taxNext ? () => saveTaxIds(toSave.id, taxNext, writerId) : null,
      })
      const persist = sequence.all
      // Owner bug 17 Nov: wait at most `WRITE_CONFIRM_TIMEOUT_MS`; a refusal in that time is shown here and Save comes
      // back; otherwise this page stays open, locked, with the amber note until the server answers (owner answer 17
      // Nov), red once `WRITE_UNCONFIRMED_AFTER_MS` has passed.
      const noticeTarget: ProfileSaveTarget = {
        saveId: Date.now(),
        organizationId: organization.id,
        personId: toSave.id,
        name: `${toSave.firstName} ${toSave.surname}`.trim() || toSave.email,
      }
      let failure: ProfileSaveStageError | null = null
      persist.catch((error: unknown) => {
        if (error instanceof ProfileSaveStageError) failure = error
      })
      confirmed = await confirmPersonWrite(noticeTarget, persist, {
        saved: () => {
          // Confirmed while the person is still on this page and nothing was edited since: close it, as for any save.
          if (!dirtyRef.current) router.push(hubHref || backHref)
        },
        refusedNotice: () => {
          const stage = failure as ProfileSaveStageError | null
          return stage?.partial ? `${noticeTarget.name}: ${stage.message}` : null
        },
        // A late refusal: everything is put back, so the edits stay on screen and Save sends the same change again.
        refused: restoreBeforeSave,
      })
      if (typePlan?.note) setSuccess(typePlan.note)
      savedUser.current = toSave
      if (taxNext) {
        setTaxIds({ ...taxNext, source: 'private' })
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
      if (confirmed === 'saved') {
        setSaved(true)
        window.setTimeout(() => setSaved(false), 3000)
        setSuccess(emailChangeNote ?? (toSave.isActive ? 'Profile saved.' : 'User deactivated.'))
      } else {
        // Not confirmed yet: the amber note says so; no "Saved" until the server answers (owner answer 17 Nov).
        setSuccess(emailChangeNote)
      }
      if (emailChangeNote) setTarget({ ...toSave })
      // The follow-up writes run off the profile batch's own confirmation — never when it was refused or has not
      // reached the server. A failure is reported on the note.
      const reportStep = (step: string) => reportStepFailure(noticeTarget, step)
      const afterProfile = (label: string, step: string, work: () => Promise<unknown>) =>
        afterPrimaryWrite(
          label,
          sequence.profile.then(
            () => work().catch((error: unknown) => {
              reportStep(step)(error)
              throw error
            }),
            // The profile batch itself failed: already reported by its own notice; this step never runs.
            () => undefined
          )
        )
      // Only when this save changes it (second review of #371): it also writes the membership, which another
      // company's profile refuses — never run it on a save that leaves the active flag alone.
      const wasActive = (storedBefore ?? previous).isActive !== false
      if (wasActive !== (toSave.isActive !== false)) {
        afterProfile('setUserActive', 'changing whether they are active', () =>
          setUserActive(toSave.id, toSave.isActive, organization.id, rosterDocs)
        )
      }
      afterProfile('syncLinkedOperative', 'updating their Operatives record', () =>
        syncLinkedOperative(organization.id, toSave, operatives)
      )
      // Off their jobs once the save is through (it runs on if this screen stops waiting — never blocks Save).
      const jobsChange: PersonAccessChange | null =
        draftAccountType === 'operative' && currentAccountType(previous) !== 'operative'
          ? { kind: 'level', to: 'operative' }
          : wasActive && toSave.isActive === false
            ? { kind: 'deactivate' }
            : null
      if (jobsChange) {
        const jobs = sequence.profile.then(
          () =>
            removeFromManagedJobs(previous, jobsChange, organization.id, rosterDocs).catch((error: unknown) => {
              reportStep('removing them from their jobs')(error)
              throw error
            }),
          () => undefined
        )
        afterPrimaryWrite('removeFromManagedJobs', jobs)
        // Waits a bounded time only when the profile is already confirmed; otherwise it runs on in the background.
        if (confirmed === 'saved') await confirmWriteWithin(jobs, () => undefined).catch(() => undefined)
      }
    } catch (err: unknown) {
      restoreBeforeSave()
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
    // Owner answer 17 Nov (#371): not confirmed yet — stay here with the note; it closes once the server confirms.
    if (confirmed === 'pending') return
    // Owner request (1.12.2): a saved profile closes and returns to the people list — only while still on this page.
    if (stillOnPerson(toSave.id)) router.push(hubHref || backHref)
  }

  const handlePasswordReset = async () => {
    if (!target?.passwordSet) return
    setBusyAction('reset')
    try {
      await sendPasswordReset(target, organization?.id)
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
      // Sends the existing invitation again (as iOS); never re-runs Add User or rewrites the placeholder.
      await resendInvitationEmail({
        organizationId: organization.id,
        organizationName: organization.name || '',
        person: target,
        actor: currentUser,
      })
      setSuccess(`Sign-up email sent to ${target.email}.`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to send sign-up email')
    } finally {
      setBusyAction(null)
    }
  }

  const handleToggleActive = async () => {
    if (!target || !(canAdminTools || mayManageAsOperativesManager) || activeSaving || target.isSuperAdmin) return
    if (serverWaitRef.current != null) return
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
    const revert = () => {
      if (savedUser.current) savedUser.current = { ...savedUser.current, isActive: previous.isActive }
      setTarget(previous)
      setListedUserActive(previous.id, previous.isActive)
      setBaseline(profileSnapshot(previous, null, null))
      setSuccess(null)
    }
    const noticeTarget: ProfileSaveTarget = {
      saveId: Date.now(),
      organizationId: organization?.id ?? '',
      personId: previous.id,
      name: `${previous.firstName} ${previous.surname}`.trim() || previous.email,
    }
    try {
      // Bounded like every save (second review of #371): confirmed within 15 s, else the amber note, red at 90 s.
      // Review of #371: the wait starts only once the write is queued, never during the reads before it.
      const { write } = await whenQueued((onQueued) => setUserActive(target.id, next, organization?.id, rosterDocs, { onQueued }))
      const orgId = organization?.id
      if (orgId) {
        // Follow-ups off the flag's own confirmation; a failure is reported on the note.
        if (!next) {
          afterPrimaryWrite(
            'removeFromManagedJobs',
            write.then(
              () =>
                removeFromManagedJobs(previous, { kind: 'deactivate' }, orgId, rosterDocs).then(
                  (count) => {
                    if (count > 0 && stillOnPerson(previous.id)) {
                      setSuccess(`Removed as manager from ${count === 1 ? '1 job' : `${count} jobs`}.`)
                    }
                  },
                  (error: unknown) => {
                    reportStepFailure(noticeTarget, 'removing them from their jobs')(error)
                    throw error
                  }
                ),
              () => undefined
            )
          )
        }
        afterPrimaryWrite('syncLinkedOperative', write.then(() => syncLinkedOperative(orgId, nextUser, operatives), () => undefined))
      }
      const confirmed = await confirmPersonWrite(noticeTarget, write, {
        refused: (message) => {
          revert()
          setError(message)
        },
      })
      if (savedUser.current) savedUser.current = { ...savedUser.current, isActive: next }
      if (confirmed === 'pending') setSuccess(null)
    } catch (err: unknown) {
      revert()
      setError(err instanceof Error ? err.message : 'Failed to update status')
    } finally {
      setActiveSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!target || !mayDeleteTarget) return
    if (serverWaitRef.current != null) return
    setConfirmDelete(false)
    if (lineManagerBlocks(target, { kind: 'delete' })) return
    setBusyAction('delete')
    const deleted = target
    const deletedName = `${deleted.firstName} ${deleted.surname}`.trim() || deleted.email
    const noticeTarget: ProfileSaveTarget = {
      saveId: Date.now(),
      organizationId: organization?.id ?? '',
      personId: deleted.id,
      name: deletedName,
    }
    // Back to the list only while still on this person's page (second review of #371).
    const backToList = () => {
      if (stillOnPerson(deleted.id)) router.push(hubHref || backHref)
    }
    try {
      // Bounded like every save (second review of #371): confirmed within 15 s, else the amber note, red at 90 s.
      // Review of #371: the wait starts only once the first batch is queued, never during the reads before it.
      const { write } = await whenQueued((onQueued) =>
        deleteUser(deleted.id, { organizationId: organization?.id, email: deleted.email, roster: rosterDocs, onQueued })
      )
      // Off the roster on this device as soon as the server confirms the delete (a late confirmation too), so lists
      // such as Settings → Warnings → Excluded users never keep showing them.
      void write.then(
        () => removeListedUser(deleted.id),
        () => undefined
      )
      // Rulebook 1.59.0 (review of #370, L1): say so when the former-person record was refused (the delete went ahead).
      void write.then(
        (outcome) => {
          if (outcome?.formerRecordSkipped) toast(FORMER_PERSON_RECORD_SKIPPED_MESSAGE, 9000)
        },
        () => undefined
      )
      // Off their jobs (secondary) once the delete is confirmed. A refusal is reported, never swallowed.
      let jobs: Promise<unknown> = Promise.resolve()
      if (organization?.id) {
        const orgId = organization.id
        jobs = write.then(
          () =>
            removeFromManagedJobs(deleted, { kind: 'delete' }, orgId, rosterDocs).catch((error: unknown) => {
              const reason = error instanceof Error && error.message ? error.message : 'the server refused it.'
              useProfileSaveNotice
                .getState()
                .failed(
                  { ...noticeTarget, saveId: Date.now() },
                  `${deletedName} was deleted, but removing them from their jobs failed: ${reason} Check their jobs' managers.`
                )
              throw error
            }),
          () => undefined
        )
        afterPrimaryWrite('removeFromManagedJobs', jobs)
      }
      const confirmed = await confirmPersonWrite(noticeTarget, write, {
        pendingMessage: `${deletedName}: delete sent from this device. Waiting for the server to confirm it — keep Project Planner open.`,
        refusedNotice: (message) => `${deletedName} was not deleted: ${message}`,
        saved: backToList,
        refused: (message) => setError(message),
      })
      if (confirmed === 'saved') {
        // Waits a bounded time for the job clean-up, then returns to the list while it finishes (owner bug 17 Nov).
        await confirmWriteWithin(jobs, () => undefined).catch(() => undefined)
        backToList()
      }
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
    if (!target || !organization?.id || typeSaving || payReloadingRef.current || serverWaitRef.current != null) return
    const previous = target
    const storedBefore = savedUser.current
    const draftTypeBefore = draftAccountType
    const draftPermissionsBefore = draftTypePermissions
    const showChangeTypeBefore = showChangeType
    const orgId = organization.id
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
    const noticeTarget: ProfileSaveTarget = {
      saveId: Date.now(),
      organizationId: orgId,
      personId: previous.id,
      name: `${previous.firstName} ${previous.surname}`.trim() || previous.email,
    }
    try {
      // Rulebook 1.11.0 `accountTypeChangeWrites`: users docs, `members.{uid}` and the membership together; the profile
      // save only after the type is confirmed, as before. Bounded like every save (second review of #371).
      // Review of #371: the reads run first (bounded); the wait starts only once the type batch is queued.
      const typePlan = await withTimeout(
        prepareChangeAccountType(previous, accountType, orgId, rosterDocs, next.permissions),
        PROFILE_SAVE_READ_TIMEOUT_MS,
        PROFILE_SAVE_READ_TIMEOUT_MESSAGE
      )
      const typeNote = typePlan.note
      const write = (async () => {
        await typePlan.commit()
        // Rulebook 1.11.0: a profile of another company is not rewritten; only this organisation's entry changed.
        if (!typeNote) await saveUser(next, orgId, previous.email, { baseline: next })
      })()
      if (accountType === 'operative' && currentAccountType(previous) !== 'operative') {
        afterPrimaryWrite(
          'removeFromManagedJobs',
          write.then(
            () =>
              removeFromManagedJobs(previous, { kind: 'level', to: 'operative' }, orgId, rosterDocs).catch((error: unknown) => {
                reportStepFailure(noticeTarget, 'removing them from their jobs')(error)
                throw error
              }),
            () => undefined
          )
        )
      }
      const confirmed = await confirmPersonWrite(noticeTarget, write, {
        refused: (message) => {
          savedUser.current = storedBefore
          if (storedBefore) patchListedUser(storedBefore)
          setTarget(previous)
          // As `restoreBeforeSave`: the chooser comes back as it was, so the same change can be sent again.
          setDraftAccountType(draftTypeBefore)
          setDraftTypePermissions(draftPermissionsBefore)
          setShowChangeType(showChangeTypeBefore)
          setBaseline(profileSnapshot(previous, null, null))
          setSuccess(null)
          setError(message)
        },
      })
      savedUser.current = next
      patchListedUser(next)
      setTarget(next)
      setDraftAccountType(null)
      setDraftTypePermissions(null)
      setShowChangeType(false)
      setBaseline(profileSnapshot(next, null, null))
      if (confirmed === 'saved') {
        setSuccess(typeNote ?? (accountType === 'admin' ? 'This user is now an administrator.' : `Account type set to ${accountType}.`))
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not change account type')
    } finally {
      setTypeSaving(false)
    }
  }

  if (loading) return <EditUserSkeleton />

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

      {/* Second review of #371: nothing can be edited or saved while a save on this page waits for the server. */}
      <fieldset
        disabled={saveLocked}
        aria-busy={saveLocked || undefined}
        style={{ display: 'contents', border: 0, margin: 0, padding: 0, minWidth: 0 }}
      >
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
      {pageSaveNotice ? (
        <ProfileBanner tone={pageSaveNotice.status === 'pending' ? 'amber' : 'red'}>{pageSaveNotice.message}</ProfileBanner>
      ) : null}
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
          <Field label="First name" hint={nameHint}>
            <Input
              value={target.firstName}
              disabled={!canEditName}
              onChange={(e) => setTarget({ ...target, firstName: e.target.value })}
            />
          </Field>
          <Field label="Surname">
            <Input
              value={target.surname}
              disabled={!canEditName}
              onChange={(e) => setTarget({ ...target, surname: e.target.value })}
            />
          </Field>
          {ghostTarget ? (
            <Field label="App login" hint={target.email ? `Invitation sent to ${target.email}.` : 'An admin can give app access from their profile.'}>
              <Input value={ghostBadgeLabel(target)} disabled />
            </Field>
          ) : (
          <>
          <Field
            label="Email"
            // firestore.rules: an Operatives manager may not change a person's email (admins only).
            hint={canEditIdentity && !canAdminTools ? 'Only an admin can change the email.' : undefined}
          >
            <Input
              type="email"
              value={target.email}
              disabled={!canEditIdentity || !canAdminTools}
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
              // Owner 24 Nov: the newest sign of life across every users document of the person, organisation zone.
              value={lastActiveText(personLastSeenAt(target, rosterDocs), organizationTimeZone)}
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
              <Field label="Employment type" hint={employmentTypeSection.note ?? undefined}>
                <Select
                  value={normalizeEmploymentType(target.employmentType)}
                  disabled={!employmentTypeSection.editable}
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
                onSave={async (next, baseline) => {
                  if (!organization?.id) return
                  setQualSaving(true)
                  setQualError(null)
                  try {
                    const urls = canonicalCertificateUrls(next.qualifications, next.qualificationCertificateURLs)
                    await patchOperativeQualifications(
                      organization.id,
                      { ...next, qualificationCertificateURLs: urls },
                      baseline
                    )
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
          {annualLeaveSection.note ? <p className="up-f-hint">{annualLeaveSection.note}</p> : null}
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
      {(showPayrollFields || showTaxIdFields) && (
        <FormSection title="Employment & timesheets" icon="sheet" tone="blue">
              {showPayrollFields ? (
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
              ) : null}
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
        <FormSection title="Permissions" icon="shield" tone="blue">
          <div className="up-lockcard">
            <span className="up-atile amber" aria-hidden="true">
              <ProfileIcon name="key" />
            </span>
            <div>
              <b>Super Admin</b>
              <small>
                The Super Admin&apos;s permissions cannot be changed. Super Admin is passed on with Change Super Admin.
              </small>
            </div>
          </div>
        </FormSection>
      ) : canEditMatrix && effectivePermissions ? (
        <FormSection title="Permissions" icon="shield" tone="blue">
          <div>
              <PermissionRowsList
                variant="profile"
                rows={editUserPermissionRows(target, effectiveAccountType, effectivePermissions, currentUser?.id, users)}
                onChange={updatePermissions}
                disabled={!canEdit || target.isSuperAdmin}
                excludeFields={suppressAdminAccessToggle ? ['adminAccess'] : undefined}
                lockedMessage={lockedPermissionMessage(effectiveAccountType)}
                onLocked={setLockedNotice}
              />
          </div>
          {lockedNotice ? <p className="up-lock-note">{lockedNotice}</p> : null}
        </FormSection>
      ) : null}

      {canEdit && dirty ? (
        <div className="up-savebar">
          <SaveButton saving={saving} saved={saved} dirty={!payReloading} onClick={() => handleSave()} />
        </div>
      ) : null}

      {/* Account actions */}
      {canEdit ? (
      <FormSection title="Account actions" icon="gear" tone="slate">
      <div className="up-actions">
        {ghostTarget ? null : target.passwordSet ? (
          <ActionButton
            title="Send password reset"
            subtitle="Email a password reset link to this user"
            icon="refresh"
            busy={busyAction === 'reset'}
            onClick={handlePasswordReset}
          />
        ) : (
          <ActionButton
            title="Resend sign-up email with verification code"
            subtitle="They haven't finished setting a password yet."
            icon="mail"
            busy={busyAction === 'invite'}
            onClick={handleResendInvite}
          />
        )}
        {canAdminTools ? (
          <ActionPanel icon="chat" tone="blue">
            <b>Wrong login email? Ask Project Planner to fix it</b>
            <small>
              Sends a support request to the platform owner. They will change the login email; you never see or set a password.
            </small>
            {fixOpen ? (
              <div className="up-fixform">
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
                  className="pu-btn primary sm"
                  style={{ alignSelf: 'flex-start' }}
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
                          // The route reads the names and current email from the stored documents.
                          orgId: organization.id,
                          targetUid: target.id,
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
              <button type="button" className="pu-btn sm" onClick={() => setFixOpen(true)}>
                Ask Project Planner to fix it
              </button>
            )}
          </ActionPanel>
        ) : null}

        {canAdminTools && (
          <>
            {showChangeType && (
              <div className="up-cut">
                <div className="up-cut-head">
                  <b>Change user type</b>
                  <small>Choose how this account should behave. Changes apply when you press Save.</small>
                </div>
                <div className="up-form" style={{ gap: 8 }}>
                  {ACCOUNT_TYPE_OPTIONS.map((option) => {
                    const selected = effectiveAccountType === option.id
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => selectDraftAccountType(option.id)}
                        className={selected ? 'up-opt on' : 'up-opt'}
                      >
                        <span className={`up-atile ${ACCOUNT_TYPE_TONE[option.id]}`} aria-hidden="true">
                          <ProfileIcon name={ACCOUNT_TYPE_ICON[option.id]} />
                        </span>
                        <span className="up-opt-text">
                          <b>{option.title}</b>
                          <small>{option.description}</small>
                        </span>
                        <span className={selected ? 'up-radio on' : 'up-radio'} aria-hidden="true">
                          {selected ? <ProfileIcon name="check" size={13} /> : null}
                        </span>
                      </button>
                    )
                  })}
                </div>
                {draftTypePermissions && (
                  <div className="up-cut-perms">
                    <PermissionRowsList
                      variant="profile"
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
                  className="pu-btn sm"
                  style={{ alignSelf: 'flex-start' }}
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
                icon="key"
                onClick={() => setShowTransfer(true)}
              />
            ) : null}
            {target.isSuperAdmin || ghostTarget ? null : (
              <ActionButton
                title="Change user type"
                subtitle="Switch between operative, manager, or administrator"
                tone="purple"
                icon="users"
                onClick={() => setShowChangeType(true)}
              />
            )}
            {target.isSuperAdmin ? null : (
              <ActionButton
                title={target.isActive ? 'Deactivate user' : 'Reactivate user'}
                subtitle={target.isActive ? 'Suspend access, keep history' : 'Restore sign-in access'}
                tone="amber"
                icon="clock"
                busy={activeSaving}
                onClick={handleToggleActive}
              />
            )}
            {!mayDeleteTarget ? null : (
              <ActionButton
                title="Delete user"
                subtitle="Permanently remove account"
                tone="red"
                icon="warn"
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
              icon="clock"
              busy={activeSaving}
              onClick={handleToggleActive}
            />
            {!mayDeleteTarget ? null : (
              <ActionButton
                title="Delete operative"
                subtitle="Permanently remove this operative"
                tone="red"
                icon="warn"
                onClick={() => setConfirmDelete(true)}
              />
            )}
          </>
        )}
      </div>
      </FormSection>
      ) : null}

      {confirmDelete && (
        <div
          className="up-dialog-wrap"
          onClick={() => setConfirmDelete(false)}
        >
          <div className="up-dialog" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <h2>Delete user?</h2>
            <p>
              Are you sure you want to delete {target.firstName} {target.surname}? This action cannot be undone.
            </p>
            <div className="up-dialog-f">
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="pu-btn"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={busyAction === 'delete'}
                className="pu-btn danger"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {showTransfer && target && currentUser?.isSuperAdmin && target.id === currentUser.id && (
        <div
          className="up-dialog-wrap"
          onClick={() => setShowTransfer(false)}
        >
          <div className="up-dialog" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <h2>Change Super Admin</h2>
            {superAdminSuccessors(users, currentUser.id).length === 0 ? (
              <p>{SUPER_ADMIN_SUCCESSOR_EMPTY}</p>
            ) : (
              <ul>
                {superAdminSuccessors(users, currentUser.id).map((person) => (
                  <li key={person.id}>
                    <button
                      type="button"
                      disabled={transferring}
                      onClick={() => void handleTransfer(person.id)}
                    >
                      <b>
                        {person.firstName} {person.surname}
                      </b>
                      <small>{person.email}</small>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="up-dialog-f">
              <button
                type="button"
                onClick={() => setShowTransfer(false)}
                className="pu-btn"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmAdmin && (
        <div
          className="up-dialog-wrap"
          onClick={() => setConfirmAdmin(false)}
        >
          <div className="up-dialog" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <h2>Make this user an administrator?</h2>
            <p>
              {target.firstName} {target.surname} will get full administrator access, including user management and
              organisation settings. Only another administrator can change this later.
            </p>
            <div className="up-dialog-f">
              <button
                type="button"
                onClick={() => setConfirmAdmin(false)}
                className="pu-btn"
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
                className="pu-btn primary"
              >
                {typeSaving ? 'Saving…' : 'Yes, make administrator'}
              </button>
            </div>
          </div>
        </div>
      )}
      </fieldset>
    </form>
  )
}
