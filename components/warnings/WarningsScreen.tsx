'use client'

import { useCallback, useMemo, useState, type ReactNode } from 'react'
import Link from 'next/link'
import type { OperativeBookingClashWarning } from '@/lib/scheduling/bookingClashUtils'
import type { ManagerBookingClashWarning } from '@/lib/warnings/managerClashWarnings'
import type { MissedMaterialOrderWarning } from '@/lib/warnings/materialOrderWarnings'
import { groupUnbookedWarningsByDay, type UnbookedLabourWarning } from '@/lib/warnings/unbookedLabourWarnings'
import { formatWarningHours } from '@/lib/warnings/clashIntervals'
import type { QualificationExpiryWarning, UnverifiedOperativeWarning } from '@/lib/warnings/generateOrgWarnings'
import { leaveWarningAnnualLeaveHref, type LeaveCoverageWarning } from '@/lib/warnings/leaveCoverageWarnings'
import { formatClockMinutes, type WarningsSortDirection } from '@/lib/canonical'
import { orderWarningListItems } from '@/lib/warnings/warningListOrder'
import { projectMaterialsPath } from '@/lib/navigation/projectSchedulePaths'
import { ClashWarningCard } from '@/components/warnings/ClashWarningCard'
import { displayTitle, type ClashTimelineEntry } from '@/lib/warnings/clashTimeline'
import { canOpenWarningSettings, canViewWarnings, hasAdminAccess } from '@/lib/permissions'
import type { Operative, User } from '@/types'
import { editUserHrefForOperative, findUserForOperative } from '@/lib/operatives/operativeRosterUtils'
import { canOpenOperativeFromWarning } from '@/lib/staff/userEditPermissions'
import { initialsFrom } from '@/lib/daily-overview/buildDailyOverview'
import { dayKey, formatLongDay } from '@/lib/ios-parity/londonTime'
import { notifyCompanyActivity } from '@/lib/notifications/companyActivity'
import { useAuthStore } from '@/lib/stores/authStore'
import { normalizeDocumentId } from '@/lib/canonical'
import { feedback } from '@/lib/feedbackSounds/feedback'
import { useOrganizationTimeZone } from '@/lib/stores/organizationDocumentStore'
import { WarningCardActions, WarningDismissButton, WarningDismissDialog } from '@/components/warnings/WarningCardActions'
import {
  leaveDismissRequest,
  managerClashDismissRequest,
  materialsDismissRequest,
  operativeClashDismissRequest,
  runWarningDismiss,
  unbookedDayDismissRequest,
  unverifiedDismissRequest,
  warningRemovedNotice,
  type WarningDismissRequest,
} from '@/lib/warnings/warningDismissRequest'

type FilterChip = 'all' | 'clashes' | 'unbooked' | 'leave' | 'materials' | 'qualifications'

const AVATAR_COLORS = ['#2C5BBF', '#4B7A5C', '#7A4B8C', '#B35614', '#2563EB', '#9E2A2A']

function avatarColor(name: string): string {
  const hash = [...name].reduce((sum, ch) => sum + ch.charCodeAt(0), 0)
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

function parseUnbookedPerson(raw: string): { name: string; badge: string | null } {
  const match = raw.match(/^(.*) \(missing (.+)\)$/)
  if (!match) return { name: raw, badge: null }
  let hours = match[2].replace(/\.0h$/, 'h')
  if (!hours.endsWith('h')) hours += 'h'
  return { name: match[1], badge: `−${hours}` }
}

function Avatar({ name, size = 32 }: { name: string; size?: number }) {
  return (
    <span
      className="grid shrink-0 place-items-center rounded-full font-bold text-white"
      style={{ width: size, height: size, fontSize: size < 30 ? 10 : 11, background: avatarColor(name) }}
    >
      {initialsFrom(name)}
    </span>
  )
}

const WARN_ICON =
  'M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z'

/** The card header: icon chip, title, then the severity chip and (when allowed) the quiet Dismiss. */
function CardHeader({
  icon = WARN_ICON,
  title,
  severity,
  hue,
  solid,
  dismiss,
}: {
  icon?: string
  title: string
  severity: string
  hue: string
  solid?: boolean
  dismiss?: ReactNode
}) {
  return (
    <div className="card-h">
      <div className="ico-chip sm">
        <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
        </svg>
      </div>
      <h2 className="h2 grow" style={{ minWidth: 0 }}>{title}</h2>
      <span className="wd-head-end">
        <span className={solid ? 'pill solid' : 'pill'} data-hue={hue}>
          {severity}
        </span>
        {dismiss}
      </span>
    </div>
  )
}

function UnbookedDayCard({
  date,
  people,
  canBook,
  onDismiss,
}: {
  date: Date
  people: UnbookedLabourWarning[]
  canBook: boolean
  onDismiss?: () => void
}) {
  const parsed = people.map((person) => ({
    ...parseUnbookedPerson(`${person.operativeName} (missing ${formatWarningHours(person.missingHours)}h)`),
    id: person.id,
    message: person.message,
  }))
  return (
    <section className="card" data-hue="warn">
      <CardHeader
        title="Unbooked labour"
        severity="HIGH"
        hue="red"
        dismiss={onDismiss ? <WarningDismissButton onClick={onDismiss} label={`Unbooked labour on ${formatLongDay(date)}`} /> : null}
      />
      <div className="card-b rows">
        <p className="small" style={{ marginBottom: 4 }}>
          {people.length} {people.length === 1 ? 'person is' : 'people are'} not booked on{' '}
          <b>{formatLongDay(date)}</b>.
        </p>
        {parsed.map((person) => (
          <div key={person.id} className="ritem accent" data-hue="warn" style={{ cursor: 'default' }}>
            <Avatar name={person.name} />
            <span className="grow">
              <span className="t">{person.name}</span>
              <span className="s">Unbooked labour</span>
            </span>
            {person.badge ? (
              <span className="pill solid" data-hue="red">
                {person.badge}
              </span>
            ) : null}
          </div>
        ))}
        <WarningCardActions
          primary={
            canBook ? (
              <Link
                href={`/dashboard/book-labour?date=${dayKey(date)}&from=warnings&focus=${encodeURIComponent(
                  people.map((person) => person.userId || person.operativeId).filter(Boolean).join(',')
                )}`}
                className="btn primary block"
              >
                Book labour for this day
              </Link>
            ) : null
          }
          secondary={[
            <Link key="day" href={`/dashboard/daily-overview?date=${dayKey(date)}`} className="btn sm">
              Open daily overview
            </Link>,
          ]}
        />
      </div>
    </section>
  )
}

function MaterialsCard({
  warning,
  smallWorkIds,
  onDismiss,
}: {
  warning: MissedMaterialOrderWarning
  smallWorkIds: ReadonlySet<string>
  onDismiss?: () => void
}) {
  return (
    <section className="card" data-hue="sw">
      <CardHeader
        icon="M21 7.5l-9-4.5L3 7.5m18 0-9 4.5m9-4.5v9l-9 4.5M3 7.5l9 4.5M3 7.5v9l9 4.5m0-9v9"
        title={warning.title}
        severity="LOW"
        hue="lib"
        dismiss={onDismiss ? <WarningDismissButton onClick={onDismiss} label={`${warning.title}, ${warning.projectLabel}`} /> : null}
      />
      <div className="card-b stack" style={{ gap: 10 }}>
        <p className="small">{warning.message}</p>
        <p><b>{warning.projectLabel}</b></p>
        <p className="muted small">Managers should confirm material lists with site teams.</p>
        <WarningCardActions
          primary={
            <Link href={projectMaterialsPath(warning.projectId, smallWorkIds)} className="btn primary block">
              Open materials
            </Link>
          }
        />
      </div>
    </section>
  )
}

function LeaveCard({
  warning,
  canBook,
  viewer,
  onDismiss,
}: {
  warning: LeaveCoverageWarning
  canBook: boolean
  viewer: User | null
  onDismiss?: () => void
}) {
  const isClash = warning.kind === 'leave_clash'
  const hue = isClash ? 'red' : 'warn'
  const range = (interval: { start: number; end: number }) =>
    `${formatClockMinutes(interval.start)}–${formatClockMinutes(interval.end)}`
  return (
    <section className="card" data-hue={hue}>
      <CardHeader
        icon="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364-.707-.707M6.343 6.343l-.707-.707m12.728 0-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
        title={warning.title}
        severity={isClash ? 'HIGH' : 'MEDIUM'}
        hue={hue}
        dismiss={
          onDismiss ? (
            <WarningDismissButton onClick={onDismiss} label={`${warning.title}, ${warning.personName}, ${formatLongDay(warning.date)}`} />
          ) : null
        }
      />
      <div className="card-b stack" style={{ gap: 10 }}>
        <div className="ritem accent" data-hue={hue} style={{ cursor: 'default' }}>
          <Avatar name={warning.personName} />
          <span className="grow">
            <span className="t">{warning.personName}</span>
            <span className="s">
              {warning.leaveLabel} annual leave · {formatLongDay(warning.date)}
            </span>
          </span>
          {!isClash ? (
            <span className="pill solid" data-hue="red">
              −{formatWarningHours(warning.missingHours)}h
            </span>
          ) : null}
        </div>
        <p className="small">{warning.message}</p>
        {isClash ? (
          <ul className="small" style={{ paddingLeft: 18, margin: 0 }}>
            {warning.clashes.map((clash) => (
              <li key={clash.bookingId}>
                <b>{clash.label}</b> {range(clash)} overlaps leave {range({ start: clash.overlapStart, end: clash.overlapEnd })}
              </li>
            ))}
          </ul>
        ) : warning.workingWindow ? (
          <p className="muted small">
            Working half: {range(warning.workingWindow)} · Not booked: {warning.missing.map(range).join(', ')}
          </p>
        ) : null}
        <WarningCardActions
          primary={
            canBook && !isClash ? (
              <Link
                href={`/dashboard/book-labour?date=${warning.dayKey}&from=warnings&focus=${encodeURIComponent(
                  warning.userId || warning.operativeId || ''
                )}`}
                className="btn primary block"
              >
                Book the {warning.leaveSlot === 'PM' ? 'AM' : 'PM'}
              </Link>
            ) : null
          }
          secondary={[
            <Link key="day" href={`/dashboard/daily-overview?date=${warning.dayKey}`} className="btn sm">
              Open daily overview
            </Link>,
            <Link key="leave" href={leaveWarningAnnualLeaveHref(warning, viewer)} className="btn sm">
              Annual leave
            </Link>,
          ]}
        />
      </div>
    </section>
  )
}

function QualificationCard({
  warning,
  onDismiss,
  operativeHref,
  showOpenOperative,
}: {
  warning: QualificationExpiryWarning
  onDismiss?: (warning: QualificationExpiryWarning) => Promise<void>
  operativeHref: string
  showOpenOperative: boolean
}) {
  const [busy, setBusy] = useState(false)
  const expired = warning.daysUntilExpiry < 0
  // Unchanged behaviour: an expired qualification is dismissed straight away into `dismissedWarnings` (iOS
  // `dismissExpiredQualification`, no confirmation sheet and no admin notice); only its button moved to the header.
  const dismiss = async () => {
    if (!onDismiss || busy) return
    setBusy(true)
    try {
      await onDismiss(warning)
    } finally {
      setBusy(false)
    }
  }
  return (
    <section className="card" data-hue="lib">
      <CardHeader
        title={warning.title}
        severity="LOW"
        hue="lib"
        dismiss={
          expired && onDismiss ? (
            <WarningDismissButton
              onClick={() => void dismiss()}
              busy={busy}
              text={busy ? 'Dismissing…' : 'Dismiss'}
              label={warning.title}
            />
          ) : null
        }
      />
      <div className="card-b stack" style={{ gap: 10 }}>
        <p>{warning.message}</p>
        {expired ? (
          <p className="muted small">Dismissing hides this on web and iOS until a new expiry date is saved.</p>
        ) : null}
        <WarningCardActions
          primary={
            showOpenOperative ? (
              <Link href={operativeHref} className="btn primary block">
                Open operative
              </Link>
            ) : null
          }
        />
      </div>
    </section>
  )
}

function LegacyCard({
  title,
  message,
  severity,
  onDismiss,
}: {
  title: string
  message: string
  severity: 'high' | 'medium' | 'low'
  onDismiss?: () => void
}) {
  const hue = severity === 'high' ? 'red' : severity === 'medium' ? 'warn' : 'lib'
  return (
    <section className="card" data-hue={hue}>
      <CardHeader
        title={title}
        severity={severity.toUpperCase()}
        hue={hue}
        dismiss={onDismiss ? <WarningDismissButton onClick={onDismiss} label={`${title}: ${message}`} /> : null}
      />
      <div className="card-b">
        <p>{message}</p>
      </div>
    </section>
  )
}

export function WarningsScreen({
  organizationName,
  clashWarnings,
  managerClashWarnings,
  unbookedWarnings,
  leaveWarnings = [],
  materialWarnings,
  qualificationWarnings = [],
  unverifiedWarnings = [],
  loading,
  user,
  operatives,
  users = [],
  smallWorkIds,
  onAcceptClash,
  onDismissQualification,
  onDismissWarning,
  onDeleteBooking,
  onDeleteManagerBooking,
  canRemoveClashEntry,
  sortDirection,
  onSortDirectionChange,
}: {
  organizationName: string
  clashWarnings: OperativeBookingClashWarning[]
  managerClashWarnings: ManagerBookingClashWarning[]
  unbookedWarnings: UnbookedLabourWarning[]
  leaveWarnings?: LeaveCoverageWarning[]
  materialWarnings: MissedMaterialOrderWarning[]
  qualificationWarnings?: QualificationExpiryWarning[]
  unverifiedWarnings?: UnverifiedOperativeWarning[]
  loading?: boolean
  user: User | null
  operatives: Operative[]
  users?: User[]
  smallWorkIds: ReadonlySet<string>
  onAcceptClash: (clash: {
    id: string
    bookingAId: string
    bookingBId: string
    resolutionKey?: string
    pairs?: Array<{ bookingAId: string; bookingBId: string }>
  }) => Promise<void>
  onDismissQualification?: (warning: QualificationExpiryWarning) => Promise<void>
  /**
   * Permanent dismissal on every device: `warningResolutions/{key}` status `dismissed` for every key of one card, in one
   * batch. Missing → no Dismiss on any card except expired qualifications (`onDismissQualification`).
   */
  onDismissWarning?: (resolutionKeys: string[]) => Promise<void>
  onDeleteBooking: (bookingId: string) => Promise<void>
  onDeleteManagerBooking: (bookingId: string) => Promise<void>
  /** Rulebook §2 (1.33.0): `bookingRemoveAction` is `delete` for this clash row's booking; missing → no remove button. */
  canRemoveClashEntry?: (entry: ClashTimelineEntry) => boolean
  sortDirection: WarningsSortDirection
  onSortDirectionChange: (direction: WarningsSortDirection) => void
}) {
  const [filter, setFilter] = useState<FilterChip>('all')
  const [busyId, setBusyId] = useState<string | null>(null)
  const canBook = Boolean(user && (hasAdminAccess(user) || user.permissions?.manager))
  const isAdmin = Boolean(user && canOpenWarningSettings(user))
  const organization = useAuthStore((state) => state.organization)
  const timeZone = useOrganizationTimeZone()
  // Admins and managers only (the `warningResolutions` rule is staff writes; iOS `canViewStaffWarnings`).
  const canDismiss = Boolean(onDismissWarning && user && canViewWarnings(user))
  const [pendingDismiss, setPendingDismiss] = useState<WarningDismissRequest | null>(null)
  const [dismissing, setDismissing] = useState(false)
  const [dismissError, setDismissError] = useState<string | null>(null)
  const askDismiss = (request: WarningDismissRequest) => () => {
    if (request.keys.length === 0) return
    setDismissError(null)
    setPendingDismiss(request)
  }
  const dismissFor = (request: WarningDismissRequest) => (canDismiss ? askDismiss(request) : undefined)
  const cancelDismiss = useCallback(() => {
    setPendingDismiss(null)
    setDismissError(null)
  }, [])

  // Owner request 17 Nov: the dismissal is written first (every key of the card, one batch); only then are the admins
  // told (`warning_removed`, `companyActivityRecipients`, the iOS text). A refused write keeps the card and the sheet.
  async function confirmDismiss() {
    const request = pendingDismiss
    if (!request || dismissing || !onDismissWarning) return
    setDismissing(true)
    setDismissError(null)
    const name = [user?.firstName, user?.surname].filter(Boolean).join(' ').trim() || user?.email || 'Someone'
    const result = await runWarningDismiss({
      request,
      write: onDismissWarning,
      notify: async (relatedId) => {
        if (!organization?.id) return
        const notice = warningRemovedNotice({ actorName: name, request })
        // One row per admin (companyActivityRecipients), never a row without userId (rulebook 1.4.0 §13).
        await notifyCompanyActivity({
          organizationId: organization.id,
          type: 'warning_removed',
          title: notice.title,
          message: notice.message,
          relatedId,
          requiresPermission: 'hasAdminAccess',
          actor: user,
          users,
        })
      },
    })
    setDismissing(false)
    if (!result.ok) {
      setDismissError(result.error)
      return
    }
    setPendingDismiss(null)
  }


  const unbookedGroups = useMemo(() => groupUnbookedWarningsByDay(unbookedWarnings), [unbookedWarnings])
  const leaveClashCount = leaveWarnings.filter((warning) => warning.kind === 'leave_clash').length
  const leaveCoverCount = leaveWarnings.length - leaveClashCount
  const clashCount = clashWarnings.length + managerClashWarnings.length
  const qualificationCount = qualificationWarnings.length + unverifiedWarnings.length
  const highCount = clashWarnings.length + unbookedWarnings.length + leaveClashCount
  const mediumCount = managerClashWarnings.length + leaveCoverCount
  const lowCount = materialWarnings.length + qualificationCount
  const allCount = highCount + mediumCount + lowCount

  const chips: { value: FilterChip; label: string; count: number }[] = [
    { value: 'all', label: 'All', count: allCount },
    { value: 'clashes', label: 'Clashes', count: clashCount },
    { value: 'unbooked', label: 'Unbooked', count: unbookedWarnings.length },
    { value: 'leave', label: 'Annual leave', count: leaveWarnings.length },
    { value: 'materials', label: 'Materials', count: materialWarnings.length },
    { value: 'qualifications', label: 'Qualifications', count: qualificationCount },
  ]

  const showClashes = filter === 'all' || filter === 'clashes'
  const showUnbooked = filter === 'all' || filter === 'unbooked'
  const showLeave = filter === 'all' || filter === 'leave'
  const showMaterials = filter === 'all' || filter === 'materials'
  const showQualifications = filter === 'all' || filter === 'qualifications'
  const listed = useMemo(
    () =>
      orderWarningListItems({
        unbookedGroups: showUnbooked ? unbookedGroups : [],
        leaveWarnings: showLeave ? leaveWarnings : [],
        materialWarnings: showMaterials ? materialWarnings : [],
        qualificationWarnings: showQualifications ? qualificationWarnings : [],
        unverifiedWarnings: showQualifications ? unverifiedWarnings : [],
        managerClashWarnings: showClashes ? managerClashWarnings : [],
        clashWarnings: showClashes ? clashWarnings : [],
        direction: sortDirection,
      }),
    [
      showUnbooked,
      showLeave,
      showMaterials,
      showQualifications,
      showClashes,
      unbookedGroups,
      leaveWarnings,
      materialWarnings,
      qualificationWarnings,
      unverifiedWarnings,
      managerClashWarnings,
      clashWarnings,
      sortDirection,
    ]
  )

  const handleAccept = async (clash: {
    id: string
    bookingAId: string
    bookingBId: string
    resolutionKey?: string
    pairs?: Array<{ bookingAId: string; bookingBId: string }>
  }) => {
    setBusyId(clash.id)
    try {
      await onAcceptClash(clash)
    } finally {
      setBusyId(null)
    }
  }

  const handleRemoveEntry = async (entry: ClashTimelineEntry) => {
    const label = displayTitle(entry)
    // Rulebook §2 (1.33.0): bookings are deleted (with the tombstone), never cancelled; only offered when
    // `bookingRemoveAction` is `delete`.
    if (!canRemoveClashEntry?.(entry)) return
    if (!window.confirm(`Delete the booking for ${label}?`)) return
    const id = entry.managerBookingId || entry.bookingId
    setBusyId(id)
    try {
      if (entry.managerBookingId) await onDeleteManagerBooking(entry.managerBookingId)
      else await onDeleteBooking(entry.bookingId)
      feedback('bookingDeleted')
    } catch (error) {
      // Owner decision 8: the refusal sound, then the error goes where it went before.
      feedback('actionRefused')
      throw error
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="stack" data-hue="warn">
      <div className="phead" data-hue="warn">
        <div className="badge-ico">
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
        </div>
        <div>
          <h1>Warnings</h1>
          <div className="sub">
            {organizationName} · Separate from the weekly report.
          </div>
        </div>
        <div className="acts">
          {isAdmin ? (
            <Link href="/dashboard/settings/warnings" className="btn">
              Warning settings
            </Link>
          ) : null}
        </div>
      </div>

      <div className="row wrap" style={{ alignItems: 'center', gap: 10 }}>
        <span className="small" style={{ fontWeight: 700 }}>
          Sort
        </span>
        <div className="seg" role="group" aria-label="Sort warnings by date">
          <button
            type="button"
            className={sortDirection === 'oldest' ? 'on' : ''}
            onClick={() => onSortDirectionChange('oldest')}
          >
            Oldest
          </button>
          <button
            type="button"
            className={sortDirection === 'newest' ? 'on' : ''}
            onClick={() => onSortDirectionChange('newest')}
          >
            Newest
          </button>
        </div>
      </div>

      {allCount > 0 ? (
        <section className="hero" data-hue="red" style={{ padding: '22px 26px' }}>
          <div className="relative z-1">
            <div className="row" style={{ alignItems: 'flex-start' }}>
              <div className="grow">
                <p className="eb">Active issues</p>
                <div className="big" style={{ fontSize: 28 }}>{allCount} need attention</div>
                <p className="small" style={{ marginTop: 8, maxWidth: 640 }}>
                  High: operative booking clashes, unbooked labour &amp; bookings during annual leave · Medium:
                  manager/admin overlaps &amp; half-day leave not covered · Low: materials and qualifications
                </p>
              </div>
              {canBook ? (
                <Link href="/dashboard/book-labour?from=warnings" className="btn hbtn solid">
                  Book labour
                </Link>
              ) : null}
            </div>
            <div className="stats">
              <button type="button" className="st" onClick={() => setFilter('all')}>
                <b>{highCount}</b>
                <span>High</span>
                <div className="xs" style={{ opacity: 0.75, marginTop: 2 }}>Clashes, unbooked labour & leave clashes</div>
              </button>
              <button type="button" className="st" onClick={() => setFilter('clashes')}>
                <b>{mediumCount}</b>
                <span>Medium</span>
                <div className="xs" style={{ opacity: 0.75, marginTop: 2 }}>Manager/admin overlaps & half-day leave cover</div>
              </button>
              <button type="button" className="st" onClick={() => setFilter('all')}>
                <b>{lowCount}</b>
                <span>Low</span>
                <div className="xs" style={{ opacity: 0.75, marginTop: 2 }}>Materials and qualifications</div>
              </button>
            </div>
          </div>
        </section>
      ) : null}

      {allCount > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {chips.map((chip) => (
            <button
              key={chip.value}
              type="button"
              onClick={() => setFilter(chip.value)}
              className={`chip ${filter === chip.value ? 'on' : ''}`}
            >
              {chip.label} · {chip.count}
            </button>
          ))}
        </div>
      ) : null}

      {allCount === 0 ? (
        <div className="empty card pad">
          {loading ? (
            <>
              <p className="text-[18px] font-semibold">Scanning for warnings…</p>
              <p className="mx-auto mt-2 max-w-md text-[14px] text-(--ink3)">
                Keep this screen open until results appear.
              </p>
            </>
          ) : (
            <>
              <p className="text-[40px] text-[#0F6E56]">✓</p>
              <p className="mt-2 text-[18px] font-semibold">No active warnings</p>
              <p className="mx-auto mt-2 max-w-md text-[14px] text-(--ink3)">
                High: operative booking clashes, unbooked labour and bookings during annual leave. Medium:
                manager/admin overlaps and half-day leave not covered. Low: materials and qualifications.
              </p>
            </>
          )}
        </div>
      ) : null}

      {listed.map((item) => {
        if (item.kind === 'unbooked') {
          return (
            <UnbookedDayCard
              key={`unbooked:${item.group.id}`}
              date={item.group.date}
              people={item.group.people}
              canBook={canBook}
              onDismiss={dismissFor(unbookedDayDismissRequest(item.group.date, item.group.people, timeZone))}
            />
          )
        }
        if (item.kind === 'leave') {
          return (
            <LeaveCard
              key={item.warning.id}
              warning={item.warning}
              canBook={canBook}
              viewer={user}
              onDismiss={dismissFor(leaveDismissRequest(item.warning, timeZone))}
            />
          )
        }
        if (item.kind === 'material') {
          return (
            <MaterialsCard
              key={item.warning.id}
              warning={item.warning}
              smallWorkIds={smallWorkIds}
              onDismiss={dismissFor(materialsDismissRequest(item.warning))}
            />
          )
        }
        if (item.kind === 'qualification') {
          return (
            <QualificationCard
              key={item.warning.id}
              warning={item.warning}
              onDismiss={onDismissQualification}
              operativeHref={editUserHrefForOperative(item.warning.operativeId, operatives, users)}
              showOpenOperative={canOpenOperativeFromWarning(
                user,
                findUserForOperative(
                  operatives.find((operative) => normalizeDocumentId(operative.id) === normalizeDocumentId(item.warning.operativeId)),
                  users
                )
              )}
            />
          )
        }
        if (item.kind === 'unverified') {
          return (
            <LegacyCard
              key={item.warning.id}
              title="Unverified operative"
              message={item.warning.message}
              severity="low"
              onDismiss={dismissFor(unverifiedDismissRequest(item.warning))}
            />
          )
        }
        if (item.kind === 'managerClash') {
          return (
            <ClashWarningCard
              key={item.warning.id}
              title="Manager booking clash"
              severity="medium"
              personName={item.warning.personName}
              date={item.warning.date}
              entries={item.warning.entries}
              busy={
                busyId === item.warning.id ||
                busyId === item.warning.bookingAId ||
                busyId === item.warning.bookingBId
              }
              onApprove={() => handleAccept(item.warning)}
              onRemove={handleRemoveEntry}
              canRemove={canRemoveClashEntry}
              onDismiss={dismissFor(managerClashDismissRequest(item.warning, timeZone))}
            />
          )
        }
        return (
          <ClashWarningCard
            key={item.warning.id}
            title="Operative booking clash"
            personName={item.warning.operativeName}
            date={item.warning.date}
            entries={item.warning.entries}
            busy={
              busyId === item.warning.id ||
              busyId === item.warning.bookingAId ||
              busyId === item.warning.bookingBId
            }
            onApprove={() => handleAccept(item.warning)}
            onRemove={handleRemoveEntry}
            canRemove={canRemoveClashEntry}
            onDismiss={dismissFor(operativeClashDismissRequest(item.warning, timeZone))}
          />
        )
      })}
      {pendingDismiss ? (
        <WarningDismissDialog
          request={pendingDismiss}
          busy={dismissing}
          error={dismissError}
          onCancel={cancelDismiss}
          onConfirm={() => void confirmDismiss()}
        />
      ) : null}
    </div>
  )
}
