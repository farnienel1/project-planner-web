'use client'

/**
 * "Report a problem with this file" — shown wherever a file someone else
 * uploaded is visible. Sends the Storage path and a reason to the admin queue.
 */

import { useState } from 'react'
import { Modal } from '@/components/ui/overlays'
import { Button } from '@/components/ui/Button'
import { Field, Textarea } from '@/components/ui/controls'
import { useToast } from '@/components/ui/ToastProvider'
import { useAuthStore } from '@/lib/stores/authStore'
import {
  FILE_REPORT_DETAILS_MAX,
  FILE_REPORT_LINK_LABEL,
  FILE_REPORT_REASONS,
  FILE_REPORT_SENT_COPY,
  fileReportReasonCopy,
  fileReportStoragePath,
  type FileReportReason,
  type FileReportSurface,
} from '@/lib/canonical'
import { submitFileReport } from '@/lib/fileReports/fileReportService'

export function ReportFileLink({
  fileRef,
  surface,
  parentId,
  fileName,
  className,
}: {
  /** Download URL or Storage path of the file. */
  fileRef: string | null | undefined
  surface: FileReportSurface
  parentId: string
  fileName?: string | null
  className?: string
}) {
  const { user, organization } = useAuthStore()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState<FileReportReason | ''>('')
  const [details, setDetails] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  const storagePath = fileReportStoragePath(fileRef)
  const organizationId = organization?.id || user?.organizationId || ''
  if (!storagePath || !user?.id || !organizationId || !parentId) return null

  const close = () => {
    if (sending) return
    setOpen(false)
    setReason('')
    setDetails('')
    setError('')
  }

  const send = async () => {
    if (!reason) {
      setError('Choose a reason.')
      return
    }
    setSending(true)
    setError('')
    try {
      await submitFileReport({
        organizationId,
        storagePath,
        surface,
        parentId,
        fileName,
        reason,
        details,
        reportedByUserId: user.id,
      })
      setSending(false)
      close()
      toast(FILE_REPORT_SENT_COPY)
    } catch {
      setSending(false)
      setError('The report could not be sent. Try again.')
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={(event) => {
          event.preventDefault()
          event.stopPropagation()
          setOpen(true)
        }}
        className={className ?? 'text-[11.5px] font-medium text-[var(--ink3)] underline-offset-2 hover:text-[var(--ink2)] hover:underline'}
      >
        {FILE_REPORT_LINK_LABEL}
      </button>
      <Modal
        open={open}
        onClose={close}
        title="Report this file"
        subtitle="An admin in your company will review it."
        footer={
          <>
            <Button variant="ghost" onClick={close} disabled={sending}>
              Cancel
            </Button>
            <Button variant="primary" onClick={send} disabled={sending || !reason}>
              {sending ? 'Sending…' : 'Send report'}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4 pb-2">
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-[13.5px] font-semibold text-[var(--ink2)]">Reason</legend>
            {FILE_REPORT_REASONS.map((value) => (
              <label key={value} className="flex items-center gap-2.5 text-[14px] text-[var(--ink)]">
                <input
                  type="radio"
                  name="file-report-reason"
                  value={value}
                  checked={reason === value}
                  onChange={() => setReason(value)}
                />
                {fileReportReasonCopy(value)}
              </label>
            ))}
          </fieldset>
          <Field label="Details (optional)" help={`${details.length}/${FILE_REPORT_DETAILS_MAX}`}>
            <Textarea
              rows={3}
              maxLength={FILE_REPORT_DETAILS_MAX}
              value={details}
              onChange={(event) => setDetails(event.target.value)}
            />
          </Field>
          {error ? <p className="text-sm text-[var(--red)]">{error}</p> : null}
        </div>
      </Modal>
    </>
  )
}
