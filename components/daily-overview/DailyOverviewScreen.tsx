/**
 * iOS parity source: Views/DailyOverviewView.swift
 * Spec: docs/ios-parity/sections/22-daily-overview.md
 */

'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { ChevronLeftIcon, ChevronRightIcon, CalendarDaysIcon, FolderIcon, SunIcon, WrenchScrewdriverIcon } from '@heroicons/react/24/solid'
import { useAuthStore } from '@/lib/stores/authStore'
import { useOrganizationTimeZone } from '@/lib/stores/organizationDocumentStore'
import { useOrganizationDayKey } from '@/lib/warnings/useOrganizationDayKey'
import { useBookingHistoryFrom } from '@/lib/stores/useBookingHistory'
import { useBookingStore } from '@/lib/stores/bookingStore'
import { useManagerScheduleStore } from '@/lib/stores/managerScheduleStore'
import { useOperativeStore } from '@/lib/stores/operativeStore'
import { useProjectStore } from '@/lib/stores/projectStore'
import { useOrgUserStore } from '@/lib/stores/siteAuditStore'
import { useHolidayStore } from '@/lib/stores/holidayStore'
import { useSubcontractorStore } from '@/lib/stores/subcontractorStore'
import { canViewDailyOverview, hasAdminAccess } from '@/lib/permissions'
import { dateFromDayKey, dayKey, londonMidnight } from '@/lib/ios-parity/londonTime'
import { leaveHalfDayLabel, overtimeTotalText, type JOB_SCHEDULE_LEGEND, type ScheduleCellTone } from '@/lib/canonical'
import { Card, Chip, DataTable, EmptyState, IconTile, Note, PageBand, PageShell, PuButton, StatRow, WarnIcon, type PuTone } from '@/components/ui/page'
import { organizationZoneOr } from '@/lib/orgTime/activeOrganizationZone'
import { watchSubcontractorBookings } from '@/lib/weekly-report/loadSubcontractorBookings'
import type { SubcontractorBookingRow } from '@/lib/weekly-report/weeklyReportData'
import {
  dailyOverviewMayPublish,
  initialsFrom,
  overviewFormatHours,
  shiftOverviewDay,
  type OverviewPersonRow,
} from '@/lib/daily-overview/buildDailyOverview'
import { BookLabourFlowScreen } from '@/components/book-labour/BookLabourFlowScreen'
import {
  DailyOverviewBookingSheet,
  managerBookingToTarget,
  type OverviewBookingTarget,
} from '@/components/daily-overview/DailyOverviewBookingSheet'
import type { ManagerSiteBooking } from '@/lib/scheduling/managerSiteBookingUtils'
import type { User } from '@/types'
import { overviewHolidayName as holidayName, overviewPersonName as personName } from '@/lib/daily-overview/dailyOverviewToday'
import { useDailyOverviewModel } from '@/lib/daily-overview/useDailyOverviewModel'

export function DailyOverviewScreen() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, organization } = useAuthStore()
  const { bookings, loadBookings, loading: bookingsLoading, error: bookingsError } = useBookingStore()
  const { managerSiteBookings, loadManagerSiteBookings, loading: managerLoading } = useManagerScheduleStore()
  const { operatives, loadOperatives } = useOperativeStore()
  const { users, userIdAliases, loadUsers } = useOrgUserStore()
  const { loadProjects, loadSmallWorks } = useProjectStore()
  const { loadBookings: loadHolidays } = useHolidayStore()
  const { subcontractors, loadSubcontractors } = useSubcontractorStore()
  const [subcontractorBookings, setSubcontractorBookings] = useState<SubcontractorBookingRow[]>([])
  const [day, setDay] = useState(() => londonMidnight(new Date(), organizationZoneOr()))
  // Today moves on at the organisation's midnight and when the tab is focused again. A viewer who was on
  // the old today follows to the new one; a viewer on another day stays there.
  const orgTimeZone = useOrganizationTimeZone()
  const todayKey = useOrganizationDayKey(orgTimeZone)
  const today = useMemo(() => new Date(), [todayKey]) // eslint-disable-line react-hooks/exhaustive-deps -- new instant per organisation day
  const lastTodayKey = useRef(todayKey)
  useEffect(() => {
    const previous = lastTodayKey.current
    lastTodayKey.current = todayKey
    if (previous === todayKey) return
    setDay((current) => (dayKey(current) === previous ? londonMidnight(new Date(), organizationZoneOr()) : current))
  }, [todayKey])
  // A past day reaches before the launch booking download.
  useBookingHistoryFrom(organization?.id, day)
  const [bookLabourOpen, setBookLabourOpen] = useState(false)
  const [editingRow, setEditingRow] = useState<OverviewBookingTarget | null>(null)

  useEffect(() => {
    const raw = searchParams.get('date')
    if (raw && /^\d{4}-\d{2}-\d{2}$/.test(raw)) {
      setDay(dateFromDayKey(raw))
    }
  }, [searchParams])

  useEffect(() => {
    if (!organization?.id) return
    loadBookings(organization.id)
    loadManagerSiteBookings(organization.id)
    loadOperatives(organization.id)
    loadUsers(organization.id)
    loadProjects(organization.id)
    loadSmallWorks(organization.id)
    loadHolidays(organization.id)
    loadSubcontractors(organization.id)
  }, [
    organization?.id,
    loadBookings,
    loadManagerSiteBookings,
    loadOperatives,
    loadUsers,
    loadProjects,
    loadSmallWorks,
    loadHolidays,
    loadSubcontractors,
  ])


  // Rulebook 1.9.0 §1: subcontractor bookings are live while Daily Overview is open.
  useEffect(() => {
    if (!organization?.id) return
    setSubcontractorBookings([])
    return watchSubcontractorBookings(organization.id, setSubcontractorBookings, () => setSubcontractorBookings([]))
  }, [organization?.id])

  // Owner decision 5 (5 Nov 2026): one Daily Overview set-up shared with Home (`useDailyOverviewModel`): the live
  // organisation settings for the day shown and `buildDailyOverview`, unchanged.
  const { model: builtModel, settings } = useDailyOverviewModel({
    day,
    today,
    timeZone: orgTimeZone,
    subcontractorBookings,
    subcontractors,
  })
  const model = builtModel!
  const payrollPolicy = settings.payrollPolicy

  const canBook = Boolean(user && (hasAdminAccess(user) || user.permissions?.manager))
  const dateParam = dayKey(day)
  const mayPublish = dailyOverviewMayPublish({
    bookingsLoading,
    bookingCount: bookings.length,
    managerLoading,
    managerBookingCount: managerSiteBookings.length,
  })
  const firstPaint = !mayPublish && bookings.length === 0 && managerSiteBookings.length === 0

  useEffect(() => {
    if (user && !canViewDailyOverview(user)) router.replace('/dashboard')
  }, [router, user])

  if (user && !canViewDailyOverview(user)) return null

  const legendTotal = Math.max(1, model.officeCount + model.wfhCount + model.onSiteCount + model.unbookedCount)
  const share = (count: number) => `${(100 * count) / legendTotal}%`
  const overtimeValue =
    // Several rates on one day: the clock hours only (no single rate to show), as iOS.
    model.overtimeWorkedHours > 0 && !model.overtimeText
      ? `${overviewFormatHours(model.overtimeWorkedHours)}h OT`
      : // Rulebook 1.39.0 (owner answer 11 Nov): "12h OT × 1.5 = 18h" (`overtimeTotalText`); clock hours at the
        // multiplier, an unpaid break in them off as plain hours (1.20.3).
        overtimeTotalText({
          clockHours: model.overtimeWorkedHours,
          multiplier: model.overtimeMultiplier,
          breakHours: model.overtimeBreakHours,
        }) || '0h OT'
  const openManagerBooking = (booking: ManagerSiteBooking) =>
    setEditingRow(managerBookingToTarget(booking, personName(booking.userId, users, userIdAliases)))

  return (
    <>
    <PageShell>
      <PageBand
        eyebrow={firstPaint ? 'Daily overview' : `Daily overview · ${model.dayLabel}`}
        title={
          firstPaint
            ? undefined
            : `${overviewFormatHours(model.labourHours)}h booked`
        }
        titleSuffix={firstPaint ? undefined : `· ${model.peopleCount === 1 ? '1 person' : `${model.peopleCount} people`}`}
        subtitle="Who is where, and who still needs booking"
        actions={
          <div className="pu-datenav">
            <button type="button" aria-label="Previous day" onClick={() => setDay(shiftOverviewDay(day, -1))}>
              <ChevronLeftIcon width={18} height={18} aria-hidden="true" />
            </button>
            <button
              type="button"
              className={model.isToday ? 'on' : undefined}
              onClick={() => setDay(londonMidnight(new Date(), organizationZoneOr()))}
            >
              {model.isToday ? 'Today' : 'Back to today'}
            </button>
            <button type="button" aria-label="Next day" onClick={() => setDay(shiftOverviewDay(day, 1))}>
              <ChevronRightIcon width={18} height={18} aria-hidden="true" />
            </button>
            <input
              type="date"
              value={dateParam}
              aria-label="View by date"
              onChange={(e) => {
                if (/^\d{4}-\d{2}-\d{2}$/.test(e.target.value)) setDay(dateFromDayKey(e.target.value))
              }}
            />
          </div>
        }
      >
        {firstPaint ? null : (
          <>
            <StatRow
              items={[
                { value: overviewFormatHours(model.standardWorkedHours), label: 'Standard hrs' },
                { value: overtimeValue, label: 'Overtime', tone: 'amber' },
                { value: model.jobsCount, label: model.jobsCount === 1 ? 'Job active' : 'Jobs active' },
                {
                  value: mayPublish ? model.unbookedCount : '…',
                  label: 'Unbooked',
                  tone: mayPublish && model.unbookedCount > 0 ? 'red' : undefined,
                },
              ]}
            />
            <div className="pu-glass">
              <div className="pu-glass-head">
                <b>Where the team is</b>
                <span style={{ flex: 1 }} />
                <span>
                  {model.bookedPeopleCount} booked · {mayPublish ? model.unbookedCount : '…'} unbooked
                </span>
              </div>
              <div className="pu-track" aria-hidden="true">
                {model.onSiteCount > 0 ? <i style={{ width: share(model.onSiteCount), background: TEAM_COLOURS.onSite }} /> : null}
                {model.officeCount > 0 ? <i style={{ width: share(model.officeCount), background: TEAM_COLOURS.office }} /> : null}
                {model.wfhCount > 0 ? <i style={{ width: share(model.wfhCount), background: TEAM_COLOURS.wfh }} /> : null}
                {mayPublish && model.unbookedCount > 0 ? (
                  <i style={{ width: share(model.unbookedCount), background: 'var(--pu-unbooked-stripe)' }} />
                ) : null}
              </div>
              <div className="pu-legend">
                <span>
                  <i style={{ background: TEAM_COLOURS.office }} />
                  {model.officeCount} Office
                </span>
                <span>
                  <i style={{ background: TEAM_COLOURS.wfh }} />
                  {model.wfhCount} WFH
                </span>
                <span>
                  <i style={{ background: TEAM_COLOURS.onSite }} />
                  {model.onSiteCount} On site
                </span>
                <span>
                  <i style={{ background: 'var(--pu-unbooked-stripe)' }} />
                  {mayPublish ? model.unbookedCount : '…'} Unbooked
                </span>
              </div>
            </div>
          </>
        )}
      </PageBand>

      {bookingsError ? (
        <Note tone="red" role="alert">
          Could not load bookings from Firebase: {bookingsError}
        </Note>
      ) : null}

      {firstPaint ? (
        <Card>
          <EmptyState title="Loading daily overview…" />
        </Card>
      ) : (
        <div className="pu-grid2">
          <Card title="By project">
            {model.projectCards.length > 0 ? (
              model.projectCards.map(({ project, people, peopleCount, bookedText, isSmallWorks }) => (
                <div key={project.id}>
                  <div className="pu-proj">
                    <IconTile tone={isSmallWorks ? 'amber' : 'green'} size="sm">
                      {isSmallWorks ? <WrenchScrewdriverIcon /> : <FolderIcon />}
                    </IconTile>
                    <span>
                      <b>
                        <Chip tone="blue">{project.jobNumber}</Chip> {project.siteName}
                      </b>
                      <small>
                        {peopleCount} {peopleCount === 1 ? 'person' : 'people'} · {bookedText}
                      </small>
                    </span>
                    <Link
                      href={isSmallWorks ? `/dashboard/small-works/${project.id}` : `/dashboard/projects/${project.id}`}
                      className="pu-btn sm"
                    >
                      {isSmallWorks ? 'Open small works' : 'Open project'}
                    </Link>
                  </div>
                  {people.length > 0 ? (
                    <DataTable
                      columns={[
                        { key: 'person', label: 'Person' },
                        { key: 'booking', label: 'Booking' },
                        { key: 'type', label: 'Type' },
                        { key: 'hours', label: 'Hours', align: 'right' },
                        { key: 'change', label: 'Change', srOnly: true },
                      ]}
                    >
                      {people.map((row) => (
                        <PersonRow
                          key={row.personKey}
                          row={row}
                          onOpen={
                            row.kind === 'subcontractor'
                              ? undefined
                              : () => {
                                  const bookingId = row.bookingId || row.id.replace(/^(op|mgr)-/i, '')
                                  if (!bookingId) return
                                  setEditingRow({ ...row, bookingId })
                                }
                          }
                        />
                      ))}
                    </DataTable>
                  ) : (
                    <p className="pu-muted pu-pad">No named people on this job today.</p>
                  )}
                </div>
              ))
            ) : model.empty ? (
              <EmptyState
                tile={
                  <IconTile tone="blue" size="lg">
                    <CalendarDaysIcon />
                  </IconTile>
                }
                title="Nothing booked yet"
                description="No one is booked onto a job for this day."
              >
                {canBook ? (
                  <PuButton variant="primary" onClick={() => setBookLabourOpen(true)}>
                    Book labour
                  </PuButton>
                ) : null}
              </EmptyState>
            ) : null}
          </Card>

          <div className="pu-col">
            {mayPublish && model.unbookedNames.length > 0 ? (
              <Card
                tone="red"
                title="Unbooked labour"
                icon={
                  <IconTile tone="red" size="sm">
                    <WarnIcon />
                  </IconTile>
                }
                actions={<Chip tone="red">{model.unbookedNames.length}</Chip>}
              >
                <div className="pu-list">
                  {model.unbookedNames.map((name) => (
                    <div key={name} className="pu-item">
                      <IconTile tone="slate" size="sm">
                        {initialsFrom(name)}
                      </IconTile>
                      <span className="grow">
                        <b>{name}</b>
                      </span>
                      <Chip tone="red">Unbooked</Chip>
                    </div>
                  ))}
                </div>
                {canBook ? (
                  <div className="pu-card-b">
                    <PuButton variant="primary" block onClick={() => setBookLabourOpen(true)}>
                      Book labour
                    </PuButton>
                  </div>
                ) : null}
              </Card>
            ) : null}

            {model.holidays.length > 0 ? (
              <Card title="Annual leave">
                <div className="pu-list">
                  {model.holidays.map((row) => (
                    <div key={row.id} className="pu-item">
                      <IconTile tone="amber" size="sm">
                        <SunIcon />
                      </IconTile>
                      <span className="grow">
                        <b>{holidayName(row, users, operatives, userIdAliases)}</b>
                        {/* Rulebook 1.20.0 §9: a leave half is the exact middle of the day (`leaveHalfDayWindows`). */}
                        <span className="pu-sub">Annual leave · {leaveHalfDayLabel(row.timeSlot, payrollPolicy)}</span>
                      </span>
                      <Chip tone="brown">Off</Chip>
                    </div>
                  ))}
                </div>
              </Card>
            ) : null}

            {model.officeBookings.length > 0 || model.wfhBookings.length > 0 || model.customGroups.length > 0 ? (
              <OtherBlock
                office={model.officeBookings}
                wfh={model.wfhBookings}
                custom={model.customGroups}
                users={users}
                aliases={userIdAliases}
                onOpen={openManagerBooking}
              />
            ) : null}

            {model.siteSurveyBookings.length > 0 ? (
              <Card title="Site survey">
                <ManagerList bookings={model.siteSurveyBookings} users={users} aliases={userIdAliases} onOpen={openManagerBooking} />
              </Card>
            ) : null}
          </div>
        </div>
      )}
    </PageShell>
    {bookLabourOpen ? (
      <div className="fixed inset-0 z-[80] overflow-y-auto bg-[var(--bg)]">
        <div className="mx-auto max-w-2xl px-4 py-6 lg:px-10 lg:py-8">
          <BookLabourFlowScreen date={dateParam} from="daily-overview" onClose={() => setBookLabourOpen(false)} />
        </div>
      </div>
    ) : null}
    {editingRow ? (
      <DailyOverviewBookingSheet row={editingRow} day={day} onClose={() => setEditingRow(null)} />
    ) : null}
    </>
  )
}

/** Display colours of the "Where the team is" bar (the Home `--dash-*` family). */
const TEAM_COLOURS = { onSite: '#3B7BF0', office: '#8B7CF6', wfh: '#34C38F' } as const

/** The scheduling week's own words for a tile kind (`JOB_SCHEDULE_LEGEND`, rulebook 1.37.0). */
const CELL_LABELS: Record<ScheduleCellTone, { label: (typeof JOB_SCHEDULE_LEGEND)[number]; tone: PuTone }> = {
  standard: { label: 'Standard', tone: 'blue' },
  split: { label: 'Std + OT', tone: 'blue' },
  otOnly: { label: 'OT only', tone: 'amber' },
  halfDay: { label: 'Half day', tone: 'slate' },
}

function PersonRow({ row, onOpen }: { row: OverviewPersonRow; onOpen?: () => void }) {
  const kind = CELL_LABELS[row.cell.tone]
  const barTotal = row.cell.standardHours + row.cell.overtimeHours
  const stdWidth = barTotal > 0 ? (100 * row.cell.standardHours) / barTotal : 0
  const otWidth = barTotal > 0 ? (100 * row.cell.overtimeHours) / barTotal : 0
  return (
    <tr className={onOpen ? 'click' : undefined} onClick={onOpen}>
      <td>
        <div className="pu-who">
          <IconTile tone="blue" size="sm" round>
            {row.initials}
          </IconTile>
          <span>
            <b>{row.name}</b>
          </span>
        </div>
      </td>
      <td>
        {row.bookingParts.map((part, index) => (
          <div key={index} style={index > 0 ? { marginTop: 6 } : undefined}>
            <b style={{ display: 'block', fontWeight: 600 }}>{part.shift}</b>
            {part.times ? <span className="pu-sub">{part.times}</span> : null}
          </div>
        ))}
      </td>
      <td>
        <Chip tone={kind.tone}>{kind.label}</Chip>
      </td>
      <td className="num">
        <span className="pu-hrs">
          <span className="pu-hbar" aria-hidden="true">
            {stdWidth > 0 ? <i className="std" style={{ width: `${stdWidth}%` }} /> : null}
            {otWidth > 0 ? <i className="ot" style={{ width: `${otWidth}%` }} /> : null}
          </span>
          {row.pillText}
        </span>
      </td>
      <td className="actions">
        {onOpen ? (
          <PuButton
            size="sm"
            aria-label={`Change booking for ${row.name}`}
            onClick={(event) => {
              event.preventDefault()
              event.stopPropagation()
              onOpen()
            }}
          >
            Change
          </PuButton>
        ) : null}
      </td>
    </tr>
  )
}

function ManagerList({
  bookings,
  users,
  aliases,
  onOpen,
}: {
  bookings: ManagerSiteBooking[]
  users: User[]
  aliases?: Record<string, string>
  onOpen?: (booking: ManagerSiteBooking) => void
}) {
  return (
    <div className="pu-list">
      {bookings.map((b) => {
        const name = personName(b.userId, users, aliases)
        if (!name) return null
        const inner = (
          <>
            <span className="grow">
              <b>{name}</b>
            </span>
            <Chip tone="slate">{b.timeSlot}</Chip>
          </>
        )
        return onOpen ? (
          <button
            key={b.id}
            type="button"
            className="pu-item"
            onClick={(event) => {
              event.preventDefault()
              event.stopPropagation()
              onOpen(b)
            }}
            aria-label={`Change booking for ${name}`}
          >
            {inner}
            <span className="pu-btn sm" aria-hidden="true">
              Change
            </span>
          </button>
        ) : (
          <div key={b.id} className="pu-item">
            {inner}
          </div>
        )
      })}
    </div>
  )
}

function OtherBlock({
  office,
  wfh,
  custom,
  users,
  aliases,
  onOpen,
}: {
  office: ManagerSiteBooking[]
  wfh: ManagerSiteBooking[]
  custom: { name: string; bookings: ManagerSiteBooking[] }[]
  users: User[]
  aliases?: Record<string, string>
  onOpen?: (booking: ManagerSiteBooking) => void
}) {
  const people = new Set([...office, ...wfh, ...custom.flatMap((g) => g.bookings)].map((b) => b.userId))
  const groups = [
    ...(office.length > 0 ? [{ name: 'Office', bookings: office }] : []),
    ...(wfh.length > 0 ? [{ name: 'Working from home', bookings: wfh }] : []),
    ...custom,
  ]
  return (
    <Card title="Other" count={`${people.size} person${people.size === 1 ? '' : 's'}`}>
      {groups.map((group) => (
        <div key={group.name}>
          <p className="pu-label pu-pad" style={{ paddingBottom: 0 }}>
            {group.name}
          </p>
          <ManagerList bookings={group.bookings} users={users} aliases={aliases} onOpen={onOpen} />
        </div>
      ))}
    </Card>
  )
}
