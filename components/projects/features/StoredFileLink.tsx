'use client'

import { useState, type ReactNode } from 'react'
import { storedFileDirectHref, storedFileTarget } from '@/lib/healthSafety/storedFile'
import { openStoredFile } from '@/lib/healthSafety/openStoredFile'

/**
 * A link that opens a stored file (download URL, `gs://` URL or Storage path) in a new tab. A download URL is a plain
 * link; a Storage path is resolved to a fresh download URL on click (`openStoredFile`).
 */
export function StoredFileLink({
  fileRef,
  className,
  children,
  ariaLabel,
}: {
  fileRef: string | null | undefined
  className?: string
  children: ReactNode
  ariaLabel?: string
}) {
  const [error, setError] = useState<string | null>(null)
  const target = storedFileTarget(fileRef)
  if (!target) return null
  const href = storedFileDirectHref(fileRef)
  return (
    <>
      <a
        href={href ?? '#'}
        target="_blank"
        rel="noreferrer"
        aria-label={ariaLabel}
        className={className}
        onClick={(event) => {
          if (target.kind === 'url') return
          event.preventDefault()
          setError(null)
          void openStoredFile(fileRef).catch(() => setError('This file could not be opened. Try again.'))
        }}
      >
        {children}
      </a>
      {error ? <span className="block text-xs text-[var(--red)]">{error}</span> : null}
    </>
  )
}
