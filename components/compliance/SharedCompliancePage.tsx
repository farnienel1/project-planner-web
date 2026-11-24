'use client'

/**
 * Rulebook 1.83.0 §31: the public, read-only page of a 7-day share link. It shows only what the server returns
 * (`orgCompliancePublicDocuments`: the company name and the linked documents' own fields); each file opens through the
 * server, which checks the link again and hands back a 60-second signed link.
 */

import { useEffect, useState } from 'react'
import type { OrgCompliancePublicDocument } from '@/lib/canonical/orgCompliance'
import { ORG_COMPLIANCE_SHARE_MESSAGES } from '@/lib/canonical/orgCompliance'

type Shared = { companyName: string; expiresAtMs: number | null; documents: OrgCompliancePublicDocument[] }

const TONE: Record<string, string> = { green: '#1e7b45', amber: '#8a5300', red: '#b42318', grey: '#55606e' }

export function SharedCompliancePage({ token }: { token: string }) {
  const [state, setState] = useState<{ data: Shared | null; error: string | null; loading: boolean }>({ data: null, error: null, loading: true })

  useEffect(() => {
    let live = true
    fetch(`/api/compliance/shared/${encodeURIComponent(token)}`, { cache: 'no-store' })
      .then(async (response) => {
        const body = (await response.json().catch(() => ({}))) as Shared & { error?: string }
        if (!live) return
        if (!response.ok) setState({ data: null, error: body.error || ORG_COMPLIANCE_SHARE_MESSAGES.gone, loading: false })
        else setState({ data: body, error: null, loading: false })
      })
      .catch(() => live && setState({ data: null, error: 'This page could not load. Try again.', loading: false }))
    return () => {
      live = false
    }
  }, [token])

  const fileHref = (key: string, view: boolean) =>
    `/api/compliance/shared/${encodeURIComponent(token)}/file/${encodeURIComponent(key)}${view ? '?view=1' : ''}`
  const until = state.data?.expiresAtMs
    ? new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(state.data.expiresAtMs))
    : null

  return (
    <main style={{ minHeight: '100vh', background: '#f5f7fa', color: '#14202e', padding: '32px 16px', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        {state.loading ? <p>Loading…</p> : null}
        {state.error ? (
          <div role="alert" style={{ background: '#fff', borderRadius: 14, padding: 20 }}>
            <h1 style={{ fontSize: 20, margin: 0 }}>Shared documents</h1>
            <p style={{ color: '#55606e' }}>{state.error}</p>
          </div>
        ) : null}
        {state.data ? (
          <>
            <h1 style={{ fontSize: 24, margin: '0 0 4px' }}>{state.data.companyName}</h1>
            <p style={{ color: '#55606e', margin: '0 0 20px' }}>
              Insurance and accreditation certificates{until ? ` · link works until ${until}` : ''}
            </p>
            {state.data.documents.length === 0 ? <p>These documents are no longer available.</p> : null}
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 10 }}>
              {state.data.documents.map((doc) => (
                <li key={doc.key} style={{ background: '#fff', borderRadius: 14, padding: 16 }}>
                  <div style={{ fontSize: 12, color: '#55606e' }}>{doc.sectionTitle} · {doc.typeLabel}</div>
                  <div style={{ fontWeight: 600, fontSize: 16, overflowWrap: 'anywhere' }}>{doc.title}</div>
                  <div style={{ fontSize: 13, color: '#334155' }}>
                    {[
                      doc.issuer ? `${doc.issuerLabel}: ${doc.issuer}` : '',
                      doc.reference ? `${doc.referenceLabel}: ${doc.reference}` : '',
                      doc.cover && doc.coverLabel ? `${doc.coverLabel}: ${doc.cover}` : '',
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: TONE[doc.tone] ?? TONE.grey, marginTop: 4 }}>{doc.statusLabel}</div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                    <a href={fileHref(doc.key, true)} target="_blank" rel="noopener noreferrer" style={{ fontWeight: 600 }}>View</a>
                    <a href={fileHref(doc.key, false)} rel="noopener noreferrer" style={{ fontWeight: 600 }}>Download</a>
                  </div>
                </li>
              ))}
            </ul>
            <p style={{ fontSize: 12, color: '#55606e', marginTop: 24 }}>Shared with Project Planner. Read only.</p>
          </>
        ) : null}
      </div>
    </main>
  )
}
