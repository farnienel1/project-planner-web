'use client'

/**
 * Rulebook 1.39.0 §10 (owner answer 11 Nov): the small triangle on one of the viewer's own My Schedule bookings that
 * overlaps another of their bookings — red while the clash is not approved, grey once approved — and its popup. The
 * texts, colours and whether "Open Warnings" is offered all come from `myScheduleClashMarkers`; nothing is decided
 * here and nothing is written. iOS draws the same (`MyScheduleClashMarkerButton`).
 */
import { useState, type MouseEvent as ReactMouseEvent } from 'react'
import Link from 'next/link'
import { Button, Modal } from '@/components/ui'
import type { MyScheduleClashMarker } from '@/lib/canonical'

export function MyScheduleClashMarkerButton({ marker }: { marker: MyScheduleClashMarker | null | undefined }) {
  const [open, setOpen] = useState(false)
  if (!marker) return null
  const red = marker.state === 'clash'
  return (
    <>
      {/* A span, not a button: the marker sits inside row buttons (the My Schedule booking card). */}
      <span
        role="button"
        tabIndex={0}
        className="inline-grid h-6 w-6 shrink-0 cursor-pointer place-items-center rounded-full align-middle"
        aria-label={red ? 'Booking clash' : 'Clash approved'}
        data-testid="my-schedule-clash-marker"
        data-state={marker.state}
        onClick={(event: ReactMouseEvent) => {
          event.stopPropagation()
          event.preventDefault()
          setOpen(true)
        }}
        onKeyDown={(event) => {
          event.stopPropagation()
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            setOpen(true)
          }
        }}
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden fill={red ? '#C62828' : '#9AA3AE'}>
          <path d="M12 3 1.5 21h21L12 3Zm-1 6h2v6h-2V9Zm0 8h2v2h-2v-2Z" />
        </svg>
      </span>
      <Modal
        open={open}
        title={marker.title}
        hue={red ? 'warn' : 'blue'}
        onClose={() => setOpen(false)}
        footer={
          <div className="flex justify-end gap-2" onClick={(event) => event.stopPropagation()}>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Close
            </Button>
            {marker.actionLabel ? (
              <Link href="/dashboard/warnings" className="inline-flex">
                <Button variant="primary">{marker.actionLabel}</Button>
              </Link>
            ) : null}
          </div>
        }
      >
        <p className="text-[14px] leading-relaxed text-[var(--ink2)]" data-testid="my-schedule-clash-message">
          {marker.message}
        </p>
      </Modal>
    </>
  )
}
