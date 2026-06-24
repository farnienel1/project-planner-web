import type { ReactNode } from 'react'

export function FormField({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</label>
      {children}
      {hint && <p className="text-xs text-slate-400 leading-relaxed">{hint}</p>}
    </div>
  )
}
