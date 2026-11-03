'use client'

import { useState } from 'react'
import { useAuthStore } from '@/lib/stores/authStore'
import { jsonAuthHeaders } from '@/lib/security/clientAuthHeaders'
import { Modal } from '@/components/ui/overlays'
import { Button } from '@/components/ui/Button'
import {
  CONTENT_REPORT_DETAILS_MAX,
  CONTENT_REPORT_LINK_LABEL,
  CONTENT_REPORT_REASON_LABELS,
  CONTENT_REPORT_REASONS,
  isReportableFileRef,
  type ContentReportReason,
} from '@/lib/reports/contentReport'

export function ReportFileLink({
  fileUrl,
  storagePath,
  fileName,
  source,
  className,
}: {
  fileUrl: string
  storagePath?: string
  fileName?: string
  source?: string
  className?: string
}) {
  const { user, organization } = useAuthStore()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState<ContentReportReason>('copyright')
  const [details, setDetails] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const url = (fileUrl || '').trim()
  const path = (storagePath || '').trim()
  if ((!url && !path) || (url && !isReportableFileRef(url)) || (path && !isReportableFileRef(path))) {
    return null
  }

  function reset() {
    setReason('copyright')
    setDetails('')
    setError(null)
    setBusy(false)
    setDone(false)
  }

  async function submit() {
    if (!organization?.id) {
      setError('Sign in to an organisation to report this file.')
      return
    }
    if (reason === 'other' && !details.trim()) {
      setError('Describe the problem.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const response = await fetch('/api/support/file-report', {
        method: 'POST',
        headers: await jsonAuthHeaders(),
        body: JSON.stringify({
          orgId: organization.id,
          orgName: organization.name,
          reason,
          details,
          fileUrl: url || path,
          storagePath: path,
          fileName,
          source,
        }),
      })
      const data = (await response.json().catch(() => ({}))) as { error?: string }
      if (!response.ok) throw new Error(data.error || 'Could not send that report.')
      setDone(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send that report.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <button
        type="button"
        className={`mt-1 block text-xs font-semibold text-[var(--ink3)] hover:underline ${className || ''}`}
        onClick={() => {
          reset()
          setOpen(true)
        }}
      >
        {CONTENT_REPORT_LINK_LABEL}
      </button>
      <Modal
        open={open}
        title={CONTENT_REPORT_LINK_LABEL}
        subtitle={fileName || undefined}
        onClose={() => setOpen(false)}
        footer={
          done ? (
            <Button variant="primary" size="sm" onClick={() => setOpen(false)}>
              Done
            </Button>
          ) : (
            <>
              <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" disabled={busy || !user} onClick={() => void submit()}>
                {busy ? 'Sending…' : 'Send report'}
              </Button>
            </>
          )
        }
      >
        {done ? (
          <p className="text-sm">The report was sent to Project Planner.</p>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-[var(--ink3)]">Choose why this file should be reviewed.</p>
            <div className="space-y-2">
              {CONTENT_REPORT_REASONS.map((item) => (
                <label key={item} className="flex items-center gap-2 text-sm font-semibold">
                  <input
                    type="radio"
                    name="content-report-reason"
                    checked={reason === item}
                    onChange={() => setReason(item)}
                  />
                  {CONTENT_REPORT_REASON_LABELS[item]}
                </label>
              ))}
            </div>
            <label className="block text-sm font-semibold">
              Details{reason === 'other' ? ' (required)' : ' (optional)'}
              <textarea
                className="pp-in mt-1 min-h-[88px] w-full font-normal"
                maxLength={CONTENT_REPORT_DETAILS_MAX}
                value={details}
                onChange={(event) => setDetails(event.target.value.slice(0, CONTENT_REPORT_DETAILS_MAX))}
              />
            </label>
            <p className="text-xs text-[var(--ink3)]">{details.length}/{CONTENT_REPORT_DETAILS_MAX}</p>
            {error ? <p className="text-sm font-semibold text-[var(--red)]">{error}</p> : null}
          </div>
        )}
      </Modal>
    </>
  )
}
