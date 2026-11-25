'use client'

/**
 * Rulebook 1.30.0 §26: Site audits → Personal. The signed-in person's own audits only (owner-only security rules); job
 * number and job name are free text, not linked to any job, and print on the audit. Rules and shapes are
 * `personalSiteAudits.ts`; this file only shows them.
 */
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  PERSONAL_SITE_AUDIT_CREATE_LABEL,
  PERSONAL_SITE_AUDIT_PRIVATE_NOTE,
  PERSONAL_SITE_AUDIT_SECTION_LABEL,
  personalSiteAuditTitle,
  personalSiteAuditsFor,
  type PersonalSiteAudit,
} from '@/lib/canonical'
import { useAuthStore } from '@/lib/stores/authStore'
import { useOrganizationTimeZone } from '@/lib/stores/organizationDocumentStore'
import { listenPersonalSiteAudits, storedFileBytes, storedFileUrl } from '@/lib/payeClaims/payeClaimsData'
import { UnsentSiteAudits } from '@/components/site-audit/UnsentSiteAudits'
import { SiteAuditFieldCounter } from '@/components/site-audit/SiteAuditFieldCounter'
import { SiteAuditSteps } from '@/components/site-audit/SiteAuditSteps'
import { SiteAuditCreateFlow } from '@/components/projects/siteAudit/SiteAuditCreateFlow'
import { FormInput, FormLabel } from '@/components/forms/FormShell'
import { PageBand, PageShell } from '@/components/ui/page'
import { SITE_AUDIT_LEAVE_CONFIRM_MESSAGE, personalSiteAuditJobProblem } from '@/lib/siteAudit/siteAuditCreateDraft'

import { downloadPdf } from '@/lib/pdf/downloadPdf'
import { loadExportModule } from '@/lib/pdf/loadExportModule'

// The PDF builders (pdf-lib) load only when a PDF is made.
const buildPersonalSiteAuditPdf: typeof import('@/lib/payeClaims/payeClaimReportPdf').buildPersonalSiteAuditPdf = (...args) =>
  loadExportModule(() => import('@/lib/payeClaims/payeClaimReportPdf')).then((module) => module.buildPersonalSiteAuditPdf(...args))

/** Live list of the signed-in person's personal audits (never anyone else's). */
export function usePersonalSiteAudits(): { audits: PersonalSiteAudit[]; loaded: boolean; error: string | null } {
  const { organization, user } = useAuthStore()
  const timeZone = useOrganizationTimeZone()
  const [audits, setAudits] = useState<PersonalSiteAudit[]>([])
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const orgId = organization?.id
  const uid = user?.id
  useEffect(() => {
    if (!orgId || !uid) return
    return listenPersonalSiteAudits(
      orgId,
      uid,
      timeZone,
      (rows) => {
        setAudits(personalSiteAuditsFor(rows, uid))
        setLoaded(true)
      },
      (e) => setError(e.message)
    )
  }, [orgId, uid, timeZone])
  return { audits, loaded, error }
}

function AuditPhoto({ path }: { path: string }) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    let live = true
    storedFileUrl(path)
      .then((value) => live && setUrl(value))
      .catch(() => live && setUrl(null))
    return () => {
      live = false
    }
  }, [path])
  return url ? <img src={url} alt="" className="w-full rounded-xl object-cover" style={{ maxHeight: 240 }} /> : null
}

function PersonalAuditDetail({ audit, onClose }: { audit: PersonalSiteAudit; onClose: () => void }) {
  const timeZone = useOrganizationTimeZone()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center" role="dialog" aria-label="Personal site audit">
      <div className="card pad stack w-full max-w-2xl" style={{ gap: 10, maxHeight: '92vh', overflowY: 'auto' }}>
        <button type="button" className="btn sm ghost" style={{ alignSelf: 'flex-start' }} onClick={onClose}>
          Done
        </button>
        <b>{personalSiteAuditTitle(audit)}</b>
        <p className="muted small">
          Job number {audit.jobNumber || '—'} · Job name {audit.jobName} · {audit.authorName} · {audit.items.length} item(s)
        </p>
        <button
          type="button"
          className="btn primary"
          disabled={busy}
          onClick={() => {
            setBusy(true)
            setError(null)
            buildPersonalSiteAuditPdf(audit, { timeZone, readFile: storedFileBytes })
              .then((bytes) => downloadPdf(bytes, `personal-site-audit-${audit.date || 'audit'}.pdf`))
              .catch((e: unknown) => setError(e instanceof Error ? e.message : 'The PDF could not be made.'))
              .finally(() => setBusy(false))
          }}
        >
          {busy ? 'Making PDF…' : 'Download PDF'}
        </button>
        {error ? <p className="small" style={{ color: 'var(--red)' }}>{error}</p> : null}
        {audit.items.map((item, index) => (
          <div key={item.id} className="card pad stack" style={{ gap: 4 }}>
            <b className="small">
              {index + 1}. {item.title}
            </b>
            {item.location ? <span className="muted small">{item.location}</span> : null}
            {item.comments ? <span className="small">{item.comments}</span> : null}
            {item.imagePath ? <AuditPhoto path={item.imagePath} /> : null}
          </div>
        ))}
      </div>
    </div>
  )
}

/** The Personal list: Create Personal Site Audit, then the person's audits, newest first. */
export function PersonalSiteAuditsView({ onBack }: { onBack: () => void }) {
  const { audits, loaded, error } = usePersonalSiteAudits()
  const router = useRouter()
  const [open, setOpen] = useState<PersonalSiteAudit | null>(null)
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button type="button" onClick={onBack} className="btn sm ghost" aria-label="Back">
          Back
        </button>
        <h2 className="text-lg font-bold">{PERSONAL_SITE_AUDIT_SECTION_LABEL}</h2>
      </div>
      <p className="muted small">{PERSONAL_SITE_AUDIT_PRIVATE_NOTE}</p>
      <button type="button" className="btn primary w-full" onClick={() => router.push(PERSONAL_SITE_AUDIT_NEW_PATH)}>
        {PERSONAL_SITE_AUDIT_CREATE_LABEL}
      </button>
      <UnsentSiteAudits kind="personal" />
      {error ? <p className="muted">{error}</p> : null}
      {!loaded && !error ? <p className="muted">Loading…</p> : null}
      {loaded && audits.length === 0 ? <p className="muted">No personal site audits yet.</p> : null}
      <div className="space-y-2">
        {audits.map((audit) => (
          <button key={audit.id} type="button" className="w-full card px-4 py-3.5 text-left" onClick={() => setOpen(audit)}>
            <b className="text-sm">{personalSiteAuditTitle(audit)}</b>
            <p className="muted small">
              {audit.items.length} item{audit.items.length === 1 ? '' : 's'}
            </p>
          </button>
        ))}
      </div>
      {open ? <PersonalAuditDetail audit={open} onClose={() => setOpen(null)} /> : null}
    </div>
  )
}

/** Where Create Personal Site Audit opens, and where a saved or cancelled one returns (the Personal list). */
export const PERSONAL_SITE_AUDIT_NEW_PATH = '/dashboard/site-audit/personal/new'
export const PERSONAL_SITE_AUDIT_LIST_PATH = '/dashboard/site-audit?view=personal'

/**
 * Create Personal Site Audit as its own page (owner request 25 Nov), step by step like New site audit: 1 the free-text
 * job number and job name (not linked to any job), then the shared create flow's Details, Photos and Review & save.
 * Checks and the saved record are the former dialog's (`personalSiteAuditValidationError`, `sendSiteAudit`).
 */
export function PersonalSiteAuditNewScreen() {
  const router = useRouter()
  const { organization } = useAuthStore()
  const [jobNumber, setJobNumber] = useState('')
  const [jobName, setJobName] = useState('')
  const [job, setJob] = useState<{ jobNumber: string; jobName: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [unsaved, setUnsaved] = useState(false)
  const leave = () => router.push(PERSONAL_SITE_AUDIT_LIST_PATH)
  const backToList = () => {
    if (unsaved && !window.confirm(SITE_AUDIT_LEAVE_CONFIRM_MESSAGE)) return
    leave()
  }
  const next = () => {
    const problem = personalSiteAuditJobProblem({ jobNumber, jobName })
    if (problem) {
      setError(problem)
      return
    }
    setError(null)
    setJob({ jobNumber: jobNumber.trim(), jobName: jobName.trim() })
  }

  return (
    <PageShell>
      <PageBand
        eyebrow={PERSONAL_SITE_AUDIT_SECTION_LABEL}
        title={PERSONAL_SITE_AUDIT_CREATE_LABEL}
        subtitle={job ? undefined : `${PERSONAL_SITE_AUDIT_PRIVATE_NOTE} Not linked to any job.`}
        back={{ label: PERSONAL_SITE_AUDIT_SECTION_LABEL, onClick: backToList }}
      />
      {job && organization?.id ? (
        <SiteAuditCreateFlow
          personal={job}
          onClose={leave}
          onChangeJob={() => setJob(null)}
          onUnsavedChange={setUnsaved}
          onCreated={() => undefined}
        />
      ) : (
        <div className="space-y-4">
          <SiteAuditSteps current={1} />
          <div className="pu-card sa-new-card space-y-4">
            {error ? (
              <p className="rounded-lg bg-(--red-t) px-3 py-2 text-xs font-medium text-(--red)" role="alert">
                {error}
              </p>
            ) : null}
            <div>
              <FormLabel>Job number</FormLabel>
              <FormInput value={jobNumber} onChange={(e) => setJobNumber(e.target.value)} placeholder="e.g. J-1042" aria-label="Job number" />
              <SiteAuditFieldCounter field="jobNumber" value={jobNumber} />
            </div>
            <div>
              <FormLabel required>Job name</FormLabel>
              <FormInput value={jobName} onChange={(e) => setJobName(e.target.value)} placeholder="e.g. Station Road" aria-label="Job name" />
              <SiteAuditFieldCounter field="jobName" value={jobName} />
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={leave} className="rounded-xl border border-(--line) px-4 py-2.5 text-sm text-(--ink2)">
                Cancel
              </button>
              <button type="button" onClick={next} className="flex-1 rounded-xl bg-(--blue) py-2.5 text-sm font-bold text-white">
                Next: details
              </button>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  )
}

