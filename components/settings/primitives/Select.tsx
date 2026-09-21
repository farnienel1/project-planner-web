import type { SelectHTMLAttributes } from 'react'

export function Select({ children, className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...props} className={`pp-in ${props.disabled ? 'opacity-60' : ''} ${className || ''}`}>
      {children}
    </select>
  )
}
