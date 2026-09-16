'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { TileId } from '@/lib/stores/dashboardStore'
import type { HeroMetricDisplay } from '@/lib/dashboard/heroMetrics'
import { MAX_HERO_METRICS } from '@/lib/dashboard/heroMetrics'
import { getDashboardTileDrag, setDashboardTileDrag, type HeroTileDrop } from '@/lib/dashboard/dashboardDrag'

function metricGridClass(count: number): string {
  if (count <= 1) return 'grid-cols-1'
  if (count === 2) return 'grid-cols-2'
  if (count === 3) return 'grid-cols-3'
  return 'grid-cols-2 lg:grid-cols-4'
}

const cardClass =
  'rounded-xl border border-slate-200 bg-white px-4 py-4 transition hover:border-slate-300'

function HeroMetricCard({
  metric,
  editable,
  onRemove,
  onDragStart,
  onHeroReorderDrop,
  onExternalDrop,
  isDragging,
}: {
  metric: HeroMetricDisplay
  editable?: boolean
  onRemove?: () => void
  onDragStart?: () => void
  onHeroReorderDrop?: () => void
  onExternalDrop?: (drop: HeroTileDrop) => void
  isDragging?: boolean
}) {
  const inner = (
    <>
      <p className="text-[12px] font-medium text-slate-500">{metric.label}</p>
      <p className="mt-2 text-[28px] font-semibold tracking-tight text-slate-900">{metric.value}</p>
    </>
  )

  const stateClass = `${cardClass} ${editable ? 'relative cursor-grab active:cursor-grabbing' : ''} ${
    isDragging ? 'opacity-40 ring-1 ring-slate-300' : ''
  }`

  if (editable) {
    return (
      <div
        draggable
        onDragStart={(e) => {
          setDashboardTileDrag(e, metric.id, 'hero')
          e.dataTransfer.effectAllowed = 'move'
          onDragStart?.()
        }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault()
          e.stopPropagation()
          const drag = getDashboardTileDrag(e)
          if (!drag) return
          if (drag.source === 'hero') {
            onHeroReorderDrop?.()
          } else {
            onExternalDrop?.({ id: drag.id, source: drag.source })
          }
        }}
        className={`group ${stateClass}`}
      >
        {inner}
        {onRemove && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onRemove()
            }}
            className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400 opacity-0 transition hover:border-red-200 hover:text-red-600 group-hover:opacity-100"
            aria-label={`Remove ${metric.label}`}
          >
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
    )
  }

  if (metric.href) {
    return (
      <Link href={metric.href} className={stateClass}>
        {inner}
      </Link>
    )
  }

  return <div className={stateClass}>{inner}</div>
}

function HeroEmptySlot({
  onDrop,
  isDragOver,
  onDragOverChange,
}: {
  onDrop: (drop: HeroTileDrop) => void
  isDragOver: boolean
  onDragOverChange: (over: boolean) => void
}) {
  return (
    <div
      onDragOver={(e) => {
        e.preventDefault()
        e.dataTransfer.dropEffect = 'copy'
        onDragOverChange(true)
      }}
      onDragLeave={() => onDragOverChange(false)}
      onDrop={(e) => {
        e.preventDefault()
        e.stopPropagation()
        onDragOverChange(false)
        const drag = getDashboardTileDrag(e)
        if (drag && drag.source !== 'hero') onDrop({ id: drag.id, source: drag.source })
      }}
      className={`flex min-h-[92px] items-center justify-center rounded-xl border border-dashed px-3 py-4 text-[12px] font-medium transition ${
        isDragOver ? 'border-slate-400 bg-slate-50 text-slate-700' : 'border-slate-300 text-slate-400'
      }`}
    >
      Drop metric here
    </div>
  )
}

export function DashboardHero({
  userName,
  organizationName,
  dateLabel,
  metrics,
  warningCount,
  showCustomizeLink = true,
  editable = false,
  onRemoveMetric,
  onHeroDragStart,
  onHeroDrop,
  heroDragSrc,
  onDropHeroTile,
  draggingTileId,
}: {
  userName: string
  organizationName: string
  dateLabel: string
  metrics: HeroMetricDisplay[]
  warningCount: number
  showCustomizeLink?: boolean
  editable?: boolean
  onRemoveMetric?: (id: TileId) => void
  onHeroDragStart?: (id: TileId) => void
  onHeroDrop?: (targetId: TileId) => void
  heroDragSrc?: TileId | null
  onDropHeroTile?: (drop: HeroTileDrop) => void
  draggingTileId?: TileId | null
}) {
  const [dragOverSlot, setDragOverSlot] = useState<number | null>(null)

  const emptySlots = Math.max(0, MAX_HERO_METRICS - metrics.length)
  const heroDragOver = Boolean(draggingTileId && draggingTileId !== heroDragSrc)

  function handleExternalDrop(drop: HeroTileDrop) {
    onDropHeroTile?.(drop)
  }

  return (
    <div
      className={heroDragOver && editable ? 'rounded-xl ring-1 ring-slate-300' : ''}
      onDragOver={editable ? (e) => e.preventDefault() : undefined}
      onDrop={
        editable
          ? (e) => {
              e.preventDefault()
              const drag = getDashboardTileDrag(e)
              if (drag && drag.source !== 'hero') {
                handleExternalDrop({ id: drag.id, source: drag.source })
              }
            }
          : undefined
      }
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[12px] font-medium text-slate-400">{dateLabel}</p>
          <h1 className="mt-1 text-[28px] font-semibold tracking-tight text-slate-900">Home</h1>
          <p className="mt-1 text-[13px] text-slate-500">
            Overview for {organizationName}
            {userName ? ` · ${userName}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/warnings"
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-[13px] font-medium text-slate-700 hover:border-slate-300"
            aria-label={`${warningCount} warning${warningCount !== 1 ? 's' : ''} — open warnings`}
          >
            <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            {warningCount > 0 ? `${warningCount} warning${warningCount !== 1 ? 's' : ''}` : 'Warnings'}
          </Link>
          {showCustomizeLink && (
            <Link
              href="/dashboard/edit"
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-[13px] font-medium text-slate-700 hover:border-slate-300"
              aria-label="Customise dashboard"
            >
              <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.8}
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Settings
            </Link>
          )}
        </div>
      </div>

      <div className="mt-6">
        <div className="mb-3 flex items-end justify-between">
          <div>
            <h2 className="text-[15px] font-semibold tracking-tight text-slate-900">Performance at a glance</h2>
            <p className="mt-0.5 text-[12px] text-slate-500">Live numbers across delivery, labour, and site work.</p>
          </div>
        </div>
        <div className={`grid gap-3 ${metricGridClass(metrics.length + (editable ? emptySlots : 0))}`}>
          {metrics.map((metric) => (
            <HeroMetricCard
              key={metric.id}
              metric={metric}
              editable={editable}
              onRemove={onRemoveMetric ? () => onRemoveMetric(metric.id) : undefined}
              onDragStart={onHeroDragStart ? () => onHeroDragStart(metric.id) : undefined}
              onHeroReorderDrop={onHeroDrop ? () => onHeroDrop(metric.id) : undefined}
              onExternalDrop={handleExternalDrop}
              isDragging={heroDragSrc === metric.id}
            />
          ))}
          {editable &&
            Array.from({ length: emptySlots }).map((_, i) => (
              <HeroEmptySlot
                key={`empty-${i}`}
                isDragOver={dragOverSlot === i}
                onDragOverChange={(over) => setDragOverSlot(over ? i : null)}
                onDrop={handleExternalDrop}
              />
            ))}
        </div>
      </div>
    </div>
  )
}
