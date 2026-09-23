'use client'

import { type ReactNode } from 'react'
import Link from 'next/link'
import { MODULES, PRICE_NOTE } from '@/lib/marketing/content'
import { AppsInfographic } from '@/components/marketing/AppsInfographic'
import { ClashDemoProvider } from '@/components/marketing/ClashDemo'
import { CtaBand } from '@/components/marketing/MarketingShell'
import { HeroMock } from '@/components/marketing/ProductPanels'
import { HsPanel, SchedulePanel, WarnPanel } from '@/components/marketing/ProductPanels'
import { MktIcon } from '@/components/marketing/icons'
import { PlanCards } from '@/components/marketing/PlanCards'
import { Platforms } from '@/components/marketing/Platforms'
import { Reveal } from '@/components/marketing/Reveal'

export function HomePage() {
  return (
    <ClashDemoProvider>
      <div className="page">
        <section className="hero">
          <div className="wrap">
            <div>
              <span className="eyebrow" data-hue="green">
                <i>
                  <MktIcon name="hardhat" size={13} />
                </i>
                Built by an MEP contractor, for subcontractors
              </span>
              <h1>
                <span>Every job. Every operative.</span> <em>Every hour.</em>
              </h1>
              <p className="lead">
                Project Planner runs your labour, timesheets, materials and H&S in one place, so you stop chasing
                spreadsheets and WhatsApp groups and start running jobs.
              </p>
              <div className="ctas">
                <Link href="/setup" className="btn primary lg">
                  <MktIcon name="rocket" size={20} />
                  Start free trial
                </Link>
                <Link href="/features" className="btn lg">
                  See how it works
                </Link>
              </div>
              <div className="trust">
                <span>
                  <MktIcon name="check" size={18} />
                  One month free
                </span>
                <span>
                  <MktIcon name="check" size={18} />
                  iOS, Android &amp; web
                </span>
                <span>
                  <MktIcon name="check" size={18} />
                  Annual Leave, Overtime &amp; Bank Holidays Built In.
                </span>
              </div>
            </div>
            <HeroMock />
          </div>
        </section>

        <div className="wrap">
          <Reveal className="band">
            {(
              [
                ['3 apps', 'iPhone, Android and web, one account'],
                ['8 modules', 'From booking to H&S sign-off'],
                ['24h', 'Clock with your own overtime rules'],
                ['1 click', 'Weekly report, ready to print'],
              ] as const
            ).map(([stat, label]) => (
              <div key={stat}>
                <b>{stat}</b>
                <span>{label}</span>
              </div>
            ))}
          </Reveal>
        </div>

        <section className="s">
          <div className="wrap">
            <Reveal className="shead" style={{ maxWidth: 880 }}>
              <span className="kicker">The problem</span>
              <h2>Running a contracting business shouldn&apos;t require spreadsheets and a host of apps.</h2>
              <p style={{ fontSize: 21, fontWeight: 600, color: 'var(--ink)' }}>
                Run everything from one platform. <span style={{ color: 'var(--blue)' }}>Project Planner.</span>
              </p>
            </Reveal>
            <AppsInfographic />
            <div className="grid g3" style={{ marginTop: 44 }}>
              {(
                [
                  ['alert', 'red', 'Double-bookings found on site', 'Two managers book the same electrician because the calendar and the spreadsheet disagree.'],
                  ['clock', 'ts', 'Timesheets chased every payday', 'Hours pieced together from texts, WhatsApp photos and paper.'],
                  ['shield', 'hs', "H&S paperwork you can't prove", 'Toolbox talks were delivered, but the signatures are in a drawer somewhere.'],
                ] as const
              ).map(([icon, hue, title, copy]) => (
                <Reveal key={title} className="card pad" data-hue={hue}>
                  <div className="ico-chip">
                    <MktIcon name={icon} size={24} />
                  </div>
                  <h3 style={{ fontSize: 20, margin: '16px 0 8px' }}>{title}</h3>
                  <p className="ink2">{copy}</p>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <section className="s" style={{ paddingTop: 0 }}>
          <div className="wrap">
            <Reveal className="shead">
              <span className="kicker">Everything in one place</span>
              <h2>One platform for the whole job.</h2>
              <p>
                Eight modules that work together, so a booking becomes a timesheet, a warning and a line on the weekly
                report without anyone retyping it.
              </p>
            </Reveal>
            <div className="grid g4">
              {MODULES.map((mod) => (
                <Link key={mod.id} href={`/features/${mod.id}`} className="ftile lift reveal vis" data-hue={mod.hue}>
                  <div className="ico-chip lg">
                    <MktIcon name={mod.icon} size={26} />
                  </div>
                  <h3>{mod.name}</h3>
                  <p>{mod.short}</p>
                  <span className="more">
                    Learn more <MktIcon name="chevR" size={16} />
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <HomeSplit moduleId="scheduling" panel={<SchedulePanel />} reverse={false} />
        <HomeSplit moduleId="warnings" panel={<WarnPanel />} reverse />
        <HomeSplit moduleId="hs" panel={<HsPanel />} reverse={false} />

        <section className="s">
          <div className="wrap">
            <Reveal className="shead">
              <span className="kicker">Get started</span>
              <h2>Up and running this afternoon.</h2>
              <p>Our guided setup walks you through everything, and you can skip the extras and add them later.</p>
            </Reveal>
            <div className="steps">
              {(
                [
                  ['building', 'blue', 'Create your organisation', 'Your account, company name, office, logo and currency.'],
                  ['settings', 'daily', 'Set how you work', 'Working hours and overtime, leave, pay runs, warnings and material cut-off.'],
                  ['users', 'proj', 'Add your team and first job', 'Managers, operatives, a project and client. Invite the rest any time.'],
                ] as const
              ).map(([icon, hue, title, copy]) => (
                <Reveal key={title} className="card stepc" data-hue={hue}>
                  <div className="ico-chip">
                    <MktIcon name={icon} size={24} />
                  </div>
                  <h3>{title}</h3>
                  <p className="ink2">{copy}</p>
                </Reveal>
              ))}
            </div>
            <div style={{ textAlign: 'center', marginTop: 30 }}>
              <Link href="/setup" className="btn primary lg">
                Set up your organisation <MktIcon name="chevR" size={18} />
              </Link>
            </div>
          </div>
        </section>

        <section className="s" style={{ paddingTop: 0 }}>
          <div className="wrap">
            <Reveal className="card pad contractor-quote" style={{ padding: 48, display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 36, alignItems: 'center' }} data-hue="blue">
              <div className="ico-chip lg" style={{ width: 84, height: 84, borderRadius: 24 }}>
                <MktIcon name="hardhat" size={38} />
              </div>
              <div>
                <span className="kicker">Built by contractors, for contractors</span>
                <p
                  style={{
                    fontFamily: 'var(--head)',
                    fontSize: 26,
                    fontWeight: 700,
                    lineHeight: 1.35,
                    letterSpacing: '-.01em',
                    marginTop: 10,
                  }}
                >
                  Project Planner was built inside a working MEP contracting business to replace the spreadsheets,
                  group chats and paper we were drowning in. Every feature is used on real jobs, every day.
                </p>
                <div className="muted" style={{ marginTop: 14, fontWeight: 600 }}>
                  The Project Planner team
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        <Platforms />

        <section className="s" style={{ paddingTop: 0 }}>
          <div className="wrap">
            <Reveal className="shead">
              <span className="kicker">Pricing</span>
              <h2>One plan. Unlimited users.</h2>
              <p>{PRICE_NOTE}</p>
            </Reveal>
            <PlanCards />
            <div style={{ textAlign: 'center', marginTop: 28 }}>
              <Link href="/pricing#compare" className="btn">
                Compare every feature <MktIcon name="chevR" size={16} />
              </Link>
            </div>
          </div>
        </section>

        <CtaBand />
      </div>
    </ClashDemoProvider>
  )
}

function HomeSplit({
  moduleId,
  panel,
  reverse,
}: {
  moduleId: 'scheduling' | 'warnings' | 'hs'
  panel: ReactNode
  reverse: boolean
}) {
  const mod = MODULES.find((row) => row.id === moduleId)!
  return (
    <section className="s" style={{ paddingTop: 40 }}>
      <div className="wrap">
        <div className={`split ${reverse ? 'rev' : ''}`} data-hue={mod.hue}>
          <Reveal>
            <span className="kicker">{mod.name}</span>
            <h2>{mod.splitTitle}</h2>
            <p className="lead">{mod.short}</p>
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
            <Link href={`/features/${mod.id}`} className="btn tint" style={{ marginTop: 26 }}>
              Explore {mod.name.toLowerCase()} <MktIcon name="chevR" size={16} />
            </Link>
          </Reveal>
          <Reveal>{panel}</Reveal>
        </div>
      </div>
    </section>
  )
}

