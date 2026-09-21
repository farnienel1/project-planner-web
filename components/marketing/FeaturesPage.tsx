'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { MARKETING_PLANS, MODULES, planHasModule, type MarketingModuleId } from '@/lib/marketing/content'
import { ClashDemoProvider } from '@/components/marketing/ClashDemo'
import { CtaBand } from '@/components/marketing/MarketingShell'
import { FeaturePanel } from '@/components/marketing/ProductPanels'
import { MktIcon } from '@/components/marketing/icons'

export function FeaturesPage({ moduleId }: { moduleId?: MarketingModuleId }) {
  useEffect(() => {
    const hash = moduleId || (typeof window !== 'undefined' ? window.location.hash.replace('#', '').replace('f-', '') : '')
    if (!hash) return
    const el = document.getElementById(`f-${hash}`)
    if (el) {
      const t = window.setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60)
      return () => window.clearTimeout(t)
    }
  }, [moduleId])

  return (
    <ClashDemoProvider>
      <div className="page">
        <div className="phero">
          <div className="wrap">
            <span className="eyebrow" data-hue="blue">
              <i>
                <MktIcon name="sparkle" size={13} />
              </i>
              Features
            </span>
            <h1>Built around how MEP jobs actually run.</h1>
            <p>Eight modules, one login. Every one designed with the people who book labour, sign timesheets and stand on site.</p>
            <div className="row" style={{ justifyContent: 'center', marginTop: 28, flexWrap: 'wrap' }}>
              <Link href="/setup" className="btn primary lg">
                Start free trial
              </Link>
              <Link href="/pricing" className="btn lg">
                See our pricing
              </Link>
            </div>
          </div>
        </div>
        <nav className="fnav" aria-label="Feature sections">
          <div className="wrap">
            {MODULES.map((mod) => (
              <a key={mod.id} href={`#f-${mod.id}`} data-hue={mod.hue}>
                <span className="ico-chip">
                  <MktIcon name={mod.icon} size={15} />
                </span>
                {mod.name}
              </a>
            ))}
          </div>
        </nav>
        {MODULES.map((mod, index) => {
          const fromPlans = MARKETING_PLANS.filter((plan) => planHasModule(plan.key, mod.id))
          const badge =
            fromPlans.length === MARKETING_PLANS.length ? (
              <span className="pill" data-hue="green">
                On every plan
              </span>
            ) : (
              <span className="pill" data-hue="blue">
                From {fromPlans[0]?.name}
              </span>
            )
          return (
            <section key={mod.id} className="s" id={`f-${mod.id}`} style={{ padding: '64px 0' }}>
              <div className="wrap">
                <div className={`split ${index % 2 ? 'rev' : ''}`} data-hue={mod.hue}>
                  <div>
                    <div className="ico-chip lg" style={{ marginBottom: 16 }}>
                      <MktIcon name={mod.icon} size={28} />
                    </div>
                    <span className="kicker">{mod.name}</span>
                    <h2>{mod.short.split('.')[0]}.</h2>
                    <ul className="ticks">
                      {mod.ticks.map((tick) => (
                        <li key={tick}>
                          <i>
                            <MktIcon name="check" size={15} />
                          </i>
                          {tick}
                        </li>
                      ))}
                    </ul>
                    <div className="row wr" style={{ marginTop: 24 }}>
                      {badge}
                    </div>
                  </div>
                  <div>
                    <FeaturePanel id={mod.id} />
                  </div>
                </div>
              </div>
            </section>
          )
        })}
        <CtaBand />
      </div>
    </ClashDemoProvider>
  )
}
