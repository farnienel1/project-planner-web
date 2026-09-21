import Link from 'next/link'
import { MktIcon } from '@/components/marketing/icons'

export function NotFoundPage() {
  return (
    <div className="page">
      <div className="phero" style={{ padding: '120px 0' }}>
        <div className="wrap">
          <div className="ico-chip lg" data-hue="blue" style={{ margin: '0 auto 18px' }}>
            <MktIcon name="map" size={28} />
          </div>
          <h1>This page went off-site.</h1>
          <p>The link you followed doesn&apos;t match a page on Project Planner.</p>
          <div className="row" style={{ justifyContent: 'center', marginTop: 26 }}>
            <Link href="/" className="btn primary lg">
              Back to home
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
