'use client'

import { useEffect, useId, type ReactNode } from 'react'
import { cn } from '@/lib/ui/cn'
import type { SectionHue } from '@/lib/ui/sectionHue'
import { IconChip } from '@/components/ui/IconChip'
import { Button } from '@/components/ui/Button'

export function Modal({
  open,
  title,
  subtitle,
  hue = 'blue',
  icon,
  wide,
  onClose,
  footer,
  children,
}: {
  open: boolean
  title: string
  subtitle?: string
  hue?: SectionHue
  icon?: ReactNode
  wide?: boolean
  onClose: () => void
  footer?: ReactNode
  children: ReactNode
}) {
  const labelledBy = useId()
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-[60]">
      <button type="button" className="absolute inset-0 bg-[rgba(10,20,40,.4)] backdrop-blur-[3px]" aria-label="Close" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        className={cn(
          'absolute left-1/2 top-1/2 flex max-h-[88vh] w-[min(620px,94vw)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-3xl bg-[var(--card)] shadow-[var(--sh-pop)]',
          wide && 'w-[min(860px,94vw)]'
        )}
      >
        <div className="flex items-center gap-3.5 px-6 pb-3 pt-[22px]" data-hue={hue}>
          {icon ? <IconChip hue={hue}>{icon}</IconChip> : null}
          <div className="min-w-0 flex-1">
            <h2 id={labelledBy} className="text-xl font-extrabold">
              {title}
            </h2>
            {subtitle ? <p className="text-sm text-[var(--ink3)]">{subtitle}</p> : null}
          </div>
          <Button variant="ghost" size="sm" round onClick={onClose} aria-label="Close">
            ×
          </Button>
        </div>
        <div className="overflow-y-auto px-6 py-2">{children}</div>
        {footer !== false ? (
          <div className="flex justify-end gap-2.5 border-t border-[var(--line)] px-6 py-4">{footer}</div>
        ) : null}
      </div>
    </div>
  )
}

export function Popover({
  open,
  onClose,
  className,
  children,
}: {
  open: boolean
  onClose: () => void
  className?: string
  children: ReactNode
}) {
  if (!open) return null
  return (
    <>
      <button type="button" className="fixed inset-0 z-30 cursor-default bg-transparent" aria-label="Close menu" onClick={onClose} />
      <div className={cn('absolute z-40 max-h-[80vh] overflow-auto rounded-[18px] bg-[var(--card)] p-2 shadow-[var(--sh-pop)]', className)}>
        {children}
      </div>
    </>
  )
}

export function ToastViewport({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <div
      role="status"
      className="fixed bottom-[calc(26px+env(safe-area-inset-bottom,0px))] left-1/2 z-[80] flex -translate-x-1/2 items-center gap-2.5 rounded-2xl bg-[var(--ink)] px-[18px] py-3 font-semibold text-[var(--card)] shadow-[var(--sh-pop)]"
    >
      <span className="grid h-6 w-6 place-items-center rounded-full bg-[var(--green)] text-white">✓</span>
      {message}
    </div>
  )
}
