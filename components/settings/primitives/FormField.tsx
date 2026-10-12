import type { ReactNode } from 'react'

export function FormField({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-[13px] font-semibold text-[var(--ink)]">{label}</label>
      {children}
      {hint && <p className="text-[12.5px] leading-relaxed text-[var(--ink3)]">{hint}</p>}
    </div>
  )
}
