'use client'

import { addDays, format, isSameDay, startOfWeek } from 'date-fns'
import type { ReactNode } from 'react'

/** Shared tokens aligned with iOS / HTML prototypes */
export const featurePageBg = 'bg-[#F7F8FA]'

export function FeatureScreen({ children }: { children: ReactNode }) {
  return <div className={`${featurePageBg} -mx-4 -mt-2 min-h-[60vh] px-4 py-4 sm:mx-0 sm:mt-0 sm:rounded-2xl`}>{children}</div>
}

export function FeatureProjectStrip({
  jobNumber,
  siteName,
  clientName,
}: {
  jobNumber: string
  siteName: string
  clientName?: string
}) {
  return (
    <div className="mb-4 text-center">
      <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">{jobNumber}</p>
      <p className="text-sm font-semibold text-slate-900">{siteName}</p>
      {clientName && <p className="text-xs text-slate-500">{clientName}</p>}
    </div>
  )
}

export function FeatureCard({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-[14px] border border-[#EEF0F3] bg-white shadow-[0_1px_2px_rgba(16,32,53,0.04),0_4px_12px_rgba(16,32,53,0.04)] ${className}`}>
      {children}
    </div>
  )
}

export function FeatureSectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.4px] text-[#6B7280]">{children}</p>
  )
}

export function FilterChipsRow<T extends string>({
  chips,
  selected,
  onSelect,
}: {
  chips: { id: T; label: string; count?: number }[]
  selected: T
  onSelect: (id: T) => void
}) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
      {chips.map((chip) => (
        <button
          key={chip.id}
          type="button"
          onClick={() => onSelect(chip.id)}
          className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
            selected === chip.id
              ? 'bg-[#185FA5] text-white shadow-sm'
              : 'border border-[#E5E7EB] bg-white text-slate-600 hover:border-slate-300'
          }`}
        >
          {chip.label}
          {chip.count !== undefined && <span className="ml-1 opacity-80">· {chip.count}</span>}
        </button>
      ))}
    </div>
  )
}

export function weekDaysContaining(anchor: Date): Date[] {
  const start = startOfWeek(anchor, { weekStartsOn: 1 })
  return Array.from({ length: 7 }, (_, i) => addDays(start, i))
}

export function weekRangeLabel(weekStart: Date): string {
  const end = addDays(weekStart, 6)
  return `${format(weekStart, 'd MMM')} – ${format(end, 'd MMM yyyy')}`
}

export function countItemsOnDay<T extends { date: Date }>(items: T[], day: Date): number {
  return items.filter((item) => isSameDay(new Date(item.date), day)).length
}

export function MaterialsWeekNavigator({
  weekStart,
  onPrev,
  onNext,
  itemCount,
}: {
  weekStart: Date
  onPrev: () => void
  onNext: () => void
  itemCount: number
}) {
  return (
    <FeatureCard className="p-3">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onPrev}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-[#E5E7EB] bg-white text-[#185FA5] hover:bg-slate-50"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="text-center">
          <p className="text-sm font-bold text-slate-900">{weekRangeLabel(weekStart)}</p>
          <p className="text-[11px] text-slate-500">{itemCount} item{itemCount !== 1 ? 's' : ''} this week</p>
        </div>
        <button
          type="button"
          onClick={onNext}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-[#E5E7EB] bg-white text-[#185FA5] hover:bg-slate-50"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </FeatureCard>
  )
}

export function MaterialsDayStrip({
  weekStart,
  selectedDate,
  onSelectDate,
  materials,
}: {
  weekStart: Date
  selectedDate: Date
  onSelectDate: (d: Date) => void
  materials: { date: Date }[]
}) {
  const days = weekDaysContaining(weekStart)
  return (
    <div className="mt-3 grid grid-cols-7 gap-1">
      {days.map((day) => {
        const selected = isSameDay(day, selectedDate)
        const isToday = isSameDay(day, new Date())
        const count = countItemsOnDay(materials, day)
        return (
          <button
            key={day.toISOString()}
            type="button"
            onClick={() => onSelectDate(day)}
            className={`flex flex-col items-center rounded-xl py-2 transition-colors ${
              selected ? 'bg-[#185FA5] text-white shadow-sm' : 'bg-white border border-[#EEF0F3] text-slate-700 hover:bg-slate-50'
            }`}
          >
            <span className={`text-[10px] font-medium ${selected ? 'text-blue-100' : 'text-slate-400'}`}>
              {format(day, 'EEE')}
            </span>
            <span className={`text-sm font-bold ${isToday && !selected ? 'text-[#185FA5]' : ''}`}>
              {format(day, 'd')}
            </span>
            {count > 0 && (
              <span
                className={`mt-0.5 h-1.5 w-1.5 rounded-full ${
                  selected ? 'bg-white' : 'bg-[#185FA5]'
                }`}
              />
            )}
          </button>
        )
      })}
    </div>
  )
}

export function StatusPill({ label, tone }: { label: string; tone: 'amber' | 'green' | 'blue' | 'grey' | 'red' | 'purple' }) {
  const styles = {
    amber: 'bg-[#FAEEDA] text-[#854F0B]',
    green: 'bg-[#E1F5EE] text-[#0F6E56]',
    blue: 'bg-[#E6F1FB] text-[#185FA5]',
    grey: 'bg-[#F2F3F5] text-[#6B7280]',
    red: 'bg-[#FCEBEB] text-[#A32D2D]',
    purple: 'bg-[#EEEDFE] text-[#534AB7]',
  }
  return (
    <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold ${styles[tone]}`}>
      {label}
    </span>
  )
}

export function materialStatusTone(status: string): 'amber' | 'green' | 'blue' | 'grey' {
  const s = status.toLowerCase()
  if (s.includes('draft')) return 'amber'
  if (s.includes('sent') || s.includes('order')) return 'green'
  if (s.includes('quote')) return 'blue'
  return 'grey'
}

export function HubCard({
  title,
  subtitle,
  count,
  countLabel,
  iconBg,
  iconColor,
  iconPath,
  onClick,
}: {
  title: string
  subtitle: string
  count?: number
  countLabel?: string
  iconBg: string
  iconColor: string
  iconPath: string
  onClick?: () => void
}) {
  const inner = (
    <>
      <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] ${iconBg}`}>
        <svg className={`h-6 w-6 ${iconColor}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={iconPath} />
        </svg>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-base font-bold text-slate-900">{title}</p>
        <p className="text-xs text-slate-500">{subtitle}</p>
      </div>
      {count !== undefined ? (
        <div className="text-right">
          <p className="text-xl font-extrabold text-slate-900">{count}</p>
          {countLabel && <p className="text-[10px] uppercase tracking-wide text-slate-400">{countLabel}</p>}
        </div>
      ) : (
        <svg className="h-5 w-5 shrink-0 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      )}
    </>
  )

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="mb-3 flex w-full items-center gap-4 rounded-[18px] border border-transparent bg-white p-4 text-left shadow-[0_1px_2px_rgba(16,32,53,0.04),0_6px_18px_rgba(16,32,53,0.05)] transition active:scale-[0.99] hover:border-slate-200"
      >
        {inner}
      </button>
    )
  }

  return (
    <div className="mb-3 flex items-center gap-4 rounded-[18px] bg-white p-4 shadow-[0_1px_2px_rgba(16,32,53,0.04),0_6px_18px_rgba(16,32,53,0.05)]">
      {inner}
    </div>
  )
}

export function DocListRow({
  title,
  meta,
  status,
  statusTone,
  fileURL,
}: {
  title: string
  meta: string
  status?: string
  statusTone?: 'green' | 'amber' | 'red' | 'blue'
  fileURL?: string
}) {
  return (
    <div className="flex items-center gap-3 border-t border-[#EEF1F5] px-4 py-3.5 first:border-t-0">
      <div className="relative flex h-11 w-10 shrink-0 items-center justify-center rounded-lg bg-[#FDEAEA]">
        <svg className="h-5 w-5 text-[#E2493F]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
        <span className="absolute bottom-1 text-[7px] font-extrabold text-[#E2493F]">PDF</span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-slate-900">{title}</p>
        <p className="mt-0.5 text-xs text-slate-500">{meta}</p>
        {status && statusTone && (
          <span className="mt-1.5 inline-block">
            <StatusPill label={status} tone={statusTone} />
          </span>
        )}
      </div>
      {fileURL && (
        <a
          href={fileURL}
          target="_blank"
          rel="noreferrer"
          className="shrink-0 text-xs font-semibold text-[#2F73F0] hover:underline"
        >
          View
        </a>
      )}
    </div>
  )
}

export const SITE_AUDIT_TYPES = ['Pre-Start', 'General', 'Variations', 'Snags'] as const
export type SiteAuditTypeFilter = 'All' | (typeof SITE_AUDIT_TYPES)[number]

export function siteAuditTypeTone(type: string): 'amber' | 'blue' | 'purple' | 'red' {
  switch (type) {
    case 'Pre-Start':
      return 'amber'
    case 'Variations':
      return 'purple'
    case 'Snags':
      return 'red'
    default:
      return 'blue'
  }
}
