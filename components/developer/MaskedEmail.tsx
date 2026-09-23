'use client'

import { useState } from 'react'
import { maskEmail } from '@/lib/auth/maskEmail'

export function MaskedEmail({
  email,
  reveal,
  onReveal,
  className,
}: {
  email?: string | null
  reveal?: boolean
  onReveal?: (email: string) => void
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const value = (email || '').trim()
  if (!value) return <span className={className}>—</span>
  const shown = reveal || open
  return (
    <button
      type="button"
      className={className || 'text-left font-medium'}
      title={shown ? 'Hide email' : 'Show full email'}
      onClick={() => {
        if (!shown) onReveal?.(value)
        setOpen((current) => !current)
      }}
    >
      {shown ? value : maskEmail(value)}
    </button>
  )
}
