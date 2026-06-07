'use client'

export function ProfileSection({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 bg-slate-50/60 px-5 py-3.5">
        <h2 className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">{title}</h2>
      </div>
      <div className="divide-y divide-slate-100">{children}</div>
    </section>
  )
}

export function ProfileToggleRow({
  label,
  description,
  checked,
  onChange,
  disabled,
}: {
  label: string
  description?: string
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
}) {
  return (
    <div className={`flex items-center justify-between gap-4 px-5 py-4 ${disabled ? 'opacity-60' : ''}`}>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-slate-900">{label}</span>
        {description && (
          <span className="mt-0.5 block text-xs leading-relaxed text-slate-500">{description}</span>
        )}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className={`
          relative inline-flex h-[28px] w-[50px] flex-shrink-0 cursor-pointer items-center
          rounded-full border-2 border-transparent
          transition-colors duration-200 ease-in-out
          focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2
          disabled:cursor-not-allowed
          ${checked ? 'bg-blue-500' : 'bg-slate-200'}
        `}
      >
        <span
          className={`
            pointer-events-none inline-block h-[22px] w-[22px] transform rounded-full
            bg-white shadow-[0_2px_4px_rgba(0,0,0,0.25)]
            ring-0 transition-transform duration-200 ease-in-out
            ${checked ? 'translate-x-[22px]' : 'translate-x-[1px]'}
          `}
        />
      </button>
    </div>
  )
}

export function ProfileActionButton({
  label,
  description,
  onClick,
  tone = 'default',
  disabled,
}: {
  label: string
  description?: string
  onClick: () => void
  tone?: 'default' | 'danger' | 'warning'
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`
        flex w-full items-center justify-between px-5 py-4 text-left
        transition-colors disabled:opacity-50
        ${
          tone === 'danger'
            ? 'hover:bg-red-50'
            : tone === 'warning'
              ? 'hover:bg-amber-50'
              : 'hover:bg-slate-50'
        }
      `}
    >
      <span className="min-w-0 flex-1">
        <span
          className={`block text-sm font-medium ${
            tone === 'danger'
              ? 'text-red-600'
              : tone === 'warning'
                ? 'text-amber-600'
                : 'text-slate-900'
          }`}
        >
          {label}
        </span>
        {description && (
          <span
            className={`mt-0.5 block text-xs ${
              tone === 'danger' ? 'text-red-400' : tone === 'warning' ? 'text-amber-500' : 'text-slate-500'
            }`}
          >
            {description}
          </span>
        )}
      </span>
      <svg className="ml-3 h-4 w-4 flex-shrink-0 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
    </button>
  )
}
