'use client'

/**
 * Rulebook 1.45.0 (owner decision 14 Nov): the one web attach control for claim evidence — timesheet price work and
 * expense entries (§8) and PAYE Add / Edit Price Work and Expense (§26). Laid out like the Tasks attachments picker:
 * Add photo, Add site audit (a frozen PDF copy of one of the person's personal site audits) and Add file. Web has no
 * camera control. Every rule, label and stored shape is the rulebook's (`claimEvidence.ts`); this file only picks files,
 * uploads them into the person's own claim folder (`uploadClaimEvidence`) when the form is saved, and shows them.
 */
import { useEffect, useState } from 'react'
import { DocumentIcon, PhotoIcon, ClipboardDocumentCheckIcon } from '@heroicons/react/24/outline'
import {
  CLAIM_EVIDENCE_ADD_FILE_LABEL,
  CLAIM_EVIDENCE_ADD_PHOTO_LABEL,
  CLAIM_EVIDENCE_ADD_SITE_AUDIT_LABEL,
  CLAIM_EVIDENCE_HEADING,
  CLAIM_EVIDENCE_HELP_TEXT,
  CLAIM_EVIDENCE_SITE_AUDIT_NOTE,
  PAYE_CLAIM_EVIDENCE_MAX,
  personalSiteAuditTitle,
  personalSiteAuditsFor,
  type PayeClaimEvidence,
  type PayeClaimEvidenceKind,
  type PersonalSiteAudit,
} from '@/lib/canonical'
import {
  attachPersonalAuditCopy,
  listenPersonalSiteAudits,
  storedFileBytes,
  storedFileUrl,
  uploadClaimEvidence,
} from '@/lib/payeClaims/payeClaimsData'
import { prepareAuditPhoto } from '@/lib/siteAudit/prepareAuditPhoto'
import { uploadLimitError } from '@/lib/security/uploadLimits'
import { loadExportModule } from '@/lib/pdf/loadExportModule'

const buildPersonalSiteAuditPdf: typeof import('@/lib/payeClaims/payeClaimReportPdf').buildPersonalSiteAuditPdf = (...args) =>
  loadExportModule(() => import('@/lib/payeClaims/payeClaimReportPdf')).then((module) => module.buildPersonalSiteAuditPdf(...args))

/** One piece of evidence on a form: already saved (`saved`), or picked and uploaded on save (`upload`). */
export type EvidenceSlot = {
  key: string
  label: string
  kind: PayeClaimEvidenceKind
  saved: PayeClaimEvidence | null
  upload: (() => Promise<PayeClaimEvidence>) | null
}

/** The slots a saved item or entry opens with. */
export function slotsFromEvidence(list: ReadonlyArray<PayeClaimEvidence> | null | undefined): EvidenceSlot[] {
  return (list || []).map((entry) => ({ key: entry.path, label: entry.name, kind: entry.kind, saved: entry, upload: null }))
}

/**
 * The evidence list to save: saved entries as they are, picked ones uploaded now (in order). Every file uploaded is
 * pushed onto `uploaded` as it lands, so a caller whose save then fails can discard them (`discardClaimEvidence`).
 */
export async function resolveEvidenceSlots(slots: ReadonlyArray<EvidenceSlot>, uploaded: PayeClaimEvidence[]): Promise<PayeClaimEvidence[]> {
  const out: PayeClaimEvidence[] = []
  for (const slot of slots) {
    if (slot.saved) {
      out.push(slot.saved)
      continue
    }
    if (!slot.upload) continue
    const entry = await slot.upload()
    uploaded.push(entry)
    out.push(entry)
  }
  return out
}

/** Placeholder evidence for the rulebook validators before upload (the paths are checked again on save). */
export function placeholderEvidence(slots: ReadonlyArray<EvidenceSlot>): Array<Pick<PayeClaimEvidence, 'path' | 'name' | 'kind'>> {
  return slots.map((slot) => slot.saved ?? { path: '', name: slot.label, kind: slot.kind })
}

/** Opens one stored file (the Storage rules decide who may). */
export function EvidenceLink({ entry }: { entry: Pick<PayeClaimEvidence, 'path' | 'name' | 'kind'> }) {
  const [error, setError] = useState(false)
  return (
    <button
      type="button"
      className="pu-link"
      style={{ border: 0, background: 'none', padding: 0, textAlign: 'left', fontSize: 13 }}
      onClick={() =>
        void storedFileUrl(entry.path)
          .then((url) => window.open(url, '_blank', 'noopener'))
          .catch(() => setError(true))
      }
    >
      📎 {entry.name}
      {entry.kind === 'personalSiteAudit' ? ' (personal site audit copy)' : ''}
      {error ? ' — could not open' : ''}
    </button>
  )
}

/** A row of evidence links (nothing when the list is empty). */
export function EvidenceLinks({ evidence }: { evidence: ReadonlyArray<PayeClaimEvidence> | null | undefined }) {
  if (!evidence || evidence.length === 0) return null
  return (
    <span style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 4 }}>
      {evidence.map((entry) => (
        <EvidenceLink key={entry.path} entry={entry} />
      ))}
    </span>
  )
}

const tileStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 4,
  padding: '12px 4px',
  borderRadius: 12,
  border: '1px solid var(--pu-line-2, #EEF0F3)',
  background: 'var(--pu-surface, #fff)',
  fontSize: 11,
  cursor: 'pointer',
  color: 'inherit',
}

/**
 * Add photo / Add site audit / Add file, the picked list with Remove, and the personal site audit chooser. Nothing is
 * uploaded until the form is saved (`resolveEvidenceSlots`).
 */
export function ClaimEvidencePicker({
  organizationId,
  ownerId,
  timeZone,
  slots,
  onChange,
  required,
  disabled,
  onError,
}: {
  organizationId: string
  /** The signed-in person: their own personal site audits are offered, and files go to their own claim folder. */
  ownerId: string
  timeZone: string
  slots: EvidenceSlot[]
  onChange: (next: EvidenceSlot[]) => void
  /** Expenses: at least one ("(at least one)"); price work: optional. */
  required: boolean
  disabled?: boolean
  onError: (message: string | null) => void
}) {
  const [pickAudit, setPickAudit] = useState(false)
  const full = slots.length >= PAYE_CLAIM_EVIDENCE_MAX

  const addFiles = async (list: FileList | null, photosOnly: boolean) => {
    if (!list?.length) return
    onError(null)
    const next: EvidenceSlot[] = []
    for (const original of Array.from(list)) {
      const isImage = original.type.startsWith('image/') && original.type !== 'image/svg+xml'
      const isPdf = original.type === 'application/pdf' || /\.pdf$/i.test(original.name)
      if (photosOnly ? !isImage : !isImage && !isPdf) {
        onError(photosOnly ? 'Choose a photo.' : 'Evidence must be a photo or a PDF.')
        return
      }
      const limit = uploadLimitError(original, isImage ? 'siteAudit' : 'work')
      if (limit) {
        onError(limit)
        return
      }
      let file: File = original
      if (isImage) {
        try {
          // Every photo becomes a JPEG so the report and invoice can draw it full size.
          file = (await prepareAuditPhoto(original)).file
        } catch {
          file = original
        }
      }
      const kind: PayeClaimEvidenceKind = isImage ? 'photo' : 'file'
      next.push({
        key: `${original.name}-${Date.now()}-${next.length}`,
        label: original.name,
        kind,
        saved: null,
        upload: () =>
          uploadClaimEvidence({
            organizationId,
            file,
            name: original.name,
            contentType: isPdf ? 'application/pdf' : file.type || 'image/jpeg',
            kind,
          }),
      })
    }
    onChange([...slots, ...next].slice(0, PAYE_CLAIM_EVIDENCE_MAX))
  }

  const addAudit = (audit: PersonalSiteAudit) => {
    setPickAudit(false)
    onChange(
      [
        ...slots,
        {
          key: `audit-${audit.id}-${Date.now()}`,
          label: personalSiteAuditTitle(audit),
          kind: 'personalSiteAudit' as const,
          saved: null,
          upload: async () => {
            const bytes = await buildPersonalSiteAuditPdf(audit, { timeZone, readFile: storedFileBytes })
            return attachPersonalAuditCopy(organizationId, audit, bytes)
          },
        },
      ].slice(0, PAYE_CLAIM_EVIDENCE_MAX)
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <b className="small">
        {CLAIM_EVIDENCE_HEADING} {required ? '(at least one)' : '(optional)'}
      </b>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
        <label style={{ ...tileStyle, opacity: disabled || full ? 0.5 : 1 }}>
          <PhotoIcon style={{ width: 20, height: 20, color: '#0F6E56' }} aria-hidden="true" />
          {CLAIM_EVIDENCE_ADD_PHOTO_LABEL}
          <input
            type="file"
            accept="image/jpeg,image/png,image/heic,image/heif,image/webp,image/*"
            multiple
            className="sr-only"
            disabled={disabled || full}
            onChange={(event) => {
              void addFiles(event.target.files, true)
              event.target.value = ''
            }}
          />
        </label>
        <button type="button" style={{ ...tileStyle, opacity: disabled || full ? 0.5 : 1 }} disabled={disabled || full} onClick={() => setPickAudit(true)}>
          <ClipboardDocumentCheckIcon style={{ width: 20, height: 20, color: '#534AB7' }} aria-hidden="true" />
          {CLAIM_EVIDENCE_ADD_SITE_AUDIT_LABEL}
        </button>
        <label style={{ ...tileStyle, opacity: disabled || full ? 0.5 : 1 }}>
          <DocumentIcon style={{ width: 20, height: 20, color: 'var(--blue, #2563eb)' }} aria-hidden="true" />
          {CLAIM_EVIDENCE_ADD_FILE_LABEL}
          <input
            type="file"
            accept="application/pdf,image/*"
            multiple
            className="sr-only"
            disabled={disabled || full}
            onChange={(event) => {
              void addFiles(event.target.files, false)
              event.target.value = ''
            }}
          />
        </label>
      </div>
      <span className="pu-sub" style={{ fontSize: 11 }}>
        {CLAIM_EVIDENCE_HELP_TEXT}
      </span>
      {slots.map((slot) => (
        <div key={slot.key} className="small" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          {slot.saved ? <EvidenceLink entry={slot.saved} /> : <span>📎 {slot.label}{slot.kind === 'personalSiteAudit' ? ' (site audit copy)' : ''}</span>}
          <button
            type="button"
            className="pu-link"
            style={{ border: 0, background: 'none' }}
            disabled={disabled}
            onClick={() => onChange(slots.filter((row) => row.key !== slot.key))}
          >
            Remove
          </button>
        </div>
      ))}
      {pickAudit ? (
        <PersonalAuditPicker organizationId={organizationId} ownerId={ownerId} timeZone={timeZone} onPick={addAudit} onCancel={() => setPickAudit(false)} />
      ) : null}
    </div>
  )
}

/** The person's own personal site audits (owner only), to attach a frozen copy. */
function PersonalAuditPicker({
  organizationId,
  ownerId,
  timeZone,
  onPick,
  onCancel,
}: {
  organizationId: string
  ownerId: string
  timeZone: string
  onPick: (audit: PersonalSiteAudit) => void
  onCancel: () => void
}) {
  const [audits, setAudits] = useState<PersonalSiteAudit[] | null>(null)
  useEffect(() => listenPersonalSiteAudits(organizationId, ownerId, timeZone, setAudits, () => setAudits([])), [organizationId, ownerId, timeZone])
  const rows = personalSiteAuditsFor(audits, ownerId)
  return (
    <div className="pu-card pu-pad stack" style={{ gap: 6 }}>
      <b className="small">Choose a personal site audit</b>
      {audits == null ? <p className="pu-sub">Loading…</p> : null}
      {audits != null && rows.length === 0 ? <p className="pu-sub">You have no personal site audits. Create one in Site audits → Personal.</p> : null}
      {rows.map((audit) => (
        <button key={audit.id} type="button" className="pu-btn sm" style={{ textAlign: 'left' }} onClick={() => onPick(audit)}>
          {personalSiteAuditTitle(audit)}
        </button>
      ))}
      <p className="pu-sub">{CLAIM_EVIDENCE_SITE_AUDIT_NOTE}</p>
      <button type="button" className="pu-btn sm" onClick={onCancel}>
        Close
      </button>
    </div>
  )
}
