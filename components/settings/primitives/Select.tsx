import type { SelectHTMLAttributes } from 'react'

export function Select({ children, className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 ${
        props.disabled ? 'bg-slate-50 text-slate-500' : 'bg-white'
      } ${className || ''}`}
    >
      {children}
    </select>
  )
}
