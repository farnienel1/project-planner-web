import Link from 'next/link'
import { MktIcon } from '@/components/marketing/icons'
import { StoreBadge } from '@/components/marketing/StoreBadge'
import { Reveal } from '@/components/marketing/Reveal'

export function Platforms() {
  return (
    <section className="s" id="download-band">
      <div className="wrap">
        <Reveal className="shead">
          <span className="kicker">Works everywhere</span>
          <h2>Office on the web. Site on the phone.</h2>
          <p>
            Managers plan on a big screen. Operatives check their week, sign timesheets and toolbox talks from their
            pocket. Everything syncs instantly.
          </p>
        </Reveal>
        <div className="grid g3">
          <Reveal className="card plat lift" data-hue="blue">
            <div className="ico-chip lg">
              <MktIcon name="apple" size={28} />
            </div>
            <h3>iPhone &amp; iPad</h3>
            <p className="ink2">The full app for managers and operatives, from the App Store.</p>
            <div style={{ marginTop: 'auto' }}>
              <StoreBadge store="ios" />
            </div>
          </Reveal>
          <Reveal className="card plat lift" data-hue="proj">
            <div className="ico-chip lg">
              <MktIcon name="android" size={28} />
            </div>
            <h3>Android</h3>
            <p className="ink2">Everything on iOS, on any Android phone, from Google Play.</p>
            <div style={{ marginTop: 'auto' }}>
              <StoreBadge store="android" />
            </div>
          </Reveal>
          <Reveal className="card plat lift" data-hue="daily">
            <div className="ico-chip lg">
              <MktIcon name="globe" size={28} />
            </div>
            <h3>Web app</h3>
            <p className="ink2">Built for big screens. Plan the week, run reports and manage settings.</p>
            <div style={{ marginTop: 'auto' }}>
              <Link href="/login" className="btn primary">
                Open web app <MktIcon name="chevR" size={16} />
              </Link>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  )
}
