/**
 * iOS parity source: Views/ProjectDeadlinesView.swift, Views/DLScreens.swift
 * Spec: docs/ios-parity/IOS_APP_BLUEPRINT.md §6.24
 */
'use client'

import { useEffect, useMemo, useState } from 'react'
import { FlagIcon } from '@heroicons/react/24/solid'
import { useAuthStore } from '@/lib/stores/authStore'
import { useBookingStore } from '@/lib/stores/bookingStore'
import { useManagerScheduleStore } from '@/lib/stores/managerScheduleStore'
import { useOperativeStore } from '@/lib/stores/operativeStore'
import { useOrgUserStore, useSiteAuditStore } from '@/lib/stores/siteAuditStore'
import { useTaskStore } from '@/lib/stores/taskStore'
import { useDeadlineStore } from '@/lib/stores/deadlineStore'
import { isOperativeMode } from '@/lib/permissions'
import { liveUserIdsOnJob } from '@/lib/access/workAccess'
import { healthSafetyFilePath, uploadFile } from '@/lib/firebase/storageUtils'
import { dateFromDayKey, dayKey } from '@/lib/ios-parity/londonTime'
import { notifyNewDeadlineAssignees } from '@/lib/deadlines/notify'
import {
  assigneeInitials,
  completeDeadline,
  deadlineStats,
  deadlineTrades,
  emptyDeadlineCopy,
  filterDeadlines,
  formatDay,
  formatDayNumber,
  formatFullDay,
  formatWeekdayLetter,
  groupDeadlines,
  hasOverdueOnDay,
  isAtRisk,
  loadOnDay,
  offsetDays,
  projectNotificationName,
  railDays,
  replaceDeadline,
  rescheduleDeadline,
  riskBannerMessage,
  scopedDeadlines,
  setDeadlineProgress,
  slippageDays,
  timelineItems,
  timelineWindowStart,
  timesRescheduled,
  urgency,
  urgencyTone,
  visibleGroups,
  withFileAttached,
} from '@/lib/deadlines/logic'
import type { Deadline, DeadlineFilter, DeadlineGrouping } from '@/lib/deadlines/types'
import type { Project, User } from '@/types'
import { Countdown, DetailSheet, EditorSheet, Pacing, RescheduleSheet } from '@/components/projects/features/deadlines/DeadlinePanels'

type Mode = 'list' | 'timeline'

const GROUP_LABELS: { id: DeadlineGrouping; label: string }[] = [
  { id: 'date', label: 'Date' },
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
  const [filter, setFilter] = useState<DeadlineFilter>('all')
  const [grouping, setGrouping] = useState<DeadlineGrouping>('date')
  const [search, setSearch] = useState('')
  const [tradeFilter, setTradeFilter] = useState('All trades')
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
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
    loadBookings(organization.id)
    loadManagerSiteBookings(organization.id)
    loadOperatives(organization.id)
    loadTasks(organization.id)
    loadAudits(organization.id)
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

  const scoped = useMemo(() => scopedDeadlines(items, canManage ? null : user?.id), [items, canManage, user?.id])
  const stats = useMemo(() => deadlineStats(scoped, now), [scoped, now])
  const trades = useMemo(() => deadlineTrades(scoped), [scoped])
  const filtered = useMemo(
    () => filterDeadlines({ items: scoped, filter, tradeFilter, search, now }),
    [scoped, filter, tradeFilter, search, now]
  )
  const groups = useMemo(() => {
    const selected = selectedDay ? dateFromDayKey(selectedDay) : null
    return visibleGroups(groupDeadlines(filtered, grouping, now), selected)
  }, [filtered, grouping, now, selectedDay])
  const timeline = useMemo(() => timelineItems(filtered), [filtered])
  const days = useMemo(() => railDays(now), [now])
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
      .filter((member) => member.isActive !== false)
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
  const risk = riskBannerMessage(stats)
  const empty = emptyDeadlineCopy(filter, canManage, contextKind)

  async function persist(nextItems: Deadline[], notifyFrom: Deadline | null, draftId: string) {
    if (!organization?.id) return
    const written = await save(organization.id, project.id, isSmallWorks, nextItems)
    const saved = written.find((item) => item.id === draftId)
    if (saved) {
      await notifyNewDeadlineAssignees({
        organizationId: organization.id,
        previous: notifyFrom,
        current: saved,
        projectName: projectNotificationName(project.siteName, project.jobNumber),
        createdBy: authorName,
      })
    }
  }

  async function commit(draft: Deadline, file: File | null) {
    if (!organization?.id || !user) throw new Error('Sign in again, then add the deadline.')
    setBanner(null)
    if (!loaded) await load(organization.id, project.id, isSmallWorks)
    const currentItems = useDeadlineStore.getState().items
    let next = { ...draft, projectId: project.id, contextKind }
    if (!next.createdByUserId) next.createdByUserId = user.id
    if (file) {
      try {
        const path = healthSafetyFilePath(organization.id, project.id, 'deadlines', file.name)
        const url = await uploadFile(path, file, file.type || 'application/octet-stream')
        next = withFileAttached(next, file.name, url, authorName, new Date())
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Could not attach the file.'
        setBanner(message)
        throw new Error(message)
      }
    }
    const previous = currentItems.find((item) => item.id === next.id) || null
    try {
      await persist(replaceDeadline(currentItems, next), previous, next.id)
      setEditing(null)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Could not save the deadline.'
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

  if (loading && !loaded) {
    return (
      <div className="stack" data-hue="red">
        <header className="phead">
          <span className="badge-ico">
            <FlagIcon className="h-6 w-6" />
          </span>
          <div>
            <h1>Deadlines</h1>
          </div>
        </header>
        <p className="text-sm text-[var(--ink3)]">Loading deadlines…</p>
      </div>
    )
  }

  return (
    <div className="stack" data-hue="red">
      <header className="phead">
        <span className="badge-ico">
          <FlagIcon className="h-6 w-6" />
        </span>
        <div className="min-w-0 grow">
          <h1>Deadlines</h1>
          <p className="sub">
            {stats.completeCount} of {scoped.length} deadlines met
          </p>
        </div>
        <div className="ml-auto flex gap-2">
          <button type="button" className="btn sm" onClick={() => setMode(mode === 'list' ? 'timeline' : 'list')}>
            {mode === 'list' ? 'Timeline' : 'List'}
          </button>
          {canManage ? (
            <button type="button" className="btn sm primary" onClick={() => setEditing('new')}>
              Add deadline
            </button>
          ) : null}
        </div>
      </header>

      {banner || error ? <p className="text-sm font-semibold text-[var(--red)]">{banner || error}</p> : null}

      <div className="grid grid-cols-2 gap-3">
        {(
          [
            ['overdue', String(stats.overdueCount), 'Overdue', 'red'],
            ['thisWeek', String(stats.thisWeekCount), 'Due this week', 'warn'],
            ['atRisk', String(stats.atRiskCount), 'Behind pace', 'leave'],
            ['complete', String(stats.completeCount), 'Completed', 'green'],
          ] as const
        ).map(([key, value, label, hue]) => (
          <button
            key={key}
            type="button"
            className="card pad text-left"
            data-hue={hue}
            onClick={() => {
              setFilter(key)
              setMode('list')
            }}
          >
            <p className="font-[family-name:var(--head)] text-2xl font-extrabold" style={{ color: 'var(--h)' }}>
              {value}
            </p>
            <p className="text-sm text-[var(--ink2)]">{label}</p>
          </button>
        ))}
      </div>

      {risk ? (
        <button
          type="button"
          className="card flex w-full items-center gap-3 p-3 text-left"
          data-hue={stats.overdueCount > 0 ? 'red' : 'warn'}
          onClick={() => {
            setFilter(stats.overdueCount > 0 ? 'overdue' : 'atRisk')
            setMode('list')
          }}
        >
          <span className="grid h-9 w-9 place-items-center rounded-full" style={{ background: 'var(--ht)', color: 'var(--h)' }}>
            <FlagIcon className="h-4 w-4" />
          </span>
          <span>
            <span className="block text-sm font-bold">{risk}</span>
            <span className="text-xs text-[var(--ink3)]">Review</span>
          </span>
        </button>
      ) : null}

      <section>
        <div className="mb-2 flex items-center gap-2">
          <h2 className="text-[11px] font-bold tracking-[0.08em] text-[var(--ink3)]">NEXT THREE WEEKS</h2>
          {selectedDay ? (
            <button type="button" className="ml-auto text-xs font-bold text-[var(--blue)]" onClick={() => setSelectedDay(null)}>
              Clear
            </button>
          ) : null}
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {days.map((day) => {
            const key = dayKey(day)
            const count = loadOnDay(scoped, day)
            const bad = hasOverdueOnDay(scoped, day, now)
            const today = key === dayKey(now)
            const selected = selectedDay === key
            return (
              <button
                key={key}
                type="button"
                onClick={() => setSelectedDay(selected ? null : key)}
                className="flex w-11 shrink-0 flex-col items-center rounded-xl px-1 py-2"
                data-hue={bad ? 'red' : count > 0 ? 'hs' : 'lib'}
                style={{ background: selected ? 'var(--h)' : today ? 'var(--ht)' : 'transparent', color: selected ? '#fff' : undefined }}
              >
                <span className="text-[10px] font-bold opacity-70">{formatWeekdayLetter(day)}</span>
                <span className="text-[15px] font-extrabold">{formatDayNumber(day)}</span>
                <span
                  className="mt-1 block rounded-full"
                  style={{
                    width: 14,
                    height: count === 0 ? 3 : Math.min(count, 4) * 3.5 + 2,
                    background: count === 0 ? 'transparent' : selected ? '#fff' : 'var(--h)',
                  }}
                />
              </button>
            )
          })}
        </div>
      </section>

      <div className="chips">
        {(
          [
            ['all', 'All', scoped.length],
            ['overdue', 'Overdue', stats.overdueCount],
            ['thisWeek', 'This week', stats.thisWeekCount],
            ['atRisk', 'At risk', stats.atRiskCount],
            ['complete', 'Complete', stats.completeCount],
          ] as const
        ).map(([id, label, count]) => (
          <button key={id} type="button" className={`chip ${filter === id ? 'on' : ''}`} onClick={() => setFilter(id)}>
            {label}
            <span className="n">{count}</span>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <input
          className="pp-in min-w-[220px] grow"
          placeholder="Search deadlines, floors, trades"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <select className="pp-in" aria-label="Group deadlines" value={grouping} onChange={(event) => setGrouping(event.target.value as DeadlineGrouping)}>
          {GROUP_LABELS.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="chips">
        {trades.map((trade) => (
          <button key={trade} type="button" className={`chip ${tradeFilter === trade ? 'on' : ''}`} onClick={() => setTradeFilter(trade)}>
            {trade}
          </button>
        ))}
      </div>

      {mode === 'timeline' ? (
        <Timeline rows={timeline} now={now} onOpen={setOpenId} />
      ) : groups.length === 0 ? (
        <div className="card pad">
          <h2 className="font-[family-name:var(--head)] text-lg font-extrabold">{empty.title}</h2>
          <p className="mt-1 text-sm text-[var(--ink3)]">{empty.message}</p>
          {canManage && filter === 'all' ? (
            <button type="button" className="btn primary mt-4" onClick={() => setEditing('new')}>
              Add a deadline
            </button>
          ) : null}
        </div>
      ) : (
        groups.map((group) => (
          <section key={group.id}>
            <h2 className="mb-2 flex items-center gap-2 text-[11px] font-bold tracking-[0.08em]" data-hue={group.tone || 'lib'} style={{ color: 'var(--h)' }}>
              <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: 'var(--h)' }} />
              {group.title.toUpperCase()}
              <span className="text-[var(--ink3)]">{group.items.length}</span>
            </h2>
            <div className="space-y-2">
              {group.items.map((item) => (
                <DeadlineCard key={item.id} item={item} now={now} showLocation={grouping !== 'location'} canManage={canManage} onOpen={() => setOpenId(item.id)} />
              ))}
            </div>
          </section>
        ))
      )}

      {openItem ? (
        <DetailSheet
          item={openItem}
          items={items}
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

function DeadlineCard({
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
  const value = urgency(item, now)
  const atRisk = isAtRisk(item, now)
  const slip = slippageDays(item)
  const initials = assigneeInitials(item.assignees)
  return (
    <article className="card relative cursor-pointer overflow-hidden p-4 pl-5" style={{ opacity: item.status === 'complete' ? 0.72 : 1 }} data-hue={urgencyTone(value)} onClick={onOpen}>
      <span className="absolute bottom-3 left-1.5 top-3 w-1 rounded-full" style={{ background: 'var(--h)' }} />
      {item.isCritical || atRisk || timesRescheduled(item) > 0 ? (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {item.isCritical ? <span className="pill solid">Critical path</span> : null}
          {atRisk ? (
            <span className="pill" data-hue="red" style={{ background: 'var(--ht)', color: 'var(--h)' }}>
              At risk
            </span>
          ) : null}
          {timesRescheduled(item) > 0 ? (
            <span className="pill" data-hue="warn" style={{ background: 'var(--ht)', color: 'var(--h)' }}>
              {slip > 0 ? `+${slip}d slip` : 'moved'}
            </span>
          ) : null}
        </div>
      ) : null}
      <div className="flex items-start gap-3">
        <h3 className="min-w-0 grow font-[family-name:var(--head)] text-base font-extrabold">{item.title}</h3>
        <Countdown value={value} />
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {showLocation && item.location ? <span className="pill">{item.location}</span> : null}
        {item.trade ? <span className="pill">{item.trade}</span> : null}
      </div>
      {item.status === 'blocked' && item.blockedReason ? (
        <p className="mt-2 rounded-xl bg-[var(--leave-t)] px-3 py-2 text-[12.5px] text-[var(--ink2)]">{item.blockedReason}</p>
      ) : item.status !== 'complete' ? (
        <div className="mt-2">
          <Pacing item={item} now={now} />
        </div>
      ) : null}
      <div className="mt-3 flex items-center gap-2 border-t border-[var(--line)] pt-3 text-xs text-[var(--ink3)]">
        <span>{item.status === 'complete' ? `Done ${formatDay(item.completedAt || item.due)}` : formatFullDay(item.due)}</span>
        <span className="ml-auto flex">
          {initials.slice(0, 3).map((letters, index) => (
            <span
              key={`${letters}-${index}`}
              className="grid h-6 w-6 place-items-center rounded-full bg-[var(--blue-t)] text-[10px] font-bold text-[var(--blue)]"
              style={{ marginLeft: index === 0 ? 0 : -6 }}
            >
              {letters}
            </span>
          ))}
        </span>
        {canManage && item.status !== 'complete' ? (
          <button
            type="button"
            className="btn sm"
            onClick={(event) => {
              event.stopPropagation()
              onOpen()
            }}
          >
            Update
          </button>
        ) : null}
      </div>
    </article>
  )
}

function Timeline({ rows, now, onOpen }: { rows: Deadline[]; now: Date; onOpen: (id: string) => void }) {
  const start = timelineWindowStart(now)
  const windowDays = 42
  if (rows.length === 0) {
    return (
      <div className="card pad">
        <h2 className="font-[family-name:var(--head)] text-lg font-extrabold">Nothing to plot</h2>
        <p className="mt-1 text-sm text-[var(--ink3)]">Open deadlines with a start and due date appear here as bars.</p>
      </div>
    )
  }
  return (
    <section>
      <h2 className="mb-2 text-[11px] font-bold tracking-[0.08em] text-[var(--ink3)]">SIX WEEK VIEW</h2>
      <div className="card relative overflow-hidden">
        <div className="relative px-3 pt-3">
          <div className="mb-1 flex text-[10px] font-bold text-[var(--ink3)]">
            {Array.from({ length: 6 }, (_, week) => (
              <span key={week} style={{ width: `${(7 / windowDays) * 100}%` }}>
                {formatDay(new Date(start.getTime() + week * 7 * 86_400_000))}
              </span>
            ))}
          </div>
          <span className="absolute bottom-0 top-6 w-px bg-[var(--hs)]" style={{ left: `calc(12px + (100% - 24px) * ${7 / windowDays})` }} />
        </div>
        {rows.map((item) => {
          const s = Math.max(offsetDays(start, item.start || item.due), 0)
          const e = Math.min(offsetDays(start, item.due) + 1, windowDays)
          const span = Math.max(e - s, 0.6)
          const tone = urgencyTone(urgency(item, now))
          return (
            <button key={item.id} type="button" className="block w-full px-3 py-2 text-left" onClick={() => onOpen(item.id)}>
              <span className="mb-1 flex items-center gap-2 text-[13.5px] font-semibold">
                {item.isCritical ? <FlagIcon className="h-3 w-3" /> : null}
                <span className="min-w-0 grow truncate">{item.title}</span>
                <span data-hue={tone} style={{ color: 'var(--h)' }}>
                  {formatDay(item.due)}
                </span>
              </span>
              <span className="relative block h-[18px] rounded-md bg-[var(--soft2)]">
                <span
                  className="absolute top-0 h-[18px] overflow-hidden rounded-md"
                  data-hue={tone}
                  style={{ left: `${(s / windowDays) * 100}%`, width: `${(span / windowDays) * 100}%`, background: 'var(--h)' }}
                >
                  <span className="absolute inset-y-0 right-0 bg-white/30" style={{ width: `${(1 - item.progress) * 100}%` }} />
                </span>
              </span>
            </button>
          )
        })}
      </div>
      <p className="mt-2 text-[11.5px] text-[var(--ink3)]">
        Bars run start to due. The pale end of a bar is work still outstanding; the teal line is today.
      </p>
    </section>
  )
}
