'use client'

import { useEffect, useMemo, useState } from 'react'
import { Modal } from '@/components/ui'
import { useAuthStore } from '@/lib/stores/authStore'
import { useBookingStore } from '@/lib/stores/bookingStore'
import { useManagerScheduleStore } from '@/lib/stores/managerScheduleStore'
import { useProjectStore } from '@/lib/stores/projectStore'
import { visibleWorks } from '@/lib/access/workAccess'
import {
  DEFAULT_MY_SCHEDULE,
  enabledScheduleLocationPicks,
  loadOrganizationDetails,
  type MyScheduleOptions,
  type ScheduleLocationPick,
} from '@/lib/settings/organizationSettings'
import { isSmallWorksJobType } from '@/lib/ios-parity/enums'
import type { ManagerLocationType, ManagerSiteBooking } from '@/lib/scheduling/managerSiteBookingUtils'
import type { OverviewPersonRow } from '@/lib/daily-overview/buildDailyOverview'
import type { Project } from '@/types'
import { useOperativeStore } from '@/lib/stores/operativeStore'

type DestTab = 'other' | 'projects' | 'smallWorks'

export type OverviewBookingTarget = OverviewPersonRow | {
  id: string
  name: string
  kind: 'manager'
  bookingId: string
  userId: string
  timeSlotRaw?: string
  workStartTime?: string
  workEndTime?: string
  locationType?: ManagerLocationType
  customLocationName?: string
  projectId?: string
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
  const { bookings, updateBooking, deleteBooking } = useBookingStore()
  const { managerSiteBookings, updateManagerSiteBooking, saveManagerSiteBooking } = useManagerScheduleStore()
  const { projects, smallWorks, loadProjects, loadSmallWorks } = useProjectStore()
  const { operatives } = useOperativeStore()
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
    return (
      project.siteName.toLowerCase().includes(q) ||
      project.jobNumber.toLowerCase().includes(q)
    )
  })

  const saveToProject = async (project: Project) => {
    if (!organization?.id || !row.bookingId) return
    setSaving(true)
    setError(null)
    try {
      const smallWorksJob = isSmallWorksJobType(project.jobType)
      if (row.kind === 'operative') {
        await updateBooking(row.bookingId, { projectId: project.id })
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
    const userId = row.userId
    if (!userId) {
      setError('This person needs a user account to be booked to Other.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      if (row.kind === 'operative' && row.bookingId) {
        await saveManagerSiteBooking(organization.id, {
          userId,
          date: day,
          timeSlot: row.timeSlotRaw || 'FULL_DAY',
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
        <p className="muted small">Book to Other, a project, or small works. Custom Other items come from Organisation → Schedule options.</p>
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
          otherPicks.length === 0 ? (
            <p className="muted small">Enable at least one location under Organisation → Schedule options to use Other.</p>
          ) : (
            <div className="rows">
              {otherPicks.map((pick) => (
                <button key={pick.id} type="button" className="ritem" data-hue="daily" onClick={() => void saveToOther(pick)}>
                  <span className="grow">
                    <span className="t">{pick.title}</span>
                  </span>
                </button>
              ))}
            </div>
          )
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
                    <span className="t">{project.jobNumber} · {project.siteName}</span>
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
