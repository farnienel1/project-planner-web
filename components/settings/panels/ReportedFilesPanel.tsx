'use client'

/**
 * Reported files — the admin queue for "Report a problem with this file".
 * Who may review and the review write come from lib/canonical/fileReports.ts.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { format } from 'date-fns'
import { getDownloadURL, ref } from 'firebase/storage'
import { storage } from '@/lib/firebase/config'
import { useAuthStore } from '@/lib/stores/authStore'
import { useOrgUserStore } from '@/lib/stores/siteAuditStore'
import { personDisplayName } from '@/lib/settings/orgHubUtils'
import { fileReportReasonCopy, fileReportStatusCopy, organizationContextStillCurrent, captureOrganizationContext } from '@/lib/canonical'
import { closeFileReport, listFileReports, type FileReportRow } from '@/lib/fileReports/fileReportService'
import { Button } from '@/components/ui/Button'
import { PanelHeader, SectionLabel, SettingsCard, ErrorBanner } from '@/components/settings/primitives'

const SURFACE_COPY: Record<string, string> = {
  site_audit: 'Site audit photo',
  task_attachment: 'Task attachment',
  health_safety: 'Health & safety document',
  deadline: 'Deadline file',
  variation_evidence: 'Variation evidence',
  qualification_certificate: 'Qualification certificate',
}

export function ReportedFilesPanel({ onBack }: { onBack: () => void }) {
  const { user, organization } = useAuthStore()
  const { users, loadUsers } = useOrgUserStore()
  const organizationId = organization?.id || ''
  const [rows, setRows] = useState<FileReportRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!organizationId) return
    const context = captureOrganizationContext()
    setError(null)
    try {
      const next = await listFileReports(organizationId)
      if (!organizationContextStillCurrent(organizationId, context)) return
      setRows(next)
    } catch {
      if (!organizationContextStillCurrent(organizationId, context)) return
      setRows([])
      setError('Reported files could not be loaded.')
    }
  }, [organizationId])

  useEffect(() => {
    void load()
    if (organizationId) loadUsers(organizationId)
  }, [load, loadUsers, organizationId])

  const nameFor = useMemo(() => {
    const byId = new Map(users.map((entry) => [entry.id, personDisplayName(entry)]))
    return (userId: string) => byId.get(userId) || 'Unknown user'
  }, [users])

  const open = (rows ?? []).filter((row) => row.status === 'open')
  const closed = (rows ?? []).filter((row) => row.status !== 'open')

  const openFile = async (row: FileReportRow) => {
    setError(null)
    try {
      const url = await getDownloadURL(ref(storage, row.storagePath))
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch {
      setError('That file could not be opened. It may already have been removed.')
    }
  }

  const close = async (row: FileReportRow, status: 'reviewed' | 'removed') => {
    if (!user?.id) return
    setBusyId(row.id)
    setError(null)
    try {
      await closeFileReport({ organizationId, reportId: row.id, status, reviewedByUserId: user.id })
      await load()
    } catch {
      setError('The report could not be updated. Try again.')
    } finally {
      setBusyId(null)
    }
  }

  const renderRow = (row: FileReportRow) => (
    <div key={row.id} className="flex flex-col gap-2 border-t border-[var(--line)] px-4 py-3.5 first:border-t-0">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-[14.5px] font-semibold text-[var(--ink)]">{row.fileName || 'Unnamed file'}</p>
        <span className="pill" data-hue={row.status === 'open' ? 'warn' : 'green'}>
          {fileReportStatusCopy(row.status)}
        </span>
      </div>
      <p className="text-[13px] text-[var(--ink2)]">
        {fileReportReasonCopy(row.reason)} · {SURFACE_COPY[row.surface] || 'File'}
      </p>
      {row.details ? <p className="whitespace-pre-wrap text-[13px] text-[var(--ink2)]">“{row.details}”</p> : null}
      <p className="text-[12px] text-[var(--ink3)]">
        Reported by {nameFor(row.reportedByUserId)}
        {row.createdAtMs ? ` · ${format(new Date(row.createdAtMs), 'd MMM yyyy, HH:mm')}` : ''}
        {row.reviewedByUserId ? ` · Closed by ${nameFor(row.reviewedByUserId)}` : ''}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button size="xs" variant="secondary" onClick={() => void openFile(row)}>
          Open file
        </Button>
        {row.status === 'open' ? (
          <>
            <Button size="xs" variant="secondary" disabled={busyId === row.id} onClick={() => void close(row, 'reviewed')}>
              Mark reviewed
            </Button>
            <Button size="xs" variant="danger" disabled={busyId === row.id} onClick={() => void close(row, 'removed')}>
              I removed the file
            </Button>
          </>
        ) : null}
      </div>
    </div>
  )

  return (
    <div className="space-y-5">
      <PanelHeader
        title="Reported files"
        description="Files people in your company reported with “Report a problem with this file”. Remove the file where it was uploaded, then close the report."
        onBack={onBack}
      />
      {error ? <ErrorBanner message={error} /> : null}
      <div>
        <SectionLabel label={`Open (${open.length})`} />
        <SettingsCard>
          {rows === null ? (
            <p className="px-4 py-3.5 text-sm text-[var(--ink3)]">Loading…</p>
          ) : open.length === 0 ? (
            <p className="px-4 py-3.5 text-sm text-[var(--ink3)]">No open reports.</p>
          ) : (
            open.map(renderRow)
          )}
        </SettingsCard>
      </div>
      {closed.length > 0 ? (
        <div>
          <SectionLabel label="Closed" />
          <SettingsCard>{closed.map(renderRow)}</SettingsCard>
        </div>
      ) : null}
    </div>
  )
}
