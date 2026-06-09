'use client'

import Link from 'next/link'
import { endOfWeek, format, isWithinInterval, startOfWeek, subWeeks } from 'date-fns'
import type { TileId } from '@/lib/stores/dashboardStore'
import { deriveWorkStatus, timelineProgressPercent } from '@/lib/projects/workStatus'
import { isTaskOverdue } from '@/lib/tasks/taskUtils'
import type {
  Booking,
  Client,
  HolidayBooking,
  Operative,
  Project,
  ProjectTask,
  SiteAudit,
  User,
} from '@/types'

export type DashboardTileData = {
  tasks: ProjectTask[]
  projects: Project[]
  smallWorks: Project[]
  bookings: Booking[]
  operatives: Operative[]
  warnings: { id: string }[]
  clients: Client[]
  audits: SiteAudit[]
  holidayBookings: HolidayBooking[]
  pendingLeaveCount: number
  user: User | null
  activeOperativesCount: number
}

function Widget({
  label,
  children,
  wide = false,
  link,
}: {
  label: string
  children: React.ReactNode
  wide?: boolean
  link?: string
}) {
  const inner = (
    <div
      className={`rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition${
        link ? ' cursor-pointer hover:border-indigo-300 hover:shadow-md group' : ''
      }${wide ? ' col-span-2' : ''}`}
    >
      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
      {children}
    </div>
  )
  if (link) {
    return (
      <Link href={link} className={wide ? 'col-span-2 block' : 'block'}>
        {inner}
      </Link>
    )
  }
  if (wide) return <div className="col-span-2">{inner}</div>
  return inner
}

function StatNum({ value, color = 'text-slate-900' }: { value: number | string; color?: string }) {
  return <p className={`text-3xl font-semibold leading-none ${color}`}>{value}</p>
}

function Pill({ label, color }: { label: string; color: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${color}`}>
      {label}
    </span>
  )
}

function Bar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="h-1.5 w-full rounded-full bg-slate-100">
      <div className={`h-1.5 rounded-full ${color}`} style={{ width: `${Math.min(100, pct)}%` }} />
    </div>
  )
}

function Sparkline({ data, color = '#3b82f6' }: { data: number[]; color?: string }) {
  if (data.length < 2) return null
  const max = Math.max(...data)
  const min = Math.min(...data)
  const range = max - min || 1
  const w = 200
  const h = 48
  const pts = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * w
      const y = h - ((v - min) / range) * h
      return `${x},${y}`
    })
    .join(' ')
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-12 w-full" preserveAspectRatio="none">
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  )
}

function MiniBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span className="truncate pr-2 text-xs text-slate-600">{label}</span>
        <span className="shrink-0 text-xs font-semibold text-slate-900">{value}</span>
      </div>
      <Bar pct={pct} color={color} />
    </div>
  )
}

function slotHours(slot: string): number {
  const normalized = `${slot}`.toUpperCase()
  if (normalized.includes('FULL')) return 8
  if (normalized === 'AM' || normalized === 'PM') return 4
  return 8
}

function leaveDaysForUser(bookings: HolidayBooking[], userId: string | undefined): {
  taken: number
  pending: number
  remaining: number
  allowance: number
} {
  if (!userId) return { taken: 0, pending: 0, remaining: 0, allowance: 0 }
  const mine = bookings.filter((b) => b.userId === userId)
  const taken = mine.filter((b) => b.status === 'approved' && !b.cancellationRequestedAt).length
  const pending = mine.filter((b) => b.status === 'pending' || b.cancellationRequestedAt != null).length
  return { taken, pending, remaining: 0, allowance: 0 }
}

function TileTasksOpen({ tasks }: { tasks: ProjectTask[] }) {
  const todo = tasks.filter((t) => t.status === 'To Do').length
  const inProg = tasks.filter((t) => t.status === 'In Progress').length
  const overdue = tasks.filter((t) => isTaskOverdue(t)).length
  return (
    <Widget label="Open tasks" link="/dashboard/tasks">
      <StatNum value={todo + inProg} />
      <div className="mt-2 flex flex-wrap gap-1.5">
        <Pill label={`${todo} to do`} color="bg-slate-100 text-slate-700" />
        <Pill label={`${inProg} in progress`} color="bg-blue-50 text-blue-700" />
        {overdue > 0 && <Pill label={`${overdue} overdue`} color="bg-red-50 text-red-700" />}
      </div>
    </Widget>
  )
}

function TileTasksOverdue({ tasks }: { tasks: ProjectTask[] }) {
  const overdue = tasks.filter((t) => isTaskOverdue(t))
  return (
    <Widget label="Overdue tasks" link="/dashboard/tasks">
      <StatNum value={overdue.length} color={overdue.length > 0 ? 'text-red-600' : 'text-slate-900'} />
      <p className="mt-1.5 text-xs text-slate-500">{overdue.length === 0 ? 'All tasks on time' : 'Past due date'}</p>
    </Widget>
  )
}

function TileTasksCompleted({ tasks }: { tasks: ProjectTask[] }) {
  const done = tasks.filter((t) => t.status === 'Completed').length
  return (
    <Widget label="Tasks completed" link="/dashboard/tasks">
      <StatNum value={done} color="text-green-600" />
      <p className="mt-1.5 text-xs text-slate-500">Total completed</p>
    </Widget>
  )
}

function TileTasksPriority({ tasks }: { tasks: ProjectTask[] }) {
  const open = tasks.filter((t) => t.status !== 'Completed')
  const counts: Record<string, number> = { Urgent: 0, High: 0, Normal: 0, Low: 0 }
  open.forEach((t) => {
    if (t.priority in counts) counts[t.priority]++
  })
  const max = Math.max(...Object.values(counts), 1)
  const colors: Record<string, string> = {
    Urgent: 'bg-red-500',
    High: 'bg-amber-500',
    Normal: 'bg-blue-500',
    Low: 'bg-slate-400',
  }
  return (
    <Widget label="Task priority split" wide link="/dashboard/tasks">
      <div className="mt-1 grid grid-cols-4 gap-3">
        {Object.entries(counts).map(([p, n]) => (
          <div key={p}>
            <div className="mb-1 flex items-end justify-between">
              <span className="text-[10px] text-slate-500">{p}</span>
              <span className="text-sm font-semibold text-slate-900">{n}</span>
            </div>
            <Bar pct={(n / max) * 100} color={colors[p]} />
          </div>
        ))}
      </div>
    </Widget>
  )
}

function TileProjectsActive({ projects, smallWorks }: { projects: Project[]; smallWorks: Project[] }) {
  const active = projects.filter((p) => p.isLive).length
  const activeWorks = smallWorks.filter((p) => p.isLive).length
  return (
    <Widget label="Active projects" link="/dashboard/projects">
      <StatNum value={active} />
      <p className="mt-1.5 text-xs text-slate-500">{activeWorks} active small works</p>
    </Widget>
  )
}

function TileProjectsPipeline({ projects, smallWorks }: { projects: Project[]; smallWorks: Project[] }) {
  const all = [...projects, ...smallWorks]
  const live = all.filter((p) => p.isLive).length
  const total = all.length
  const completed = all.filter((p) => !p.isLive).length
  const maxVal = Math.max(live, completed, 1)
  return (
    <Widget label="Project pipeline" wide link="/dashboard/projects">
      <div className="mt-2 space-y-2.5">
        <MiniBar label="Live / active" value={live} max={maxVal} color="bg-blue-500" />
        <MiniBar label="Completed" value={completed} max={maxVal} color="bg-green-500" />
        <MiniBar label="Total" value={total} max={maxVal} color="bg-slate-400" />
      </div>
    </Widget>
  )
}

function TileProjectHealth({ projects }: { projects: Project[] }) {
  const live = projects.filter((p) => p.isLive).slice(0, 5)
  return (
    <Widget label="Project health" wide link="/dashboard/projects">
      {live.length === 0 ? (
        <p className="mt-1 text-xs text-slate-400">No live projects</p>
      ) : (
        <div className="mt-2 space-y-2.5">
          {live.map((p) => {
            const status = deriveWorkStatus(p)
            const pct = timelineProgressPercent(p.startDate, p.endDate, status)
            const color = pct >= 75 ? 'bg-green-500' : pct >= 50 ? 'bg-amber-500' : 'bg-red-500'
            return (
              <div key={p.id}>
                <div className="mb-1 flex items-center justify-between">
                  <span className="truncate pr-2 text-xs font-medium text-slate-700">{p.siteName || p.jobNumber}</span>
                  <span className="shrink-0 text-xs font-semibold text-slate-900">{pct}%</span>
                </div>
                <Bar pct={pct} color={color} />
              </div>
            )
          })}
        </div>
      )}
    </Widget>
  )
}

function TileBookingsTotal({ bookings }: { bookings: Booking[] }) {
  return (
    <Widget label="Bookings this period" link="/dashboard/daily-overview">
      <StatNum value={bookings.length} />
      <p className="mt-1.5 text-xs text-slate-500">Across all projects</p>
    </Widget>
  )
}

function TileBookingClashes({ warnings }: { warnings: { id: string }[] }) {
  return (
    <Widget label="Booking clashes" link="/dashboard/warnings">
      <StatNum value={warnings.length} color={warnings.length > 0 ? 'text-amber-600' : 'text-slate-900'} />
      <p className="mt-1.5 text-xs text-slate-500">
        {warnings.length === 0 ? 'No clashes detected' : 'Operatives affected'}
      </p>
    </Widget>
  )
}

function TileBookingsTrend({ bookings }: { bookings: Booking[] }) {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const counts = days.map((_, i) =>
    bookings.filter((b) => {
      const d = b.date ? new Date(b.date) : null
      if (!d) return false
      const day = d.getDay()
      const target = i === 6 ? 0 : i + 1
      return day === target
    }).length
  )
  return (
    <Widget label="Bookings by day of week" wide link="/dashboard/daily-overview">
      <div className="mt-2">
        <Sparkline data={counts} color="#059669" />
        <div className="mt-1 flex justify-between">
          {days.map((d, i) => (
            <div key={d} className="flex flex-col items-center gap-0.5">
              <span className="text-[9px] text-slate-400">{d}</span>
              <span className="text-[11px] font-semibold text-slate-700">{counts[i]}</span>
            </div>
          ))}
        </div>
      </div>
    </Widget>
  )
}

function TileOperativesActive({ operatives, activeOperativesCount }: { operatives: Operative[]; activeOperativesCount: number }) {
  return (
    <Widget label="Active operatives" link="/dashboard/operatives">
      <StatNum value={activeOperativesCount || operatives.length} />
      <p className="mt-1.5 text-xs text-slate-500">On roster</p>
    </Widget>
  )
}

function TileOperativesUtilisation({ bookings, operatives }: { bookings: Booking[]; operatives: Operative[] }) {
  const booked = new Set(bookings.map((b) => b.operativeId).filter(Boolean)).size
  const total = Math.max(operatives.length, 1)
  const pct = Math.round((booked / total) * 100)
  return (
    <Widget label="Operative utilisation" wide link="/dashboard/operatives">
      <div className="mt-2 flex items-center gap-4">
        <div className="relative flex h-16 w-16 shrink-0 items-center justify-center">
          <svg viewBox="0 0 36 36" className="h-16 w-16 -rotate-90">
            <circle cx="18" cy="18" r="15.9" fill="none" stroke="#e2e8f0" strokeWidth="3.8" />
            <circle
              cx="18"
              cy="18"
              r="15.9"
              fill="none"
              stroke="#3b82f6"
              strokeWidth="3.8"
              strokeDasharray={`${pct} ${100 - pct}`}
              strokeLinecap="round"
            />
          </svg>
          <span className="absolute text-sm font-semibold text-slate-900">{pct}%</span>
        </div>
        <div>
          <p className="text-2xl font-semibold text-slate-900">
            {booked} <span className="text-sm text-slate-400">/ {total}</span>
          </p>
          <p className="mt-0.5 text-xs text-slate-500">Operatives currently booked</p>
        </div>
      </div>
    </Widget>
  )
}

function TileLeavePending({ count }: { count: number }) {
  return (
    <Widget label="Leave approvals" link="/dashboard/tasks">
      <StatNum value={count} color={count > 0 ? 'text-amber-600' : 'text-slate-900'} />
      <p className="mt-1.5 text-xs text-slate-500">Pending requests</p>
    </Widget>
  )
}

function TileLeaveCalendar({ user, holidayBookings }: { user: User | null; holidayBookings: HolidayBooking[] }) {
  const stats = leaveDaysForUser(holidayBookings, user?.id)
  const allowance = user?.annualLeaveDaysPerYear && user.annualLeaveDaysPerYear > 0 ? user.annualLeaveDaysPerYear : 28
  const remaining = Math.max(0, allowance - stats.taken)
  const max = Math.max(allowance, 1)
  return (
    <Widget label="Leave — taken vs allowance" wide link="/dashboard/annual-leave">
      <div className="mt-2 grid grid-cols-3 gap-3">
        {[
          { label: 'Taken', value: stats.taken, color: 'bg-orange-400', pct: (stats.taken / max) * 100 },
          { label: 'Pending', value: stats.pending, color: 'bg-amber-400', pct: (stats.pending / max) * 100 },
          { label: 'Remaining', value: remaining, color: 'bg-green-400', pct: (remaining / max) * 100 },
        ].map((s) => (
          <div key={s.label}>
            <div className="mb-1 flex items-end justify-between">
              <span className="text-[10px] text-slate-500">{s.label}</span>
              <span className="text-sm font-semibold text-slate-900">{s.value}</span>
            </div>
            <Bar pct={s.pct} color={s.color} />
          </div>
        ))}
      </div>
    </Widget>
  )
}

function TileAuditsOpen({ audits }: { audits: SiteAudit[] }) {
  return (
    <Widget label="Site audits" link="/dashboard/site-audit">
      <StatNum value={audits.length} />
      <p className="mt-1.5 text-xs text-slate-500">Recorded audits</p>
    </Widget>
  )
}

function TileAuditsScore({ audits }: { audits: SiteAudit[] }) {
  const months = Array.from({ length: 6 }, (_, i) => subWeeks(new Date(), (5 - i) * 4))
  const labels = months.map((d) => format(d, 'MMM'))
  const counts = months.map((anchor) => {
    const start = new Date(anchor.getFullYear(), anchor.getMonth(), 1)
    const end = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0, 23, 59, 59)
    return audits.filter((a) => {
      const d = new Date(a.date)
      return d >= start && d <= end
    }).length
  })
  return (
    <Widget label="Audit activity — last 6 months" wide link="/dashboard/site-audit">
      <div className="mt-2">
        <Sparkline data={counts.length >= 2 ? counts : [0, ...counts]} color="#059669" />
        <div className="mt-1 flex justify-between">
          {labels.map((m, i) => (
            <div key={m} className="flex flex-col items-center gap-0.5">
              <span className="text-[9px] text-slate-400">{m}</span>
              <span className="text-[11px] font-semibold text-slate-700">{counts[i]}</span>
            </div>
          ))}
        </div>
      </div>
    </Widget>
  )
}

function TileSmallWorks({ smallWorks }: { smallWorks: Project[] }) {
  const active = smallWorks.filter((p) => p.isLive).length
  return (
    <Widget label="Small works" link="/dashboard/small-works">
      <StatNum value={active} />
      <p className="mt-1.5 text-xs text-slate-500">Active jobs</p>
    </Widget>
  )
}

function TileSmallWorksStatus({ smallWorks }: { smallWorks: Project[] }) {
  const active = smallWorks.filter((p) => p.isLive).length
  const done = smallWorks.filter((p) => !p.isLive).length
  const max = Math.max(active, done, 1)
  return (
    <Widget label="Small works by status" wide link="/dashboard/small-works">
      <div className="mt-2 space-y-2.5">
        <MiniBar label="Active" value={active} max={max} color="bg-amber-500" />
        <MiniBar label="Completed" value={done} max={max} color="bg-green-500" />
      </div>
    </Widget>
  )
}

function TileTimesheetsSubmitted({ bookings, operatives }: { bookings: Booking[]; operatives: Operative[] }) {
  const start = startOfWeek(new Date(), { weekStartsOn: 1 })
  const end = endOfWeek(start, { weekStartsOn: 1 })
  const weekBookings = bookings.filter((b) => isWithinInterval(new Date(b.date), { start, end }))
  const rosterSize = Math.max(operatives.length, 1)
  return (
    <Widget label="Bookings this week" link="/dashboard/timesheets">
      <div className="flex items-baseline gap-1">
        <span className="text-3xl font-semibold text-slate-900">{weekBookings.length}</span>
        <span className="text-sm text-slate-400">/ {rosterSize} ops</span>
      </div>
      <p className="mt-1.5 text-xs text-slate-500">Scheduled days</p>
    </Widget>
  )
}

function TileTimesheetsHours({ bookings }: { bookings: Booking[] }) {
  const weeks = Array.from({ length: 4 }, (_, i) => {
    const start = startOfWeek(subWeeks(new Date(), 3 - i), { weekStartsOn: 1 })
    const end = endOfWeek(start, { weekStartsOn: 1 })
    const weekBookings = bookings.filter((b) => isWithinInterval(new Date(b.date), { start, end }))
    return weekBookings.reduce((sum, b) => sum + slotHours(`${b.timeSlot}`), 0)
  })
  const labels = ['Wk 1', 'Wk 2', 'Wk 3', 'Wk 4']
  return (
    <Widget label="Hours logged — last 4 weeks" wide link="/dashboard/timesheets">
      <div className="mt-2">
        <Sparkline data={weeks.length >= 2 ? weeks : [0, ...weeks]} color="#6366f1" />
        <div className="mt-1 flex justify-between">
          {labels.map((w, i) => (
            <div key={w} className="flex flex-col items-center gap-0.5">
              <span className="text-[9px] text-slate-400">{w}</span>
              <span className="text-[11px] font-semibold text-slate-700">{weeks[i]}h</span>
            </div>
          ))}
        </div>
      </div>
    </Widget>
  )
}

function TileClientsTotal({ clients }: { clients: Client[] }) {
  return (
    <Widget label="Clients" link="/dashboard/clients">
      <StatNum value={clients.length} />
      <p className="mt-1.5 text-xs text-slate-500">In directory</p>
    </Widget>
  )
}

function TileWarningsActive({ warnings }: { warnings: { id: string }[] }) {
  return (
    <Widget label="Active warnings" link="/dashboard/warnings">
      <StatNum value={warnings.length} color={warnings.length > 0 ? 'text-amber-600' : 'text-slate-900'} />
      <p className="mt-1.5 text-xs text-slate-500">Booking clashes</p>
    </Widget>
  )
}

export function RenderDashboardTile({ id, data }: { id: TileId; data: DashboardTileData }) {
  switch (id) {
    case 'tasks_open':
      return <TileTasksOpen tasks={data.tasks} />
    case 'tasks_overdue':
      return <TileTasksOverdue tasks={data.tasks} />
    case 'tasks_completed':
      return <TileTasksCompleted tasks={data.tasks} />
    case 'tasks_priority':
      return <TileTasksPriority tasks={data.tasks} />
    case 'projects_active':
      return <TileProjectsActive projects={data.projects} smallWorks={data.smallWorks} />
    case 'projects_pipeline':
      return <TileProjectsPipeline projects={data.projects} smallWorks={data.smallWorks} />
    case 'projects_health':
      return <TileProjectHealth projects={data.projects} />
    case 'bookings_total':
      return <TileBookingsTotal bookings={data.bookings} />
    case 'bookings_clashes':
      return <TileBookingClashes warnings={data.warnings} />
    case 'bookings_trend':
      return <TileBookingsTrend bookings={data.bookings} />
    case 'operatives_active':
      return <TileOperativesActive operatives={data.operatives} activeOperativesCount={data.activeOperativesCount} />
    case 'operatives_utilisation':
      return <TileOperativesUtilisation bookings={data.bookings} operatives={data.operatives} />
    case 'leave_pending':
      return <TileLeavePending count={data.pendingLeaveCount} />
    case 'leave_calendar':
      return <TileLeaveCalendar user={data.user} holidayBookings={data.holidayBookings} />
    case 'audits_open':
      return <TileAuditsOpen audits={data.audits} />
    case 'audits_score':
      return <TileAuditsScore audits={data.audits} />
    case 'small_works':
      return <TileSmallWorks smallWorks={data.smallWorks} />
    case 'small_works_status':
      return <TileSmallWorksStatus smallWorks={data.smallWorks} />
    case 'timesheets_submitted':
      return <TileTimesheetsSubmitted bookings={data.bookings} operatives={data.operatives} />
    case 'timesheets_hours':
      return <TileTimesheetsHours bookings={data.bookings} />
    case 'clients_total':
      return <TileClientsTotal clients={data.clients} />
    case 'warnings_active':
      return <TileWarningsActive warnings={data.warnings} />
    default:
      return null
  }
}

export function DashboardWidgetGrid({ layout, data }: { layout: TileId[]; data: DashboardTileData }) {
  if (layout.length === 0) {
    return (
      <div className="col-span-2 rounded-2xl border border-dashed border-slate-300 p-10 text-center md:col-span-4">
        <p className="text-sm text-slate-500">No tiles on your dashboard.</p>
        <Link
          href="/dashboard/edit"
          className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600 hover:text-blue-700"
        >
          Open dashboard editor →
        </Link>
      </div>
    )
  }

  return (
    <>
      {layout.map((id) => (
        <RenderDashboardTile key={id} id={id} data={data} />
      ))}
    </>
  )
}
