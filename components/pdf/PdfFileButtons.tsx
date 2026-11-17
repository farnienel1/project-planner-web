'use client'

import { useEffect, useState } from 'react'
import { PuButton } from '@/components/ui/page'
import { canSharePdf, downloadPdf, sharePdf } from '@/lib/pdf/downloadPdf'

/**
 * Download + Share buttons for a PDF that is already built (display only, guardrail 7).
 * Download saves the same bytes under the same file name straight to the computer; Share opens the system share
 * sheet and is hidden where this browser cannot share a file, so no button does nothing.
 */
export function PdfFileButtons({
  bytes,
  fileName,
  downloadLabel = 'Download PDF',
  shareLabel = 'Share PDF',
  busyLabel,
  disabled = false,
}: {
  bytes: Uint8Array
  fileName: string
  downloadLabel?: string
  shareLabel?: string
  /** Shown on both buttons while `disabled` (e.g. "Adding evidence…"). */
  busyLabel?: string
  disabled?: boolean
}) {
  // Read after mount so the server render and the first client render match.
  const [shareable, setShareable] = useState(false)
  useEffect(() => {
    setShareable(canSharePdf(fileName))
  }, [fileName])

  return (
    <>
      <PuButton
        variant={shareable ? undefined : 'green'}
        disabled={disabled}
        onClick={() => downloadPdf(bytes, fileName)}
      >
        {disabled && busyLabel ? busyLabel : downloadLabel}
      </PuButton>
      {shareable ? (
        <PuButton variant="green" disabled={disabled} onClick={() => void sharePdf(bytes, fileName)}>
          {disabled && busyLabel ? busyLabel : shareLabel}
        </PuButton>
      ) : null}
    </>
  )
}
