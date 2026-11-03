'use client'

/**
 * Last-resort error screen: an exception in the root layout itself. It replaces the whole document, so it carries
 * its own <html>/<body> and inline styles (globals.css may not have loaded).
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en-GB">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'system-ui, -apple-system, Segoe UI, sans-serif',
          background: '#F7F8FC',
          color: '#111827',
          padding: 16,
        }}
      >
        <main style={{ maxWidth: 420, textAlign: 'center' }}>
          <h1 style={{ fontSize: 22, margin: '0 0 8px' }}>Something went wrong</h1>
          <p style={{ fontSize: 15, color: '#4B5563', margin: '0 0 20px' }}>
            Project Planner hit an unexpected error. Nothing you saved has been lost.
          </p>
          {error?.digest ? (
            <p style={{ fontSize: 12, color: '#6B7280', margin: '0 0 20px' }}>Reference: {error.digest}</p>
          ) : null}
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <button
              type="button"
              onClick={() => reset()}
              style={{
                border: 0,
                borderRadius: 12,
                padding: '10px 18px',
                background: '#007AFF',
                color: '#fff',
                fontSize: 15,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Retry
            </button>
            <a
              href="/"
              style={{
                borderRadius: 12,
                padding: '10px 18px',
                background: '#fff',
                color: '#007AFF',
                fontSize: 15,
                fontWeight: 600,
                textDecoration: 'none',
                boxShadow: '0 1px 2px rgba(0,0,0,0.10)',
              }}
            >
              Go to home
            </a>
          </div>
        </main>
      </body>
    </html>
  )
}
