'use client'

import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/ui/cn'
import type { SectionHue } from '@/lib/ui/sectionHue'

export type ButtonVariant = 'primary' | 'secondary' | 'tint' | 'hue' | 'ghost' | 'danger'
export type ButtonSize = 'md' | 'sm' | 'xs'

export function Button({
  variant = 'secondary',
  size = 'md',
  hue,
  round,
  block,
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  size?: ButtonSize
  hue?: SectionHue
  round?: boolean
  block?: boolean
  children?: ReactNode
}) {
  const heights = { md: 'h-11 px-[18px] text-[14.5px] rounded-[13px]', sm: 'h-9 px-3.5 text-[13.5px] rounded-[11px]', xs: 'h-[30px] px-[11px] text-[12.5px] rounded-[9px]' }
  const rounds = { md: 'w-11 px-0', sm: 'w-9 px-0', xs: 'w-[30px] px-0' }
  const variants: Record<ButtonVariant, string> = {
    primary:
      'bg-[linear-gradient(180deg,var(--blue2),var(--blue))] text-white shadow-[0_1px_0_rgba(255,255,255,.25)_inset,0_6px_16px_rgba(30,90,168,.32)]',
    secondary: 'bg-[var(--card)] text-[var(--ink)] shadow-[var(--sh)]',
    tint: 'bg-[var(--ht)] text-[var(--h)] shadow-none',
    hue: 'bg-[var(--h)] text-white shadow-[0_6px_16px_color-mix(in_srgb,var(--h)_35%,transparent)]',
    ghost: 'bg-transparent text-[var(--ink2)] shadow-none hover:bg-[var(--soft2)] hover:text-[var(--ink)]',
    danger: 'bg-[var(--red-t)] text-[var(--red)] shadow-none',
  }
  return (
    <button
      type="button"
      data-hue={hue}
      className={cn(
        'inline-flex items-center justify-center gap-2 font-semibold transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45',
        heights[size],
        round && rounds[size],
        block && 'w-full',
        variants[variant],
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
}
