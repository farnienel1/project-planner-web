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
  canReviewPayeClaims,
  OVERTIME_APPROVE_LABEL,
  overtimePersonIds,
  payeClaimReviewOutcomeLabel,
  payeClaimReviewState,
  payeClaimReviewWrites,
  type PayeClaimReviewDecision,
  type PayeClaimReviewRecord,
  canWritePayeClaim,
  canEditPayeClaim,
  claimEvidenceCountText,
  EXPENSE_AMOUNT_LABEL,
  PRICE_WORK_AMOUNT_LABEL,
  PAYE_CLAIM_DELETE_CONFIRM_MESSAGE,
  PAYE_CLAIM_DELETE_LABEL,
  PAYE_CLAIM_EDIT_LABEL,
  PAYE_CLAIM_EDIT_REVIEW_NOTE,
  PAYE_CLAIM_SAVE_CHANGES_LABEL,
  payeClaimEditDraft,
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
  priceWorkApproverCandidates,
  priceWorkJobNumberText,
  PRICE_WORK_JOB_NUMBER_MAX,
  priceWorkValidationError,
  timesheetClaimRows,
  type PayeClaimEvidence,
  type PayeClaimItem,
  type PayeClaimKind,
  type PayeClaimReportSnapshot,
  type TimesheetClaimRow,
} from '@/lib/canonical'
import { useOrganizationCurrency } from '@/lib/stores/organizationDocumentStore'
import { rulebookPerson, rulebookRoster } from '@/lib/staff/rulebookPeople'
import {
  addExpense,
  addPriceWork,
  discardClaimEvidence,
  listenPayeClaimReports,
  listenPayeClaimReviews,
  listenPersonPayeClaims,
  savePayeClaimReviews,
  loadTimesheetClaimSheets,
  removePayeClaim,
  savePayeClaimReport,
  storedFileBytes,
  updatePayeClaim,
} from '@/lib/payeClaims/payeClaimsData'
import { ClaimEvidencePicker, EvidenceLinks, placeholderEvidence, resolveEvidenceSlots, slotsFromEvidence, type EvidenceSlot } from '@/components/claims/ClaimEvidencePicker'
import { CustomRangeForm, ListTile, NavBar, Tile, isPaye, orgLogo, overtimeHref, personName } from '@/components/overtime/overtimeUi'
import { Card, EmptyState, Note, PageShell } from '@/components/ui/page'
import type { User } from '@/types'

import { downloadPdf } from '@/lib/pdf/downloadPdf'
import { loadExportModule } from '@/lib/pdf/loadExportModule'

// The PDF builders (pdf-lib) load only when a PDF is made.
const buildPayeClaimReportPdf: typeof import('@/lib/payeClaims/payeClaimReportPdf').buildPayeClaimReportPdf = (...args) =>
  loadExportModule(() => import('@/lib/payeClaims/payeClaimReportPdf')).then((module) => module.buildPayeClaimReportPdf(...args))

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

  if (!allowed) return <Note tone="info">You cannot see this person&apos;s {title.toLowerCase()}.</Note>

  if (!range) {
    return (
      <PageShell>
        <NavBar
          title={title}
          back={props.sectionBack}
          subtitle={selfEmployed ? `${personName(subject)} is self-employed: these are the entries on their timesheets, read-only.` : undefined}
        >
          <Note tone="dark">{!props.orgLoaded ? 'Loading…' : current ? payePayrunLabel(current) : PAYE_PAYDAY_NOT_SET_MESSAGE}</Note>
        </NavBar>
        <div className="pu-gridAuto">
          <Tile tone="blue" title="Current PAYE payrun" disabled={!current} onClick={() => router.push(overtimeHref({ ...here, range: 'current' }))} />
          <Tile tone="slate" title="Past PAYE payruns" disabled={!current && payePastPayruns(orgDoc, todayKey).length === 0} onClick={() => router.push(overtimeHref({ ...here, range: 'past' }))} />
          <Tile tone="purple" title="Custom date range" onClick={() => router.push(overtimeHref({ ...here, range: 'custom' }))} />
          {mine && !selfEmployed ? (
            <Tile tone="green" title={kind === 'priceWork' ? PRICE_WORK_ADD_LABEL : EXPENSE_ADD_LABEL} subtitle="Online only" onClick={() => router.push(overtimeHref({ ...here, range: 'current', add: '1' }))} disabled={!current} />
          ) : null}
        </div>
        {mine && !selfEmployed && !current ? (
          <Note tone="info">Open Custom date range to add {kind === 'priceWork' ? 'price work' : 'an expense'} until the PAYE payday is set.</Note>
        ) : null}
      </PageShell>
    )
  }

  if (range === 'past' && !(start && end)) {
    const past = payePastPayruns(orgDoc, todayKey)
    return (
      <PageShell>
        <NavBar title="Past PAYE payruns" back={{ label: title, href: sectionHref }} />
        {past.length === 0 ? <Note tone="info">{current ? 'No past PAYE payruns yet.' : PAYE_PAYDAY_NOT_SET_MESSAGE}</Note> : null}
        {past.length > 0 ? (
          <Card>
            <div className="pu-list">
              {past.map((run) => (
                <ListTile
                  key={run.start}
                  title={`${formatPayePayrunDay(run.start)} – ${formatPayePayrunDay(run.end)}`}
                  subtitle={`Paid ${formatPayePayrunDay(run.payDate)}`}
                  onClick={() => router.push(overtimeHref({ ...here, range: 'past', start: run.start, end: run.end }))}
                />
              ))}
            </div>
          </Card>
        ) : null}
        {!selfEmployed ? <SavedClaimReports kind={kind} organizationId={props.organizationId} subjectId={subject.id} logoUrl={orgLogo(orgDoc)} /> : null}
      </PageShell>
    )
  }

  if (range === 'custom' && !(start && end)) {
    return (
      <PageShell>
        <NavBar title="Custom date range" back={{ label: title, href: sectionHref }} />
        <CustomRangeForm onView={(a, b) => router.push(overtimeHref({ ...here, range: 'custom', start: a, end: b }))} />
      </PageShell>
    )
  }

  const window = range === 'current' ? (current ? { start: current.start, end: current.end } : null) : payeCustomRange(start, end)
  if (!window) {
    return (
      <PageShell>
        <NavBar title={title} back={{ label: title, href: sectionHref }} />
        <Note tone="amber">{PAYE_PAYDAY_NOT_SET_MESSAGE}</Note>
      </PageShell>
    )
  }
  const back = range === 'past' ? { label: 'Past PAYE payruns', href: overtimeHref({ ...here, range: 'past' }) } : { label: title, href: sectionHref }
  const heading = `${title} · ${formatPayePayrunDay(window.start)} – ${formatPayePayrunDay(window.end)}`
  if (selfEmployed) {
    return (
      <PageShell>
        <NavBar title={heading} back={back} />
        <TimesheetClaims kind={kind} organizationId={props.organizationId} subject={subject} users={props.users} timeZone={props.timeZone} range={window} />
      </PageShell>
    )
  }
  return (
    <PageShell>
      <NavBar title={heading} back={back} />
      <ClaimList {...props} range={window} />
    </PageShell>
  )
}

/** Read-only list of a self-employed person's timesheet entries in the range. */
function TimesheetClaims({ kind, organizationId, subject, users, timeZone, range }: { kind: PayeClaimKind; organizationId: string; subject: User; users: User[]; timeZone: string; range: { start: string; end: string } }) {
  const currency = useOrganizationCurrency()
  // Rulebook 1.45.0 (guardrail 1): every id the person goes by, so sheets filed under an older id — and their
  // evidence — show here too (`overtimePersonIds`, the same ids the PAYE lists read).
  const personIds = useMemo(() => overtimePersonIds({ person: rulebookPerson(subject, users), roster: rulebookRoster(users) }), [subject, users])
  const idsKey = personIds.join('|')
  const [rows, setRows] = useState<TimesheetClaimRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    let live = true
    loadTimesheetClaimSheets(organizationId, personIds.length > 0 ? personIds : [subject.id], timeZone)
      .then((sheets) => live && setRows(timesheetClaimRows(sheets, kind, range)))
      .catch((e: unknown) => live && setError(e instanceof Error ? e.message : 'Their timesheets could not be read.'))
    return () => {
      live = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId, idsKey, timeZone, kind, range])
  if (error) return <Note tone="red">{error}</Note>
  if (!rows) return <Note tone="info">Loading…</Note>
  if (rows.length === 0)
    return (
      <Card>
        <EmptyState title={kind === 'priceWork' ? PRICE_WORK_EMPTY_MESSAGE : EXPENSES_EMPTY_MESSAGE} />
      </Card>
    )
  return (
    <Card>
      <div className="pu-list">
      {rows.map((row) => (
        <div key={`${row.sheetId}-${row.id}`} className="pu-item" style={{ alignItems: 'flex-start' }}>
          <span className="grow">
            <b>{row.title}</b>
          <span className="pu-sub">
            {[row.startDate === row.endDate ? formatPayePayrunDay(row.startDate) : `${formatPayePayrunDay(row.startDate)} – ${formatPayePayrunDay(row.endDate)}`, kind === 'priceWork' ? priceWorkJobNumberText(row.jobNumber) : row.jobNumber, row.approvedByName ? `Agreed by ${row.approvedByName}` : '', `Timesheet: ${row.managerDecision}`]
              .filter(Boolean)
              .join(' · ')}
          </span>
          {row.details ? <span className="pu-sub">{row.details}</span> : null}
          <EvidenceLinks evidence={row.evidence} />
          </span>
          <b>{formatMoney(row.amount, currency)}</b>
        </div>
      ))}
      </div>
      <div className="pu-totals">
        <span>
          <b>Total {formatMoney(payeClaimsTotal(rows), currency)}</b> · read-only, from their timesheets
        </span>
      </div>
    </Card>
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
  const [editing, setEditing] = useState<PayeClaimItem | null>(null)
  const [open, setOpen] = useState<PayeClaimItem | null>(null)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('add') === '1' && mine) setAdding(true)
  }, [mine])
  // Rulebook 1.32.0 §26: every record of this person (`overtimePersonIds`), and the review state of each item.
  const roster = useMemo(() => rulebookRoster(props.users), [props.users])
  const subjectPerson = useMemo(() => rulebookPerson(subject, props.users), [subject, props.users])
  const viewerPerson = useMemo(() => rulebookPerson(props.users.find((row) => row.id === props.viewerUser.id) || props.viewerUser, props.users), [props.users, props.viewerUser])
  const personIds = useMemo(() => overtimePersonIds({ person: subjectPerson, roster }), [subjectPerson, roster])
  const idsKey = personIds.join('|')
  const [reviews, setReviews] = useState<PayeClaimReviewRecord[]>([])
  const [decisions, setDecisions] = useState<Record<string, PayeClaimReviewDecision>>({})
  const reviewer = !mine && canReviewPayeClaims(viewerPerson, subjectPerson, roster)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => listenPayeClaimReviews(organizationId, personIds, setReviews), [organizationId, idsKey])
  useEffect(
    () =>
      listenPersonPayeClaims(
        organizationId,
        personIds,
        kind,
        props.timeZone,
        (rows) => {
          setItems(rows)
          setLoaded(true)
        },
        (e) => setError(e.message)
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [organizationId, idsKey, kind, props.timeZone]
  )
  const inRange = payeClaimsInRange(items, range)
  const preview = payeClaimReviewWrites({
    items: inRange,
    decisions,
    reviews,
    subjectUserId: subject.id,
    personIds,
    reviewerId: props.viewerUser.id,
  })
  const approve = async () => {
    setBusy(true)
    setNotice(null)
    try {
      await savePayeClaimReviews(organizationId, preview.writes)
      setDecisions({})
      setNotice(preview.message)
    } catch (e: unknown) {
      setNotice(e instanceof Error ? e.message : 'The review could not be saved.')
    } finally {
      setBusy(false)
    }
  }
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
      {error ? <p className="pu-muted">{error}</p> : null}
      {!loaded && !error ? <p className="pu-muted">Loading…</p> : null}
      {loaded && inRange.length === 0 ? <p className="pu-muted">{kind === 'priceWork' ? PRICE_WORK_EMPTY_MESSAGE : EXPENSES_EMPTY_MESSAGE}</p> : null}
      {inRange.map((item) => {
        const row = payeClaimListRow(item, currency)
        const state = payeClaimReviewState(item, reviews)
        const decision = decisions[item.id]
        const outcomeLabel = decision ? payeClaimReviewOutcomeLabel(preview.outcomes[item.id]) : null
        return (
          <div key={item.id} className="pu-card pu-pad" style={{ textAlign: 'left' }}>
          <button type="button" className="click" style={{ border: 0, background: 'none', padding: 0, textAlign: 'left', width: '100%' }} onClick={() => setOpen(item)}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <b>{row.title}</b>
              <b>{row.figure}</b>
            </div>
            <div className="pu-sub">
              {row.subtitle}
              {item.evidence.length > 0 ? ` · ${claimEvidenceCountText(item.evidence.length)}` : ''}
            </div>
          </button>
          <div className="row" style={{ marginTop: 8, gap: 8, flexWrap: 'wrap' }}>
            <span className="pill" data-hue={state.state === 'approved' ? 'green' : state.state === 'rejected' ? 'red' : 'warn'}>{state.label}</span>
            {decision ? <span className="pill">{decision === 'approved' ? 'Ticked' : 'Crossed'} (not saved)</span> : null}
            {outcomeLabel ? <span className="pill" data-hue="warn">{outcomeLabel}</span> : null}
            {reviewer ? (
              <span className="row" style={{ gap: 6, marginLeft: 'auto' }}>
                <button type="button" className="pu-btn sm" aria-label="Reject this item" disabled={busy} onClick={() => setDecisions((d) => ({ ...d, [item.id]: 'rejected' }))}>
                  ✕
                </button>
                <button type="button" className="pu-btn sm" aria-label="Approve this item" disabled={busy} onClick={() => setDecisions((d) => ({ ...d, [item.id]: 'approved' }))}>
                  ✓
                </button>
              </span>
            ) : null}
          </div>
          </div>
        )
      })}
      {inRange.length > 0 ? (
        <p className="small">
          <b>Total {formatMoney(payeClaimsTotal(inRange), currency)}</b>
        </p>
      ) : null}
      {!mine ? <p className="pu-sub">{personName(subject)} adds these themselves.{reviewer ? ' Tick or cross each item, then Approve.' : ''}</p> : null}
      {reviewer && inRange.length > 0 ? (
        <button type="button" className="pu-btn primary" disabled={busy || preview.writes.length === 0} onClick={() => void approve()}>
          {OVERTIME_APPROVE_LABEL}
        </button>
      ) : null}
      <div className="stack" style={{ gap: 8 }}>
        {writable ? (
          <button type="button" className="pu-btn" onClick={() => setAdding(true)}>
            {kind === 'priceWork' ? PRICE_WORK_ADD_LABEL : EXPENSE_ADD_LABEL}
          </button>
        ) : null}
        {mine ? (
          <button
            type="button"
            className="pu-btn primary"
            style={ready ? { background: 'var(--green, #16a34a)' } : undefined}
            disabled={!ready || busy}
            onClick={() => void generate()}
          >
            {busy ? 'Making report…' : kind === 'priceWork' ? PRICE_WORK_GENERATE_REPORT_LABEL : EXPENSES_GENERATE_REPORT_LABEL}
          </button>
        ) : null}
        {notice ? <p className="pu-sub">{notice}</p> : null}
      </div>
      {adding || editing ? (
        <ClaimSheet
          kind={kind}
          editing={editing}
          reviewed={editing ? payeClaimReviewState(editing, reviews).state !== 'needsReview' : false}
          organizationId={organizationId}
          subject={subject}
          users={props.users}
          timeZone={props.timeZone}
          defaultDay={props.todayKey >= range.start && props.todayKey <= range.end ? props.todayKey : range.start}
          currency={currency}
          onClose={() => {
            setAdding(false)
            setEditing(null)
            const params = new URLSearchParams(window.location.search)
            if (params.get('add')) router.replace(overtimeHref({ ...here, range: params.get('range'), start: params.get('start'), end: params.get('end') }))
          }}
        />
      ) : null}
      {open ? (
        <ClaimDetail
          item={open}
          currency={currency}
          canEdit={mine && canEditPayeClaim(props.viewerUser.id, open)}
          organizationId={organizationId}
          onEdit={() => {
            setEditing(open)
            setOpen(null)
          }}
          onClose={() => setOpen(null)}
        />
      ) : null}
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
      <p className="pu-label">Saved reports</p>
      {rows.map((report) => (
        <Tile
          key={report.id}
          title={`${formatPayePayrunDay(report.rangeStart)} – ${formatPayePayrunDay(report.rangeEnd)} · ${formatMoney(report.totals.amount, report.currency)}`}
          subtitle={`${report.totals.itemCount} item(s)${report.generatedAtMs ? ` · made ${new Date(report.generatedAtMs).toLocaleDateString('en-GB')}` : ''} · download again`}
          onClick={() => void downloadClaimReport(report, logoUrl, setNotice).catch((e: unknown) => setNotice(e instanceof Error ? e.message : 'The report could not be made.'))}
        />
      ))}
      {notice ? <p className="pu-sub">{notice}</p> : null}
    </div>
  )
}

function ClaimDetail({
  item,
  currency,
  canEdit,
  organizationId,
  onEdit,
  onClose,
}: {
  item: PayeClaimItem
  currency: string
  canEdit: boolean
  organizationId: string
  onEdit: () => void
  onClose: () => void
}) {
  const row = payeClaimListRow(item, currency)
  const [error, setError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 p-4 sm:items-center" role="dialog" aria-label={row.title}>
      <div className="pu-card pu-pad stack w-full max-w-lg" style={{ gap: 10, maxHeight: '90vh', overflowY: 'auto' }}>
        <button type="button" className="pu-btn sm" style={{ alignSelf: 'flex-start' }} onClick={onClose}>
          Close
        </button>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <b>{row.title}</b>
          <b>{row.figure}</b>
        </div>
        <div className="pu-sub">{row.subtitle}</div>
        {item.details ? <p className="small">{item.details}</p> : null}
        <p className="pu-label">Evidence</p>
        {item.evidence.length === 0 ? <p className="pu-sub">None</p> : <EvidenceLinks evidence={item.evidence} />}
        {canEdit ? (
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className="pu-btn sm" onClick={onEdit}>
              {PAYE_CLAIM_EDIT_LABEL}
            </button>
            {confirming ? (
              <>
                <span className="pu-sub" style={{ flexBasis: '100%' }}>
                  {PAYE_CLAIM_DELETE_CONFIRM_MESSAGE}
                </span>
                <button type="button" className="pu-btn sm" onClick={() => setConfirming(false)}>
                  Keep it
                </button>
                <button
                  type="button"
                  className="pu-btn sm"
                  style={{ color: 'var(--red)' }}
                  onClick={() =>
                    void removePayeClaim(organizationId, item)
                      .then(onClose)
                      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Could not delete it.'))
                  }
                >
                  {PAYE_CLAIM_DELETE_LABEL}
                </button>
              </>
            ) : (
              <button type="button" className="pu-btn sm" style={{ color: 'var(--red)' }} onClick={() => setConfirming(true)}>
                {PAYE_CLAIM_DELETE_LABEL}
              </button>
            )}
          </div>
        ) : null}
        {error ? <p className="pu-sub">{error}</p> : null}
      </div>
    </div>
  )
}

/**
 * Add Price Work / Add Expense, and (1.45.0) the same sheet to edit a saved item: Cancel at the top, the add or Save
 * changes button at the bottom. Evidence through the shared `ClaimEvidencePicker` (Add photo / Add site audit / Add
 * file).
 */
function ClaimSheet(props: {
  kind: PayeClaimKind
  editing: PayeClaimItem | null
  /** The item being edited has a review: saving sends it back to Needs review. */
  reviewed: boolean
  organizationId: string
  subject: User
  users: User[]
  timeZone: string
  defaultDay: string
  currency: string
  onClose: () => void
}) {
  const { kind, organizationId, subject, users, currency, editing } = props
  const priceWork = kind === 'priceWork'
  const start = editing ? payeClaimEditDraft(editing) : null
  const [title, setTitle] = useState(String(start?.title ?? ''))
  const [details, setDetails] = useState(String(start?.details ?? ''))
  const [jobNumber, setJobNumber] = useState(String(start?.jobNumber ?? ''))
  const [from, setFrom] = useState(String((priceWork ? start?.startDate : start?.date) ?? props.defaultDay))
  const [to, setTo] = useState(String(start?.endDate ?? props.defaultDay))
  const [approver, setApprover] = useState(String(start?.approvedByUserId ?? ''))
  const [amount, setAmount] = useState(start?.amount != null ? String(start.amount) : '')
  const [evidence, setEvidence] = useState<EvidenceSlot[]>(() => slotsFromEvidence(editing?.evidence))
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  // The approver's users document must name this organisation (the rules check it): read each person's home company.
  const approverRoster = useMemo(() => users.map((row) => ({ ...row, organizationId: row.homeOrganizationId || row.organizationId })), [users])
  const approvers = useMemo(() => priceWorkApproverCandidates(subject as never, approverRoster as never, { organizationId }), [subject, approverRoster, organizationId])

  // Shape checks before upload: the rulebook validators with placeholder evidence (paths are checked again on save).
  const placeholder = placeholderEvidence(evidence)
  const draftError = priceWork
    ? priceWorkValidationError({ title, details, jobNumber, startDate: from, endDate: to, approvedByUserId: approver, amount }, { person: subject as never, roster: approverRoster as never, organizationId })
    : expenseValidationError({ title, details, jobNumber, date: from, amount, evidence: placeholder })

  const submit = async () => {
    if (draftError || saving) return
    setSaving(true)
    setError(null)
    const uploaded: PayeClaimEvidence[] = []
    try {
      const list = await resolveEvidenceSlots(evidence, uploaded)
      if (editing) {
        await updatePayeClaim({
          organizationId,
          item: editing,
          person: subject as never,
          roster: approverRoster as never,
          draft: priceWork
            ? { title, details, jobNumber, startDate: from, endDate: to, approvedByUserId: approver, amount, evidence: list }
            : { title, details, jobNumber, date: from, amount, evidence: list },
        })
      } else if (priceWork) {
        await addPriceWork({
          organizationId,
          person: subject as never,
          roster: approverRoster as never,
          currency,
          draft: { title, details, jobNumber, startDate: from, endDate: to, approvedByUserId: approver, amount, evidence: list },
        })
      } else {
        await addExpense({ organizationId, currency, draft: { title, details, jobNumber, date: from, amount, evidence: list } })
      }
      props.onClose()
    } catch (e: unknown) {
      // 1.30.0 review: a refused or failed save leaves no new copy behind where line managers and admins could read it.
      await discardClaimEvidence(organizationId, uploaded)
      setError(e instanceof Error ? e.message : 'It could not be saved.')
    } finally {
      setSaving(false)
    }
  }

  const label = editing ? PAYE_CLAIM_SAVE_CHANGES_LABEL : priceWork ? PRICE_WORK_ADD_LABEL : EXPENSE_ADD_LABEL
  const heading = editing ? (priceWork ? 'Edit Price Work' : 'Edit Expense') : priceWork ? PRICE_WORK_ADD_LABEL : EXPENSE_ADD_LABEL
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 p-4 sm:items-center" role="dialog" aria-label={heading}>
      <form
        className="pu-card pu-pad stack w-full max-w-lg"
        style={{ gap: 12, maxHeight: '92vh', overflowY: 'auto' }}
        onSubmit={(event) => {
          event.preventDefault()
          void submit()
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button type="button" className="pu-btn sm" onClick={props.onClose}>
            Cancel
          </button>
          <b>{heading}</b>
          <span style={{ width: 60 }} />
        </div>
        <label className="small">
          {priceWork ? 'Price work name' : 'Expense name'}
          <input className="pu-inp" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />
        </label>
        <label className="small">
          Description
          <textarea className="pu-inp" value={details} onChange={(e) => setDetails(e.target.value)} rows={3} maxLength={4000} />
        </label>
        <label className="small">
          {priceWork ? 'Job number (required)' : 'Job number'}
          <input className="pu-inp" value={jobNumber} onChange={(e) => setJobNumber(e.target.value)} maxLength={PRICE_WORK_JOB_NUMBER_MAX} required={priceWork} />
        </label>
        <div className="pu-gridAuto" style={{ gap: 8 }}>
          <label className="small">
            {priceWork ? 'From' : 'Date'}
            <input
              className="pu-inp"
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
              <input className="pu-inp" type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} />
            </label>
          ) : null}
        </div>
        {priceWork ? (
          <label className="small">
            Approved by (required)
            <select className="pu-inp" value={approver} onChange={(e) => setApprover(e.target.value)}>
              <option value="">Choose an admin or manager</option>
              {approvers.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.name} ({row.level === 'admin' ? 'Admin' : 'Manager'})
                </option>
              ))}
            </select>
            <span className="pu-muted">{PAYE_CLAIM_APPROVER_NOT_NOTIFIED_NOTE}</span>
          </label>
        ) : null}
        <label className="small">
          {priceWork ? PRICE_WORK_AMOUNT_LABEL : EXPENSE_AMOUNT_LABEL} ({currency})
          <input className="pu-inp" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={formatMoney(0, currency)} />
        </label>
        <ClaimEvidencePicker
          organizationId={organizationId}
          ownerId={subject.id}
          timeZone={props.timeZone}
          slots={evidence}
          onChange={setEvidence}
          required={!priceWork}
          disabled={saving}
          onError={setError}
        />
        {error || (draftError && (title || amount)) ? <p className="small" style={{ color: 'var(--red)' }}>{error || draftError}</p> : null}
        {editing && props.reviewed ? <p className="pu-sub">{PAYE_CLAIM_EDIT_REVIEW_NOTE}</p> : null}
        <button type="submit" className="pu-btn primary" disabled={Boolean(draftError) || saving}>
          {saving ? 'Saving…' : label}
        </button>
      </form>
    </div>
  )
}
