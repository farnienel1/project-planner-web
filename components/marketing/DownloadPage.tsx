import Link from 'next/link'
import { MktIcon } from '@/components/marketing/icons'
import { Platforms } from '@/components/marketing/Platforms'
import { StoreBadge } from '@/components/marketing/StoreBadge'

export function DownloadPage() {
  return (
    <div className="page">
      <div className="phero">
        <div className="wrap">
          <span className="eyebrow" data-hue="green">
            <i>
              <MktIcon name="download" size={13} />
            </i>
            Download
          </span>
          <h1>Get Project Planner on every device.</h1>
          <p>One account across iPhone, Android and the web. Your team&apos;s schedule, timesheets and H&S follow them to site.</p>
        </div>
      </div>
      <Platforms />
      <section className="s" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="grid g2">
            <div className="card pad" data-hue="blue">
              <div className="ico-chip lg" style={{ marginBottom: 14 }}>
                <MktIcon name="building" size={26} />
              </div>
              <h3 style={{ fontSize: 22, marginBottom: 8 }}>Setting up a new company?</h3>
              <p className="ink2" style={{ marginBottom: 18 }}>
                We recommend creating your organisation on a computer first. Your team can then sign in on their phones.
              </p>
              <Link href="/setup" className="btn primary">
                Set up organisation
              </Link>
            </div>
            <div className="card pad" data-hue="ops">
              <div className="ico-chip lg" style={{ marginBottom: 14 }}>
                <MktIcon name="hardhat" size={26} />
              </div>
              <h3 style={{ fontSize: 22, marginBottom: 8 }}>Been invited by your employer?</h3>
              <p className="ink2" style={{ marginBottom: 18 }}>
                Download the app and sign in with the email your admin invited. You&apos;ll set your password on first sign-in.
              </p>
              <div className="row wr">
                <StoreBadge store="ios" />
                <StoreBadge store="android" />
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
