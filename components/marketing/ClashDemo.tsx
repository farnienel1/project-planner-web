'use client'

import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import { MktIcon } from '@/components/marketing/icons'

const CLASH = [
  { job: 'C1042 · 12 High Street', time: '07:30–16:00', h: 8 },
  { job: 'C1057 · Riverside Court', time: '13:00–17:00', h: 4 },
]

type ClashContextValue = {
  approved: boolean
  deleted: number[]
  approve: () => void
  remove: (index: number) => void
  reset: () => void
}

import { mktToast } from '@/components/marketing/toast'

const ClashContext = createContext<ClashContextValue | null>(null)

export function ClashDemoProvider({ children }: { children: ReactNode }) {
  const [approved, setApproved] = useState(false)
  const [deleted, setDeleted] = useState<number[]>([])
  const value = useMemo<ClashContextValue>(
    () => ({
      approved,
      deleted,
      approve: () => {
        setApproved(true)
        mktToast('Clash approved for the weekly report')
      },
      remove: (index) => {
        setDeleted((prev) => (prev.includes(index) ? prev : [...prev, index]))
        mktToast('Booking deleted. Clash resolved')
      },
      reset: () => {
        setApproved(false)
        setDeleted([])
      },
    }),
    [approved, deleted]
  )
  return <ClashContext.Provider value={value}>{children}</ClashContext.Provider>
}

function useClash() {
  const ctx = useContext(ClashContext)
  if (!ctx) throw new Error('ClashDemo must be used inside ClashDemoProvider')
  return ctx
}

export function ClashDemo({ compact = false }: { compact?: boolean }) {
  const { approved, deleted, approve, remove, reset } = useClash()
  const live = CLASH.map((booking, index) => ({ ...booking, i: index })).filter((booking) => !deleted.includes(booking.i))
  const total = live.reduce((sum, booking) => sum + booking.h, 0)
  const resolved = live.length < 2
  const hue = resolved || approved ? 'green' : 'red'

  let head
  if (resolved) {
    head = (
      <>
        <span className="ico-chip sm" data-hue="green">
          <MktIcon name="check" size={16} />
        </span>
        <div className="grow">
          <b>Clash resolved · Joe Bloggs</b>
          <span className="muted xs">Now {total}h on {live[0] ? live[0].job : 'no job'}</span>
        </div>
      </>
    )
  } else if (approved) {
    head = (
      <>
        <span className="ico-chip sm" data-hue="green">
          <MktIcon name="check" size={16} />
        </span>
        <div className="grow">
          <b>Clash approved · Joe Bloggs</b>
          <span className="muted xs">{total}h on Tue 22 Sep · noted on the weekly report</span>
        </div>
      </>
    )
  } else {
    head = (
      <>
        <span className="ico-chip sm" data-hue="red">
          <MktIcon name="alert" size={16} />
        </span>
        <div className="grow">
          <b>Booking clash · Joe Bloggs</b>
          <span className="muted xs">
            Tue 22 Sep · 2 jobs · <b style={{ color: 'var(--red)', display: 'inline' }}>{total}h in one day</b>
          </span>
        </div>
      </>
    )
  }

  return (
    <div className="mrow acc" data-hue={hue} style={{ flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
      <div className="row" style={{ gap: 10 }}>
        {head}
      </div>
      {live.map((booking) => (
        <div
          key={booking.i}
          className="row"
          style={{
            gap: 8,
            background: 'var(--soft)',
            borderRadius: 10,
            padding: compact ? '6px 8px' : '8px 10px',
          }}
        >
          <span className="grow" style={{ fontSize: compact ? 12 : 13 }}>
            <b style={{ display: 'inline' }}>{booking.job}</b> · {booking.time} · {booking.h}h
          </span>
          <button
            type="button"
            className={`btn xs ${compact ? 'round' : ''} danger`}
            style={compact ? { width: 26, height: 26 } : undefined}
            onClick={() => remove(booking.i)}
            aria-label={`Delete ${booking.job} booking`}
          >
            <MktIcon name="trash" size={14} />
            {compact ? null : 'Delete'}
          </button>
        </div>
      ))}
      {resolved || approved ? (
        <button type="button" className="btn xs ghost" style={{ alignSelf: 'flex-start' }} onClick={reset}>
          Reset demo
        </button>
      ) : (
        <div className="row" style={{ gap: 8 }}>
          <button type="button" className="btn xs tint" data-hue="green" onClick={approve}>
            <MktIcon name="check" size={14} />
            Approve
          </button>
          <span className="muted xs">or delete a booking</span>
        </div>
      )}
    </div>
  )
}
