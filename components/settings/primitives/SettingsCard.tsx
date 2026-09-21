import type { ReactNode } from 'react'

export function SettingsCard({ children }: { children: ReactNode }) {
  return <div className="card divide-y divide-[var(--line)] overflow-hidden">{children}</div>
}
