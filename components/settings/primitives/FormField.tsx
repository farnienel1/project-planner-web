import type { ReactNode } from 'react'

export function FormField({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[13.5px] font-semibold text-[var(--ink2)]">{label}</label>
      {children}
      {hint && <p className="text-[12.5px] text-[var(--ink3)] leading-relaxed">{hint}</p>}
    </div>
  )
}
