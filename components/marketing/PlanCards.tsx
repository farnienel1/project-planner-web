import Link from 'next/link'
import { MARKETING_PLANS, setupPathForPlan, type MarketingPlan } from '@/lib/marketing/content'
import { MktIcon } from '@/components/marketing/icons'

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
  return (
    <div className="plans">
      {plans.map((plan) => {
        const selected = selectedKey === plan.key
        const inner = (
          <>
            {plan.popular ? <span className="badge">Most popular</span> : null}
            <div>
              <h3>{plan.name}</h3>
              <p className="muted small" style={{ marginTop: 4 }}>
                {plan.desc}
              </p>
            </div>
            <div>
              <div className="price">
                £{plan.price}
                <small> /month</small>
              </div>
              <div className="muted xs" style={{ marginTop: 6 }}>
                {plan.users} · excl. VAT
              </div>
            </div>
            {onSelect ? (
              <span className={`btn ${plan.popular || selected ? 'primary' : ''} block`}>
                {selected ? 'Selected' : ctaMode === 'choose' ? `Choose ${plan.name}` : 'Start free trial'}
              </span>
            ) : (
              <span className={`btn ${plan.popular ? 'primary' : ''} block`}>
                {ctaMode === 'choose' ? `Choose ${plan.name}` : 'Start free trial'}
              </span>
            )}
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
            <button
              key={plan.key}
              type="button"
              className={`card plan ${plan.popular ? 'pop' : ''} ${selected ? 'pop' : ''}`}
              onClick={() => onSelect(plan.key)}
            >
              {inner}
            </button>
          )
        }

        return (
          <Link key={plan.key} href={setupPathForPlan(plan.key)} className={`card plan ${plan.popular ? 'pop' : ''}`}>
            {inner}
          </Link>
        )
      })}
    </div>
  )
}
