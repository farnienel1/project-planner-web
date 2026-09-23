'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { MARKETING_PLANS, setupPathForPlan, type MarketingPlan } from '@/lib/marketing/content'
import { MktIcon } from '@/components/marketing/icons'
import { formatTrialChargeCopy } from '@/lib/stripe/billing'
import type { SubscriptionPlanKey } from '@/lib/stripe/plans'

export function PlanCards({
  plans = MARKETING_PLANS,
  selectedKey,
  onSelect,
  ctaMode = 'trial',
}: {
  plans?: MarketingPlan[]
  selectedKey?: string
  onSelect?: (key: MarketingPlan['key']) => void
  ctaMode?: 'trial' | 'choose'
}) {
  const monthly = plans.find((plan) => plan.key === 'month') || plans[0]
  const annual = plans.find((plan) => plan.key === 'year') || plans[1] || monthly
  const [interval, setInterval] = useState<SubscriptionPlanKey>(selectedKey === 'year' ? 'year' : 'month')

  useEffect(() => {
    if (selectedKey === 'year' || selectedKey === 'month') setInterval(selectedKey)
  }, [selectedKey])

  const plan = interval === 'year' ? annual : monthly
  const selected = selectedKey ? selectedKey === plan.key : true

  const inner = (
    <>
      <span className="badge">30-day free trial</span>
      <div>
        <h3>ProjectPlanner</h3>
        <p className="muted small" style={{ marginTop: 4 }}>
          {plan.desc}
        </p>
      </div>
      <div className="row" style={{ gap: 8, marginTop: 4 }}>
        <button
          type="button"
          className={`chip ${interval === 'month' ? 'on' : ''}`}
          onClick={(event) => {
            event.preventDefault()
            event.stopPropagation()
            setInterval('month')
            onSelect?.('month')
          }}
        >
          Monthly
        </button>
        <button
          type="button"
          className={`chip ${interval === 'year' ? 'on' : ''}`}
          onClick={(event) => {
            event.preventDefault()
            event.stopPropagation()
            setInterval('year')
            onSelect?.('year')
          }}
        >
          Annual · save £298
        </button>
      </div>
      <div>
        <div className="price">
          £{plan.price}
          <small>{interval === 'year' ? ' /year' : ' /month'} + VAT</small>
        </div>
        <div className="muted xs" style={{ marginTop: 6 }}>
          {plan.users} · no feature tiers
        </div>
      </div>
      {onSelect ? (
        <span className={`btn ${selected ? 'primary' : ''} block`}>
          {selected ? 'Selected' : ctaMode === 'choose' ? 'Choose this plan' : 'Start your 30-day free trial'}
        </span>
      ) : (
        <span className="btn primary block">
          {ctaMode === 'choose' ? 'Choose this plan' : 'Start your 30-day free trial'}
        </span>
      )}
      <p className="muted xs">{formatTrialChargeCopy()}</p>
      <ul>
        {plan.features.map((feature) => (
          <li key={feature}>
            <MktIcon name="check" size={17} />
            {feature}
          </li>
        ))}
      </ul>
    </>
  )

  if (onSelect) {
    return (
      <div className="plans" style={{ gridTemplateColumns: 'minmax(0, 420px)', justifyContent: 'center' }}>
        <div className={`card plan pop ${selected ? 'pop' : ''}`}>
          {inner}
        </div>
      </div>
    )
  }

  return (
    <div className="plans" style={{ gridTemplateColumns: 'minmax(0, 420px)', justifyContent: 'center' }}>
      <Link href={setupPathForPlan(plan.key)} className="card plan pop">
        {inner}
      </Link>
    </div>
  )
}
