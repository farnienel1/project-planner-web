import Link from 'next/link'
import { MarketingShell } from '@/components/marketing/MarketingShell'
import { MktIcon } from '@/components/marketing/icons'

export const metadata = {
  title: 'Checkout cancelled | Project Planner',
}

export default function SetupCancelPage() {
  return (
    <MarketingShell>
      <section className="s">
        <div className="wrap" style={{ maxWidth: 640 }}>
          <div className="card wz-card">
            <div className="banner" data-hue="warn" style={{ marginBottom: 18 }}>
              <span className="ico-chip">
                <MktIcon name="alert" size={18} />
              </span>
              <div>
                <b>Payment cancelled.</b>
                <div className="small ink2">Nothing was charged and your details are still here.</div>
              </div>
            </div>
            <h1 style={{ fontSize: 28 }}>Return to setup</h1>
            <p className="muted" style={{ marginTop: 10 }}>
              No charge was made. Continue to Review &amp; Pay to choose a plan again, or sign in if you already
              completed payment elsewhere.
            </p>
            <div className="row wr" style={{ marginTop: 22 }}>
              <Link href="/setup?cancelled=1" className="btn primary">
                Back to setup
              </Link>
              <Link href="/login" className="btn">
                Sign in
              </Link>
            </div>
          </div>
        </div>
      </section>
    </MarketingShell>
  )
}
