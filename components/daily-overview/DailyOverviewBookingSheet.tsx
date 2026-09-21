'use client'

import { useEffect, useMemo, useState } from 'react'
import { Modal } from '@/components/ui'
import { useAuthStore } from '@/lib/stores/authStore'
import { useBookingStore } from '@/lib/stores/bookingStore'
import { useManagerScheduleStore } from '@/lib/stores/managerScheduleStore'
import { useProjectStore } from '@/lib/stores/projectStore'
import { useOperativeStore } from '@/lib/stores/operativeStore'
import { useOrgUserStore } from '@/lib/stores/siteAuditStore'
import { visibleWorks } from '@/lib/access/workAccess'
import { findOperativeForUser } from '@/lib/operatives/operativeRosterUtils'
import {
  DEFAULT_MY_SCHEDULE,
  enabledScheduleLocationPicks,
  loadOrganizationDetails,
  oneOffCustomLocationPick,
  type MyScheduleOptions,
  type ScheduleLocationPick,
} from '@/lib/settings/organizationSettings'
import { isSmallWorksJobType } from '@/lib/ios-parity/enums'
import type { ManagerLocationType, ManagerSiteBooking } from '@/lib/scheduling/managerSiteBookingUtils'
import type { OverviewPersonRow } from '@/lib/daily-overview/buildDailyOverview'
import type { Project } from '@/types'
import { CustomOtherLocationField } from '@/components/scheduling/CustomOtherLocationField'

type DestTab = 'other' | 'projects' | 'smallWorks'

export type OverviewBookingTarget = OverviewPersonRow | {
  id: string
  name: string
  kind: 'manager'
  bookingId: string
  userId: string
  operativeId?: string
  timeSlotRaw?: string
  workStartTime?: string
  workEndTime?: string
  locationType?: ManagerLocationType
  customLocationName?: string
  projectId?: string
}

function slotKindFromRaw(raw?: string): 'AM' | 'PM' | 'CUSTOM_HOURS' | 'FULL' {
  const compact = (raw || '').toUpperCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim()
  if (compact === 'AM') return 'AM'
  if (compact === 'PM') return 'PM'
  if (compact.includes('CUSTOM')) return 'CUSTOM_HOURS'
  return 'FULL'
}

function operativeSlotFromRaw(raw?: string): string {
  const kind = slotKindFromRaw(raw)
  return kind === 'FULL' ? 'FULL DAY' : kind
}

function managerSlotFromRaw(raw?: string): string {
  const kind = slotKindFromRaw(raw)
  return kind === 'FULL' ? 'FULL_DAY' : kind
}

export function DailyOverviewBookingSheet({
  row,
  day,
  onClose,
}: {
  row: OverviewBookingTarget
  day: Date
  onClose: () => void
}) {
  const { user, organization } = useAuthStore()
  const { bookings, createBooking, updateBooking, deleteBooking } = useBookingStore()
  const {
    managerSiteBookings,
    updateManagerSiteBooking,
    saveManagerSiteBooking,
    deleteManagerSiteBooking,
  } = useManagerScheduleStore()
  const { projects, smallWorks, loadProjects, loadSmallWorks } = useProjectStore()
  const { operatives } = useOperativeStore()
  const { users } = useOrgUserStore()
  const [tab, setTab] = useState<DestTab | undefined>(undefined)
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [scheduleOpts, setScheduleOpts] = useState<MyScheduleOptions>({
    ...DEFAULT_MY_SCHEDULE,
    customItemEnabled: {},
  })

  useEffect(() => {
    if (!organization?.id) return
    loadProjects(organization.id, true)
    loadSmallWorks(organization.id)
    loadOrganizationDetails(organization.id)
      .then((details) => {
        if (details?.myScheduleOptions) setScheduleOpts(details.myScheduleOptions)
      })
      .catch(() => {})
  }, [organization?.id, loadProjects, loadSmallWorks])

  const allWorks = useMemo(() => [...projects, ...smallWorks], [projects, smallWorks])
  const liveProjects = useMemo(
    () =>
      visibleWorks({
        projects: allWorks,
        catalogue: 'projects',
        user,
        operatives,
        bookings,
        managerBookings: managerSiteBookings,
      }).filter((project) => project.isLive),
    [allWorks, user, operatives, bookings, managerSiteBookings]
  )
  const liveSmallWorks = useMemo(
    () =>
      visibleWorks({
        projects: allWorks,
        catalogue: 'smallWorks',
        user,
        operatives,
        bookings,
        managerBookings: managerSiteBookings,
      }).filter((project) => project.isLive),
    [allWorks, user, operatives, bookings, managerSiteBookings]
  )
  const otherPicks = enabledScheduleLocationPicks(scheduleOpts)
  const list = tab === 'smallWorks' ? liveSmallWorks : liveProjects
  const filtered = list.filter((project) => {
    const q = search.trim().toLowerCase()
    if (!q) return true
    return project.siteName.toLowerCase().includes(q) || project.jobNumber.toLowerCase().includes(q)
  })

  const resolvedUserId = useMemo(() => {
    if (row.userId) return row.userId
    if (!row.operativeId) return undefined
    const op = operatives.find((entry) => entry.id === row.operativeId)
    if (!op) return undefined
    const byEmail = users.find((entry) => entry.email.trim().toLowerCase() === op.email.trim().toLowerCase())
    if (byEmail) return byEmail.id
    return users.find((entry) => findOperativeForUser(entry, operatives)?.id === row.operativeId)?.id
  }, [row.userId, row.operativeId, operatives, users])

  const linkedOperative = useMemo(() => {
    if (row.operativeId) return operatives.find((entry) => entry.id === row.operativeId)
    if (!resolvedUserId) return undefined
    const matchedUser = users.find((entry) => entry.id === resolvedUserId)
    return matchedUser ? findOperativeForUser(matchedUser, operatives) : undefined
  }, [row.operativeId, resolvedUserId, operatives, users])

  const currentLabel = useMemo(() => {
    if (row.locationType === 'office') return 'Office'
    if (row.locationType === 'working_from_home') return 'Working from home'
    if (row.locationType === 'site_survey') return 'Site survey'
    if (row.locationType === 'custom') return row.customLocationName || 'Custom'
    const project = allWorks.find((entry) => entry.id === row.projectId)
    if (project) return `${project.jobNumber} · ${project.siteName}`
    return row.kind === 'operative' ? 'Project booking' : 'Current booking'
  }, [row, allWorks])

  const saveToProject = async (project: Project) => {
    if (!organization?.id || !row.bookingId || !user) return
    setSaving(true)
    setError(null)
    try {
      const smallWorksJob = isSmallWorksJobType(project.jobType)
      if (row.kind === 'operative') {
        await updateBooking(row.bookingId, { projectId: project.id })
      } else if (linkedOperative) {
        await createBooking({
          operativeId: linkedOperative.id,
          projectId: project.id,
          date: day,
          timeSlot: operativeSlotFromRaw(row.timeSlotRaw),
          bookedBy: user.id,
          status: 'Confirmed',
          notes: '',
          workStartTime: row.workStartTime,
          workEndTime: row.workEndTime,
          organizationId: organization.id,
        })
        await deleteManagerSiteBooking(organization.id, row.bookingId)
      } else {
        await updateManagerSiteBooking(organization.id, row.bookingId, {
          locationType: smallWorksJob ? 'small_work' : 'project',
          locationId: project.id,
          customLocationName: undefined,
        })
      }
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not update booking')
    } finally {
      setSaving(false)
    }
  }

  const saveToOther = async (pick: ScheduleLocationPick) => {
    if (!organization?.id) return
    if (!resolvedUserId) {
      setError('This person needs a user account to be booked to Other.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      if (row.kind === 'operative' && row.bookingId) {
        await saveManagerSiteBooking(organization.id, {
          userId: resolvedUserId,
          date: day,
          timeSlot: managerSlotFromRaw(row.timeSlotRaw),
          locationType: pick.locationType,
          customLocationName: pick.customLocationName,
          workStartTime: row.workStartTime,
          workEndTime: row.workEndTime,
        })
        await deleteBooking(row.bookingId, organization.id)
      } else if (row.bookingId) {
        await updateManagerSiteBooking(organization.id, row.bookingId, {
          locationType: pick.locationType,
          locationId: undefined,
          customLocationName: pick.customLocationName,
        })
      }
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not update booking')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open hue="daily" title={row.name} subtitle="Change this booking" onClose={onClose} footer={false}>
      <div className="stack" style={{ gap: 14 }}>
        <p className="muted small">
          Currently booked to <b>{currentLabel}</b>. Move them to Other, a project, or small works.
        </p>
        <div className="grid g3" style={{ gap: 8 }}>
          <button type="button" className={`btn ${tab === 'other' ? 'primary' : ''}`} onClick={() => setTab('other')}>
            Other
          </button>
          <button type="button" className={`btn ${tab === 'projects' ? 'primary' : ''}`} onClick={() => setTab('projects')}>
            Projects
          </button>
          <button
            type="button"
            className={`btn ${tab === 'smallWorks' ? 'primary' : ''}`}
            onClick={() => setTab('smallWorks')}
          >
            Small works
          </button>
        </div>
        {error ? <p className="banner" data-hue="red">{error}</p> : null}
        {saving ? <p className="muted small">Saving…</p> : null}
        {tab === 'other' ? (
          <div className="stack" style={{ gap: 12 }}>
            {otherPicks.length === 0 ? (
              <p className="muted small">No saved Other locations. Add a custom one for this booking.</p>
            ) : (
              <div className="rows">
                {otherPicks.map((pick) => (
                  <button
                    key={pick.id}
                    type="button"
                    className="ritem"
                    data-hue="daily"
                    onClick={() => void saveToOther(pick)}
                  >
                    <span className="grow">
                      <span className="t">{pick.title}</span>
                    </span>
                  </button>
                ))}
              </div>
            )}
            <CustomOtherLocationField
              disabled={saving}
              onUse={(name) => {
                const pick = oneOffCustomLocationPick(name)
                if (pick) void saveToOther(pick)
              }}
            />
          </div>
        ) : null}
        {tab === 'projects' || tab === 'smallWorks' ? (
          <>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={tab === 'smallWorks' ? 'Search small works…' : 'Search projects…'}
              className="in"
            />
            <div className="rows">
              {filtered.map((project) => (
                <button
                  key={project.id}
                  type="button"
                  className="ritem"
                  data-hue={tab === 'smallWorks' ? 'sw' : 'proj'}
                  onClick={() => void saveToProject(project)}
                >
                  <span className="grow">
                    <span className="t">
                      {project.jobNumber} · {project.siteName}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </>
        ) : null}
      </div>
    </Modal>
  )
}

export function managerBookingToTarget(booking: ManagerSiteBooking, name: string): OverviewBookingTarget {
  return {
    id: `mgr-${booking.id}`,
    name,
    kind: 'manager',
    bookingId: booking.id,
    userId: booking.userId,
    projectId: booking.locationId,
    locationType: booking.locationType,
    customLocationName: booking.customLocationName,
    timeSlotRaw: booking.timeSlot,
    workStartTime: booking.workStartTime,
    workEndTime: booking.workEndTime,
  }
}
