'use client'

import { FormEvent, useState } from 'react'

export function CustomOtherLocationField({
  onUse,
  disabled,
}: {
  onUse: (name: string) => void
  disabled?: boolean
}) {
  const [name, setName] = useState('')
  const trimmed = name.trim()
  return (
    <form
      className="stack"
      style={{ gap: 8 }}
      onSubmit={(event: FormEvent) => {
        event.preventDefault()
        if (!trimmed || disabled) return
        onUse(trimmed)
        setName('')
      }}
    >
      <p className="eyebrow">Custom location</p>
      <p className="muted small">One-off for this booking — not added to organisation defaults.</p>
      <div className="row wrap">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Training"
          className="in grow"
          aria-label="Custom Other location"
        />
        <button type="submit" className="btn primary" disabled={!trimmed || disabled}>
          Use
        </button>
      </div>
    </form>
  )
}
