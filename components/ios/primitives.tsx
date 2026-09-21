/**
 * Shared list/detail primitives. Visuals follow the v2 prototype;
 * handlers stay with each screen.
 */

import type { ReactNode } from 'react'
import { cn } from '@/lib/ui/cn'
import type { SectionHue } from '@/lib/ui/sectionHue'

export function StatusPill({
  label,
  tone = 'grey',
}: {
  label: string
  tone?: 'blue' | 'green' | 'amber' | 'red' | 'grey'
}) {
  const hue: SectionHue =
    tone === 'blue' ? 'blue' : tone === 'green' ? 'green' : tone === 'amber' ? 'warn' : tone === 'red' ? 'red' : 'lib'
  return (
    <span data-hue={hue} className="pill dot">
      {label}
    </span>
  )
}

export function EmptyState({
  icon,
  title,
  subtitle,
  action,
  hue = 'lib',
}: {
  icon?: ReactNode
  title: string
  subtitle?: string
  action?: ReactNode
  hue?: SectionHue
}) {
  return (
    <div className="empty card pad" data-hue={hue}>
      {icon ? <div className="ico-chip lg">{icon}</div> : null}
      <h3>{title}</h3>
      {subtitle ? <p>{subtitle}</p> : null}
      {action}
    </div>
  )
}

export function PageHeader({
  title,
  subtitle,
  actions,
  hue = 'blue',
  icon,
}: {
  title: string
  subtitle?: string
  actions?: ReactNode
  hue?: SectionHue
  icon?: ReactNode
}) {
  return (
    <div className="phead" data-hue={hue}>
      {icon ? <div className="badge-ico">{icon}</div> : null}
      <div className="min-w-0">
        <h1>{title}</h1>
        {subtitle ? <div className="sub">{subtitle}</div> : null}
      </div>
      {actions ? <div className="acts">{actions}</div> : null}
    </div>
  )
}

export function IosModal({
  title,
  onDone,
  children,
}: {
  title: string
  onDone: () => void
  children: ReactNode
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(10,20,40,.4)] p-4 backdrop-blur-[3px]">
      <div className="flex max-h-[80vh] w-full max-w-[620px] flex-col overflow-hidden rounded-[24px] bg-[var(--card)] shadow-[var(--sh-pop)]">
        <header className="flex items-center justify-between px-6 pb-3 pt-[22px]">
          <h3 className="text-xl font-extrabold">{title}</h3>
          <button type="button" onClick={onDone} className="btn sm ghost">
            Done
          </button>
        </header>
        <div className="overflow-y-auto px-6 py-4">{children}</div>
      </div>
    </div>
  )
}

/** Sheet header: Cancel left, title centre. Sticky footer for the primary action. */
export function IosFormModal({
  title,
  onCancel,
  children,
  footer,
  width = 'sm',
}: {
  title: string
  onCancel: () => void
  children: ReactNode
  footer?: ReactNode
  width?: 'sm' | 'md'
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(10,20,40,.4)] p-4 backdrop-blur-[3px]" onClick={onCancel}>
      <div
        role="dialog"
        aria-labelledby="ios-form-title"
        className={cn(
          'flex max-h-[85vh] w-full flex-col overflow-hidden rounded-[24px] bg-[var(--card)] shadow-[var(--sh-pop)]',
          width === 'md' ? 'max-w-[860px]' : 'max-w-[620px]'
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center gap-3.5 px-6 pb-3 pt-[22px]">
          <h3 id="ios-form-title" className="flex-1 text-xl font-extrabold tracking-tight">
            {title}
          </h3>
          <button type="button" onClick={onCancel} className="btn sm ghost">
            Cancel
          </button>
        </header>
        <div className="overflow-y-auto px-6 py-4">{children}</div>
        {footer ? <div className="flex justify-end gap-2.5 border-t border-[var(--line)] px-6 py-4">{footer}</div> : null}
      </div>
    </div>
  )
}

export function FilterChip({
  title,
  selected,
  onClick,
}: {
  title: string
  selected: boolean
  onClick: () => void
  /** @deprecated visual comes from the selected chip style */
  selectedClass?: string
}) {
  const [label, count] = splitChipTitle(title)
  return (
    <button type="button" onClick={onClick} className={cn('chip', selected && 'on')}>
      {label}
      {count !== undefined ? <span className="n">{count}</span> : null}
    </button>
  )
}

function splitChipTitle(title: string): [string, string | undefined] {
  const match = title.match(/^(.*?)(?:\s*[·•]\s*)(\d+)\s*$/)
  if (!match) return [title, undefined]
  return [match[1].trim(), match[2]]
}

export function StatsRow({
  items,
}: {
  items: { value: number; label: string; valueClass?: string; hue?: SectionHue }[]
}) {
  return (
    <div className="grid grid-cols-3 gap-2.5">
      {items.map((item) => (
        <div key={item.label} className="stat" data-hue={item.hue || 'blue'} style={{ cursor: 'default' }}>
          <div>
            <b className={item.valueClass}>{item.value}</b>
            <span>{item.label}</span>
          </div>
        </div>
      ))}
    </div>
  )
}

export function SearchField({
  value,
  onChange,
  placeholder,
}: {
  value: string
  onChange: (value: string) => void
  placeholder: string
}) {
  return (
    <label className="search">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </svg>
      <input
        className="pp-in"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
      />
    </label>
  )
}

