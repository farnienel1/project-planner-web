'use client'

import { useState } from 'react'
import { useAuthStore } from '@/lib/stores/authStore'
import { outboxSummary, type SiteAuditOutboxRecord } from '@/lib/siteAudit/siteAuditOutbox'
import {
  discardSiteAudit,
  isSiteAuditSending,
  retrySiteAudit,
  siteAuditOutboxPersistent,
  useSiteAuditOutbox,
} from '@/lib/siteAudit/siteAuditSender'

/**
 * Site audits saved on this device but not yet sent (owner bug 17 Nov): each shows its photo progress, the real
 * error and Retry / Discard, so a stuck upload never makes an audit disappear.
 */
export function UnsentSiteAudits({ kind, projectId }: { kind?: SiteAuditOutboxRecord['kind']; projectId?: string }) {
  const { organization, user } = useAuthStore()
  const records = useSiteAuditOutbox(organization?.id, user?.id, { kind, projectId })
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  if (records.length === 0) return null
  return (
    <section className="space-y-2" aria-label="Site audits not sent">
      <p className="text-xs font-bold tracking-wide text-[var(--red)]">NOT SENT · {records.length}</p>
      {!siteAuditOutboxPersistent() ? (
        <p className="text-xs text-[var(--ink2)]">This browser cannot keep a copy, so keep this tab open until these are sent.</p>
      ) : null}
      {message ? <p className="text-xs text-[var(--red)]">{message}</p> : null}
      {records.map((record) => {
        const summary = outboxSummary(record)
        const sending = isSiteAuditSending(record.id)
        const title =
          record.meta.customTitle ||
          (record.kind === 'personal' ? record.meta.jobName : record.project?.siteName) ||
          record.meta.type
        return (
          <div key={record.id} className="card px-4 py-3 space-y-1" style={{ borderColor: 'var(--red)' }}>
            <p className="text-sm font-bold text-[var(--ink)]">
              {record.kind === 'project' && record.project ? `${record.project.jobNumber} · ` : ''}
              {title} · {record.meta.date}
            </p>
            <p className="text-xs text-[var(--ink2)]">
              {record.items.length} item{record.items.length === 1 ? '' : 's'} · {sending ? summary.label : `${summary.done} of ${summary.total} photos uploaded`}
            </p>
            {!sending && record.lastError ? <p className="text-xs text-[var(--red)]">{record.lastError}</p> : null}
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                className="btn sm primary"
                disabled={sending || busy === record.id}
                onClick={() => {
                  setMessage(null)
                  setBusy(record.id)
                  void retrySiteAudit(record.id).finally(() => setBusy(null))
                }}
              >
                {sending ? 'Sending…' : summary.done === summary.total ? 'Retry save' : 'Retry'}
              </button>
              <button
                type="button"
                className="btn sm ghost"
                style={{ color: 'var(--red)' }}
                disabled={sending || busy === record.id}
                onClick={() => {
                  if (!window.confirm('Discard this audit? Its text and photos are removed from this device and it is not saved.')) return
                  setMessage(null)
                  setBusy(record.id)
                  discardSiteAudit(record.id)
                    .catch((error: unknown) => setMessage(error instanceof Error ? error.message : 'Could not discard.'))
                    .finally(() => setBusy(null))
                }}
              >
                Discard
              </button>
            </div>
          </div>
        )
      })}
    </section>
  )
}
