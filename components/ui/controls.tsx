'use client'

import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'
import { cn } from '@/lib/ui/cn'
import type { SectionHue } from '@/lib/ui/sectionHue'

export function Chip({
  selected,
  count,
  hue = 'blue',
  onClick,
  children,
}: {
  selected?: boolean
  count?: number
  hue?: SectionHue
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      data-hue={hue}
      onClick={onClick}
      className={cn(
        'inline-flex h-[38px] items-center gap-1.5 rounded-full px-[15px] text-sm font-semibold shadow-[var(--sh)]',
        selected ? 'bg-[var(--h)] text-white' : 'bg-[var(--card)] text-[var(--ink2)] hover:text-[var(--ink)]'
      )}
    >
      {children}
      {typeof count === 'number' ? (
        <span className={cn('rounded-full px-2 py-px text-xs', selected ? 'bg-white/25 text-white' : 'bg-[var(--soft2)] text-[var(--ink2)]')}>
          {count}
        </span>
      ) : null}
    </button>
  )
}

export function SegmentedControl({
  value,
  options,
  onChange,
}: {
  value: string
  options: { value: string; label: string }[]
  onChange: (value: string) => void
}) {
  return (
    <div className="inline-flex gap-1 rounded-[14px] bg-[var(--soft2)] p-1" role="tablist">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="tab"
          aria-selected={option.value === value}
          onClick={() => onChange(option.value)}
          className={cn(
            'inline-flex h-9 items-center gap-1.5 rounded-[10px] px-4 text-sm font-semibold',
            option.value === value ? 'bg-[var(--card)] text-[var(--ink)] shadow-[var(--sh)]' : 'text-[var(--ink2)]'
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

export function Pill({
  hue = 'lib',
  dot,
  solid,
  children,
}: {
  hue?: SectionHue
  dot?: boolean
  solid?: boolean
  children: ReactNode
}) {
  return (
    <span
      data-hue={hue}
      className={cn(
        'inline-flex h-[26px] items-center gap-1.5 whitespace-nowrap rounded-full px-[11px] text-[12.5px] font-semibold',
        solid ? 'bg-[var(--h)] text-white' : 'bg-[var(--ht)] text-[var(--h)]'
      )}
    >
      {dot ? <i className="h-[7px] w-[7px] rounded-full bg-current" /> : null}
      {children}
    </span>
  )
}

const STATUS_HUE: Record<string, SectionHue> = {
  Active: 'green',
  Signed: 'green',
  Ordered: 'green',
  Verified: 'green',
  Approved: 'green',
  Upcoming: 'blue',
  Completed: 'lib',
  Pending: 'warn',
  Overdue: 'red',
  Urgent: 'red',
  High: 'red',
  Clash: 'red',
  'To do': 'task',
  'To Do': 'task',
  'In progress': 'daily',
}

export function StatusPill({ status }: { status: string }) {
  return (
    <Pill hue={STATUS_HUE[status] || 'lib'} dot>
      {status}
    </Pill>
  )
}

export function Toggle({
  checked,
  onChange,
  hue = 'blue',
  label,
}: {
  checked: boolean
  onChange: (next: boolean) => void
  hue?: SectionHue
  label?: string
}) {
  return (
    <label data-hue={hue} className="inline-flex cursor-pointer items-center gap-2">
      {label ? <span className="text-sm font-medium">{label}</span> : null}
      <span className="relative inline-block h-7 w-12 shrink-0">
        <input
          type="checkbox"
          className="peer sr-only"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
        />
        <span className="absolute inset-0 rounded-full bg-[var(--line2)] transition peer-checked:bg-[var(--h)] peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-[var(--blue-t)]" />
        <span className="absolute left-[3px] top-[3px] h-[22px] w-[22px] rounded-full bg-white shadow transition peer-checked:translate-x-5" />
      </span>
    </label>
  )
}

export function Field({
  label,
  required,
  error,
  help,
  className,
  children,
}: {
  label: string
  required?: boolean
  error?: string
  help?: string
  className?: string
  children: ReactNode
}) {
  return (
    <label className={cn('flex flex-col gap-[7px]', className)}>
      <span className="text-[13.5px] font-semibold text-[var(--ink2)]">
        {label}
        {required ? <span className="text-[var(--red)]"> *</span> : null}
      </span>
      {children}
      {help && !error ? <span className="text-[12.5px] text-[var(--ink3)]">{help}</span> : null}
      {error ? <span className="text-[12.5px] font-medium text-[var(--red)]">{error}</span> : null}
    </label>
  )
}

const inputClass =
  'h-12 w-full min-w-0 rounded-[13px] border-[1.5px] border-[var(--line2)] bg-[var(--card)] px-3.5 text-[15px] transition focus:border-[var(--blue)] focus:outline-none focus:shadow-[0_0_0_4px_var(--blue-t)]'

export function Input({ error, className, ...props }: InputHTMLAttributes<HTMLInputElement> & { error?: boolean }) {
  return <input className={cn(inputClass, error && 'border-[var(--red)]', className)} {...props} />
}

export function Textarea({ error, className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement> & { error?: boolean }) {
  return <textarea className={cn(inputClass, 'h-auto min-h-24 py-3', error && 'border-[var(--red)]', className)} {...props} />
}

export function Select({ error, className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement> & { error?: boolean }) {
  return (
    <select className={cn(inputClass, error && 'border-[var(--red)]', className)} {...props}>
      {children}
    </select>
  )
}
