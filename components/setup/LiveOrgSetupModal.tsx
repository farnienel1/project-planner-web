'use client'

import Link from 'next/link'
import { liveOrgSetupModalCopy } from '@/lib/orgSetup/liveOrgLookup'

export function LiveOrgSetupModal({ email, onClose }: { email: string; onClose: () => void }) {
  const copy = liveOrgSetupModalCopy(email)

  return (
    <>
      <button type="button" className="scrim show" aria-label="Close" onClick={onClose} />
      <div className="modal show" role="dialog" aria-modal="true" aria-labelledby="live-org-setup-title">
        <h2 id="live-org-setup-title" style={{ fontSize: 22, fontWeight: 800, marginBottom: 12 }}>
          {copy.title}
        </h2>
        {copy.paragraphs.map((paragraph) => (
          <p key={paragraph} className="muted" style={{ marginTop: 10, lineHeight: 1.5 }}>
            {paragraph}
          </p>
        ))}
        <div className="row wr" style={{ marginTop: 22, justifyContent: 'flex-end', gap: 10 }}>
          <button type="button" className="btn ghost" onClick={onClose}>
            Close
          </button>
          <Link href={copy.primaryHref} className="btn primary">
            {copy.primaryLabel}
          </Link>
        </div>
      </div>
    </>
  )
}
