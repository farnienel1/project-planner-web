import type { ReactNode } from 'react'
import { cn } from '@/lib/ui/cn'
import type { SectionHue } from '@/lib/ui/sectionHue'

export function IconChip({
  hue = 'blue',
  size = 'md',
  solid,
  className,
  children,
}: {
  hue?: SectionHue
  size?: 'sm' | 'md' | 'lg'
  solid?: boolean
  className?: string
  children: ReactNode
}) {
  const box = size === 'lg' ? 'h-14 w-14 rounded-[16px]' : size === 'sm' ? 'h-9 w-9 rounded-[11px]' : 'h-11 w-11 rounded-[13px]'
  return (
    <span
      data-hue={hue}
      className={cn(
        'inline-grid shrink-0 place-items-center',
        box,
        solid ? 'bg-[var(--h)] text-white' : 'bg-[var(--ht)] text-[var(--h)]',
        className
      )}
    >
      {children}
    </span>
  )
}
