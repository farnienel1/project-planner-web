'use client'

import { useEffect } from 'react'
import Link from 'next/link'

/** Error boundary for every dashboard screen: shows Retry and a way home instead of a blank page. */
export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('[dashboard]', error)
  }, [error])
  return (
    <div className="empty card pad" role="alert" style={{ maxWidth: 520, margin: '40px auto', textAlign: 'center' }}>
      <h3>Something went wrong on this screen</h3>
      <p className="muted">Nothing you saved has been lost. Try again, or go back to the dashboard.</p>
      {error?.digest ? <p className="muted small">Reference: {error.digest}</p> : null}
      <div className="row" style={{ gap: 10, justifyContent: 'center', marginTop: 16 }}>
        <button type="button" className="btn primary" onClick={() => reset()}>
          Retry
        </button>
        <Link href="/dashboard" className="btn">
          Go to dashboard
        </Link>
      </div>
    </div>
  )
}
