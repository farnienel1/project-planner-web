import { COMPANY } from '@/lib/marketing/content'
import { CtaBand } from '@/components/marketing/MarketingShell'
import { MktIcon } from '@/components/marketing/icons'

export function AboutPage() {
  return (
    <div className="page">
      <div className="phero">
        <div className="wrap">
          <span className="eyebrow" data-hue="proj">
            <i>
              <MktIcon name="hardhat" size={13} />
            </i>
            About
          </span>
          <h1>Built on site, not in a boardroom.</h1>
          <p>
            Project Planner started inside a working London MEP contractor, delivering mechanical, electrical and
            public health packages across fit-outs, residential and hotels.
          </p>
        </div>
      </div>
      <section className="s" style={{ paddingTop: 30 }}>
        <div className="wrap">
          <div className="split">
            <div>
              <span className="kicker" data-hue="blue">
                Our story
              </span>
              <h2 style={{ fontSize: 36, margin: '12px 0 16px' }}>We were drowning in spreadsheets, so we built our way out.</h2>
              <p className="ink2" style={{ fontSize: 17.5, marginBottom: 14 }}>
                Booking labour, chasing timesheets, ordering materials before cut-off, proving toolbox talks were
                signed: none of the software we tried understood how an MEP subcontractor actually works.
              </p>
              <p className="ink2" style={{ fontSize: 17.5 }}>
                So we built Project Planner around our own jobs, operatives and paperwork. Today it runs that business
                day to day, and we&apos;re opening it up to every subcontractor with the same headaches.
              </p>
            </div>
            <div className="grid g2">
              {(
                [
                  ['hardhat', 'proj', 'Made for trades', 'Designed with managers and operatives who use it daily.'],
                  ['globe', 'daily', 'Three platforms', 'iPhone, Android and web, on one account.'],
                  ['lock', 'blue', 'UK company', 'Projectplanner Systems Ltd, registered in England and Wales.'],
                  ['sparkle', 'warn', 'Always improving', 'New features shipped from real site feedback.'],
                ] as const
              ).map(([icon, hue, title, copy]) => (
                <div key={title} className="card pad" data-hue={hue}>
                  <div className="ico-chip">
                    <MktIcon name={icon} size={22} />
                  </div>
                  <b style={{ fontFamily: 'var(--head)', display: 'block', margin: '12px 0 4px' }}>{title}</b>
                  <span className="muted small">{copy}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
      <section className="s" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="card pad" style={{ padding: 36 }}>
            <h3 style={{ fontSize: 22, marginBottom: 16 }}>Company details</h3>
            <div className="grid g3">
              {(
                [
                  ['Company', COMPANY.legalName],
                  ['Company number', `${COMPANY.number} · ${COMPANY.jurisdiction}`],
                  ['Registered office', COMPANY.address],
                ] as const
              ).map(([label, value]) => (
                <div key={label}>
                  <div className="muted small" style={{ fontWeight: 700 }}>
                    {label}
                  </div>
                  <b>{value}</b>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
      <CtaBand />
    </div>
  )
}
