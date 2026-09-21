import type { InputHTMLAttributes } from 'react'

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`pp-in ${props.disabled ? 'opacity-60' : ''} ${props.className || ''}`}
    />
  )
}
