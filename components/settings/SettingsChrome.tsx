'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'
import {
  COMPANY_SETTINGS,
  PERSONAL_SETTINGS,
  type SettingsNavItem,
  type SettingsPanel,
} from '@/lib/settings/settingsNav'

function NavLink({ item, active }: { item: SettingsNavItem; active: boolean }) {
  return (
    <Link
      href={item.href}
      data-hue={item.hue}
      aria-current={active ? 'page' : undefined}
      className={`relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13.5px] leading-tight transition ${
        active
          ? 'bg-[var(--blue-t)] font-semibold text-[var(--ink)]'
          : 'font-medium text-[var(--ink2)] hover:bg-[var(--soft)] hover:text-[var(--ink)]'
      }`}
    >
      {active ? <span className="absolute inset-y-1.5 left-0 w-[3px] rounded-r bg-[var(--blue)]" aria-hidden /> : null}
      <span
        className={`grid h-7 w-7 shrink-0 place-items-center rounded-md ${
          active ? 'text-[var(--blue)]' : 'text-[var(--ink3)]'
        }`}
        aria-hidden
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d={item.icon} />
        </svg>
      </span>
      <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">{item.label}</span>
    </Link>
  )
}

function GroupLabel({ children }: { children: ReactNode }) {
  return <div className="px-2.5 pb-1 pt-4 text-[12px] font-semibold text-[var(--ink3)]">{children}</div>
}

export function SettingsChrome({
  panel,
  canAccessCompany,
  children,
}: {
  panel: SettingsPanel
  canAccessCompany: boolean
  children: ReactNode
}) {
  const personal = PERSONAL_SETTINGS
  const company = canAccessCompany ? COMPANY_SETTINGS : []

  return (
    <div className="page" style={{ maxWidth: 1100 }}>
      <div className="settings-split">
        <nav className="card self-start p-2 lg:sticky lg:top-[84px]" aria-label="Settings">
          <Link
            href="/dashboard/settings"
            className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-[13.5px] font-semibold text-[var(--ink)] transition hover:bg-[var(--soft)]"
          >
            <svg className="h-4 w-4 text-[var(--ink3)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
            All settings
          </Link>
          <GroupLabel>Personal</GroupLabel>
          {personal.map((item) => (
            <NavLink key={item.id} item={item} active={item.id === panel} />
          ))}
          {company.length > 0 ? (
            <>
              <GroupLabel>Company-wide</GroupLabel>
              {company.map((item) => (
                <NavLink key={item.id} item={item} active={item.id === panel} />
              ))}
            </>
          ) : null}
        </nav>
        <section className="min-w-0">{children}</section>
      </div>
    </div>
  )
}
