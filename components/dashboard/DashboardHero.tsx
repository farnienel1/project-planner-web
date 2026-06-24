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
  return 'grid-cols-2 sm:grid-cols-4'
}

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
      <p className="text-xl font-semibold">{metric.value}</p>
      <p className="mt-0.5 text-xs text-blue-100">{metric.label}</p>
    </>
  )

  const cardClass = `rounded-xl border border-white/20 bg-white/15 px-3 py-2.5 ${
    editable ? 'relative cursor-grab active:cursor-grabbing' : ''
  } ${isDragging ? 'opacity-50 ring-2 ring-white/50' : ''}`

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
        className={`group ${cardClass}`}
      >
        {inner}
        {onRemove && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onRemove()
            }}
            className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full border border-white/40 bg-blue-800 text-white opacity-0 shadow transition hover:bg-red-600 group-hover:opacity-100"
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
      <Link href={metric.href} className={`${cardClass} transition hover:bg-white/20`}>
        {inner}
      </Link>
    )
  }

  return <div className={cardClass}>{inner}</div>
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
      className={`flex min-h-[68px] items-center justify-center rounded-xl border-2 border-dashed px-3 py-2.5 text-xs font-medium transition ${
        isDragOver ? 'border-white bg-white/20 text-white' : 'border-white/30 text-blue-200'
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
      className={`relative rounded-2xl bg-gradient-to-br from-blue-600 to-blue-700 p-6 text-white shadow-[0_10px_30px_rgba(37,99,235,0.28)] ${
        editable && heroDragOver ? 'ring-2 ring-white/40 ring-offset-2 ring-offset-blue-600' : ''
      }`}
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
      {showCustomizeLink && (
        <Link
          href="/dashboard/edit"
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-white transition hover:bg-white/30"
          aria-label="Customise dashboard"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
            />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </Link>
      )}

      <Link
        href="/dashboard/warnings"
        className={`absolute top-4 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:opacity-90 ${
          showCustomizeLink ? 'right-14' : 'right-4'
        } ${warningCount > 0 ? 'bg-red-600 hover:bg-red-700' : 'bg-red-500/80 hover:bg-red-600'}`}
        aria-label={`${warningCount} warning${warningCount !== 1 ? 's' : ''} — open warnings`}
      >
        <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
        {warningCount > 0 ? `${warningCount} warning${warningCount !== 1 ? 's' : ''}` : 'Warnings'}
      </Link>

      <div className={`flex items-start justify-between gap-3 pr-24 ${showCustomizeLink ? 'sm:pr-28' : ''}`}>
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-blue-200">{dateLabel}</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">Hi, {userName}</h1>
          <p className="mt-1 text-sm text-blue-100">Project planning overview for {organizationName}.</p>
        </div>
      </div>

      <div className={`mt-5 grid gap-3 ${metricGridClass(metrics.length + (editable ? emptySlots : 0))}`}>
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
  )
}
