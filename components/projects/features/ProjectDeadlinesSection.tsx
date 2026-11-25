/**
 * iOS parity source: Views/ProjectDeadlinesView.swift, Views/DLScreens.swift
 * Spec: docs/ios-parity/IOS_APP_BLUEPRINT.md §6.24
 */
'use client'

import { useEffect, useMemo, useState } from 'react'
import { FlagIcon } from '@heroicons/react/24/solid'
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline'
import { useAuthStore } from '@/lib/stores/authStore'
import { useBookingStore } from '@/lib/stores/bookingStore'
import { useManagerScheduleStore } from '@/lib/stores/managerScheduleStore'
import { useOperativeStore } from '@/lib/stores/operativeStore'
import { useOrgUserStore, useSiteAuditStore } from '@/lib/stores/siteAuditStore'
import { useTaskStore } from '@/lib/stores/taskStore'
import { useDeadlineStore } from '@/lib/stores/deadlineStore'
import { isOperativeMode } from '@/lib/permissions'
import { liveUserIdsOnJob } from '@/lib/access/workAccess'
import { isPendingPerson } from '@/lib/staff/pendingPeople'
import { DEADLINE_MULTIPLE_FLOORS_GROUP, DEADLINE_TABS, deadlineSummaryLine, deadlineTabCounts, personIdSet } from '@/lib/canonical'
import type { DeadlineTabKey } from '@/lib/canonical'
import { rulebookPerson, rulebookRoster } from '@/lib/staff/rulebookPeople'
import { healthSafetyFilePath, uploadFile } from '@/lib/firebase/storageUtils'
import { prepareClientUpload } from '@/lib/security/stripPhotoLocation'
import { organizationZoneOr } from '@/lib/orgTime/activeOrganizationZone'
import { notifyNewDeadlineAssignees } from '@/lib/deadlines/notify'
import {
  assigneeInitials,
  completeDeadline,
  deadlineDayLabel,
  deadlineLocationList,
  deadlineTrades,
  deadlineView,
  emptyDeadlineCopy,
  filterDeadlines,
  formatDay,
  groupDeadlines,
  offsetDays,
  projectNotificationName,
  replaceDeadline,
  rescheduleDeadline,
  scopedDeadlines,
  setDeadlineProgress,
  slippageDays,
  timelineItems,
  timelineWindowStart,
  timesRescheduled,
  withFileAttached,
} from '@/lib/deadlines/logic'
import type { Deadline, DeadlineGroup, DeadlineGrouping } from '@/lib/deadlines/types'
import type { Project, User } from '@/types'
import { DetailSheet, EditorSheet, ProgressBar, ProgressRing, RescheduleSheet } from '@/components/projects/features/deadlines/DeadlinePanels'
import '@/app/pages-ui.css'
import '@/app/tasks-ui.css'
import '@/app/deadlines-ui.css'

type Mode = 'list' | 'timeline'

const GROUP_LABELS: { id: DeadlineGrouping; label: string }[] = [
  { id: 'date', label: 'Due date' },
  { id: 'location', label: 'Floor / area' },
  { id: 'trade', label: 'Trade' },
  { id: 'assignee', label: 'Who' },
]

function displayName(user: User): string {
  return `${user.firstName} ${user.surname}`.trim() || user.email
}

export function ProjectDeadlinesSection({ project, isSmallWorks }: { project: Project; isSmallWorks: boolean }) {
  const { organization, user } = useAuthStore()
  const { users, loadUsers } = useOrgUserStore()
  const { bookings, loadBookings } = useBookingStore()
  const { managerSiteBookings, loadManagerSiteBookings } = useManagerScheduleStore()
  const { operatives, loadOperatives } = useOperativeStore()
  const { tasks, loadTasks } = useTaskStore()
  const { audits, loadAudits } = useSiteAuditStore()
  const { items, loading, loaded, error, load, save } = useDeadlineStore()
  const [now] = useState(() => new Date())
  const [mode, setMode] = useState<Mode>('list')
  const [filter, setFilter] = useState<DeadlineTabKey>('all')
  const [grouping, setGrouping] = useState<DeadlineGrouping>('date')
  const [search, setSearch] = useState('')
  const [tradeFilter, setTradeFilter] = useState('All trades')
  const [showCompleted, setShowCompleted] = useState(false)
  const [openId, setOpenId] = useState<string | null>(null)
  const [editing, setEditing] = useState<Deadline | 'new' | null>(null)
  const [rescheduleId, setRescheduleId] = useState<string | null>(null)
  const [banner, setBanner] = useState<string | null>(null)

  const canManage = !isOperativeMode(user)
  const contextKind = isSmallWorks ? 'Small Work' : 'Project'
  const authorName = user ? displayName(user) : 'Unknown'

  useEffect(() => {
    if (!organization?.id) return
    load(organization.id, project.id, isSmallWorks)
    loadUsers(organization.id)
    loadBookings(organization.id, { fullHistory: true })
    loadManagerSiteBookings(organization.id, { fullHistory: true })
    loadOperatives(organization.id)
    loadTasks(organization.id)
    loadAudits(organization.id)
    // Rulebook 1.9.0 §1: the deadline programme is live while this section is open.
    return () => useDeadlineStore.getState().stopListening()
  }, [
    organization?.id,
    project.id,
    isSmallWorks,
    load,
    loadUsers,
    loadBookings,
    loadManagerSiteBookings,
    loadOperatives,
    loadTasks,
    loadAudits,
  ])

  // Rulebook §8 `personIdSet`: a person's deadlines under every id they go by (a ghost given app access keeps the
  // deadlines filed under the ghost id, which accepting puts on `formerUserIds`).
  const myIds = useMemo(() => (user ? personIdSet(rulebookPerson(user, users), rulebookRoster(users)) : []), [user, users])
  const scoped = useMemo(() => scopedDeadlines(items, canManage ? null : myIds), [items, canManage, myIds])
  const trades = useMemo(() => deadlineTrades(scoped), [scoped])
  // Rulebook 1.94.0 §23: tabs, counts, groups and the summary all read `deadlineDisplay` (via `deadlineView`).
  const searched = useMemo(
    () => filterDeadlines({ items: scoped, tab: 'all', tradeFilter, search, now }),
    [scoped, tradeFilter, search, now]
  )
  const displayInputs = useMemo(
    () =>
      searched.map((item) => ({
        title: item.title,
        status: item.status,
        progress: item.progress,
        due: item.due,
        start: item.start,
        createdAt: item.history.find((entry) => entry.kind.type === 'created')?.at ?? null,
        completedAt: item.completedAt,
      })),
    [searched]
  )
  const tabCounts = useMemo(() => deadlineTabCounts(displayInputs, now.getTime(), organizationZoneOr()), [displayInputs, now])
  const summary = useMemo(() => deadlineSummaryLine(displayInputs, now.getTime(), organizationZoneOr()), [displayInputs, now])
  const filtered = useMemo(() => searched.filter((item) => deadlineView(item, now).tabs.includes(filter)), [searched, filter, now])
  const groups = useMemo(() => groupDeadlines(filtered, grouping, now), [filtered, grouping, now])
  const timeline = useMemo(() => timelineItems(filtered), [filtered])
  const people = useMemo(() => {
    const live = liveUserIdsOnJob({
      projectId: project.id,
      bookings,
      managerBookings: managerSiteBookings,
      tasks,
      operatives,
      users,
    })
    return users
      // Owner 25 Nov (reverses 1.34.0 J2 for deadlines): a ghost operative (no login) may be a deadline assignee, as
      // on iOS. It is never notified: `deadlineAssignedRecipients` drops ghosts (rulebook §13).
      .filter((member) => member.isActive !== false && !isPendingPerson(member))
      .map((member) => ({
        id: member.id,
        name: displayName(member),
        subtitle: member.tradeTypeCustom || member.tradeTypePreset || member.email,
        isLive: live.has(member.id),
      }))
  }, [project.id, bookings, managerSiteBookings, tasks, operatives, users])
  const jobAudits = useMemo(
    () => audits.filter((audit) => audit.projectId === project.id && (canManage || audit.visibleToOperatives)),
    [audits, project.id, canManage]
  )
  const openItem = items.find((item) => item.id === openId) || null
  const rescheduleItem = items.find((item) => item.id === rescheduleId) || null
  const empty = emptyDeadlineCopy(filter, canManage, contextKind)

  async function persist(nextItems: Deadline[], notifyFrom: Deadline | null, draftId: string) {
    if (!organization?.id) return
    const written = await save(organization.id, project.id, isSmallWorks, nextItems)
    const saved = written.find((item) => item.id === draftId)
    if (saved) {
      void notifyNewDeadlineAssignees({
        organizationId: organization.id,
        previous: notifyFrom,
        current: saved,
        projectName: projectNotificationName(project.siteName, project.jobNumber),
        createdBy: authorName,
        actorUserId: user?.id ?? null,
        users,
      }).catch(() => {})
    }
  }

  async function commit(draft: Deadline, file: File | null) {
    if (!organization?.id || !user) throw new Error('Sign in again, then add the deadline.')
    setBanner(null)
    if (!useDeadlineStore.getState().loaded) await load(organization.id, project.id, isSmallWorks)
    let next = { ...draft, projectId: project.id, contextKind }
    if (!next.createdByUserId) next.createdByUserId = user.id
    if (file) {
      try {
        setBanner('Uploading the attachment…')
        const prepared = await prepareClientUpload(file, 'work')
        if (prepared.error) throw new Error(prepared.error)
        const path = healthSafetyFilePath(organization.id, project.id, 'deadlines', prepared.file.name)
        const url = await uploadFile(path, prepared.file, prepared.file.type)
        next = withFileAttached(next, file.name, url, authorName, new Date())
        setBanner(null)
      } catch (err: unknown) {
        const message = deadlineErrorText(err, 'The file could not be attached, so the deadline was not saved.')
        setBanner(message)
        throw new Error(message)
      }
    }
    // Owner 25 Nov: read the list after the upload, never the copy from before it — the upload can take a while and
    // the live list may have moved on (a save then wrote a stale list or lost this edit).
    if (!useDeadlineStore.getState().loaded) await load(organization.id, project.id, isSmallWorks)
    const currentItems = useDeadlineStore.getState().items
    const previous = currentItems.find((item) => item.id === next.id) || null
    try {
      const written = await save(organization.id, project.id, isSmallWorks, replaceDeadline(currentItems, next), [next.id])
      const saved = written.find((item) => item.id === next.id)
      if (!saved) throw new Error('The deadline did not stay on the list. Try saving it again.')
      if (file && !saved.fileURL) throw new Error('The file uploaded but was not saved on the deadline. Try saving it again.')
      if (saved) {
        void notifyNewDeadlineAssignees({
          organizationId: organization.id,
          previous,
          current: saved,
          projectName: projectNotificationName(project.siteName, project.jobNumber),
          createdBy: authorName,
          actorUserId: user?.id ?? null,
          users,
        }).catch(() => {})
      }
      setBanner(null)
      setEditing(null)
    } catch (err: unknown) {
      const message = deadlineErrorText(err, 'Could not save the deadline.')
      setBanner(message)
      throw new Error(message)
    }
  }

  async function mutate(next: Deadline) {
    const previous = items.find((item) => item.id === next.id) || null
    try {
      await persist(replaceDeadline(items, next), previous, next.id)
    } catch (err: unknown) {
      setBanner(err instanceof Error ? err.message : 'Could not save the deadline.')
    }
  }

  const summaryParts = summary.split(' · ')

  return (
    <div className="tk-page dl-page">
      <header className="tk-head">
        <div className="flex min-w-0 items-start gap-3">
          <span className="badge-ico" data-hue="red">
            <FlagIcon className="h-6 w-6" />
          </span>
          <div className="min-w-0">
            <h1>Deadlines</h1>
            {scoped.length > 0 ? (
              <p className="dl-summary">
                <b>{summaryParts[0]}</b>
                {summaryParts[1] ? (
                  <>
                    {' · '}
                    <b>{summaryParts[1]}</b>
                  </>
                ) : null}
                {summaryParts.slice(2).map((part) => ` · ${part}`)}
              </p>
            ) : null}
          </div>
        </div>
        <div className="flex max-w-full flex-wrap items-center gap-2">
          <div className="tk-seg" role="group" aria-label="View">
            <button type="button" aria-pressed={mode === 'list'} onClick={() => setMode('list')}>
              List
            </button>
            <button type="button" aria-pressed={mode === 'timeline'} onClick={() => setMode('timeline')}>
              Timeline
            </button>
          </div>
          {canManage ? (
            <button type="button" className="tk-btn primary" onClick={() => setEditing('new')}>
              Add deadline
            </button>
          ) : null}
        </div>
      </header>

      {loading && !loaded ? <p className="text-sm text-(--ink3)">Loading deadlines…</p> : null}
      {banner || error ? <p className="text-sm font-semibold text-(--red)">{banner || error}</p> : null}
      {error && !loaded && organization?.id ? (
        <button type="button" className="tk-btn sm" onClick={() => void load(organization.id, project.id, isSmallWorks)}>
          Try again
        </button>
      ) : null}

      <div className="tk-tabs" role="tablist" aria-label="Deadline lists">
        {DEADLINE_TABS.map((tab) => (
          <button key={tab.key} type="button" role="tab" className="tk-tab" aria-selected={filter === tab.key} onClick={() => setFilter(tab.key)}>
            {tab.label}
            <span
              className={`n${tab.key === 'overdue' && tabCounts.overdue > 0 ? ' red' : ''}${
                tab.key === 'behindPace' && tabCounts.behindPace > 0 ? ' amber' : ''
              }`}
            >
              {tabCounts[tab.key]}
            </span>
          </button>
        ))}
      </div>

      <div className="tk-toolbar">
        <label className="tk-search">
          <MagnifyingGlassIcon aria-hidden />
          <input
            placeholder="Search deadlines, floors, trades"
            aria-label="Search deadlines"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <select className="tk-select" aria-label="Trade" value={tradeFilter} onChange={(event) => setTradeFilter(event.target.value)}>
          {trades.map((trade) => (
            <option key={trade} value={trade}>
              {trade}
            </option>
          ))}
        </select>
        <select className="tk-select" aria-label="Group deadlines" value={grouping} onChange={(event) => setGrouping(event.target.value as DeadlineGrouping)}>
          {GROUP_LABELS.map((option) => (
            <option key={option.id} value={option.id}>
              Group: {option.label}
            </option>
          ))}
        </select>
      </div>

      {mode === 'timeline' ? (
        <Timeline rows={timeline} now={now} onOpen={setOpenId} />
      ) : groups.length === 0 ? (
        <div className="tk-empty">
          <h3>{empty.title}</h3>
          <p>{empty.message}</p>
          {canManage && filter === 'all' ? (
            <button type="button" className="tk-btn primary mt-4" onClick={() => setEditing('new')}>
              Add deadline
            </button>
          ) : null}
        </div>
      ) : (
        groups.map((group) => {
          const collapsed = grouping === 'date' && group.id === 'completed' && filter === 'all' && !showCompleted
          return (
            <section key={group.id} className="tk-group">
              <h3 className="dl-group-h" data-dl-tone={groupTone(group)}>
                {group.title}
                <span className="count">{group.items.length}</span>
                <span className="grow" />
                {grouping === 'date' && group.id === 'completed' && filter === 'all' ? (
                  <button type="button" aria-expanded={!collapsed} onClick={() => setShowCompleted(!showCompleted)}>
                    {collapsed ? 'Show' : 'Hide'}
                  </button>
                ) : null}
              </h3>
              {collapsed
                ? null
                : group.items.map((item) => (
                    <DeadlineRow
                      key={item.id}
                      item={item}
                      now={now}
                      showLocation={grouping !== 'location' || group.id === DEADLINE_MULTIPLE_FLOORS_GROUP}
                      canManage={canManage}
                      onOpen={() => setOpenId(item.id)}
                    />
                  ))}
            </section>
          )
        })
      )}

      {openItem ? (
        <DetailSheet
          item={openItem}
          items={items}
          projectLabel={projectNotificationName(project.siteName, project.jobNumber) || contextKind}
          now={now}
          canManage={canManage}
          audits={jobAudits}
          onClose={() => setOpenId(null)}
          onEdit={() => setEditing(openItem)}
          onReschedule={() => setRescheduleId(openItem.id)}
          onOpen={setOpenId}
          onProgress={(pct) => mutate(setDeadlineProgress(openItem, pct, authorName, new Date()))}
          onComplete={() => mutate(completeDeadline(openItem, authorName, new Date()))}
        />
      ) : null}
      {editing ? (
        <EditorSheet
          existing={editing === 'new' ? null : editing}
          contextKind={contextKind}
          people={people}
          audits={jobAudits}
          authorName={authorName}
          onClose={() => setEditing(null)}
          onSave={(draft, file) => commit(draft, file)}
        />
      ) : null}
      {rescheduleItem ? (
        <RescheduleSheet
          item={rescheduleItem}
          items={items}
          onClose={() => setRescheduleId(null)}
          onSave={(date, reason) => {
            const next = rescheduleDeadline(rescheduleItem, date, reason, authorName, new Date())
            if (!next) return
            setRescheduleId(null)
            void mutate(next)
          }}
        />
      ) : null}
    </div>
  )
}

/** The real reason a save failed (Firebase code included), never a generic line alone. */
function deadlineErrorText(err: unknown, fallback: string): string {
  const message = err instanceof Error ? err.message.trim() : ''
  const code = typeof err === 'object' && err !== null && 'code' in err ? String((err as { code?: unknown }).code || '') : ''
  if (!message) return code ? `${fallback} (${code})` : fallback
  return code && !message.includes(code) ? `${message} (${code})` : message
}

/** The group heading colour: overdue red, this week amber, completed green, the rest plain. */
function groupTone(group: DeadlineGroup): string | undefined {
  if (group.tone === 'red') return 'red'
  if (group.tone === 'amber') return 'amber'
  if (group.tone === 'green') return 'green'
  return undefined
}

function DeadlineRow({
  item,
  now,
  showLocation,
  canManage,
  onOpen,
}: {
  item: Deadline
  now: Date
  showLocation: boolean
  canManage: boolean
  onOpen: () => void
}) {
  const view = deadlineView(item, now)
  const slip = slippageDays(item)
  const initials = assigneeInitials(item.assignees)
  const edge = view.status === 'overdue' ? 'red' : view.tone === 'amber' ? 'amber' : undefined
  const done = view.group === 'completed'
  const dueDay = done && item.completedAt ? deadlineDayLabel(item.completedAt) : deadlineDayLabel(item.due, true)
  return (
    <div
      className={`dl-row${done ? ' done' : ''}`}
      data-edge={edge}
      data-dl-tone={view.tone}
      role="button"
      tabIndex={0}
      aria-label={`${item.title}, ${view.statusLabel}, ${view.dueText}`}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onOpen()
        }
      }}
    >
      <ProgressRing view={view} />
      <div className="min-w-0">
        <div className="title">{item.title}</div>
        <div className="tags">
          {item.isCritical ? <span className="dl-tag critical">Critical path</span> : null}
          {view.status === 'blocked' ? <span className="dl-status">Blocked</span> : null}
          {showLocation
            ? deadlineLocationList(item).map((floor) => (
                <span key={floor} className="dl-tag">
                  {floor}
                </span>
              ))
            : null}
          {item.trade ? <span className="dl-tag">{item.trade}</span> : null}
          {timesRescheduled(item) > 0 ? <span className="dl-tag">{slip > 0 ? `+${slip}d slip` : 'moved'}</span> : null}
        </div>
        {item.status === 'blocked' && item.blockedReason ? <p className="mt-1 text-[13px] text-(--ink2)">{item.blockedReason}</p> : null}
      </div>
      <div className="bar-cell">
        <ProgressBar view={view} />
      </div>
      <div className="due">
        <b>{view.dueText}</b>
        <span>{dueDay}</span>
      </div>
      <div className="people tk-avatars">
        {initials.slice(0, 3).map((letters, index) => (
          <span key={`${letters}-${index}`} className="tk-avatar">
            {letters}
          </span>
        ))}
      </div>
      {canManage && !done ? (
        <button
          type="button"
          className="tk-btn sm"
          onClick={(event) => {
            event.stopPropagation()
            onOpen()
          }}
        >
          Update
        </button>
      ) : (
        <span />
      )}
    </div>
  )
}

function Timeline({ rows, now, onOpen }: { rows: Deadline[]; now: Date; onOpen: (id: string) => void }) {
  const start = timelineWindowStart(now)
  const windowDays = 42
  if (rows.length === 0) {
    return (
      <div className="tk-empty">
        <h3>Nothing to plot</h3>
        <p>Deadlines with a due date appear here as bars.</p>
      </div>
    )
  }
  const todayAt = (offsetDays(start, now) + 0.5) / windowDays
  return (
    <section>
      <div className="dl-tl">
        <div className="dl-tl-today" style={{ left: `calc(12px + (100% - 24px) * ${todayAt})` }} aria-hidden>
          <span>Today</span>
        </div>
        <div className="dl-tl-head" aria-hidden>
          {Array.from({ length: 6 }, (_, week) => (
            <span key={week} style={{ width: `${(7 / windowDays) * 100}%` }}>
              w/c {formatDay(new Date(start.getTime() + week * 7 * 86_400_000))}
            </span>
          ))}
        </div>
        {rows.map((item) => {
          const view = deadlineView(item, now)
          const s = Math.max(offsetDays(start, item.start || item.due), 0)
          const e = Math.min(offsetDays(start, item.due) + 1, windowDays)
          const span = Math.max(e - s, 0.6)
          const dueAt = offsetDays(start, item.due) + 0.5
          const when = view.status === 'overdue' || view.group === 'completed' ? view.dueText : deadlineDayLabel(item.due)
          return (
            <button
              key={item.id}
              type="button"
              className="dl-tl-row"
              data-dl-tone={view.tone}
              aria-label={`${item.title}, ${view.progressPercent}% complete, due ${deadlineDayLabel(item.due)}, ${view.statusLabel}`}
              onClick={() => onOpen(item.id)}
            >
              <span className="dl-tl-label">
                {item.isCritical ? <FlagIcon className="h-3 w-3 text-(--red)" aria-label="Critical path" /> : null}
                <span className="min-w-0 truncate">{item.title}</span>
                <span className="when">{when}</span>
              </span>
              <span className="dl-tl-track">
                {e > 0 && s < windowDays ? (
                  <span className="dl-tl-bar" style={{ left: `${(s / windowDays) * 100}%`, width: `${(span / windowDays) * 100}%` }}>
                    <span className="done" style={{ width: `${view.progressPercent}%` }} />
                  </span>
                ) : null}
                {dueAt >= 0 && dueAt <= windowDays ? <span className="dl-tl-due" style={{ left: `${(dueAt / windowDays) * 100}%` }} /> : null}
              </span>
            </button>
          )
        })}
      </div>
      <p className="dl-tl-note">
        Bars run start to due: the solid part is progress, the pale part is still to do, and ◆ is the due date. The teal line is today.
      </p>
    </section>
  )
}
