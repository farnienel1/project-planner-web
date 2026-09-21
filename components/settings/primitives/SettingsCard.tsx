import type { ReactNode } from 'react'

export function SettingsCard({ children }: { children: ReactNode }) {
  return <div className="card overflow-hidden [&>*+*]:border-t [&>*+*]:border-[var(--line)]">{children}</div>
}
