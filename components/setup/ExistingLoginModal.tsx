'use client'

import Link from 'next/link'
import { existingLoginModalCopy } from '@/lib/orgSetup/existingLogin'

export function ExistingLoginModal({
  email,
  signedIn,
  isAdmin,
  onClose,
}: {
  email: string
  signedIn: boolean
  isAdmin: boolean
  onClose: () => void
}) {
  const copy = existingLoginModalCopy({ email, signedIn, isAdmin })

  return (
    <>
      <button type="button" className="scrim show" aria-label="Close" onClick={onClose} />
      <div className="modal show" role="dialog" aria-modal="true" aria-labelledby="existing-login-title">
        <h2 id="existing-login-title" style={{ fontSize: 22, fontWeight: 800, marginBottom: 12 }}>
          {copy.title}
        </h2>
        {copy.paragraphs.map((paragraph) => (
          <p key={paragraph} className="muted" style={{ marginTop: 10, lineHeight: 1.5 }}>
            {paragraph}
          </p>
        ))}
        <div className="row wr" style={{ marginTop: 22, justifyContent: 'flex-end', gap: 10 }}>
          {copy.secondaryHref && copy.secondaryLabel ? (
            <Link href={copy.secondaryHref} className="btn ghost">
              {copy.secondaryLabel}
            </Link>
          ) : (
            <button type="button" className="btn ghost" onClick={onClose}>
              Close
            </button>
          )}
          <Link href={copy.primaryHref} className="btn primary">
            {copy.primaryLabel}
          </Link>
        </div>
      </div>
    </>
  )
}
