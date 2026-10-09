'use client'

import { useCallback, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/overlays'
import { addLondonDays, londonMidnight } from '@/lib/ios-parity/londonTime'
import { employmentTypeLabel, normalizeEmploymentType } from '@/lib/canonical/userProfile'

function sameType(left?: string | null, right?: string | null): boolean {
  return normalizeEmploymentType(left) === normalizeEmploymentType(right)
}

export function useEmploymentTypeSaveGate() {
  const [open, setOpen] = useState(false)
  const [nextType, setNextType] = useState<string>('self_employed')
  const [picked, setPicked] = useState('')
  const [resolveFn, setResolveFn] = useState<((value: Date | 'immediate' | 'cancel') => void) | null>(null)

  const request = useCallback((input: { previous?: string | null; next?: string | null }) => {
    return new Promise<Date | 'immediate' | 'cancel'>((resolve) => {
      if (sameType(input.previous, input.next)) {
        resolve('immediate')
        return
      }
      setNextType(String(input.next || 'self_employed'))
      setPicked('')
      setResolveFn(() => resolve)
      setOpen(true)
    })
  }, [])

  const finish = (value: Date | 'immediate' | 'cancel') => {
    resolveFn?.(value)
    setResolveFn(null)
    setOpen(false)
  }

  const ui = (
    <Modal
      open={open}
      title="Employment type"
      onClose={() => finish('cancel')}
      footer={
        <>
          <Button variant="primary" onClick={() => finish('immediate')}>
            Today
          </Button>
          <Button variant="secondary" onClick={() => finish(addLondonDays(londonMidnight(new Date()), 1))}>
            Tomorrow
          </Button>
        </>
      }
    >
      <p className="text-sm leading-relaxed text-[var(--ink2)]">
        When should {employmentTypeLabel(nextType)} start? Timesheets and the weekly report use the type that
        applies on each working day.
      </p>
      <label className="mt-4 block text-xs font-semibold text-[var(--ink3)]">
        Or pick a working day
        <input
          type="date"
          className="pp-in mt-1"
          value={picked}
          onChange={(e) => setPicked(e.target.value)}
        />
      </label>
      {picked ? (
        <Button
          className="mt-3"
          variant="secondary"
          onClick={() => finish(new Date(`${picked}T12:00:00`))}
        >
          Use this date
        </Button>
      ) : null}
    </Modal>
  )

  return { request, ui }
}
