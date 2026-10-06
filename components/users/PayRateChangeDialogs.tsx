'use client'

import { useCallback, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/overlays'
import { addLondonDays, londonMidnight } from '@/lib/ios-parity/londonTime'
import { readStoredRates } from '@/lib/timesheets/payBasis'
import type { OperativeDayRateHistoryEntry } from '@/lib/timesheets/dayRateHistoryStorage'

type RateInput = {
  payBasis?: unknown
  dayRate?: unknown
  hourlyRate?: unknown
}

export function payRateSnapshot(input?: RateInput | null): {
  basis: 'day' | 'hourly' | null
  amount: number | null
} {
  const stored = readStoredRates(input || {})
  if (stored.payBasis == null) return { basis: null, amount: null }
  return {
    basis: stored.payBasis,
    amount: stored.payBasis === 'hourly' ? stored.hourlyRate : stored.dayRate,
  }
}

export function payRateChanged(previous?: RateInput | null, next?: RateInput | null): boolean {
  const before = payRateSnapshot(previous)
  const after = payRateSnapshot(next)
  return before.basis !== after.basis || before.amount !== after.amount
}

export function addingRateToPayePerson(
  employmentType: string | null | undefined,
  previous?: RateInput | null,
  next?: RateInput | null
): boolean {
  const raw = (employmentType || '').toLowerCase().replace(/[\s_-]/g, '')
  if (raw !== 'paye') return false
  const before = payRateSnapshot(previous)
  const after = payRateSnapshot(next)
  return before.basis == null && before.amount == null && after.basis != null && after.amount != null
}

export function payDayStart(which: 'today' | 'tomorrow', now = new Date()): Date {
  const today = londonMidnight(now)
  return which === 'tomorrow' ? addLondonDays(today, 1) : today
}

const PAYE_MESSAGE =
  'This user is currently set as PAYE. If you add a rate, it will appear on the weekly report and on their timesheet.'
const RATE_MESSAGE =
  'When the day rate is changed, the weekly report and invoicing use the new rate from the working day you choose. If you want the new rate to apply from tomorrow, choose Tomorrow.'

type Gate =
  | { kind: 'paye'; resolve: (value: Date | 'cancel') => void }
  | { kind: 'when'; resolve: (value: Date | 'cancel') => void }

export function usePaySaveGate() {
  const [gate, setGate] = useState<Gate | null>(null)

  const request = useCallback(
    (input: {
      existing: boolean
      employmentType?: string | null
      previous?: RateInput | null
      next?: RateInput | null
      createdAt?: Date
    }) =>
      new Promise<Date | 'cancel'>((resolve) => {
        if (!input.existing) {
          resolve(input.createdAt || new Date())
          return
        }
        if (!payRateChanged(input.previous, input.next)) {
          resolve(new Date())
          return
        }
        if (addingRateToPayePerson(input.employmentType, input.previous, input.next)) {
          setGate({ kind: 'paye', resolve })
          return
        }
        setGate({ kind: 'when', resolve })
      }),
    []
  )

  const finish = (value: Date | 'cancel') => {
    setGate((current) => {
      current?.resolve(value)
      return null
    })
  }

  const ui = (
    <>
      <Modal
        open={gate?.kind === 'paye'}
        title="PAYE"
        onClose={() => finish('cancel')}
        footer={
          <Button variant="primary" onClick={() => setGate((current) => (current ? { kind: 'when', resolve: current.resolve } : null))}>
            OK
          </Button>
        }
      >
        <p className="text-sm leading-relaxed text-[var(--ink2)]">{PAYE_MESSAGE}</p>
      </Modal>
      <Modal
        open={gate?.kind === 'when'}
        title="Day rate change"
        onClose={() => finish('cancel')}
        footer={
          <>
            <Button variant="primary" onClick={() => finish(payDayStart('today'))}>
              Today
            </Button>
            <Button variant="secondary" onClick={() => finish(payDayStart('tomorrow'))}>
              Tomorrow
            </Button>
            <Button variant="ghost" onClick={() => finish('cancel')}>
              Cancel
            </Button>
          </>
        }
      >
        <p className="text-sm leading-relaxed text-[var(--ink2)]">{RATE_MESSAGE}</p>
      </Modal>
    </>
  )

  return { request, ui }
}

export function PreviousRatesList({ entries }: { entries: OperativeDayRateHistoryEntry[] }) {
  if (entries.length === 0) return null
  const newestFirst = [...entries].sort((a, b) => {
    const byEffective = b.effectiveAt.getTime() - a.effectiveAt.getTime()
    if (byEffective !== 0) return byEffective
    return b.createdAt.getTime() - a.createdAt.getTime()
  })
  return (
    <div className="sm:col-span-2 space-y-1.5">
      <p className="text-[13.5px] font-semibold text-[var(--ink2)]">Previous rates</p>
      <ul className="space-y-1">
        {newestFirst.map((entry) => {
          const date = entry.effectiveAt.toLocaleDateString('en-GB', {
            timeZone: 'Europe/London',
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          })
          const suffix = entry.payBasis === 'hourly' ? '/hr' : '/day'
          return (
            <li key={entry.id} className="text-sm text-[var(--ink)]">
              {date} · £{entry.dayRate.toFixed(2)}
              {suffix}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
