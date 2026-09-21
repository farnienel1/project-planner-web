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
  const hue = danger
    ? 'red'
    : iconBg.includes('emerald') || iconColor.includes('emerald')
      ? 'hs'
      : iconBg.includes('purple') || iconColor.includes('purple')
        ? 'user'
        : iconBg.includes('red') || iconColor.includes('red')
          ? 'red'
          : iconBg.includes('amber') || iconColor.includes('amber')
            ? 'warn'
            : iconBg.includes('slate')
              ? 'lib'
              : 'blue'
  const inner = (
    <div
      data-hue={hue}
      className={`flex items-center gap-3 px-4 py-3.5 ${onClick ? 'cursor-pointer hover:bg-[var(--soft)] transition-colors' : ''} ${danger ? 'hover:bg-[var(--red-t)]' : ''}`}
    >
      <div className="ico-chip sm">
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={icon} />
        </svg>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className={`text-[15px] font-semibold ${danger ? 'text-[var(--red)]' : 'text-[var(--ink)]'}`}>{label}</p>
          {badge && (
            <span className="pill" data-hue="blue">
              {badge}
            </span>
          )}
        </div>
        {description && (
          <p className="mt-0.5 text-[13px] leading-relaxed text-[var(--ink3)]">{description}</p>
        )}
      </div>
      {value && <span className="shrink-0 text-sm font-semibold text-[var(--blue)]">{value}</span>}
      {children ? <div className="shrink-0">{children}</div> : null}
      {chevron && (
        <svg className="h-4 w-4 shrink-0 text-[var(--ink3)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
