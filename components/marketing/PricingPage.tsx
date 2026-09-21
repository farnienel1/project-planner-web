'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import {
  MARKETING_PLANS,
  MODULES,
  PRICE_NOTE,
  RATES_FAQ,
  planHasExtra,
  planHasModule,
  setupPathForPlan,
} from '@/lib/marketing/content'
import { AdminEstimator } from '@/components/marketing/AdminEstimator'
import { CtaBand } from '@/components/marketing/MarketingShell'
import { FaqList } from '@/components/marketing/FaqList'
import { MktIcon } from '@/components/marketing/icons'
import { PlanCards } from '@/components/marketing/PlanCards'

const EXTRAS: [string, 'starter' | 'professional' | 'enterprise'][] = [
  ['Sub-contractor scheduling', 'enterprise'],
  ['Wholesalers & order history', 'professional'],
  ['Priority support', 'enterprise'],
  ['iOS, Android & web apps', 'starter'],
]

export function PricingPage({ scrollToCompare = false }: { scrollToCompare?: boolean }) {
  useEffect(() => {
    if (!scrollToCompare && typeof window !== 'undefined' && window.location.hash !== '#compare') return
    const el = document.getElementById('compare')
    if (el) {
      const t = window.setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60)
      return () => window.clearTimeout(t)
    }
  }, [scrollToCompare])

  return (
    <div className="page">
      <div className="phero">
        <div className="wrap">
          <span className="eyebrow" data-hue="blue">
            <i>
              <MktIcon name="money" size={13} />
            </i>
            Pricing
          </span>
          <h1>Flat-rate plans. No per-user surprises.</h1>
          <p>
            {PRICE_NOTE} Cancel any time.
          </p>
        </div>
      </div>
      <section className="s" style={{ paddingTop: 20 }}>
        <div className="wrap">
          <PlanCards />
          <div className="grid g3" style={{ marginTop: 34 }}>
            {(
              [
                ['rocket', 'blue', 'One-month free trial', 'Every feature on your chosen plan. No card needed to set up.'],
                ['users', 'proj', 'Change plan any time', 'Move up as your team grows. We warn you before you hit a limit.'],
                ['lock', 'daily', 'Your data, protected', 'Encrypted, backed up and GDPR-ready. Export whenever you like.'],
              ] as const
            ).map(([icon, hue, title, copy]) => (
              <div key={title} className="card pad" data-hue={hue}>
                <div className="row">
                  <div className="ico-chip">
                    <MktIcon name={icon} size={22} />
                  </div>
                  <div>
                    <b style={{ fontFamily: 'var(--head)' }}>{title}</b>
                    <div className="muted small">{copy}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="card pad" style={{ marginTop: 34, padding: 34 }}>
            <span className="kicker" data-hue="blue">
              Admin cost estimator
            </span>
            <h2 style={{ fontSize: 30, margin: '8px 0 20px' }}>What is the admin costing you now?</h2>
            <AdminEstimator />
          </div>
        </div>
      </section>
      <section className="s" id="compare" style={{ paddingTop: 20 }}>
        <div className="wrap">
          <div className="shead">
            <h2>Compare plans</h2>
          </div>
          <div className="card" style={{ overflowX: 'auto' }}>
            <table className="cmp">
              <thead>
                <tr>
                  <th>Feature</th>
                  {MARKETING_PLANS.map((plan) => (
                    <th key={plan.key}>
                      {plan.name}
                      <div className="muted xs" style={{ fontWeight: 600 }}>
                        £{plan.price}/mo
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="grp">
                  <td colSpan={5}>Team size</td>
                </tr>
                <tr>
                  <td>Users</td>
                  {MARKETING_PLANS.map((plan) => (
                    <td key={plan.key} className="small">
                      <b>{plan.users}</b>
                    </td>
                  ))}
                </tr>
                <tr className="grp">
                  <td colSpan={5}>Modules</td>
                </tr>
                {MODULES.map((mod) => (
                  <tr key={mod.id}>
                    <td>
                      <span className="row" style={{ gap: 10 }} data-hue={mod.hue}>
                        <span className="ico-chip sm" style={{ width: 30, height: 30 }}>
                          <MktIcon name={mod.icon} size={15} />
                        </span>
                        {mod.name}
                      </span>
                    </td>
                    {MARKETING_PLANS.map((plan) => (
                      <td key={plan.key}>
                        {planHasModule(plan.key, mod.id) ? (
                          <svg className="y" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                            <path d="m5 12 5 5L20 7" />
                          </svg>
                        ) : (
                          <span className="n">—</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
                <tr className="grp">
                  <td colSpan={5}>Extras</td>
                </tr>
                {EXTRAS.map(([label, from]) => (
                  <tr key={label}>
                    <td>{label}</td>
                    {MARKETING_PLANS.map((plan) => (
                      <td key={plan.key}>
                        {planHasExtra(plan.key, from) ? (
                          <svg className="y" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                            <path d="m5 12 5 5L20 7" />
                          </svg>
                        ) : (
                          <span className="n">—</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
                <tr>
                  <td />
                  {MARKETING_PLANS.map((plan) => (
                    <td key={plan.key}>
                      <Link href={setupPathForPlan(plan.key)} className={`btn sm ${plan.popular ? 'primary' : ''}`}>
                        Choose {plan.name}
                      </Link>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>
      <section className="s" style={{ paddingTop: 20 }}>
        <div className="wrap" style={{ maxWidth: 860 }}>
          <div className="shead">
            <h2>Questions about our pricing</h2>
          </div>
          <FaqList items={RATES_FAQ} />
        </div>
      </section>
      <CtaBand />
    </div>
  )
}
