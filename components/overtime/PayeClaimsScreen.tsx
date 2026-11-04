'use client'

/**
 * Rulebook 1.30.0 §26: Timesheets → Overtime, Expenses & Price Work → Price work / Expenses. Every rule, figure,
 * permission and write shape comes from `@/lib/canonical` (payeClaims.ts, personalSiteAudits.ts, payePayrun.ts); this
 * screen only passes inputs and shows results.
 *
 * The same three range buttons as Overtime (Current PAYE payrun / Past PAYE payruns / Custom date range) plus Add
 * (the person only). Users' view (line managers, admins) is read-only. A self-employed person's items are their
 * timesheet entries, read-only (`timesheetClaimRows`).
 */
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  EXPENSE_ADD_LABEL,
  EXPENSES_EMPTY_MESSAGE,
  EXPENSES_GENERATE_REPORT_LABEL,
  PAYE_CLAIM_APPROVER_NOT_NOTIFIED_NOTE,
  PAYE_PAYDAY_NOT_SET_MESSAGE,
  PRICE_WORK_ADD_LABEL,
  PRICE_WORK_EMPTY_MESSAGE,
  PRICE_WORK_GENERATE_REPORT_LABEL,
  canViewPayeClaims,
  canWritePayeClaim,
  expenseValidationError,
  formatMoney,
  formatPayePayrunDay,
  payeClaimListRow,
  payeClaimReportReady,
  payeClaimReportsOfKind,
  payeClaimsInRange,
  payeClaimsTotal,
  payeCustomRange,
  payePastPayruns,
  payePayrunLabel,
  payePayrunPeriod,
  personalSiteAuditTitle,
  personalSiteAuditsFor,
  priceWorkApproverCandidates,
  priceWorkValidationError,
  timesheetClaimRows,
  type PayeClaimEvidence,
  type PayeClaimItem,
  type PayeClaimKind,
  type PayeClaimReportSnapshot,
  type PersonalSiteAudit,
  type TimesheetClaimRow,
} from '@/lib/canonical'
import { useOrganizationCurrency } from '@/lib/stores/organizationDocumentStore'
import { rulebookPerson, rulebookRoster } from '@/lib/staff/rulebookPeople'
import {
  addExpense,
  addPriceWork,
  attachPersonalAuditCopy,
  listenPayeClaimReports,
  listenPayeClaims,
  listenPersonalSiteAudits,
  loadTimesheetClaimSheets,
  removePayeClaim,
  savePayeClaimReport,
  storedFileBytes,
  storedFileUrl,
  uploadClaimEvidence,
} from '@/lib/payeClaims/payeClaimsData'
import { buildPayeClaimReportPdf, buildPersonalSiteAuditPdf } from '@/lib/payeClaims/payeClaimReportPdf'
import { downloadPdf } from '@/lib/overtime/overtimeReportPdf'
import { prepareAuditPhoto } from '@/lib/siteAudit/prepareAuditPhoto'
import { uploadLimitError } from '@/lib/security/uploadLimits'
import { CustomRangeForm, NavBar, Tile, isPaye, orgLogo, overtimeHref, personName } from '@/components/overtime/overtimeUi'
import type { User } from '@/types'

type Props = {
  kind: PayeClaimKind
  mine: boolean
  subject: User
  viewerUser: User
  users: User[]
  organizationId: string
  orgDoc: Record<string, unknown> | null | undefined
  orgLoaded: boolean
  companyName: string
  timeZone: string
  todayKey: string
  here: { scope: string | null; user: string | null; section: string | null }
  range: string | null
  start: string | null
  end: string | null
  sectionBack: { label: string; href: string }
}

function sectionTitle(kind: PayeClaimKind): string {
  return kind === 'priceWork' ? 'Price work' : 'Expenses'
}

export function PayeClaimsSection(props: Props) {
  const router = useRouter()
  const { kind, mine, subject, here, range, start, end, orgDoc, todayKey } = props
  const title = sectionTitle(kind)
  const roster = useMemo(() => rulebookRoster(props.users), [props.users])
  const viewer = useMemo(() => rulebookPerson(props.users.find((row) => row.id === props.viewerUser.id) || props.viewerUser, props.users), [props.users, props.viewerUser])
  const subjectPerson = useMemo(() => rulebookPerson(subject, props.users), [subject, props.users])
  const allowed = canViewPayeClaims(viewer, subjectPerson, roster)
  const current = payePayrunPeriod(orgDoc, todayKey)
  const sectionHref = overtimeHref({ ...here })
  const selfEmployed = !isPaye(subject)

  if (!allowed) return <p className="muted">You cannot see this person&apos;s {title.toLowerCase()}.</p>

  if (!range) {
    return (
      <div className="stack" data-hue="ts">
        <NavBar title={title} back={props.sectionBack} />
        {selfEmployed ? <p className="muted small">{personName(subject)} is self-employed: these are the entries on their timesheets, read-only.</p> : null}
        <p className="muted small">{!props.orgLoaded ? 'Loading…' : current ? payePayrunLabel(current) : PAYE_PAYDAY_NOT_SET_MESSAGE}</p>
        <div className="grid g2">
          <Tile title="Current PAYE payrun" disabled={!current} onClick={() => router.push(overtimeHref({ ...here, range: 'current' }))} />
          <Tile title="Past PAYE payruns" disabled={!current && payePastPayruns(orgDoc, todayKey).length === 0} onClick={() => router.push(overtimeHref({ ...here, range: 'past' }))} />
          <Tile title="Custom date range" onClick={() => router.push(overtimeHref({ ...here, range: 'custom' }))} />
          {mine && !selfEmployed ? (
            <Tile title={kind === 'priceWork' ? PRICE_WORK_ADD_LABEL : EXPENSE_ADD_LABEL} subtitle="Online only" onClick={() => router.push(overtimeHref({ ...here, range: 'current', add: '1' }))} disabled={!current} />
          ) : null}
        </div>
        {mine && !selfEmployed && !current ? (
          <p className="muted small">Open Custom date range to add {kind === 'priceWork' ? 'price work' : 'an expense'} until the PAYE payday is set.</p>
        ) : null}
      </div>
    )
  }

  if (range === 'past' && !(start && end)) {
    const past = payePastPayruns(orgDoc, todayKey)
    return (
      <div className="stack" data-hue="ts">
        <NavBar title="Past PAYE payruns" back={{ label: title, href: sectionHref }} />
        {past.length === 0 ? <p className="muted">{current ? 'No past PAYE payruns yet.' : PAYE_PAYDAY_NOT_SET_MESSAGE}</p> : null}
        <div className="stack" style={{ gap: 8 }}>
          {past.map((run) => (
            <Tile
              key={run.start}
              title={`${formatPayePayrunDay(run.start)} – ${formatPayePayrunDay(run.end)}`}
              subtitle={`Paid ${formatPayePayrunDay(run.payDate)}`}
              onClick={() => router.push(overtimeHref({ ...here, range: 'past', start: run.start, end: run.end }))}
            />
          ))}
        </div>
        {!selfEmployed ? <SavedClaimReports kind={kind} organizationId={props.organizationId} subjectId={subject.id} logoUrl={orgLogo(orgDoc)} /> : null}
      </div>
    )
  }

  if (range === 'custom' && !(start && end)) {
    return (
      <div className="stack" data-hue="ts">
        <NavBar title="Custom date range" back={{ label: title, href: sectionHref }} />
        <CustomRangeForm onView={(a, b) => router.push(overtimeHref({ ...here, range: 'custom', start: a, end: b }))} />
      </div>
    )
  }

  const window = range === 'current' ? (current ? { start: current.start, end: current.end } : null) : payeCustomRange(start, end)
  if (!window) {
    return (
      <div className="stack" data-hue="ts">
        <NavBar title={title} back={{ label: title, href: sectionHref }} />
        <p className="muted">{PAYE_PAYDAY_NOT_SET_MESSAGE}</p>
      </div>
    )
  }
  const back = range === 'past' ? { label: 'Past PAYE payruns', href: overtimeHref({ ...here, range: 'past' }) } : { label: title, href: sectionHref }
  const heading = `${title} · ${formatPayePayrunDay(window.start)} – ${formatPayePayrunDay(window.end)}`
  if (selfEmployed) {
    return (
      <div className="stack" data-hue="ts">
        <NavBar title={heading} back={back} />
        <TimesheetClaims kind={kind} organizationId={props.organizationId} subject={subject} timeZone={props.timeZone} range={window} />
      </div>
    )
  }
  return (
    <div className="stack" data-hue="ts">
      <NavBar title={heading} back={back} />
      <ClaimList {...props} range={window} />
    </div>
  )
}

/** Read-only list of a self-employed person's timesheet entries in the range. */
function TimesheetClaims({ kind, organizationId, subject, timeZone, range }: { kind: PayeClaimKind; organizationId: string; subject: User; timeZone: string; range: { start: string; end: string } }) {
  const currency = useOrganizationCurrency()
  const [rows, setRows] = useState<TimesheetClaimRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    let live = true
    loadTimesheetClaimSheets(organizationId, subject.id, timeZone)
      .then((sheets) => live && setRows(timesheetClaimRows(sheets, kind, range)))
      .catch((e: unknown) => live && setError(e instanceof Error ? e.message : 'Their timesheets could not be read.'))
    return () => {
      live = false
    }
  }, [organizationId, subject.id, timeZone, kind, range])
  if (error) return <p className="muted">{error}</p>
  if (!rows) return <p className="muted">Loading…</p>
  if (rows.length === 0) return <p className="muted">{kind === 'priceWork' ? PRICE_WORK_EMPTY_MESSAGE : EXPENSES_EMPTY_MESSAGE}</p>
  return (
    <div className="stack" style={{ gap: 8 }}>
      {rows.map((row) => (
        <div key={`${row.sheetId}-${row.id}`} className="card pad">
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
            <b>{row.title}</b>
            <b>{formatMoney(row.amount, currency)}</b>
          </div>
          <div className="muted small">
            {[row.startDate === row.endDate ? formatPayePayrunDay(row.startDate) : `${formatPayePayrunDay(row.startDate)} – ${formatPayePayrunDay(row.endDate)}`, row.jobNumber, row.approvedByName ? `Agreed by ${row.approvedByName}` : '', `Timesheet: ${row.managerDecision}`]
              .filter(Boolean)
              .join(' · ')}
          </div>
          {row.details ? <div className="small">{row.details}</div> : null}
        </div>
      ))}
      <p className="small">
        <b>Total {formatMoney(payeClaimsTotal(rows), currency)}</b> · read-only, from their timesheets
      </p>
    </div>
  )
}

function ClaimList(props: Omit<Props, 'range'> & { range: { start: string; end: string } }) {
  const router = useRouter()
  const { kind, organizationId, subject, mine, range, here } = props
  const currency = useOrganizationCurrency()
  const [items, setItems] = useState<PayeClaimItem[]>([])
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [open, setOpen] = useState<PayeClaimItem | null>(null)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('add') === '1' && mine) setAdding(true)
  }, [mine])
  useEffect(
    () =>
      listenPayeClaims(
        organizationId,
        subject.id,
        kind,
        props.timeZone,
        (rows) => {
          setItems(rows)
          setLoaded(true)
        },
        (e) => setError(e.message)
      ),
    [organizationId, subject.id, kind, props.timeZone]
  )
  const inRange = payeClaimsInRange(items, range)
  const ready = payeClaimReportReady(inRange)
  const writable = mine && canWritePayeClaim(props.viewerUser.id, { userId: subject.id })

  const generate = async () => {
    setBusy(true)
    setNotice(null)
    try {
      const snapshot = await savePayeClaimReport({
        organizationId,
        kind,
        userId: subject.id,
        userName: personName(subject),
        companyName: props.companyName,
        currency,
        rangeStart: range.start,
        rangeEnd: range.end,
        items: inRange,
      })
      await downloadClaimReport(snapshot, orgLogo(props.orgDoc), setNotice)
    } catch (e: unknown) {
      setNotice(e instanceof Error ? e.message : 'The report could not be made.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="stack" style={{ gap: 10 }}>
      {error ? <p className="muted">{error}</p> : null}
      {!loaded && !error ? <p className="muted">Loading…</p> : null}
      {loaded && inRange.length === 0 ? <p className="muted">{kind === 'priceWork' ? PRICE_WORK_EMPTY_MESSAGE : EXPENSES_EMPTY_MESSAGE}</p> : null}
      {inRange.map((item) => {
        const row = payeClaimListRow(item, currency)
        return (
          <button key={item.id} type="button" className="card pad click" style={{ border: 0, textAlign: 'left' }} onClick={() => setOpen(item)}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <b>{row.title}</b>
              <b>{row.figure}</b>
            </div>
            <div className="muted small">
              {row.subtitle}
              {item.evidence.length > 0 ? ` · ${item.evidence.length} evidence` : ''}
            </div>
          </button>
        )
      })}
      {inRange.length > 0 ? (
        <p className="small">
          <b>Total {formatMoney(payeClaimsTotal(inRange), currency)}</b>
        </p>
      ) : null}
      {!mine ? <p className="muted small">Read-only. {personName(subject)} adds and sends these themselves.</p> : null}
      <div className="stack" style={{ gap: 8 }}>
        {writable ? (
          <button type="button" className="btn" onClick={() => setAdding(true)}>
            {kind === 'priceWork' ? PRICE_WORK_ADD_LABEL : EXPENSE_ADD_LABEL}
          </button>
        ) : null}
        {mine ? (
          <button
            type="button"
            className="btn primary"
            style={ready ? { background: 'var(--green, #16a34a)' } : undefined}
            disabled={!ready || busy}
            onClick={() => void generate()}
          >
            {busy ? 'Making report…' : kind === 'priceWork' ? PRICE_WORK_GENERATE_REPORT_LABEL : EXPENSES_GENERATE_REPORT_LABEL}
          </button>
        ) : null}
        {notice ? <p className="muted small">{notice}</p> : null}
      </div>
      {adding ? (
        <AddClaimSheet
          kind={kind}
          organizationId={organizationId}
          subject={subject}
          users={props.users}
          timeZone={props.timeZone}
          defaultDay={props.todayKey >= range.start && props.todayKey <= range.end ? props.todayKey : range.start}
          currency={currency}
          onClose={() => {
            setAdding(false)
            const params = new URLSearchParams(window.location.search)
            if (params.get('add')) router.replace(overtimeHref({ ...here, range: params.get('range'), start: params.get('start'), end: params.get('end') }))
          }}
        />
      ) : null}
      {open ? <ClaimDetail item={open} currency={currency} canRemove={writable} organizationId={organizationId} onClose={() => setOpen(null)} /> : null}
    </div>
  )
}

async function downloadClaimReport(
  snapshot: Pick<PayeClaimReportSnapshot, 'kind' | 'userName' | 'companyName' | 'rangeStart' | 'rangeEnd' | 'currency' | 'items' | 'totals'>,
  logoUrl: string | null,
  setNotice: (text: string | null) => void
) {
  const { bytes, notDrawn } = await buildPayeClaimReportPdf(snapshot, { logoUrl, readFile: storedFileBytes })
  const label = snapshot.kind === 'priceWork' ? 'price-work' : 'expenses'
  downloadPdf(bytes, `${label}-${snapshot.userName.replace(/\s+/g, '-') || 'report'}-${snapshot.rangeStart}-${snapshot.rangeEnd}.pdf`)
  setNotice(notDrawn > 0 ? `Report downloaded. ${notDrawn} piece(s) of evidence could not be shown in the PDF and are listed instead.` : 'Report downloaded. Send it to payroll yourself.')
}

function SavedClaimReports({ kind, organizationId, subjectId, logoUrl }: { kind: PayeClaimKind; organizationId: string; subjectId: string; logoUrl: string | null }) {
  const [reports, setReports] = useState<Array<PayeClaimReportSnapshot & { id: string; generatedAtMs: number | null }>>([])
  const [notice, setNotice] = useState<string | null>(null)
  useEffect(() => listenPayeClaimReports(organizationId, subjectId, setReports, () => setReports([])), [organizationId, subjectId])
  const rows = payeClaimReportsOfKind(reports, kind)
  if (rows.length === 0) return null
  return (
    <div className="stack" style={{ gap: 8 }}>
      <p className="eyebrow">Saved reports</p>
      {rows.map((report) => (
        <Tile
          key={report.id}
          title={`${formatPayePayrunDay(report.rangeStart)} – ${formatPayePayrunDay(report.rangeEnd)} · ${formatMoney(report.totals.amount, report.currency)}`}
          subtitle={`${report.totals.itemCount} item(s)${report.generatedAtMs ? ` · made ${new Date(report.generatedAtMs).toLocaleDateString('en-GB')}` : ''} · download again`}
          onClick={() => void downloadClaimReport(report, logoUrl, setNotice).catch((e: unknown) => setNotice(e instanceof Error ? e.message : 'The report could not be made.'))}
        />
      ))}
      {notice ? <p className="muted small">{notice}</p> : null}
    </div>
  )
}

function EvidenceLink({ entry }: { entry: PayeClaimEvidence }) {
  const [error, setError] = useState(false)
  return (
    <button
      type="button"
      className="link small"
      style={{ border: 0, background: 'none', padding: 0, textAlign: 'left' }}
      onClick={() =>
        void storedFileUrl(entry.path)
          .then((url) => window.open(url, '_blank', 'noopener'))
          .catch(() => setError(true))
      }
    >
      {entry.name}
      {entry.kind === 'personalSiteAudit' ? ' (personal site audit copy)' : ''}
      {error ? ' — could not open' : ''}
    </button>
  )
}

function ClaimDetail({ item, currency, canRemove, organizationId, onClose }: { item: PayeClaimItem; currency: string; canRemove: boolean; organizationId: string; onClose: () => void }) {
  const row = payeClaimListRow(item, currency)
  const [error, setError] = useState<string | null>(null)
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 p-4 sm:items-center" role="dialog" aria-label={row.title}>
      <div className="card pad stack w-full max-w-lg" style={{ gap: 10, maxHeight: '90vh', overflowY: 'auto' }}>
        <button type="button" className="btn sm ghost" style={{ alignSelf: 'flex-start' }} onClick={onClose}>
          Close
        </button>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <b>{row.title}</b>
          <b>{row.figure}</b>
        </div>
        <div className="muted small">{row.subtitle}</div>
        {item.details ? <p className="small">{item.details}</p> : null}
        <p className="eyebrow">Evidence</p>
        {item.evidence.length === 0 ? <p className="muted small">None</p> : item.evidence.map((entry) => <EvidenceLink key={entry.path} entry={entry} />)}
        {canRemove ? (
          <button
            type="button"
            className="btn sm"
            style={{ color: 'var(--red)' }}
            onClick={() =>
              void removePayeClaim(organizationId, item)
                .then(onClose)
                .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Could not remove it.'))
            }
          >
            Remove
          </button>
        ) : null}
        {error ? <p className="muted small">{error}</p> : null}
      </div>
    </div>
  )
}

type PendingEvidence = { key: string; label: string; upload: () => Promise<PayeClaimEvidence> }

/** Add Price Work / Add Expense: Cancel at the top, the add button at the bottom. */
function AddClaimSheet(props: {
  kind: PayeClaimKind
  organizationId: string
  subject: User
  users: User[]
  timeZone: string
  defaultDay: string
  currency: string
  onClose: () => void
}) {
  const { kind, organizationId, subject, users, currency } = props
  const priceWork = kind === 'priceWork'
  const [title, setTitle] = useState('')
  const [details, setDetails] = useState('')
  const [jobNumber, setJobNumber] = useState('')
  const [from, setFrom] = useState(props.defaultDay)
  const [to, setTo] = useState(props.defaultDay)
  const [approver, setApprover] = useState('')
  const [amount, setAmount] = useState('')
  const [evidence, setEvidence] = useState<PendingEvidence[]>([])
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [pickAudit, setPickAudit] = useState(false)
  const approvers = useMemo(() => priceWorkApproverCandidates(subject as never, users as never), [subject, users])

  // Shape checks before upload: the rulebook validators with placeholder evidence (paths are checked again on save).
  const placeholder = evidence.map(() => ({ path: '', name: '', kind: 'file' as const }))
  const draftError = priceWork
    ? priceWorkValidationError({ title, details, startDate: from, endDate: to, approvedByUserId: approver, amount }, { person: subject as never, roster: users as never })
    : expenseValidationError({ title, details, jobNumber, date: from, amount, evidence: placeholder })

  const addFiles = async (list: FileList | null, photo: boolean) => {
    if (!list?.length) return
    setError(null)
    const next: PendingEvidence[] = []
    for (const original of Array.from(list)) {
      const isImage = original.type.startsWith('image/')
      const isPdf = original.type === 'application/pdf' || /\.pdf$/i.test(original.name)
      if (!isImage && !isPdf) {
        setError('Evidence must be a photo or a PDF.')
        return
      }
      const limit = uploadLimitError(original, isImage ? 'siteAudit' : 'work')
      if (limit) {
        setError(limit)
        return
      }
      let file: File = original
      if (isImage) {
        try {
          // Every photo becomes a JPEG so the report can draw it full size.
          file = (await prepareAuditPhoto(original)).file
        } catch {
          file = original
        }
      }
      next.push({
        key: `${original.name}-${Date.now()}-${next.length}`,
        label: original.name,
        upload: () =>
          uploadClaimEvidence({
            organizationId,
            file,
            name: original.name,
            contentType: isPdf ? 'application/pdf' : file.type || 'image/jpeg',
            kind: photo || isImage ? 'photo' : 'file',
          }),
      })
    }
    setEvidence((current) => [...current, ...next].slice(0, 20))
  }

  const addAudit = (audit: PersonalSiteAudit) => {
    setPickAudit(false)
    setEvidence((current) => [
      ...current,
      {
        key: `audit-${audit.id}-${Date.now()}`,
        label: personalSiteAuditTitle(audit),
        upload: async () => {
          const bytes = await buildPersonalSiteAuditPdf(audit, { timeZone: props.timeZone, readFile: storedFileBytes })
          return attachPersonalAuditCopy(organizationId, audit, bytes)
        },
      },
    ])
  }

  const submit = async () => {
    if (draftError || saving) return
    setSaving(true)
    setError(null)
    try {
      const uploaded: PayeClaimEvidence[] = []
      for (const entry of evidence) uploaded.push(await entry.upload())
      if (priceWork) {
        await addPriceWork({
          organizationId,
          person: subject as never,
          roster: users as never,
          currency,
          draft: { title, details, startDate: from, endDate: to, approvedByUserId: approver, amount, evidence: uploaded },
        })
      } else {
        await addExpense({ organizationId, currency, draft: { title, details, jobNumber, date: from, amount, evidence: uploaded } })
      }
      props.onClose()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'It could not be added.')
    } finally {
      setSaving(false)
    }
  }

  const label = priceWork ? PRICE_WORK_ADD_LABEL : EXPENSE_ADD_LABEL
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 p-4 sm:items-center" role="dialog" aria-label={label}>
      <form
        className="card pad stack w-full max-w-lg"
        style={{ gap: 12, maxHeight: '92vh', overflowY: 'auto' }}
        onSubmit={(event) => {
          event.preventDefault()
          void submit()
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button type="button" className="btn sm ghost" onClick={props.onClose}>
            Cancel
          </button>
          <b>{label}</b>
          <span style={{ width: 60 }} />
        </div>
        <label className="small">
          {priceWork ? 'Price work name' : 'Expense name'}
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />
        </label>
        <label className="small">
          Description
          <textarea className="input" value={details} onChange={(e) => setDetails(e.target.value)} rows={3} maxLength={4000} />
        </label>
        {!priceWork ? (
          <label className="small">
            Job number
            <input className="input" value={jobNumber} onChange={(e) => setJobNumber(e.target.value)} maxLength={60} />
          </label>
        ) : null}
        <div className="grid g2" style={{ gap: 8 }}>
          <label className="small">
            {priceWork ? 'From' : 'Date'}
            <input
              className="input"
              type="date"
              value={from}
              onChange={(e) => {
                setFrom(e.target.value)
                if (!to || to < e.target.value) setTo(e.target.value)
              }}
            />
          </label>
          {priceWork ? (
            <label className="small">
              To
              <input className="input" type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} />
            </label>
          ) : null}
        </div>
        {priceWork ? (
          <label className="small">
            Approved by (required)
            <select className="input" value={approver} onChange={(e) => setApprover(e.target.value)}>
              <option value="">Choose an admin or manager</option>
              {approvers.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.name} ({row.level === 'admin' ? 'Admin' : 'Manager'})
                </option>
              ))}
            </select>
            <span className="muted">{PAYE_CLAIM_APPROVER_NOT_NOTIFIED_NOTE}</span>
          </label>
        ) : null}
        <label className="small">
          Amount ({currency})
          <input className="input" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={formatMoney(0, currency)} />
        </label>
        <div className="stack" style={{ gap: 6 }}>
          <b className="small">Evidence {priceWork ? '(optional)' : '(at least one)'}</b>
          {evidence.map((entry) => (
            <div key={entry.key} className="small" style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <span>{entry.label}</span>
              <button type="button" className="link" style={{ border: 0, background: 'none' }} onClick={() => setEvidence((current) => current.filter((row) => row.key !== entry.key))}>
                Remove
              </button>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <label className="btn sm">
              File
              <input type="file" accept="application/pdf,image/*" className="sr-only" multiple onChange={(e) => { void addFiles(e.target.files, false); e.target.value = '' }} />
            </label>
            <label className="btn sm">
              Photo
              <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => { void addFiles(e.target.files, true); e.target.value = '' }} />
            </label>
            <button type="button" className="btn sm" onClick={() => setPickAudit(true)}>
              Personal site audit
            </button>
          </div>
        </div>
        {pickAudit ? <PersonalAuditPicker organizationId={organizationId} ownerId={subject.id} timeZone={props.timeZone} onPick={addAudit} onCancel={() => setPickAudit(false)} /> : null}
        {error || (draftError && (title || amount)) ? <p className="small" style={{ color: 'var(--red)' }}>{error || draftError}</p> : null}
        <button type="submit" className="btn primary" disabled={Boolean(draftError) || saving}>
          {saving ? 'Adding…' : label}
        </button>
      </form>
    </div>
  )
}

/** The person's own personal site audits (owner only), to attach a frozen copy. */
function PersonalAuditPicker({ organizationId, ownerId, timeZone, onPick, onCancel }: { organizationId: string; ownerId: string; timeZone: string; onPick: (audit: PersonalSiteAudit) => void; onCancel: () => void }) {
  const [audits, setAudits] = useState<PersonalSiteAudit[] | null>(null)
  useEffect(() => listenPersonalSiteAudits(organizationId, ownerId, timeZone, setAudits, () => setAudits([])), [organizationId, ownerId, timeZone])
  const rows = personalSiteAuditsFor(audits, ownerId)
  return (
    <div className="card pad stack" style={{ gap: 6 }}>
      <b className="small">Choose a personal site audit</b>
      {audits == null ? <p className="muted small">Loading…</p> : null}
      {audits != null && rows.length === 0 ? <p className="muted small">You have no personal site audits. Create one in Site audits → Personal.</p> : null}
      {rows.map((audit) => (
        <button key={audit.id} type="button" className="btn sm" style={{ textAlign: 'left' }} onClick={() => onPick(audit)}>
          {personalSiteAuditTitle(audit)}
        </button>
      ))}
      <p className="muted small">A frozen copy (PDF) is attached; your line managers and admins see the copy, never your list.</p>
      <button type="button" className="btn sm ghost" onClick={onCancel}>
        Close
      </button>
    </div>
  )
}
