'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { searchSkillTrades } from '@/lib/staff/skillUtils'

type SkillTradeAutocompleteProps = {
  value: string
  onChange: (value: string) => void
  trades: string[]
  placeholder?: string
  required?: boolean
  disabled?: boolean
  id?: string
}

export function SkillTradeAutocomplete({
  value,
  onChange,
  trades,
  placeholder = 'Enter trade name',
  required = false,
  disabled = false,
  id,
}: SkillTradeAutocompleteProps) {
  const [open, setOpen] = useState(false)
  const [highlightIndex, setHighlightIndex] = useState(-1)
  const containerRef = useRef<HTMLDivElement>(null)

  const suggestions = useMemo(() => searchSkillTrades(value, trades), [value, trades])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false)
        setHighlightIndex(-1)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const showSuggestions = open && suggestions.length > 0

  const selectSuggestion = (trade: string) => {
    onChange(trade)
    setOpen(false)
    setHighlightIndex(-1)
  }

  return (
    <div ref={containerRef} className="relative w-full sm:w-56">
      <input
        id={id}
        value={value}
        onChange={(e) => {
          onChange(e.target.value)
          setOpen(true)
          setHighlightIndex(-1)
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (!showSuggestions) return
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            setHighlightIndex((prev) => (prev + 1) % suggestions.length)
          } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setHighlightIndex((prev) => (prev <= 0 ? suggestions.length - 1 : prev - 1))
          } else if (e.key === 'Enter' && highlightIndex >= 0) {
            e.preventDefault()
            selectSuggestion(suggestions[highlightIndex])
          } else if (e.key === 'Escape') {
            setOpen(false)
            setHighlightIndex(-1)
          }
        }}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        autoComplete="off"
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
      />
      {showSuggestions && (
        <ul className="absolute z-20 mt-1 max-h-48 w-full overflow-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
          {suggestions.map((trade, index) => (
            <li key={trade}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => selectSuggestion(trade)}
                className={`block w-full px-3 py-2 text-left text-sm ${
                  index === highlightIndex ? 'bg-blue-50 text-blue-700' : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                {trade}
              </button>
            </li>
          ))}
        </ul>
      )}
      {value.trim() && !trades.some((t) => t.toLowerCase() === value.trim().toLowerCase()) && (
        <p className="mt-1 text-xs text-slate-500">New trade — used for skills grouping only</p>
      )}
    </div>
  )
}
