'use client'

/**
 * Settings → Company → Export company data (launch checklist 2.1). Admins outside operative mode only
 * (`canExportCompanyData`); the reading, the CSV / JSON / README files and the zip are lib/companyExport.
 */

import { useEffect, useRef, useState } from 'react'
import { db } from '@/lib/firebase/config'
import { useAuthStore } from '@/lib/stores/authStore'
import { canExportCompanyData, COMPANY_EXPORT_REFUSED_MESSAGE } from '@/lib/companyExport/access'
import { EXPORT_FILES } from '@/lib/companyExport/sources'
import { displayOrganizationName } from '@/lib/settings/organizationSettings'
import type { CompanyExportProgress } from '@/lib/companyExport/runCompanyExport'
import { Button } from '@/components/ui/Button'
import {
  Callout,
  ErrorBanner,
  PanelHeader,
  SectionLabel,
  SettingsCard,
  SuccessBanner,
  ToggleRow,
} from '@/components/settings/primitives'

type Status =
  | { kind: 'idle' }
  | { kind: 'running'; progress: CompanyExportProgress | null }
  | { kind: 'done'; fileName: string; documentCount: number; problems: number }
  | { kind: 'error'; message: string }

export function CompanyDataExportPanel({ onBack }: { onBack: () => void }) {
  const { user, organization } = useAuthStore()
  const organizationId = organization?.id || ''
  const allowed = canExportCompanyData(user, organizationId)
  const [includeNotifications, setIncludeNotifications] = useState(false)
  const [status, setStatus] = useState<Status>({ kind: 'idle' })
  const controller = useRef<AbortController | null>(null)

  // Leaving the screen (or switching company) cancels a running export.
  useEffect(() => () => controller.current?.abort(), [])
  useEffect(() => {
    controller.current?.abort()
  }, [organizationId])

  const start = async () => {
    if (!allowed || !user) {
      setStatus({ kind: 'error', message: COMPANY_EXPORT_REFUSED_MESSAGE })
      return
    }
    const abort = new AbortController()
    controller.current = abort
    setStatus({ kind: 'running', progress: null })
    try {
      // The reader, CSV builder and zip library load only when someone exports.
      const { runCompanyExport, downloadBlob, CompanyExportCancelled } = await import('@/lib/companyExport/runCompanyExport')
      try {
        const result = await runCompanyExport({
          db,
          organizationId,
          viewer: user,
          includeNotifications,
          signal: abort.signal,
          onProgress: (progress) => {
            if (!abort.signal.aborted) setStatus({ kind: 'running', progress })
          },
        })
        if (abort.signal.aborted) return
        downloadBlob(result.blob, result.fileName)
        setStatus({
          kind: 'done',
          fileName: result.fileName,
          documentCount: result.documentCount,
          problems: result.problems.length,
        })
      } catch (error) {
        if (error instanceof CompanyExportCancelled) {
          setStatus(
            error.message === 'Export cancelled.' ? { kind: 'idle' } : { kind: 'error', message: error.message }
          )
          return
        }
        throw error
      }
    } catch (error) {
      setStatus({
        kind: 'error',
        message: error instanceof Error && error.message ? error.message : 'The export could not be completed.',
      })
    } finally {
      if (controller.current === abort) controller.current = null
    }
  }

  const cancel = () => controller.current?.abort()
  const running = status.kind === 'running'
  const progress = running ? status.progress : null
  const percent = progress ? Math.min(100, Math.round((progress.step / Math.max(1, progress.totalSteps)) * 100)) : 0
  const orgName = displayOrganizationName(organization?.name)

  return (
    <div className="mx-auto max-w-2xl space-y-5 pb-12">
      <PanelHeader
        title="Export company data"
        onBack={onBack}
        description={`Download everything ${orgName} holds in Project Planner as one .zip file.`}
      />

      {!allowed ? <ErrorBanner message={COMPANY_EXPORT_REFUSED_MESSAGE} /> : null}

      <Callout title="What you get">
        One CSV file per area (people, jobs, bookings, annual leave, timesheets, rates, materials, variations, tasks,
        deadlines, clients, warnings and more) that opens in Excel, <strong>export.json</strong> with the same records
        in full, <strong>files.csv</strong> listing every uploaded file with its link, and a <strong>README.txt</strong>{' '}
        explaining each file. Uploaded photos and documents are listed, not included. Push tokens, Stripe ids and
        people&apos;s private tax ids are never exported.
      </Callout>

      <SectionLabel label="Options" />
      <SettingsCard>
        <div className="px-4 py-3.5">
          <ToggleRow
            title="Include notifications"
            description={`Every inbox notification in the company (${EXPORT_FILES.notifications.file}). Usually not needed.`}
            checked={includeNotifications}
            onChange={setIncludeNotifications}
            disabled={running || !allowed}
          />
        </div>
      </SettingsCard>

      {running ? (
        <SettingsCard>
          <div className="space-y-2.5 px-4 py-4" role="status" aria-live="polite">
            <div className="flex items-center justify-between gap-3 text-[13.5px]">
              <span className="font-semibold text-[var(--ink)]">
                {progress ? `Reading ${progress.label.toLowerCase()}…` : 'Starting…'}
              </span>
              <span className="text-[var(--ink3)]">
                {progress ? `${progress.documentsRead.toLocaleString('en-GB')} records` : ''}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-[var(--soft2)]">
              <div className="h-full rounded-full bg-[var(--blue)] transition-[width]" style={{ width: `${percent}%` }} />
            </div>
          </div>
        </SettingsCard>
      ) : null}

      {status.kind === 'done' ? (
        <SuccessBanner
          message={`Downloaded ${status.fileName} (${status.documentCount.toLocaleString('en-GB')} records).${
            status.problems > 0 ? ` ${status.problems} area(s) could not be read — see README.txt.` : ''
          }`}
        />
      ) : null}
      {status.kind === 'error' ? <ErrorBanner message={status.message} /> : null}

      <div className="flex flex-wrap gap-2.5">
        {running ? (
          <Button variant="secondary" onClick={cancel}>
            Cancel
          </Button>
        ) : (
          <Button variant="primary" onClick={() => void start()} disabled={!allowed}>
            Export company data
          </Button>
        )}
      </div>
      <p className="muted small">
        Large companies can take a few minutes. Keep this page open until the download starts. The file holds
        personal data and pay — store it as you would payroll records.
      </p>
    </div>
  )
}
