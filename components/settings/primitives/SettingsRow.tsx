import type { ReactNode } from 'react'

export function SettingsRow({
  icon,
  iconBg = 'bg-slate-100',
  iconColor = 'text-slate-600',
  label,
  description,
  value,
  chevron,
  badge,
  danger,
  onClick,
  children,
}: {
  icon: string
  iconBg?: string
  iconColor?: string
  label: string
  description?: string
  value?: string
  chevron?: boolean
  badge?: string
  danger?: boolean
  onClick?: () => void
  children?: ReactNode
}) {
  const inner = (
    <div
      className={`flex items-center gap-3 px-4 py-3.5 ${onClick ? 'cursor-pointer hover:bg-slate-50 transition-colors' : ''} ${danger ? 'hover:bg-red-50' : ''}`}
    >
      <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl ${iconBg}`}>
        <svg className={`h-5 w-5 ${iconColor}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={icon} />
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className={`text-sm font-semibold ${danger ? 'text-red-600' : 'text-slate-900'}`}>{label}</p>
          {badge && (
            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700">{badge}</span>
          )}
        </div>
        {description && <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{description}</p>}
      </div>
      {value && <span className="text-sm font-semibold text-blue-600 flex-shrink-0">{value}</span>}
      {children}
      {chevron && (
        <svg className="h-4 w-4 text-slate-300 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      )}
    </div>
  )
  return onClick ? (
    <button type="button" className="w-full text-left" onClick={onClick}>
      {inner}
    </button>
  ) : (
    <div>{inner}</div>
  )
}
