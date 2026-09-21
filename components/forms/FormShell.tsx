'use client'

import Link from 'next/link'

export function FormLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="mb-1 block text-[13.5px] font-semibold text-[var(--ink2)]">
      {children}
      {required && <span className="text-red-500"> *</span>}
    </label>
  )
}

export function FormInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`pp-in ${props.className || ''}`}
    />
  )
}

export function FormSelect(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`pp-in ${props.className || ''}`}
    />
  )
}

export function FormTextarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`pp-in ${props.className || ''}`}
    />
  )
}

export function FormBackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="btn sm ghost mb-4">
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
      </svg>
      {label}
    </Link>
  )
}

export function FormActions({
  saving,
  submitLabel,
  cancelHref,
}: {
  saving: boolean
  submitLabel: string
  cancelHref: string
}) {
  return (
    <div className="flex flex-wrap gap-3 pt-4">
      <button
        type="submit"
        disabled={saving}
        className="btn primary disabled:opacity-50"
      >
        {saving ? 'Saving…' : submitLabel}
      </button>
      <Link href={cancelHref} className="btn">
        Cancel
      </Link>
    </div>
  )
}
