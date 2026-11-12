'use client'

/**
 * Rulebook 1.29.0 / 1.30.0 (§25, §26): shared layout pieces of Timesheets → Overtime, Expenses & Price Work (no rules).
 */
import { useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronRightIcon } from '@heroicons/react/24/solid'
import { OVERTIME_HUB_LABEL, payeCustomRange } from '@/lib/canonical'
import { ActionCard, Card, IconTile, PageBand, PuButton, type PuTileTone } from '@/components/ui/page'
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

export function NavBar({
  title,
  back,
  eyebrow,
  subtitle,
  children,
}: {
  title: ReactNode
  back?: { label: string; href: string }
  eyebrow?: ReactNode
  subtitle?: ReactNode
  children?: ReactNode
}) {
  const router = useRouter()
  return (
    <PageBand
      back={back ? { label: back.label, onClick: () => router.replace(back.href) } : undefined}
      eyebrow={eyebrow ?? OVERTIME_HUB_LABEL}
      title={title}
      subtitle={subtitle}
    >
      {children}
    </PageBand>
  )
}

/** One choice on these pages: the same button, title, subtitle, handler and disabled state as before. */
export function Tile({
  title,
  subtitle,
  onClick,
  disabled,
  tone,
  icon,
}: {
  title: string
  subtitle?: string
  onClick: () => void
  disabled?: boolean
  tone?: PuTileTone
  icon?: ReactNode
}) {
  return (
    <ActionCard
      tile={<IconTile tone={tone ?? 'blue'}>{icon ?? <ChevronRightIcon />}</IconTile>}
      title={title}
      description={subtitle}
      onClick={onClick}
      disabled={disabled}
    />
  )
}

/** A compact list row with the same button behaviour (used for long lists). */
export function ListTile({ title, subtitle, onClick, chip }: { title: ReactNode; subtitle?: ReactNode; onClick: () => void; chip?: ReactNode }) {
  return (
    <button type="button" className="pu-item" onClick={onClick}>
      <span className="grow">
        <b>{title}</b>
        {subtitle ? <span className="pu-sub">{subtitle}</span> : null}
      </span>
      {chip}
      <ChevronRightIcon width={16} height={16} aria-hidden="true" style={{ color: 'var(--pu-muted)' }} />
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
    <Card>
      <div className="pu-card-b">
        <div className="pu-form-row">
          <label className="pu-form-label">
            Start
            <input className="pu-inp" type="date" value={a} onChange={(e) => setA(e.target.value)} />
          </label>
          <label className="pu-form-label">
            End
            <input className="pu-inp" type="date" value={b} onChange={(e) => setB(e.target.value)} />
          </label>
        </div>
        <PuButton variant="green" disabled={!picked} onClick={() => picked && onView(picked.start, picked.end)}>
          View Overtime
        </PuButton>
      </div>
    </Card>
  )
}
