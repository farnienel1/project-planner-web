'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { gbp, setupPathForPlan, suggestPlanForUsers } from '@/lib/marketing/content'

export function AdminEstimator() {
  const opsRef = useRef(12)
  const hrsRef = useRef(6)
  const rateRef = useRef(28)
  const opsLabel = useRef<HTMLElement>(null)
  const hrsLabel = useRef<HTMLElement>(null)
  const [result, setResult] = useState(() => compute(12, 6, 28))

  function refresh() {
    setResult(compute(opsRef.current, hrsRef.current, rateRef.current))
  }

  return (
    <div className="grid g2" style={{ alignItems: 'center' }}>
      <div className="form" style={{ gridTemplateColumns: '1fr' }}>
        <div className="f">
          <label htmlFor="eO">People in your team (operatives and managers)</label>
          <input
            id="eO"
            type="range"
            min={1}
            max={80}
            defaultValue={12}
            onInput={(event) => {
              const value = Number((event.target as HTMLInputElement).value)
              opsRef.current = value
              if (opsLabel.current) opsLabel.current.textContent = String(value)
              refresh()
            }}
          />
          <b ref={opsLabel}>12</b>
        </div>
        <div className="f">
          <label htmlFor="eH">Hours a week spent on bookings, timesheets and chasing paperwork</label>
          <input
            id="eH"
            type="range"
            min={1}
            max={40}
            defaultValue={6}
            onInput={(event) => {
              const value = Number((event.target as HTMLInputElement).value)
              hrsRef.current = value
              if (hrsLabel.current) hrsLabel.current.textContent = `${value}h`
              refresh()
            }}
          />
          <b ref={hrsLabel}>6h</b>
        </div>
        <div className="f">
          <label htmlFor="eR">Cost of that person&apos;s time (£ per hour)</label>
          <input
            id="eR"
            className="in"
            type="number"
            min={10}
            max={200}
            defaultValue={28}
            onInput={(event) => {
              rateRef.current = Math.max(1, Number((event.target as HTMLInputElement).value) || 0)
              refresh()
            }}
          />
        </div>
      </div>
      <EstimatorResult monthly={result.monthly} users={result.users} planName={result.plan.name} planPrice={result.plan.price} planKey={result.plan.key} />
    </div>
  )
}

function compute(ops: number, hrs: number, rate: number) {
  const monthly = Math.round((hrs * rate * 52) / 12)
  const users = ops + 2
  const plan = suggestPlanForUsers(users)
  return { monthly, users, plan }
}

function EstimatorResult({
  monthly,
  users,
  planName,
  planPrice,
  planKey,
}: {
  monthly: number
  users: number
  planName: string
  planPrice: number
  planKey: ReturnType<typeof suggestPlanForUsers>['key']
}) {
  return (
    <div className="card pad" style={{ boxShadow: 'none', background: 'var(--soft)', textAlign: 'center' }}>
      <div className="muted small" style={{ fontWeight: 700 }}>
        Your admin time costs about
      </div>
      <div className="price" style={{ margin: '6px 0' }}>
        £{gbp(monthly)}
        <small> /month</small>
      </div>
      <div className="muted small">Suggested plan for {users} users</div>
      <div style={{ fontFamily: 'var(--head)', fontSize: 24, fontWeight: 800, margin: '4px 0 14px' }}>
        {planName} · £{planPrice}/month
      </div>
      <Link href={setupPathForPlan(planKey)} className="btn primary block">
        Start free trial on {planName}
      </Link>
      <p className="muted xs" style={{ marginTop: 10 }}>
        An estimate from your own figures, not a guarantee of savings.
      </p>
    </div>
  )
}
