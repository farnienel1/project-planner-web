'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { MODULES, PRICE_NOTE, RATES_FAQ } from '@/lib/marketing/content'
import { CtaBand } from '@/components/marketing/MarketingShell'
import { FaqList } from '@/components/marketing/FaqList'
import { MktIcon } from '@/components/marketing/icons'
import { PlanCards } from '@/components/marketing/PlanCards'

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
          <h1>Construction management software without the pricing headache.</h1>
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
                ['rocket', 'blue', '30-day free trial', 'Use every feature. You will not be charged until day 31.'],
                ['users', 'proj', 'Unlimited users', 'No seat bands, no per-user charges, no paid add-ons.'],
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
        </div>
      </section>
      <section className="s" id="compare" style={{ paddingTop: 20 }}>
        <div className="wrap">
          <div className="shead">
            <h2>Everything included</h2>
            <p className="muted">One plan. No feature tiers.</p>
          </div>
          <div className="card pad">
            <ul className="ticks">
              {MODULES.map((mod) => (
                <li key={mod.id}>
                  <span className="row" style={{ gap: 10 }} data-hue={mod.hue}>
                    <span className="ico-chip sm" style={{ width: 30, height: 30 }}>
                      <MktIcon name={mod.icon} size={15} />
                    </span>
                    {mod.name}
                  </span>
                </li>
              ))}
            </ul>
            <div style={{ marginTop: 22 }}>
              <Link href="/setup" className="btn primary">
                Start your 30-day free trial
              </Link>
            </div>
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
