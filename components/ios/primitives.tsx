/**
 * iOS parity source: Blueprint §4.5 shared primitives (subset used by Phase 2 shell / Home)
 */

import type { ReactNode } from 'react'

export function StatusPill({
  label,
  tone = 'grey',
}: {
  label: string
  tone?: 'blue' | 'green' | 'amber' | 'red' | 'grey'
}) {
  const map = {
    blue: 'bg-ios-chip-blue text-ios-icon-blue',
    green: 'bg-ios-chip-green text-ios-icon-green',
    amber: 'bg-ios-chip-amber text-ios-icon-amber',
    red: 'bg-ios-chip-red text-ios-icon-red',
    grey: 'bg-ios-chip-grey text-ios-icon-grey',
  }
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[12px] font-medium ${map[tone]}`}>{label}</span>
  )
}

export function EmptyState({
  icon,
  title,
  subtitle,
}: {
  icon?: ReactNode
  title: string
  subtitle?: string
}) {
  return (
    <div className="flex min-h-[320px] flex-col items-center justify-center px-6 py-16 text-center">
      {icon ? <div className="mb-4 text-ios-muted">{icon}</div> : null}
      <p className="text-[22px] font-semibold">{title}</p>
      {subtitle ? <p className="mt-2 text-[15px] text-ios-muted">{subtitle}</p> : null}
    </div>
  )
}

export function PageHeader({ title, actions }: { title: string; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex items-center justify-between gap-3">
      <h1 className="text-[28px] font-semibold tracking-tight">{title}</h1>
      {actions}
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[80vh] w-full max-w-[640px] flex-col overflow-hidden rounded-2xl bg-ios-card">
        <header className="flex items-center justify-between border-b border-ios-border px-5 py-3">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button type="button" onClick={onDone} className="text-sm font-semibold text-[#185FA5]">
            Done
          </button>
        </header>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  )
}
