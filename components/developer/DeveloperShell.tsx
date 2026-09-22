'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'
import { cn } from '@/lib/ui/cn'

const LINKS = [
  { href: '/dashboard/developer', label: 'Overview' },
  { href: '/dashboard/developer/analytics', label: 'Analytics' },
  { href: '/dashboard/developer/usage', label: 'Feature usage' },
  { href: '/dashboard/developer/feedback', label: 'Feedback' },
  { href: '/dashboard/developer/roadmap', label: 'Roadmap' },
]

export function DeveloperShell({ title, children, actions }: { title: string; children: ReactNode; actions?: ReactNode }) {
  const pathname = usePathname() || ''
  return (
    <div className="space-y-4">
      <nav className="flex gap-1 overflow-x-auto rounded-[13px] bg-[#e7ebf1] p-1">
        {LINKS.map((link) => {
          const on = pathname === link.href || (link.href !== '/dashboard/developer' && pathname.startsWith(link.href))
          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                'min-w-[88px] flex-1 rounded-[10px] px-3 py-2 text-center text-xs font-bold',
                on ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
              )}
            >
              {link.label}
            </Link>
          )
        })}
      </nav>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h1 className="text-xl font-extrabold text-[var(--ink)]">{title}</h1>
        {actions}
      </div>
      {children}
    </div>
  )
}

export function MetricCard({
  label,
  value,
  hint,
  href,
}: {
  label: string
  value: string | number
  hint?: ReactNode
  href?: string
}) {
  const inner = (
    <>
      <p className="eyebrow">{label}</p>
      <p className="mt-1 text-2xl font-extrabold">{value}</p>
      {hint ? <p className="mt-1 text-xs text-[var(--ink3)]">{hint}</p> : null}
    </>
  )
  if (href) {
    return (
      <Link href={href} className="card pad block">
        {inner}
      </Link>
    )
  }
  return <div className="card pad">{inner}</div>
}

export function MiniBars({ points, hue = 'blue' }: { points: { day: string; value: number }[]; hue?: string }) {
  const max = Math.max(1, ...points.map((point) => point.value))
  return (
    <div className="flex h-24 items-end gap-1" data-hue={hue}>
      {points.map((point) => (
        <i
          key={point.day}
          title={`${point.day}: ${point.value}`}
          className="flex-1 rounded-sm bg-[var(--h)]"
          style={{ height: `${Math.max(4, (point.value / max) * 100)}%`, opacity: point.value ? 1 : 0.2 }}
        />
      ))}
    </div>
  )
}

export function ChangeHint({ current, previous }: { current: number; previous: number }) {
  if (previous === 0 && current === 0) return <span className="text-[var(--ink3)]">No change</span>
  if (previous === 0) return <span className="text-[var(--ink3)]">No previous-period data</span>
  const pct = Math.round(((current - previous) / previous) * 1000) / 10
  const up = pct >= 0
  return (
    <span className={up ? 'text-[var(--hs)]' : 'text-[var(--red)]'}>
      {up ? '+' : ''}
      {pct}% vs previous period
    </span>
  )
}
