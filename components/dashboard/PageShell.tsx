'use client'

export function LoadingSpinner({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex h-64 flex-col items-center justify-center gap-3">
      <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600" />
      <p className="text-sm text-slate-500">{label}</p>
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
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">{title}</h1>
          <p className="mt-1 text-slate-600">{description}</p>
          {meta && <p className="mt-2 text-xs text-slate-500">{meta}</p>}
        </div>
        {actions}
      </div>
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
      className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
    />
  )
}

export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-sm">
      <h3 className="text-lg font-medium text-slate-900">{title}</h3>
      <p className="mt-2 text-slate-500">{description}</p>
    </div>
  )
}

export function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{message}</div>
  )
}
