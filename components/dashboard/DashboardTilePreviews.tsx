'use client'

import type { TileId } from '@/lib/stores/dashboardStore'
import { getTileMeta } from '@/lib/dashboard/tileCatalogue'
import { setDashboardTileDrag, type HeroTileDrop } from '@/lib/dashboard/dashboardDrag'
import { DashboardHero } from '@/components/dashboard/DashboardHero'
import { MAX_HERO_METRICS, resolveHeroMetricPreviews } from '@/lib/dashboard/heroMetrics'

function Shell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="h-full rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
      {children}
    </div>
  )
}

function Stat({ value = 0, muted = false }: { value?: number | string; muted?: boolean }) {
  return (
    <p className={`text-3xl font-semibold leading-none ${muted ? 'text-slate-300' : 'text-slate-900'}`}>{value}</p>
  )
}

function Sub({ children }: { children: React.ReactNode }) {
  return <p className="mt-1.5 text-xs text-slate-400">{children}</p>
}

function Pill({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-400">
      {label}
    </span>
  )
}

function BarTrack({ pct = 0, color = 'bg-slate-200' }: { pct?: number; color?: string }) {
  return (
    <div className="h-1.5 w-full rounded-full bg-slate-100">
      <div className={`h-1.5 rounded-full ${color}`} style={{ width: `${Math.min(100, pct)}%` }} />
    </div>
  )
}

function SparkPlaceholder({ color = '#cbd5e1' }: { color?: string }) {
  return (
    <svg viewBox="0 0 200 48" className="h-12 w-full" preserveAspectRatio="none">
      <polyline
        points="0,36 50,28 100,32 150,20 200,24"
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  )
}

function MiniBarRow({ label }: { label: string }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span className="truncate pr-2 text-xs text-slate-400">{label}</span>
        <span className="shrink-0 text-xs font-semibold text-slate-300">0</span>
      </div>
      <BarTrack pct={0} />
    </div>
  )
}

export function RenderDashboardTilePreview({ id }: { id: TileId }) {
  switch (id) {
    case 'tasks_open':
      return (
        <Shell label="Open tasks">
          <Stat />
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Pill label="0 to do" />
            <Pill label="0 in progress" />
          </div>
        </Shell>
      )
    case 'tasks_overdue':
      return (
        <Shell label="Overdue tasks">
          <Stat />
          <Sub>All tasks on time</Sub>
        </Shell>
      )
    case 'tasks_completed':
      return (
        <Shell label="Tasks completed">
          <Stat muted />
          <Sub>Total completed</Sub>
        </Shell>
      )
    case 'tasks_priority':
      return (
        <Shell label="Task priority split">
          <div className="mt-1 grid grid-cols-4 gap-3">
            {['Urgent', 'High', 'Normal', 'Low'].map((p) => (
              <div key={p}>
                <div className="mb-1 flex items-end justify-between">
                  <span className="text-[10px] text-slate-400">{p}</span>
                  <span className="text-sm font-semibold text-slate-300">0</span>
                </div>
                <BarTrack />
              </div>
            ))}
          </div>
        </Shell>
      )
    case 'projects_active':
      return (
        <Shell label="Active projects">
          <Stat />
          <Sub>0 active small works</Sub>
        </Shell>
      )
    case 'projects_pipeline':
      return (
        <Shell label="Project pipeline">
          <div className="mt-2 space-y-2.5">
            <MiniBarRow label="Live / active" />
            <MiniBarRow label="Completed" />
            <MiniBarRow label="Total" />
          </div>
        </Shell>
      )
    case 'projects_health':
      return (
        <Shell label="Project health">
          <div className="mt-2 space-y-2.5">
            {['Project A', 'Project B', 'Project C'].map((name) => (
              <div key={name}>
                <div className="mb-1 flex items-center justify-between">
                  <span className="truncate pr-2 text-xs text-slate-400">{name}</span>
                  <span className="shrink-0 text-xs font-semibold text-slate-300">—</span>
                </div>
                <BarTrack pct={35} color="bg-slate-200" />
              </div>
            ))}
          </div>
        </Shell>
      )
    case 'bookings_total':
      return (
        <Shell label="Bookings this period">
          <Stat />
          <Sub>Across all projects</Sub>
        </Shell>
      )
    case 'bookings_clashes':
      return (
        <Shell label="Booking clashes">
          <Stat />
          <Sub>No clashes detected</Sub>
        </Shell>
      )
    case 'bookings_trend':
      return (
        <Shell label="Bookings by day of week">
          <div className="mt-2">
            <SparkPlaceholder color="#059669" />
            <div className="mt-1 flex justify-between">
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
                <div key={d} className="flex flex-col items-center gap-0.5">
                  <span className="text-[9px] text-slate-400">{d}</span>
                  <span className="text-[11px] font-semibold text-slate-300">0</span>
                </div>
              ))}
            </div>
          </div>
        </Shell>
      )
    case 'operatives_active':
      return (
        <Shell label="Active operatives">
          <Stat />
          <Sub>On roster</Sub>
        </Shell>
      )
    case 'operatives_utilisation':
      return (
        <Shell label="Operative utilisation">
          <div className="mt-2 flex items-center gap-4">
            <div className="relative flex h-16 w-16 shrink-0 items-center justify-center">
              <svg viewBox="0 0 36 36" className="h-16 w-16 -rotate-90">
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="#e2e8f0" strokeWidth="3.8" />
              </svg>
              <span className="absolute text-sm font-semibold text-slate-300">0%</span>
            </div>
            <div>
              <p className="text-2xl font-semibold text-slate-300">
                0 <span className="text-sm text-slate-300">/ 0</span>
              </p>
              <Sub>Operatives currently booked</Sub>
            </div>
          </div>
        </Shell>
      )
    case 'leave_pending':
      return (
        <Shell label="Leave approvals">
          <Stat />
          <Sub>Pending requests</Sub>
        </Shell>
      )
    case 'leave_calendar':
      return (
        <Shell label="Leave — taken vs allowance">
          <div className="mt-2 grid grid-cols-3 gap-3">
            {['Taken', 'Pending', 'Remaining'].map((label) => (
              <div key={label}>
                <div className="mb-1 flex items-end justify-between">
                  <span className="text-[10px] text-slate-400">{label}</span>
                  <span className="text-sm font-semibold text-slate-300">0</span>
                </div>
                <BarTrack />
              </div>
            ))}
          </div>
        </Shell>
      )
    case 'audits_open':
      return (
        <Shell label="Site audits">
          <Stat />
          <Sub>Recorded audits</Sub>
        </Shell>
      )
    case 'audits_score':
      return (
        <Shell label="Audit activity — last 6 months">
          <div className="mt-2">
            <SparkPlaceholder color="#059669" />
            <div className="mt-1 flex justify-between">
              {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'].map((m) => (
                <div key={m} className="flex flex-col items-center gap-0.5">
                  <span className="text-[9px] text-slate-400">{m}</span>
                  <span className="text-[11px] font-semibold text-slate-300">0</span>
                </div>
              ))}
            </div>
          </div>
        </Shell>
      )
    case 'small_works':
      return (
        <Shell label="Small works">
          <Stat />
          <Sub>Active jobs</Sub>
        </Shell>
      )
    case 'small_works_status':
      return (
        <Shell label="Small works by status">
          <div className="mt-2 space-y-2.5">
            <MiniBarRow label="Active" />
            <MiniBarRow label="Completed" />
          </div>
        </Shell>
      )
    case 'timesheets_submitted':
      return (
        <Shell label="Bookings this week">
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-semibold text-slate-300">0</span>
            <span className="text-sm text-slate-300">/ 0</span>
          </div>
          <Sub>Scheduled days</Sub>
        </Shell>
      )
    case 'timesheets_hours':
      return (
        <Shell label="Hours logged — last 4 weeks">
          <div className="mt-2">
            <SparkPlaceholder color="#6366f1" />
            <div className="mt-1 flex justify-between">
              {['Wk 1', 'Wk 2', 'Wk 3', 'Wk 4'].map((w) => (
                <div key={w} className="flex flex-col items-center gap-0.5">
                  <span className="text-[9px] text-slate-400">{w}</span>
                  <span className="text-[11px] font-semibold text-slate-300">0h</span>
                </div>
              ))}
            </div>
          </div>
        </Shell>
      )
    case 'clients_total':
      return (
        <Shell label="Clients">
          <Stat />
          <Sub>In directory</Sub>
        </Shell>
      )
    case 'warnings_active':
      return (
        <Shell label="Active warnings">
          <Stat />
          <Sub>Booking clashes</Sub>
        </Shell>
      )
    default:
      return null
  }
}

function DraggablePreviewTile({
  id,
  wide,
  heroEligible,
  onRemove,
  onDragStart,
  onDragEnd,
  onDrop,
  isDragging,
}: {
  id: TileId
  wide: boolean
  heroEligible: boolean
  onRemove: () => void
  onDragStart: () => void
  onDragEnd: () => void
  onDrop: () => void
  isDragging: boolean
}) {
  return (
    <div
      draggable
      onDragStart={(e) => {
        setDashboardTileDrag(e, id, 'grid')
        e.dataTransfer.effectAllowed = heroEligible ? 'copyMove' : 'move'
        onDragStart()
      }}
      onDragEnd={onDragEnd}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault()
        onDrop()
      }}
      className={`group relative cursor-grab active:cursor-grabbing ${wide ? 'col-span-2' : ''} ${
        isDragging ? 'opacity-50 ring-2 ring-blue-400 ring-offset-2' : ''
      }`}
    >
      <div className="pointer-events-none select-none">
        <RenderDashboardTilePreview id={id} />
      </div>
      <div className="pointer-events-none absolute inset-0 rounded-2xl border-2 border-transparent transition group-hover:border-blue-200" />
      <div className="pointer-events-none absolute left-2 top-2 flex items-center gap-1 opacity-0 transition group-hover:opacity-100">
        <span className="flex items-center gap-1 rounded-lg bg-slate-900/80 px-2 py-1 text-[10px] font-semibold text-white backdrop-blur-sm">
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
          </svg>
          {heroEligible ? 'Drag to hero or reorder' : 'Drag to reorder'}
        </span>
      </div>
      <button
        type="button"
        onClick={onRemove}
        className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400 shadow-sm opacity-0 transition hover:border-red-200 hover:bg-red-50 hover:text-red-500 group-hover:opacity-100"
        aria-label="Remove tile"
      >
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}

export function DashboardEditorPreview({
  layout,
  heroMetrics,
  userName,
  organizationName,
  onRemove,
  onDragStart,
  onDrop,
  dragSrc,
  onRemoveHeroMetric,
  onHeroDragStart,
  onHeroDrop,
  heroDragSrc,
  onDropHeroTile,
  draggingTileId,
  onDragEnd,
}: {
  layout: TileId[]
  heroMetrics: TileId[]
  userName: string
  organizationName: string
  onRemove: (id: TileId) => void
  onDragStart: (id: TileId) => void
  onDrop: (targetId: TileId) => void
  dragSrc: TileId | null
  onRemoveHeroMetric: (id: TileId) => void
  onHeroDragStart: (id: TileId) => void
  onHeroDrop: (targetId: TileId) => void
  heroDragSrc: TileId | null
  onDropHeroTile: (drop: HeroTileDrop) => void
  draggingTileId: TileId | null
  onDragEnd: () => void
}) {
  const dateLabel = new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

  const heroDisplay = resolveHeroMetricPreviews(heroMetrics)

  return (
    <section className="rounded-2xl border border-slate-200 bg-[#f4f6f9] p-4 md:p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Live preview</h2>
          <p className="text-xs text-slate-500">
            Matches your home screen · {heroMetrics.length} hero metric{heroMetrics.length !== 1 ? 's' : ''} ·{' '}
            {layout.length} tile{layout.length !== 1 ? 's' : ''} · drag to reorder
          </p>
        </div>
        <span className="rounded-full bg-blue-100 px-2.5 py-1 text-[11px] font-semibold text-blue-700">
          Preview only — no live data
        </span>
      </div>

      <div className="space-y-3">
        <p className="text-xs text-slate-500">
          Drag eligible tiles from the grid below into the blue section (max {MAX_HERO_METRICS} single metrics).
        </p>
        <DashboardHero
          userName={userName}
          organizationName={organizationName}
          dateLabel={dateLabel}
          metrics={heroDisplay}
          warningCount={0}
          showCustomizeLink={false}
          editable
          onRemoveMetric={onRemoveHeroMetric}
          onHeroDragStart={onHeroDragStart}
          onHeroDrop={onHeroDrop}
          heroDragSrc={heroDragSrc}
          onDropHeroTile={onDropHeroTile}
          draggingTileId={draggingTileId}
        />

        {layout.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
            <p className="text-sm text-slate-500">No tiles selected yet.</p>
            <p className="mt-1 text-xs text-slate-400">Choose tiles from the catalogue below to see them here.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {layout.map((id) => {
              const meta = getTileMeta(id)
              return (
                <DraggablePreviewTile
                  key={id}
                  id={id}
                  wide={meta?.wide ?? false}
                  heroEligible={meta?.heroEligible ?? false}
                  onRemove={() => onRemove(id)}
                  onDragStart={() => onDragStart(id)}
                  onDragEnd={onDragEnd}
                  onDrop={() => onDrop(id)}
                  isDragging={dragSrc === id}
                />
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}
