'use client'

/**
 * Small controls shared by the settings panels. Presentation only: each one
 * calls back with the same values the old inline controls used.
 */

import type { ReactNode } from 'react'
import { Toggle } from './Toggle'

/** A whole row you can click to flip a switch, with a title and helper text. */
export function ToggleRow({
  title,
  description,
  checked,
  onChange,
  disabled,
}: {
  title: string
  description?: ReactNode
  checked: boolean
  onChange: (value: boolean) => void
  disabled?: boolean
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className="min-w-0 flex-1 text-left"
      >
        <span className="block text-[14.5px] font-semibold text-[var(--ink)]">{title}</span>
        {description ? (
          <span className="mt-0.5 block text-[13px] leading-relaxed text-[var(--ink3)]">{description}</span>
        ) : null}
      </button>
      <Toggle checked={checked} onChange={onChange} disabled={disabled} />
    </div>
  )
}

/** Two or more mutually exclusive options shown as a pill switch. */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
}: {
  value: T
  options: ReadonlyArray<{ value: T; label: string; disabled?: boolean }>
  onChange: (value: T) => void
  ariaLabel: string
}) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className="inline-flex flex-wrap gap-1 rounded-xl bg-[var(--soft2)] p-1">
      {options.map((option) => {
        const on = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={on}
            disabled={option.disabled}
            onClick={() => onChange(option.value)}
            className={`rounded-lg px-3.5 py-1.5 text-[13.5px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${
              on ? 'bg-[var(--card)] text-[var(--ink)] shadow-[0_1px_2px_rgba(15,27,45,0.12)]' : 'text-[var(--ink2)] hover:text-[var(--ink)]'
            }`}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

/** A large selectable option with a title, helper text and an example. */
export function ChoiceCard({
  selected,
  title,
  description,
  example,
  onClick,
}: {
  selected: boolean
  title: string
  description: string
  example?: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onClick}
      className={`flex w-full items-start gap-3 rounded-xl p-3.5 text-left transition ${
        selected
          ? 'bg-[var(--blue-t)] shadow-[inset_0_0_0_2px_var(--blue)]'
          : 'bg-[var(--card)] shadow-[inset_0_0_0_1px_var(--line2)] hover:shadow-[inset_0_0_0_1px_var(--ink3)]'
      }`}
    >
      <span
        className={`mt-0.5 grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full border-2 ${
          selected ? 'border-[var(--blue)]' : 'border-[var(--line2)]'
        }`}
        aria-hidden
      >
        {selected ? <span className="h-2 w-2 rounded-full bg-[var(--blue)]" /> : null}
      </span>
      <span className="min-w-0">
        <span className="block text-[14.5px] font-semibold text-[var(--ink)]">{title}</span>
        <span className="mt-0.5 block text-[13px] leading-relaxed text-[var(--ink2)]">{description}</span>
        {example ? <span className="mt-1.5 block text-[12.5px] font-semibold text-[var(--ink3)]">{example}</span> : null}
      </span>
    </button>
  )
}

/** − value + control for whole steps (minutes, hours). */
export function Stepper({
  label,
  hint,
  value,
  onChange,
  min,
  max,
  step,
  format = (v) => String(v),
}: {
  label: string
  hint?: string
  value: number
  onChange: (value: number) => void
  min: number
  max: number
  step: number
  format?: (value: number) => string
}) {
  const btn =
    'grid h-9 w-9 place-items-center rounded-lg text-[18px] font-semibold text-[var(--ink2)] transition hover:bg-[var(--soft2)] hover:text-[var(--ink)] disabled:opacity-30'
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <div className="text-[14.5px] font-semibold text-[var(--ink)]">{label}</div>
        {hint ? <div className="mt-0.5 text-[13px] text-[var(--ink3)]">{hint}</div> : null}
      </div>
      <div className="flex shrink-0 items-center rounded-xl bg-[var(--soft)] p-1 shadow-[inset_0_0_0_1px_var(--line)]">
        <button
          type="button"
          className={btn}
          aria-label={`Decrease ${label}`}
          disabled={value <= min}
          onClick={() => onChange(Math.max(min, +(value - step).toFixed(2)))}
        >
          −
        </button>
        <span className="min-w-[72px] text-center text-[15px] font-bold tabular-nums text-[var(--ink)]">{format(value)}</span>
        <button
          type="button"
          className={btn}
          aria-label={`Increase ${label}`}
          disabled={value >= max}
          onClick={() => onChange(Math.min(max, +(value + step).toFixed(2)))}
        >
          +
        </button>
      </div>
    </div>
  )
}

/** A rate such as 1.5 shown as "1.5 ×". Same parsing as before: blank or bad input becomes 0. */
export function MultiplierInput({
  label,
  hint,
  value,
  onChange,
}: {
  label: string
  hint?: string
  value: number
  onChange: (value: number) => void
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <div className="text-[14.5px] font-semibold text-[var(--ink)]">{label}</div>
        {hint ? <div className="mt-0.5 text-[13px] text-[var(--ink3)]">{hint}</div> : null}
      </div>
      <label className="flex shrink-0 items-center rounded-xl bg-[var(--card)] pr-3 shadow-[inset_0_0_0_1.5px_var(--line2)] focus-within:shadow-[inset_0_0_0_1.5px_var(--blue),0_0_0_3px_var(--blue-t)]">
        <input
          type="number"
          inputMode="decimal"
          step="0.1"
          min="0"
          aria-label={label}
          value={Number.isFinite(value) ? value : ''}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          className="w-[72px] bg-transparent py-2 pl-3 text-right text-[15px] font-bold tabular-nums text-[var(--ink)] outline-none"
        />
        <span className="pl-1 text-[14px] font-semibold text-[var(--ink3)]">×</span>
      </label>
    </div>
  )
}

/** Blue information box with a title. */
export function Callout({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <div className="flex gap-3 rounded-xl bg-[var(--blue-t)] px-4 py-3 text-[13px] leading-relaxed text-[var(--ink2)]">
      <svg className="mt-0.5 h-4 w-4 shrink-0 text-[var(--blue)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <div className="min-w-0">
        {title ? <p className="font-semibold text-[var(--ink)]">{title}</p> : null}
        <div>{children}</div>
      </div>
    </div>
  )
}

/** Sticky bar at the bottom of a panel holding the Save button. */
export function SaveBar({
  children,
  hint,
  dirty,
}: {
  children: ReactNode
  hint?: string
  dirty?: boolean
}) {
  const copy =
    hint ??
    (dirty ? 'Save your changes, or they will be lost if you leave.' : 'Changes are only saved when you press Save.')
  return (
    <div className="sticky bottom-0 z-10 -mx-1 mt-8 bg-[color-mix(in_srgb,var(--bg)_88%,transparent)] px-1 pb-4 pt-3 backdrop-blur-[6px]">
      <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[12.5px] text-[var(--ink3)]">{copy}</p>
        <div className="sm:w-[220px]">{children}</div>
      </div>
    </div>
  )
}
