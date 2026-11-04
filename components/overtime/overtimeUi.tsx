'use client'

/**
 * Rulebook 1.29.0 / 1.30.0 (§25, §26): shared layout pieces of Timesheets → Overtime, Expenses & Price Work (no rules).
 */
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { payeCustomRange } from '@/lib/canonical'
import type { User } from '@/types'

export const OVERTIME_PATH = '/dashboard/timesheets/overtime'

export function overtimeHref(params: Record<string, string | null | undefined>): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) if (value) search.set(key, value)
  const query = search.toString()
  return query ? `${OVERTIME_PATH}?${query}` : OVERTIME_PATH
}

export function personName(user: User | null | undefined): string {
  if (!user) return 'Unknown person'
  return [user.firstName, user.surname].filter(Boolean).join(' ') || user.email || 'Unknown person'
}

export function isPaye(user: User | null | undefined): boolean {
  return String(user?.employmentType ?? '').toLowerCase() === 'paye'
}

export function NavBar({ title, back }: { title: string; back?: { label: string; href: string } }) {
  const router = useRouter()
  return (
    <div className="phead" data-hue="ts">
      {back ? (
        <button type="button" className="btn sm ghost" onClick={() => router.replace(back.href)}>
          {back.label}
        </button>
      ) : null}
      <div>
        <h1>{title}</h1>
      </div>
    </div>
  )
}

export function Tile({ title, subtitle, onClick, disabled }: { title: string; subtitle?: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      className="card pad click"
      style={{ border: 0, textAlign: 'left', opacity: disabled ? 0.55 : 1 }}
      onClick={onClick}
      disabled={disabled}
    >
      <b style={{ fontFamily: 'var(--head)', fontSize: 18 }}>{title}</b>
      {subtitle ? <div className="muted small">{subtitle}</div> : null}
    </button>
  )
}

export function orgLogo(orgDoc: Record<string, unknown> | null | undefined): string | null {
  const url = orgDoc?.companyLogoURL
  return typeof url === 'string' && url.trim() ? url : null
}

export function CustomRangeForm({ onView }: { onView: (start: string, end: string) => void }) {
  const [a, setA] = useState('')
  const [b, setB] = useState('')
  const picked = payeCustomRange(a, b)
  return (
    <div className="card pad stack" style={{ gap: 12 }}>
      <label className="small">
        Start
        <input className="input" type="date" value={a} onChange={(e) => setA(e.target.value)} />
      </label>
      <label className="small">
        End
        <input className="input" type="date" value={b} onChange={(e) => setB(e.target.value)} />
      </label>
      <button type="button" className="btn primary" style={{ background: 'var(--green, #16a34a)' }} disabled={!picked} onClick={() => picked && onView(picked.start, picked.end)}>
        View Overtime
      </button>
    </div>
  )
}
