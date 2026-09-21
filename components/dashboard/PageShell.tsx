'use client'

export function LoadingSpinner({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex h-64 flex-col items-center justify-center gap-3">
      <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-[var(--blue)]" />
      <p className="text-sm text-[var(--ink3)]">{label}</p>
    </div>
  )
}

export function PageHeader({
  title,
  description,
  meta,
  actions,
}: {
  title: string
  description: string
  meta?: string
  actions?: React.ReactNode
}) {
  return (
    <div className="phead">
      <div className="min-w-0">
        <h1>{title}</h1>
        <p className="sub">{description}</p>
        {meta ? <p className="mt-2 text-xs text-[var(--ink3)]">{meta}</p> : null}
      </div>
      {actions ? <div className="acts">{actions}</div> : null}
    </div>
  )
}

export function SearchField({
  value,
  onChange,
  placeholder,
}: {
  value: string
  onChange: (value: string) => void
  placeholder: string
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="pp-in"
    />
  )
}

export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="card pad text-center">
      <h3 className="h2">{title}</h3>
      <p className="mt-2 text-[var(--ink3)]">{description}</p>
    </div>
  )
}

export function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="banner" data-hue="red">
      <span className="text-sm font-semibold">{message}</span>
    </div>
  )
}
