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
      className="row"
      style={{
        padding: '8px 10px',
        borderRadius: 12,
        color: 'var(--ink)',
        fontWeight: active ? 700 : 500,
        background: active ? 'var(--ht)' : 'transparent',
      }}
    >
      <span className="ico-chip sm" style={{ width: 30, height: 30 }}>
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={item.icon} />
        </svg>
      </span>
      {item.label}
    </Link>
  )
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
      <p className="muted small" style={{ marginBottom: 12 }}>
        Click through sections freely. Press Save only when you have changed something.
      </p>
      <div className="settings-split">
        <nav className="card" style={{ padding: 8 }}>
          <Link href="/dashboard/settings" className="btn sm ghost" style={{ margin: '4px 6px 8px' }}>
            All settings
          </Link>
          <div className="eyebrow" style={{ padding: '10px 10px 4px' }}>
            PERSONAL
          </div>
          {personal.map((item) => (
            <NavLink key={item.id} item={item} active={item.id === panel} />
          ))}
          {company.length > 0 ? (
            <>
              <div className="eyebrow" style={{ padding: '14px 10px 4px' }}>
                COMPANY-WIDE
              </div>
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
