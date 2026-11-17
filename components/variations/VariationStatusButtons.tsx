'use client'

import { useRef, type KeyboardEvent } from 'react'
import type { VariationStatus } from '@/lib/variations/variationModel'
import { VARIATION_STATUS_OPTIONS, variationStatusChoice, variationStatusKeyTarget } from '@/lib/variations/variationStatusChoice'

/**
 * Open / Submitted / Closed as three buttons on one line (owner request 17 Nov; replaces the dropdown, UI only).
 * A radio group: one tab stop, arrow keys / Home / End move and choose, screen readers hear "Status of VO-003,
 * radio group, Open, selected". `onChange` gets exactly what the dropdown handed it (`variationStatusChoice`).
 */
export function VariationStatusButtons({
  value,
  onChange,
  label,
  disabled = false,
}: {
  value: VariationStatus
  onChange: (status: VariationStatus) => void
  label: string
  disabled?: boolean
}) {
  const refs = useRef<Array<HTMLButtonElement | null>>([])
  const choose = (pressed: VariationStatus) => {
    const next = variationStatusChoice(value, pressed)
    if (next) onChange(next)
  }
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const target = variationStatusKeyTarget(value, event.key)
    if (!target) return
    event.preventDefault()
    const index = VARIATION_STATUS_OPTIONS.findIndex((option) => option.value === target)
    refs.current[index]?.focus()
    choose(target)
  }
  return (
    <div className="seg" role="radiogroup" aria-label={label} aria-disabled={disabled || undefined} style={{ flexWrap: 'nowrap' }}>
      {VARIATION_STATUS_OPTIONS.map((option, index) => {
        const on = option.value === value
        return (
          <button
            key={option.value}
            ref={(node) => {
              refs.current[index] = node
            }}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={on ? 0 : -1}
            className={on ? 'on' : ''}
            disabled={disabled}
            onClick={() => choose(option.value)}
            onKeyDown={onKeyDown}
            style={{ padding: '0 12px', minHeight: 36, whiteSpace: 'nowrap' }}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
