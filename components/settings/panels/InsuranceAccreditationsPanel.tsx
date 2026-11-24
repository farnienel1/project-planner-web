'use client'

/**
 * Rulebook 1.83.0 §31: Settings › Organisation › Compliance › Insurance & accreditations (admins only). Every rule is
 * the rulebook's (`lib/canonical/orgCompliance.ts`: sections, types, labels, checks, status, order, counts); this file
 * only shows them and calls the write glue (`lib/compliance/orgComplianceWrites.ts`).
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { useAuthStore } from '@/lib/stores/authStore'
import { useOrganizationCurrency, useOrganizationTimeZone } from '@/lib/stores/organizationDocumentStore'
import { useToast } from '@/components/ui/ToastProvider'
import { uploadAcceptAttribute, uploadAllowedHint } from '@/lib/canonical/uploadPolicy'
import {
  ORG_COMPLIANCE_FIELD_LIMITS,
  ORG_COMPLIANCE_LABELS,
  ORG_COMPLIANCE_MESSAGES,
  ORG_COMPLIANCE_PAGE_SUBTITLE,
  ORG_COMPLIANCE_PAGE_TITLE,
  ORG_COMPLIANCE_SECTIONS,
  canManageOrganizationCompliance,
  orgComplianceCounts,
  orgComplianceCoverText,
  orgComplianceDetailsError,
  orgComplianceExpiryStatus,
  orgComplianceSortedEntries,
  orgComplianceTodayKey,
  orgComplianceDocumentRefKey,
  parseOrgComplianceDocumentRef,
  ORG_COMPLIANCE_SHARE_MESSAGES,
  ORG_COMPLIANCE_SHARE_MAX_DOCUMENTS,
  ORG_COMPLIANCE_ZIP_MAX_DOCUMENTS,
  type OrgComplianceDocuments,
  type OrgComplianceEntry,
  type OrgComplianceSection,
} from '@/lib/canonical/orgCompliance'
import {
  addOrgComplianceDocument,
  openOrgComplianceFile,
  removeOrgComplianceDocument,
  replaceOrgComplianceFile,
  subscribeOrgComplianceDocuments,
  updateOrgComplianceDocument,
} from '@/lib/compliance/orgComplianceWrites'
import { PanelHeader, SectionLabel, SettingsCard, ErrorBanner } from '@/components/settings/primitives'
import {
  createComplianceShareLink,
  downloadComplianceZip,
  complianceShareLinkStatusText,
  listComplianceShareLinks,
  revokeComplianceShareLink,
  type ComplianceShareLinkRow,
} from '@/lib/compliance/complianceShareClient'

const SHIELD =
  'M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z'

const TONE_HUE: Record<string, string | undefined> = { red: 'red', amber: 'warn', green: 'green', grey: undefined }

type FormMode = { kind: 'add' } | { kind: 'edit'; entry: OrgComplianceEntry } | { kind: 'replace'; entry: OrgComplianceEntry }

/** Live documents of the open organisation (admins only; null while loading). */
export function useOrgComplianceDocuments(enabled: boolean): { documents: OrgComplianceDocuments | null; error: string | null } {
  const organizationId = useAuthStore((s) => s.organization?.id ?? null)
  const [state, setState] = useState<{ org: string | null; documents: OrgComplianceDocuments | null; error: string | null }>({
    org: null,
    documents: null,
    error: null,
  })
  useEffect(() => {
    if (!enabled || !organizationId) return
    return subscribeOrgComplianceDocuments(
      organizationId,
      (documents) => setState({ org: organizationId, documents, error: null }),
      () => setState({ org: organizationId, documents: null, error: 'Insurance & accreditations did not load. Check the connection and try again.' })
    )
  }, [enabled, organizationId])
  // Never show another organisation's documents after a switch.
  if (!enabled || state.org !== organizationId) return { documents: null, error: null }
  return { documents: state.documents, error: state.error }
}

/**
 * Today in the organisation zone (status labels follow the organisation's day). Worked out again when the window
 * regains focus or the tab becomes visible, and once a minute, so a page left open past midnight moves to the new day.
 */
export function useComplianceTodayKey(): string {
  const timeZone = useOrganizationTimeZone()
  const [nowMs, setNowMs] = useState(() => Date.now())
  useEffect(() => {
    const tick = () => setNowMs(Date.now())
    const onVisible = () => {
      if (document.visibilityState === 'visible') tick()
    }
    window.addEventListener('focus', tick)
    document.addEventListener('visibilitychange', onVisible)
    const timer = window.setInterval(tick, 60_000)
    return () => {
      window.removeEventListener('focus', tick)
      document.removeEventListener('visibilitychange', onVisible)
      window.clearInterval(timer)
    }
  }, [])
  return orgComplianceTodayKey(nowMs, timeZone)
}

export function InsuranceAccreditationsPanel({ onBack }: { onBack: () => void }) {
  const { user, organization } = useAuthStore()
  const allowed = canManageOrganizationCompliance(user)
  const { documents, error } = useOrgComplianceDocuments(allowed)
  const currency = useOrganizationCurrency()
  const todayKey = useComplianceTodayKey()
  const counts = useMemo(() => orgComplianceCounts(documents, todayKey), [documents, todayKey])
  const [selected, setSelected] = useState<Set<string>>(() => new Set())
  const toggleSelected = (key: string) =>
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  if (!allowed || !organization?.id || !user) {
    return (
      <div className="mx-auto max-w-2xl space-y-5 pb-12">
        <PanelHeader title={ORG_COMPLIANCE_PAGE_TITLE} onBack={onBack} />
        <ErrorBanner message={ORG_COMPLIANCE_MESSAGES.noAccess} />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5 pb-12">
      <PanelHeader title={ORG_COMPLIANCE_PAGE_TITLE} description={ORG_COMPLIANCE_PAGE_SUBTITLE} iconPath={SHIELD} hue="green" onBack={onBack} />
      {error ? <ErrorBanner message={error} /> : null}
      <div className="row wrap" style={{ gap: 8 }}>
        <span className="pill" data-hue="green">{counts.total} documents</span>
        <span className="pill" data-hue="warn">{counts.expiringSoon} expiring soon</span>
        <span className="pill" data-hue="red">{counts.expired} expired</span>
      </div>
      {documents === null && !error ? <p className="muted small">Loading…</p> : null}
      {documents ? (
        <ShareAndZipBar
          organizationId={organization.id}
          documents={documents}
          selected={selected}
          clearSelection={() => setSelected(new Set())}
          todayKey={todayKey}
        />
      ) : null}
      {documents
        ? ORG_COMPLIANCE_SECTIONS.map((section) => (
            <SectionBlock
              key={section.key}
              section={section}
              entries={orgComplianceSortedEntries(documents[section.key], todayKey)}
              organizationId={organization.id}
              actorUid={user.id}
              todayKey={todayKey}
              currency={currency}
              selected={selected}
              toggleSelected={toggleSelected}
            />
          ))
        : null}
    </div>
  )
}

function SectionBlock({
  section,
  entries,
  organizationId,
  actorUid,
  todayKey,
  currency,
  selected,
  toggleSelected,
}: {
  section: OrgComplianceSection
  entries: OrgComplianceEntry[]
  organizationId: string
  actorUid: string
  todayKey: string
  currency: string
  selected: Set<string>
  toggleSelected: (key: string) => void
}) {
  const toast = useToast()
  const [form, setForm] = useState<FormMode | null>(null)

  async function onOpen(entry: OrgComplianceEntry) {
    try {
      await openOrgComplianceFile(entry.path)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'This file cannot be opened.')
    }
  }

  async function onRemove(entry: OrgComplianceEntry) {
    if (!window.confirm(`${entry.title}: ${ORG_COMPLIANCE_LABELS.removeConfirm}`)) return
    try {
      await removeOrgComplianceDocument({ organizationId, section: section.key, entryId: entry.id, actorUid })
      toast('Document removed.')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'The document could not be removed.')
    }
  }

  return (
    <section aria-labelledby={`compliance-${section.key}`}>
      <div className="row" style={{ alignItems: 'flex-end', gap: 8 }}>
        <div className="grow" style={{ minWidth: 0 }}>
          <SectionLabel label={`${section.title} · ${entries.length}`} />
          <p id={`compliance-${section.key}`} className="muted small">{section.helper}</p>
        </div>
        <button type="button" className="btn sm tint" onClick={() => setForm({ kind: 'add' })} disabled={form !== null}>
          {ORG_COMPLIANCE_LABELS.upload}
        </button>
      </div>
      <SettingsCard>
        {entries.length === 0 && !form ? (
          <div style={{ padding: 14 }}>
            <p className="t" style={{ fontWeight: 600 }}>{section.emptyTitle}</p>
            <p className="muted small">{section.emptyBody}</p>
          </div>
        ) : null}
        {entries.map((entry) => {
          const status = orgComplianceExpiryStatus(entry.expiresOn, todayKey)
          const extra = [
            entry.issuer ? `${section.issuerLabel}: ${entry.issuer}` : '',
            entry.reference ? `${section.referenceLabel}: ${entry.reference}` : '',
            section.coverLabel && entry.coverAmount != null ? `${section.coverLabel}: ${orgComplianceCoverText(entry.coverAmount, currency)}` : '',
          ].filter(Boolean)
          return (
            <div key={entry.id} className="ritem" style={{ boxShadow: 'none', cursor: 'default' }}>
              <input
                type="checkbox"
                aria-label={`Choose ${entry.title} to share or download`}
                checked={selected.has(orgComplianceDocumentRefKey({ section: section.key, id: entry.id }))}
                onChange={() => toggleSelected(orgComplianceDocumentRefKey({ section: section.key, id: entry.id }))}
                style={{ marginRight: 10 }}
              />
              <span className="grow" style={{ minWidth: 0 }}>
                <span className="t" style={{ overflowWrap: 'anywhere' }}>{entry.title}</span>
                <span className="s">{extra.join(' · ') || entry.fileName}</span>
              </span>
              <span className="row wrap" style={{ gap: 6, justifyContent: 'flex-end' }}>
                <span className="pill" data-hue={TONE_HUE[status.tone]}>{status.label}</span>
                <button type="button" className="btn sm" onClick={() => void onOpen(entry)}>{ORG_COMPLIANCE_LABELS.view}</button>
                <button type="button" className="btn sm" disabled={form !== null} onClick={() => setForm({ kind: 'edit', entry })}>
                  {ORG_COMPLIANCE_LABELS.edit}
                </button>
                <button type="button" className="btn sm" disabled={form !== null} onClick={() => setForm({ kind: 'replace', entry })}>
                  {ORG_COMPLIANCE_LABELS.replace}
                </button>
                <button type="button" className="btn sm" onClick={() => void onRemove(entry)} aria-label={`${ORG_COMPLIANCE_LABELS.remove} ${entry.title}`}>
                  {ORG_COMPLIANCE_LABELS.remove}
                </button>
              </span>
            </div>
          )
        })}
        {form ? (
          <DocumentForm
            key={form.kind === 'add' ? 'add' : `${form.kind}-${form.entry.id}`}
            mode={form}
            section={section}
            organizationId={organizationId}
            actorUid={actorUid}
            todayKey={todayKey}
            onDone={(message) => {
              setForm(null)
              if (message) toast(message)
            }}
          />
        ) : null}
      </SettingsCard>
    </section>
  )
}

function DocumentForm({
  mode,
  section,
  organizationId,
  actorUid,
  todayKey,
  onDone,
}: {
  mode: FormMode
  section: OrgComplianceSection
  organizationId: string
  actorUid: string
  todayKey: string
  onDone: (message: string | null) => void
}) {
  const entry = mode.kind === 'add' ? null : mode.entry
  const firstType = section.documentTypes[0]
  const [docType, setDocType] = useState(entry?.docType ?? firstType.key)
  const [title, setTitle] = useState(entry?.title ?? firstType.label)
  const [titleTouched, setTitleTouched] = useState(Boolean(entry))
  const [issuer, setIssuer] = useState(entry?.issuer ?? '')
  const [reference, setReference] = useState(entry?.reference ?? '')
  const [cover, setCover] = useState(entry?.coverAmount != null ? String(entry.coverAmount) : '')
  const [hasExpiry, setHasExpiry] = useState(Boolean(entry?.expiresOn))
  const [expiresOn, setExpiresOn] = useState(entry?.expiresOn ?? '')
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const needsFile = mode.kind !== 'edit'
  const heading = mode.kind === 'add' ? `Add to ${section.title}` : mode.kind === 'edit' ? ORG_COMPLIANCE_LABELS.edit : ORG_COMPLIANCE_LABELS.replace
  const id = (name: string) => `compliance-${section.key}-${name}`

  async function onSave() {
    const details = { docType, title, issuer, reference, coverAmount: cover, expiresOn: hasExpiry ? expiresOn : null }
    const detailsError = orgComplianceDetailsError(section.key, details, todayKey)
    if (detailsError) return setError(detailsError)
    if (needsFile && !file) return setError('Choose a file.')
    setBusy(true)
    setError(null)
    try {
      if (mode.kind === 'add') {
        await addOrgComplianceDocument({ organizationId, section: section.key, details, file: file!, actorUid, todayKey })
        onDone('Document uploaded.')
      } else if (mode.kind === 'replace') {
        await replaceOrgComplianceFile({ organizationId, section: section.key, entryId: mode.entry.id, details, file: file!, actorUid, todayKey })
        onDone('File replaced.')
      } else {
        await updateOrgComplianceDocument({ organizationId, section: section.key, entryId: mode.entry.id, details, actorUid, todayKey })
        onDone('Details saved.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The document could not be saved. Try again.')
      setBusy(false)
    }
  }

  return (
    <div style={{ padding: 14, borderTop: '1px solid var(--line, rgba(0,0,0,0.08))' }} className="stack">
      <h3 className="h2" style={{ fontSize: 15 }}>{heading}</h3>
      {mode.kind === 'replace' ? <p className="muted small">{ORG_COMPLIANCE_LABELS.replaceHelper}</p> : null}
      {needsFile ? (
        <div className="row wrap" style={{ gap: 8, alignItems: 'center' }}>
          <button type="button" className="btn sm" onClick={() => fileInput.current?.click()} disabled={busy}>
            {file ? 'Change file' : 'Choose a file'}
          </button>
          <span className="small" style={{ overflowWrap: 'anywhere' }}>{file?.name ?? uploadAllowedHint('org_compliance_document')}</span>
          <input
            ref={fileInput}
            type="file"
            hidden
            accept={uploadAcceptAttribute('org_compliance_document')}
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </div>
      ) : null}
      <label htmlFor={id('type')} className="small stack" style={{ gap: 4 }}>
        {ORG_COMPLIANCE_LABELS.docType}
        <select
          id={id('type')}
          className="in"
          value={docType}
          disabled={busy}
          onChange={(e) => {
            setDocType(e.target.value)
            const type = section.documentTypes.find((t) => t.key === e.target.value)
            if (!titleTouched && type) setTitle(type.label)
          }}
        >
          {section.documentTypes.map((type) => (
            <option key={type.key} value={type.key}>{type.label}</option>
          ))}
          {entry && !section.documentTypes.some((t) => t.key === entry.docType) ? <option value={entry.docType}>{entry.docType}</option> : null}
        </select>
      </label>
      <label htmlFor={id('title')} className="small stack" style={{ gap: 4 }}>
        {ORG_COMPLIANCE_LABELS.title}
        <input
          id={id('title')}
          className="in"
          value={title}
          maxLength={ORG_COMPLIANCE_FIELD_LIMITS.title * 2}
          placeholder={ORG_COMPLIANCE_LABELS.titlePlaceholder}
          disabled={busy}
          onChange={(e) => {
            setTitle(e.target.value)
            setTitleTouched(true)
          }}
        />
      </label>
      <label className="small row" style={{ gap: 8, alignItems: 'center' }}>
        <input type="checkbox" checked={hasExpiry} disabled={busy} onChange={(e) => setHasExpiry(e.target.checked)} />
        {ORG_COMPLIANCE_LABELS.expiryToggle}
      </label>
      {hasExpiry ? (
        <label htmlFor={id('expiry')} className="small stack" style={{ gap: 4 }}>
          {ORG_COMPLIANCE_LABELS.expiry}
          <input id={id('expiry')} type="date" className="in" style={{ maxWidth: 200 }} value={expiresOn} disabled={busy} onChange={(e) => setExpiresOn(e.target.value)} />
          <span className="muted">{ORG_COMPLIANCE_LABELS.expiryHelper}</span>
        </label>
      ) : null}
      <label htmlFor={id('issuer')} className="small stack" style={{ gap: 4 }}>
        {section.issuerLabel} (optional)
        <input id={id('issuer')} className="in" value={issuer} disabled={busy} onChange={(e) => setIssuer(e.target.value)} />
      </label>
      <label htmlFor={id('reference')} className="small stack" style={{ gap: 4 }}>
        {section.referenceLabel} (optional)
        <input id={id('reference')} className="in" value={reference} disabled={busy} onChange={(e) => setReference(e.target.value)} />
      </label>
      {section.coverLabel ? (
        <label htmlFor={id('cover')} className="small stack" style={{ gap: 4 }}>
          {section.coverLabel} (optional)
          <input id={id('cover')} className="in" inputMode="numeric" value={cover} disabled={busy} onChange={(e) => setCover(e.target.value)} />
        </label>
      ) : null}
      {error ? (
        <p className="banner" data-hue="red" role="alert">{error}</p>
      ) : null}
      <div className="row" style={{ gap: 8, justifyContent: 'flex-end' }}>
        <button type="button" className="btn sm" disabled={busy} onClick={() => onDone(null)}>{ORG_COMPLIANCE_LABELS.cancel}</button>
        <button type="button" className="btn sm tint" disabled={busy} onClick={() => void onSave()}>
          {busy ? 'Saving…' : ORG_COMPLIANCE_LABELS.save}
        </button>
      </div>
    </div>
  )
}

function dateText(ms: number | null): string {
  return ms ? new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(ms)) : ''
}

/** Share link (7 days) and zip download of the chosen documents, and the organisation's links with Turn off. */
function ShareAndZipBar({
  organizationId,
  documents,
  selected,
  clearSelection,
  todayKey,
}: {
  organizationId: string
  documents: OrgComplianceDocuments
  selected: Set<string>
  clearSelection: () => void
  todayKey: string
}) {
  const toast = useToast()
  const [busy, setBusy] = useState<'zip' | 'link' | null>(null)
  const [created, setCreated] = useState<string | null>(null)
  const [links, setLinks] = useState<ComplianceShareLinkRow[] | null>(null)
  const [linksError, setLinksError] = useState<string | null>(null)

  const chosen = useMemo(() => {
    const out: OrgComplianceEntry[] = []
    for (const key of selected) {
      const ref = parseOrgComplianceDocumentRef(key)
      const entry = ref ? documents[ref.section].find((row) => row.id === ref.id) : undefined
      if (entry) out.push(entry)
    }
    return out
  }, [documents, selected])

  async function loadLinks() {
    try {
      setLinks(await listComplianceShareLinks(organizationId))
      setLinksError(null)
    } catch (err) {
      setLinksError(err instanceof Error ? err.message : 'The links could not be loaded.')
    }
  }

  useEffect(() => {
    void listComplianceShareLinks(organizationId)
      .then((rows) => setLinks(rows))
      .catch((err) => setLinksError(err instanceof Error ? err.message : 'The links could not be loaded.'))
  }, [organizationId])

  async function onZip() {
    setBusy('zip')
    try {
      await downloadComplianceZip(chosen, todayKey)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'The zip could not be made.')
    } finally {
      setBusy(null)
    }
  }

  async function onLink() {
    setBusy('link')
    try {
      const result = await createComplianceShareLink(organizationId, [...selected])
      setCreated(result.url)
      clearSelection()
      await loadLinks()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'The link could not be made.')
    } finally {
      setBusy(null)
    }
  }

  async function onRevoke(id: string) {
    if (!window.confirm('Turn this link off? Anyone who has it will no longer see the documents.')) return
    try {
      await revokeComplianceShareLink(organizationId, id)
      await loadLinks()
      toast('Link turned off.')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'The link could not be turned off.')
    }
  }

  const count = chosen.length
  // The server works out each link's state (`orgComplianceShareLinkState`).
  const active = (links ?? []).filter((link) => link.state === 'active')

  return (
    <SettingsCard>
      <div style={{ padding: 14 }} className="stack">
        <p className="small">
          {count ? `${count} chosen` : 'Tick documents below to share them or download them together.'}
        </p>
        <div className="row wrap" style={{ gap: 8 }}>
          <button type="button" className="btn sm" disabled={!count || count > ORG_COMPLIANCE_ZIP_MAX_DOCUMENTS || busy !== null} onClick={() => void onZip()}>
            {busy === 'zip' ? 'Preparing…' : 'Download zip'}
          </button>
          <button type="button" className="btn sm tint" disabled={!count || count > ORG_COMPLIANCE_SHARE_MAX_DOCUMENTS || busy !== null} onClick={() => void onLink()}>
            {busy === 'link' ? 'Making link…' : 'Create share link'}
          </button>
        </div>
        <p className="muted small">{ORG_COMPLIANCE_SHARE_MESSAGES.helper}</p>
        {created ? (
          <div className="row wrap" style={{ gap: 8, alignItems: 'center' }}>
            <input className="in grow" readOnly value={created} aria-label="Share link" onFocus={(e) => e.currentTarget.select()} />
            <button
              type="button"
              className="btn sm"
              onClick={() => void navigator.clipboard?.writeText(created).then(() => toast('Link copied.'), () => toast('Copy the link from the box.'))}
            >
              Copy link
            </button>
          </div>
        ) : null}
        {linksError ? <p className="muted small">{linksError}</p> : null}
        {active.length ? (
          <div className="stack" style={{ gap: 6 }}>
            <p className="small" style={{ fontWeight: 600 }}>Active links</p>
            {active.map((link) => (
              <div key={link.id} className="row wrap" style={{ gap: 8, alignItems: 'center' }}>
                <span className="small grow">
                  {link.documents.length} document{link.documents.length === 1 ? '' : 's'} · until {dateText(link.expiresAtMs)} · opened {link.openCount} time{link.openCount === 1 ? '' : 's'}
                  {complianceShareLinkStatusText(link) ? (
                    <>
                      {' · '}
                      <strong style={{ color: 'var(--red)' }}>{complianceShareLinkStatusText(link)}</strong>
                    </>
                  ) : null}
                </span>
                <button type="button" className="btn sm" onClick={() => void onRevoke(link.id)}>Turn off</button>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </SettingsCard>
  )
}
