'use client'

/**
 * Rulebook 1.29.0 §25: Timesheets → Overtime, Expenses & Price Work. Every figure, state, permission and write shape
 * comes from `@/lib/canonical` (payeOvertime.ts, payePayrun.ts); this screen only passes inputs and shows results.
 *
 * Routes (one path, query params): `scope` mine | users; `user` (Users'); `section` overtime | expenses | priceWork;
 * `range` current | past | custom; `start` / `end` day keys.
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import {
  OVERTIME_APPROVE_REQUEST_LABEL,
  OVERTIME_BOOKING_UNREADABLE_MESSAGE,
  OVERTIME_NOT_THEIR_BOOKING_MESSAGE,
  canWriteBooking,
  isAdminOutsideOperativeMode,
  overtimeApprovalWrites,
  overtimeBookingIsTheirs,
  OVERTIME_CANCEL_WARNING,
  OVERTIME_GENERATE_REPORT_LABEL,
  OVERTIME_HUB_LABEL,
  OVERTIME_MINE_LABEL,
  OVERTIME_MULTIPLIER_STEPS,
  OVERTIME_NO_LINES_MESSAGE,
  OVERTIME_SEND_FOR_APPROVAL_LABEL,
  OVERTIME_USERS_LABEL,
  PAYE_PAYDAY_NOT_SET_MESSAGE,
  canDecideOvertimeRequest,
  canEditOwnBookingOvertime,
  canGenerateOvertimeReport,
  formatPayePayrunDay,
  organizationOvertimeMultiplier,
  overtimeCogPreview,
  overtimeHubAccess,
  overtimeLinesTotal,
  overtimeRequestFullyDecided,
  overtimeRequestLineFields,
  overtimeStrikeOutcome,
  overtimeUserSubjects,
  payeCustomRange,
  payePastPayruns,
  payePayrunPeriod,
  payeOvertimeLines,
  payePayrunLabel,
  parseOvertimeReportDocument,
  personIdSet,
  type OvertimeBookingInput,
  type OvertimeDecision,
  type OvertimeLine,
  type OvertimeRequestLine,
  type OvertimeRequestRecord,
  type OvertimeReviewRecord,
} from '@/lib/canonical'
import { bookingIdsForAccount } from '@/lib/canonical'
import { useAuthStore } from '@/lib/stores/authStore'
import { useOrgUserStore } from '@/lib/stores/siteAuditStore'
import { useOperativeStore } from '@/lib/stores/operativeStore'
import { useProjectStore } from '@/lib/stores/projectStore'
import { useOrganizationDocument, useOrganizationTimeZone } from '@/lib/stores/organizationDocumentStore'
import { dayKeyInZone } from '@/lib/orgTime/zoneTime'
import { webJobAccessViewer } from '@/lib/access/readPlan'
import { rulebookPerson, rulebookRoster } from '@/lib/staff/rulebookPeople'
import { timesheetsTeamHref, TIMESHEETS_HUB_PATH } from '@/lib/timesheets/timesheetRoutes'
import {
  OvertimeApprovalRefused,
  applyDirectOvertime,
  approveOvertimeRequest,
  listenOvertimeReports,
  listenOvertimeRequests,
  listenOvertimeReviews,
  listenPersonOvertimeBookings,
  saveOvertimeReport,
  sendOvertimeRequest,
  withdrawOvertimeRequest,
} from '@/lib/overtime/overtimeData'
import { buildOvertimeReportPdf, downloadPdf } from '@/lib/overtime/overtimeReportPdf'
import { Modal } from '@/components/ui'
import { CustomRangeForm, NavBar, OVERTIME_PATH, Tile, isPaye, orgLogo, overtimeHref, personName } from '@/components/overtime/overtimeUi'
import { PayeClaimsSection } from '@/components/overtime/PayeClaimsScreen'

export { OVERTIME_PATH, overtimeHref }
import type { Project, User } from '@/types'

export function OvertimeScreen() {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const scope = params.get('scope')
  const userParam = params.get('user')
  const section = params.get('section')
  const range = params.get('range')
  const start = params.get('start')
  const end = params.get('end')
  const { user, organization } = useAuthStore()
  const { users, loadUsers } = useOrgUserStore()
  const { operatives, managers, loadOperatives } = useOperativeStore()
  const { projects, smallWorks, loadProjects, loadSmallWorks } = useProjectStore()
  const { data: orgDoc, loaded: orgLoaded } = useOrganizationDocument()
  const timeZone = useOrganizationTimeZone()
  const todayKey = dayKeyInZone(new Date(), timeZone)

  useEffect(() => {
    if (!organization?.id) return
    loadUsers(organization.id)
    loadOperatives(organization.id)
    loadProjects(organization.id)
    loadSmallWorks(organization.id)
  }, [organization?.id, loadUsers, loadOperatives, loadProjects, loadSmallWorks])

  const roster = useMemo(() => rulebookRoster(users), [users])
  const viewer = useMemo(() => (user ? rulebookPerson(users.find((row) => row.id === user.id) || user, users) : null), [user, users])
  const access = overtimeHubAccess({ viewer, roster })
  const subjectIds = useMemo(() => (viewer ? overtimeUserSubjects(viewer, roster) : []), [viewer, roster])

  if (!user || !organization) return null
  const here = { scope, user: userParam, section, range }

  if (!scope) {
    return (
      <div className="stack" data-hue="ts">
        <NavBar title={OVERTIME_HUB_LABEL} back={{ label: 'Timesheets', href: TIMESHEETS_HUB_PATH }} />
        {!access.showButton ? <p className="muted">This section is for PAYE staff, admins and line managers.</p> : null}
        <div className="grid g2">
          {access.mine ? <Tile title={OVERTIME_MINE_LABEL} subtitle="Your overtime, expenses and price work as PAYE." onClick={() => router.push(overtimeHref({ scope: 'mine' }))} /> : null}
          {access.users ? (
            <Tile
              title={OVERTIME_USERS_LABEL}
              subtitle={access.mine ? 'The people you manage.' : 'Everyone you can see. Read-only except approvals.'}
              onClick={() => router.push(overtimeHref({ scope: 'users' }))}
            />
          ) : null}
        </div>
      </div>
    )
  }

  const mine = scope === 'mine'
  if (!mine && !access.users) {
    return <p className="muted">Users&apos; overtime is for admins and line managers.</p>
  }
  if (mine && !access.mine) {
    return <p className="muted">My Overtime, Expenses &amp; Price Work is for PAYE staff.</p>
  }

  if (!mine && !userParam) {
    return (
      <div className="stack" data-hue="ts">
        <NavBar title={OVERTIME_USERS_LABEL} back={{ label: OVERTIME_HUB_LABEL, href: overtimeHref({}) }} />
        <UsersList users={users.filter((row) => subjectIds.includes(row.id))} onOpen={(id) => router.push(overtimeHref({ scope: 'users', user: id }))} />
      </div>
    )
  }

  const subject = mine ? users.find((row) => row.id === user.id) || user : users.find((row) => row.id === userParam)
  if (!subject || (!mine && !subjectIds.includes(subject.id))) {
    return <p className="muted">{users.length === 0 ? 'Loading…' : 'This person is not one you can see here.'}</p>
  }
  const baseTitle = mine ? OVERTIME_MINE_LABEL : personName(subject)
  const upHref = mine ? overtimeHref({}) : overtimeHref({ scope: 'users' })

  if (!section) {
    return (
      <div className="stack" data-hue="ts">
        <NavBar title={baseTitle} back={{ label: mine ? OVERTIME_HUB_LABEL : OVERTIME_USERS_LABEL, href: upHref }} />
        <div className="grid g2">
          <Tile title="Overtime" onClick={() => router.push(overtimeHref({ ...here, section: 'overtime' }))} />
          <Tile title="Expenses" onClick={() => router.push(overtimeHref({ ...here, section: 'expenses' }))} />
          <Tile title="Price work" onClick={() => router.push(overtimeHref({ ...here, section: 'priceWork' }))} />
        </div>
      </div>
    )
  }

  const sectionBack = { label: baseTitle, href: overtimeHref({ scope, user: userParam }) }
  if (section === 'expenses' || section === 'priceWork') {
    // Rulebook 1.30.0 §26: PAYE price work and expenses (self-employed: their timesheet entries, read-only).
    return (
      <PayeClaimsSection
        kind={section === 'expenses' ? 'expense' : 'priceWork'}
        mine={mine}
        subject={subject}
        viewerUser={user}
        users={users}
        organizationId={organization.id}
        orgDoc={orgDoc}
        orgLoaded={orgLoaded}
        companyName={String(orgDoc?.name ?? organization.name ?? '')}
        timeZone={timeZone}
        todayKey={todayKey}
        here={{ scope, user: userParam, section }}
        range={range}
        start={start}
        end={end}
        sectionBack={sectionBack}
      />
    )
  }
  if (section !== 'overtime') return <p className="muted">Unknown section.</p>

  if (!mine && !isPaye(subject)) {
    return (
      <div className="stack" data-hue="ts">
        <NavBar title="Overtime" back={sectionBack} />
        <div className="card pad">
          <p>
            {personName(subject)} is self-employed: their overtime is on their timesheet.{' '}
            <a className="link" href={timesheetsTeamHref({ user: subject.id })}>Open User Timesheets</a>
          </p>
        </div>
      </div>
    )
  }

  const overtimeBack = { label: 'Overtime', href: overtimeHref({ scope, user: userParam, section: 'overtime' }) }
  const current = payePayrunPeriod(orgDoc, todayKey)

  if (!range) {
    return (
      <div className="stack" data-hue="ts">
        <NavBar title="Overtime" back={sectionBack} />
        <p className="muted small">{!orgLoaded ? 'Loading…' : current ? payePayrunLabel(current) : PAYE_PAYDAY_NOT_SET_MESSAGE}</p>
        <div className="grid g2">
          <Tile title="Current PAYE payrun" disabled={!current} onClick={() => router.push(overtimeHref({ ...here, range: 'current' }))} />
          <Tile title="Past PAYE payruns" disabled={!current && payePastPayruns(orgDoc, todayKey).length === 0} onClick={() => router.push(overtimeHref({ ...here, range: 'past' }))} />
          <Tile title="Custom date range" onClick={() => router.push(overtimeHref({ ...here, range: 'custom' }))} />
        </div>
        <PendingRequests
          organizationId={organization.id}
          subjectId={subject.id}
          onOpen={(request) => router.push(overtimeHref({ ...here, range: 'custom', start: request.rangeStart, end: request.rangeEnd }))}
        />
      </div>
    )
  }

  if (range === 'past' && !(start && end)) {
    const past = payePastPayruns(orgDoc, todayKey)
    return (
      <div className="stack" data-hue="ts">
        <NavBar title="Past PAYE payruns" back={overtimeBack} />
        {past.length === 0 ? <p className="muted">{current ? 'No past PAYE payruns yet.' : PAYE_PAYDAY_NOT_SET_MESSAGE}</p> : null}
        <div className="stack" style={{ gap: 8 }}>
          {past.map((run) => (
            <Tile
              key={run.start}
              title={`${formatPayePayrunDay(run.start)} – ${formatPayePayrunDay(run.end)}`}
              subtitle={`Paid ${formatPayePayrunDay(run.payDate)}`}
              onClick={() => router.push(overtimeHref({ ...here, start: run.start, end: run.end }))}
            />
          ))}
        </div>
        <SavedReports organizationId={organization.id} subject={subject} logoUrl={orgLogo(orgDoc)} />
      </div>
    )
  }

  if (range === 'custom' && !(start && end)) {
    return (
      <div className="stack" data-hue="ts">
        <NavBar title="Custom date range" back={overtimeBack} />
        <CustomRangeForm onView={(a, b) => router.push(overtimeHref({ ...here, start: a, end: b }))} />
      </div>
    )
  }

  const window = range === 'current' ? (current ? { start: current.start, end: current.end } : null) : payeCustomRange(start, end)
  if (!window) {
    return (
      <div className="stack" data-hue="ts">
        <NavBar title="Overtime" back={overtimeBack} />
        <p className="muted">{PAYE_PAYDAY_NOT_SET_MESSAGE}</p>
      </div>
    )
  }

  return (
    <div className="stack" data-hue="ts" key={pathname}>
      <NavBar
        title={`Overtime · ${formatPayePayrunDay(window.start)} – ${formatPayePayrunDay(window.end)}`}
        back={range === 'past' ? { label: 'Past PAYE payruns', href: overtimeHref({ ...here, range: 'past' }) } : overtimeBack}
      />
      <OvertimeLines
        organizationId={organization.id}
        companyName={String(orgDoc?.name ?? organization.name ?? '')}
        logoUrl={orgLogo(orgDoc)}
        orgDoc={orgDoc}
        timeZone={timeZone}
        todayKey={todayKey}
        viewerUser={user}
        subject={subject}
        mode={mine ? 'mine' : 'review'}
        range={window}
        users={users}
        operatives={operatives}
        managers={managers}
        jobs={[...projects, ...smallWorks]}
      />
    </div>
  )
}

/** Pending overtime requests of the person, each opening its range (the request push lands here). */
function PendingRequests({ organizationId, subjectId, onOpen }: { organizationId: string; subjectId: string; onOpen: (request: OvertimeRequestRecord) => void }) {
  const [requests, setRequests] = useState<OvertimeRequestRecord[]>([])
  useEffect(() => listenOvertimeRequests(organizationId, subjectId, setRequests, () => setRequests([])), [organizationId, subjectId])
  const pending = requests.filter((row) => row.status === 'pending').sort((a, b) => (b.createdAtMs ?? 0) - (a.createdAtMs ?? 0))
  if (pending.length === 0) return null
  return (
    <div className="stack" style={{ gap: 8 }}>
      <p className="eyebrow">Waiting for approval</p>
      {pending.map((request) => (
        <Tile
          key={request.id}
          title={`Overtime request · ${formatPayePayrunDay(request.rangeStart)} – ${formatPayePayrunDay(request.rangeEnd)}`}
          subtitle={`${request.lines.length} line(s)`}
          onClick={() => onOpen(request)}
        />
      ))}
    </div>
  )
}

function UsersList({ users, onOpen }: { users: User[]; onOpen: (id: string) => void }) {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'paye' | 'self'>('all')
  const rows = users
    .filter((row) => (filter === 'all' ? true : filter === 'paye' ? isPaye(row) : !isPaye(row)))
    .filter((row) => personName(row).toLowerCase().includes(search.trim().toLowerCase()))
    .sort((a, b) => personName(a).localeCompare(personName(b)))
  return (
    <div className="stack" style={{ gap: 10 }}>
      <input className="input" placeholder="Search people" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search people" />
      <div className="seg">
        {(['all', 'paye', 'self'] as const).map((value) => (
          <button key={value} type="button" className={filter === value ? 'on' : ''} onClick={() => setFilter(value)}>
            {value === 'all' ? 'Everyone' : value === 'paye' ? 'PAYE' : 'Self-employed'}
          </button>
        ))}
      </div>
      {rows.length === 0 ? <p className="muted">Nobody to show.</p> : null}
      {rows.map((row) => (
        <Tile key={row.id} title={personName(row)} subtitle={isPaye(row) ? 'PAYE' : 'Self-employed'} onClick={() => onOpen(row.id)} />
      ))}
    </div>
  )
}

function SavedReports({ organizationId, subject, logoUrl }: { organizationId: string; subject: User; logoUrl: string | null }) {
  const [reports, setReports] = useState<Array<ReturnType<typeof parseOvertimeReportDocument>>>([])
  const [error, setError] = useState<string | null>(null)
  useEffect(() => listenOvertimeReports(organizationId, subject.id, setReports, (e) => setError(e.message)), [organizationId, subject.id])
  if (error) return <p className="muted small">Saved reports could not be loaded.</p>
  if (reports.length === 0) return null
  return (
    <div className="stack" style={{ gap: 8 }}>
      <p className="eyebrow">Saved overtime reports</p>
      {reports.map((report) => (
        <button
          key={report.id}
          type="button"
          className="card pad click"
          style={{ border: 0, textAlign: 'left' }}
          onClick={() => void buildOvertimeReportPdf(report, { logoUrl }).then((bytes) => downloadPdf(bytes, `overtime-${report.rangeStart}-${report.rangeEnd}.pdf`))}
        >
          <b>
            {formatPayePayrunDay(report.rangeStart)} – {formatPayePayrunDay(report.rangeEnd)}
          </b>
          <div className="muted small">
            {report.totals.overtimeHours}h overtime · {report.generatedAtMs ? new Date(report.generatedAtMs).toLocaleString('en-GB') : 'saving…'} · Download PDF
          </div>
        </button>
      ))}
    </div>
  )
}

type Proposal = { action: 'keep' } | { action: 'strike' } | { action: 'edit'; start: string; end: string; multiplier: number | null }

function OvertimeLines(props: {
  organizationId: string
  companyName: string
  logoUrl: string | null
  orgDoc: Record<string, unknown> | null
  timeZone: string
  todayKey: string
  viewerUser: User
  subject: User
  mode: 'mine' | 'review'
  range: { start: string; end: string }
  users: User[]
  operatives: ReturnType<typeof useOperativeStore.getState>['operatives']
  managers: ReturnType<typeof useOperativeStore.getState>['managers']
  jobs: Project[]
}) {
  const { organizationId, orgDoc, timeZone, subject, users, range } = props
  const organization = useMemo(() => orgDoc ?? {}, [orgDoc])
  const roster = useMemo(() => rulebookRoster(users), [users])
  const subjectPerson = useMemo(() => rulebookPerson(subject, users), [subject, users])
  const userIds = useMemo(() => personIdSet(subjectPerson, roster), [subjectPerson, roster])
  // Rulebook §10 `bookingIdsForAccount`: every id the person goes by, plus every operatives row on their email (not one).
  const operativeIds = useMemo(
    () => bookingIdsForAccount({ id: subject.id, email: subject.email, aliasIds: userIds }, props.operatives),
    [subject.id, subject.email, userIds, props.operatives]
  )
  const [bookings, setBookings] = useState<OvertimeBookingInput[]>([])
  const [reviews, setReviews] = useState<OvertimeReviewRecord[]>([])
  const [requests, setRequests] = useState<OvertimeRequestRecord[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [draft, setDraft] = useState<Record<string, Proposal>>({})
  const [decisions, setDecisions] = useState<Record<string, OvertimeDecision>>({})
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [cog, setCog] = useState<{ booking: OvertimeBookingInput; target: 'draft' | 'direct' | 'decision' } | null>(null)
  const [confirmCancel, setConfirmCancel] = useState<{ summary: string; run: () => void } | null>(null)

  const onError = (e: Error) => setLoadError(e.message)
  const idsKey = operativeIds.join('|')
  useEffect(
    () =>
      listenPersonOvertimeBookings({
        organizationId,
        operativeIds,
        // Manager site bookings belong to managers and admins; an operative has none (and may not query them).
        userIds: subjectPerson.operativeMode && !subjectPerson.isAdmin ? [] : userIds,
        timeZone,
        jobs: props.jobs,
        onChange: setBookings,
        onError,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [organizationId, idsKey, timeZone, props.jobs.length]
  )
  useEffect(() => listenOvertimeReviews(organizationId, subject.id, setReviews, onError), [organizationId, subject.id])
  useEffect(() => listenOvertimeRequests(organizationId, subject.id, setRequests, onError), [organizationId, subject.id])

  const lines = useMemo(
    () => payeOvertimeLines({ personIds: operativeIds, bookings, organization, timeZone, range, reviews, requests }),
    [operativeIds, bookings, organization, timeZone, range, reviews, requests]
  )
  const bookingById = useMemo(() => new Map(bookings.map((row) => [row.id.toLowerCase(), row])), [bookings])
  const pending = requests
    .filter((row) => row.status === 'pending' && row.rangeStart <= range.end && row.rangeEnd >= range.start)
    .sort((a, b) => (b.createdAtMs ?? 0) - (a.createdAtMs ?? 0))
  const viewerAccess = webJobAccessViewer(props.viewerUser)
  const jobFor = (id: string | null) => props.jobs.find((job) => id && job.id.toLowerCase() === id.toLowerCase()) ?? null

  const editMode = (line: OvertimeLine) => {
    if (props.mode !== 'mine' || line.state === 'cancelled') return 'none' as const
    const job = jobFor(line.jobId)
    return canEditOwnBookingOvertime({
      viewer: viewerAccess,
      isPaye: true,
      booking:
        line.collection === 'managerSiteBookings'
          ? { collection: 'managerSiteBookings', userId: subject.id, locationType: line.jobId ? 'project' : 'office', locationId: line.jobId, dayKey: line.dayKey }
          : { collection: 'bookings', projectId: line.jobId, dayKey: line.dayKey },
      job: job as unknown as Record<string, unknown> | null,
      managers: props.managers as never,
      todayKey: props.todayKey,
    })
  }
  const anyRequestLines = lines.some((line) => editMode(line) === 'request')

  const run = async (work: () => Promise<void>) => {
    setBusy(true)
    setMessage(null)
    try {
      await work()
    } catch (e) {
      setMessage(e instanceof OvertimeApprovalRefused || e instanceof Error ? e.message : 'Something went wrong.')
    } finally {
      setBusy(false)
    }
  }

  const direct = (booking: OvertimeBookingInput, action: OvertimeDecision) =>
    run(async () => {
      const ok = await applyDirectOvertime({ organizationId, booking, action, organization, timeZone, person: subject, users, job: jobFor(booking.jobId ?? null) })
      if (!ok) setMessage('That change is not allowed on this booking.')
    })

  const strike = (booking: OvertimeBookingInput, apply: () => void) => {
    const outcome = overtimeStrikeOutcome({ booking, organization, timeZone })
    if (outcome.kind === 'notAllowed') return setMessage(outcome.message)
    if (outcome.kind === 'none') return setMessage('Nothing on this booking is outside the working day.')
    if (outcome.kind === 'cancel') return setConfirmCancel({ summary: outcome.warning.summary, run: apply })
    apply()
  }

  const onTick = (line: OvertimeLine, booking: OvertimeBookingInput) => {
    const mode = editMode(line)
    if (mode === 'direct') void direct(booking, { action: 'approve' })
    else if (mode === 'request') setDraft((d) => ({ ...d, [line.bookingId]: { action: 'keep' } }))
  }
  const onCross = (line: OvertimeLine, booking: OvertimeBookingInput) => {
    const mode = editMode(line)
    if (mode === 'direct') strike(booking, () => void direct(booking, { action: 'strike' }))
    else if (mode === 'request') strike(booking, () => setDraft((d) => ({ ...d, [line.bookingId]: { action: 'strike' } })))
  }

  const sendForApproval = () =>
    run(async () => {
      const requestLines: OvertimeRequestLine[] = []
      for (const line of lines) {
        if (editMode(line) !== 'request') continue
        const booking = bookingById.get(line.bookingId.toLowerCase())
        if (!booking) continue
        const built = overtimeRequestLineFields({ booking, organization, timeZone, proposal: draft[line.bookingId] ?? { action: 'keep' }, personIds: operativeIds })
        if (built) requestLines.push(built)
      }
      if (requestLines.length === 0) {
        setMessage(OVERTIME_NO_LINES_MESSAGE)
        return
      }
      await sendOvertimeRequest({ organizationId, requester: subject, users, rangeStart: range.start, rangeEnd: range.end, lines: requestLines, existing: requests, personIds: operativeIds, bookings })
      setDraft({})
      setMessage('Sent for approval.')
    })

  const generateReport = () =>
    run(async () => {
      const saved = await saveOvertimeReport({ organizationId, person: subject, companyName: props.companyName, rangeStart: range.start, rangeEnd: range.end, lines })
      const bytes = await buildOvertimeReportPdf(saved, { logoUrl: props.logoUrl })
      downloadPdf(bytes, `overtime-${range.start}-${range.end}.pdf`)
      setMessage('Report saved and downloaded. Send it to payroll yourself.')
    })

  const canDecide = props.mode === 'review' && canDecideOvertimeRequest(rulebookPerson(props.viewerUser, users), subjectPerson, roster)
  // §16: an admin writes every booking; a line manager only the requester's users-id bookings, or jobs they manage.
  const deciderIsAdmin = isAdminOutsideOperativeMode(rulebookPerson(props.viewerUser, users))
  const deciderCanWrite = (booking: OvertimeBookingInput) =>
    canWriteBooking(
      viewerAccess,
      booking.collection === 'managerSiteBookings'
        ? { collection: 'managerSiteBookings', userId: booking.personId, locationType: booking.jobId ? 'project' : 'office', locationId: booking.jobId }
        : { collection: 'bookings', projectId: booking.jobId },
      jobFor(booking.jobId ?? null) as unknown as Record<string, unknown> | null,
      props.managers as never
    )

  return (
    <div className="stack" style={{ gap: 12 }}>
      {loadError ? <p className="banner" data-hue="warn">Some overtime data could not be loaded: {loadError}</p> : null}
      {lines.length === 0 ? <p className="muted">{OVERTIME_NO_LINES_MESSAGE}</p> : null}
      {lines.map((line) => {
        const booking = bookingById.get(line.bookingId.toLowerCase())
        const mode = editMode(line)
        const proposal = draft[line.bookingId]
        const preview =
          booking && proposal && proposal.action !== 'keep'
            ? overtimeRequestLineFields({ booking, organization, timeZone, proposal })
            : null
        const requested = line.requestLine
        return (
          <div key={`${line.collection}/${line.bookingId}`} className="card pad" style={{ opacity: line.state === 'cancelled' ? 0.6 : 1 }}>
            <div className="row" style={{ justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div className="grow" style={{ minWidth: 0 }}>
                <b style={{ textDecoration: line.state === 'cancelled' ? 'line-through' : 'none' }}>{line.title}</b>
                <div className="muted small">
                  {line.dayLabel} · {line.start && line.end ? `${line.start}–${line.end}` : line.timeSlot}
                  {requested && requested.action === 'edit' && requested.proposedStart ? ` (asked ${requested.proposedStart}–${requested.proposedEnd})` : ''}
                  {line.figures?.dayWindow ? ` · day ${line.figures.dayWindow}` : ''}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                {line.figures ? (
                  <div style={{ textDecoration: preview ? 'line-through' : 'none' }}>{line.figures.text}</div>
                ) : null}
                {preview ? <div>{preview.cancel ? 'Booking cancelled' : `${preview.overtimeHoursAfter}h`}</div> : null}
              </div>
            </div>
            <div className="row" style={{ marginTop: 8, gap: 8, flexWrap: 'wrap' }}>
              <span className="pill" data-hue={line.state === 'approved' ? 'green' : line.state === 'needsReview' ? 'warn' : 'blue'}>
                {line.stateLabel}
              </span>
              {proposal ? <span className="pill">{proposal.action === 'keep' ? 'Ticked' : proposal.action === 'strike' ? 'Crossed' : 'Changed'} (not sent)</span> : null}
              {booking && mode !== 'none' ? (
                <span className="row" style={{ gap: 6, marginLeft: 'auto' }}>
                  <button type="button" className="btn sm" aria-label="I didn't work these overtime hours" disabled={busy} onClick={() => onCross(line, booking)}>
                    ✕
                  </button>
                  <button type="button" className="btn sm" aria-label="Approve this line" disabled={busy} onClick={() => onTick(line, booking)}>
                    ✓
                  </button>
                  <button type="button" className="btn sm" aria-label="Change start, finish or rate" disabled={busy} onClick={() => setCog({ booking, target: mode === 'direct' ? 'direct' : 'draft' })}>
                    ⚙
                  </button>
                </span>
              ) : null}
            </div>
          </div>
        )
      })}
      {lines.length > 0 ? <p className="small"><b>Total overtime: {overtimeLinesTotal(lines)}h</b></p> : null}

      {props.mode === 'review'
        ? pending.map((request) => (
            <RequestReview
              key={request.id}
              request={request}
              bookingById={bookingById}
              organization={organization}
              timeZone={timeZone}
              canDecide={canDecide}
              decisions={decisions}
              setDecisions={setDecisions}
              busy={busy}
              requesterIds={operativeIds}
              deciderIsAdmin={deciderIsAdmin}
              canWriteBooking={deciderCanWrite}
              onCog={(booking) => setCog({ booking, target: 'decision' })}
              onStrike={(booking, apply) => strike(booking, apply)}
              onApprove={() =>
                run(async () => {
                  const result = await approveOvertimeRequest({
                    organizationId,
                    requestId: request.id,
                    decisions,
                    organization,
                    timeZone,
                    decider: props.viewerUser,
                    requester: subject,
                    users,
                    requesterIds: operativeIds,
                    deciderIsAdmin,
                    canWriteBooking: deciderCanWrite,
                  })
                  setDecisions({})
                  const notes = [
                    result.deletedBookingIds.length > 0 ? `${result.deletedBookingIds.length} deleted booking(s) left out` : '',
                    result.unreadableBookingIds.length > 0 ? `${result.unreadableBookingIds.length} booking(s) you can't read left out` : '',
                    result.foreignBookingIds.length > 0 ? `${result.foreignBookingIds.length} booking(s) not theirs left out` : '',
                  ].filter(Boolean)
                  setMessage(notes.length > 0 ? `Approved. ${notes.join('; ')}.` : 'Approved. The bookings are updated.')
                })
              }
            />
          ))
        : null}

      {props.mode === 'mine' ? (
        <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
          {anyRequestLines ? (
            <button type="button" className="btn primary" style={{ background: 'var(--green, #16a34a)' }} disabled={busy} onClick={() => void sendForApproval()}>
              {OVERTIME_SEND_FOR_APPROVAL_LABEL}
            </button>
          ) : null}
          <button type="button" className="btn primary" disabled={busy || !canGenerateOvertimeReport(lines)} onClick={() => void generateReport()}>
            {OVERTIME_GENERATE_REPORT_LABEL}
          </button>
          {pending.map((request) => (
            <button key={request.id} type="button" className="btn ghost" disabled={busy} onClick={() => void run(() => withdrawOvertimeRequest(organizationId, request))}>
              Withdraw request ({formatPayePayrunDay(request.rangeStart)} – {formatPayePayrunDay(request.rangeEnd)})
            </button>
          ))}
        </div>
      ) : null}
      {message ? <p className="small">{message}</p> : null}

      {cog ? (
        <CogDialog
          booking={cog.booking}
          organization={organization}
          timeZone={timeZone}
          onClose={() => setCog(null)}
          onSave={(edit) => {
            const target = cog.target
            const booking = cog.booking
            setCog(null)
            if (target === 'direct') void direct(booking, { action: 'edit', ...edit })
            else if (target === 'draft') setDraft((d) => ({ ...d, [booking.id]: { action: 'edit', ...edit } }))
            else setDecisions((d) => ({ ...d, [booking.id]: { action: 'edit', ...edit } }))
          }}
        />
      ) : null}
      {confirmCancel ? (
        <Modal
          open
          title={OVERTIME_CANCEL_WARNING.title}
          onClose={() => setConfirmCancel(null)}
          footer={
            <div className="row" style={{ gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" className="btn" onClick={() => setConfirmCancel(null)}>
                {OVERTIME_CANCEL_WARNING.back}
              </button>
              <button
                type="button"
                className="btn danger"
                onClick={() => {
                  const next = confirmCancel.run
                  setConfirmCancel(null)
                  next()
                }}
              >
                {OVERTIME_CANCEL_WARNING.confirm}
              </button>
            </div>
          }
        >
          <p className="small"><b>{confirmCancel.summary}</b></p>
          <p>{OVERTIME_CANCEL_WARNING.body}</p>
          <p className="muted small">{OVERTIME_CANCEL_WARNING.footnote}</p>
        </Modal>
      ) : null}
    </div>
  )
}

function RequestReview(props: {
  request: OvertimeRequestRecord
  bookingById: Map<string, OvertimeBookingInput>
  organization: unknown
  timeZone: string
  canDecide: boolean
  decisions: Record<string, OvertimeDecision>
  setDecisions: (update: (d: Record<string, OvertimeDecision>) => Record<string, OvertimeDecision>) => void
  busy: boolean
  onCog: (booking: OvertimeBookingInput) => void
  onStrike: (booking: OvertimeBookingInput, apply: () => void) => void
  onApprove: () => void
  requesterIds: ReadonlyArray<string>
  deciderIsAdmin: boolean
  canWriteBooking: (booking: OvertimeBookingInput) => boolean
}) {
  const { request, decisions } = props
  const ready = overtimeRequestFullyDecided(request, decisions)
  // The same rule the approval transaction (and the security rules) apply, run on what this screen can read, so the
  // button is never offered for an approval that would be refused.
  const unreadable = request.lines.filter((line) => !props.bookingById.get(line.bookingId.toLowerCase())).map((line) => line.bookingId)
  const live: Record<string, OvertimeBookingInput> = {}
  for (const line of request.lines) {
    const booking = props.bookingById.get(line.bookingId.toLowerCase())
    if (booking) live[line.bookingId] = booking
  }
  const dryRun = ready
    ? overtimeApprovalWrites({
        request,
        decisions,
        bookings: live,
        organization: props.organization,
        timeZone: props.timeZone,
        deciderId: 'preview',
        requesterIds: props.requesterIds,
        deciderIsAdmin: props.deciderIsAdmin,
        writableBookingIds: Object.values(live).filter(props.canWriteBooking).map((row) => row.id),
        unreadableBookingIds: unreadable,
      })
    : null
  const blocked = dryRun && !dryRun.ok ? dryRun : null
  const decide = (bookingId: string, decision: OvertimeDecision) => props.setDecisions((d) => ({ ...d, [bookingId]: decision }))
  const describe = (line: OvertimeRequestLine): ReactNode =>
    line.cancel
      ? 'Asks to remove the booking'
      : line.action === 'edit'
        ? `Asks ${line.proposedStart}–${line.proposedEnd}${line.proposedMultiplier ? ` at ×${line.proposedMultiplier}` : ''}: ${line.overtimeHoursBefore}h → ${line.overtimeHoursAfter}h`
        : line.action === 'strike'
          ? `Asks to trim to ${line.proposedStart}–${line.proposedEnd}: ${line.overtimeHoursBefore}h → ${line.overtimeHoursAfter}h`
          : `Approve as booked: ${line.overtimeHoursBefore}h`
  return (
    <div className="card pad stack" style={{ gap: 10 }}>
      <b>
        Overtime request · {formatPayePayrunDay(request.rangeStart)} – {formatPayePayrunDay(request.rangeEnd)}
      </b>
      {request.lines.map((line) => {
        const booking = props.bookingById.get(line.bookingId.toLowerCase())
        const decision = decisions[line.bookingId]
        return (
          <div key={line.bookingId} className="row" style={{ gap: 8, flexWrap: 'wrap', justifyContent: 'space-between' }}>
            <div className="grow small" style={{ minWidth: 0 }}>
              {formatPayePayrunDay(line.dayKey)} · {describe(line)}
              {decision ? <span className="muted"> · {decision.action === 'approve' ? 'ticked' : decision.action === 'strike' ? 'crossed' : `changed to ${decision.start}–${decision.end}`}</span> : null}
              {!booking ? <span className="muted"> · {OVERTIME_BOOKING_UNREADABLE_MESSAGE}</span> : null}
              {booking && !overtimeBookingIsTheirs(booking, props.requesterIds) ? <span className="muted"> · {OVERTIME_NOT_THEIR_BOOKING_MESSAGE}</span> : null}
            </div>
            {props.canDecide && booking ? (
              <span className="row" style={{ gap: 6 }}>
                <button type="button" className="btn sm" aria-label="Remove the overtime" disabled={props.busy} onClick={() => props.onStrike(booking, () => decide(line.bookingId, { action: 'strike' }))}>
                  ✕
                </button>
                <button type="button" className="btn sm" aria-label="Approve as asked" disabled={props.busy} onClick={() => decide(line.bookingId, { action: 'approve' })}>
                  ✓
                </button>
                <button type="button" className="btn sm" aria-label="Counter-change" disabled={props.busy} onClick={() => props.onCog(booking)}>
                  ⚙
                </button>
              </span>
            ) : null}
            {props.canDecide && !booking ? (
              <button type="button" className="btn sm" onClick={() => decide(line.bookingId, { action: 'approve' })}>
                OK
              </button>
            ) : null}
          </div>
        )
      })}
      {props.canDecide ? (
        <>
          {blocked ? <p className="small" style={{ color: 'var(--red)' }}>{blocked.message}</p> : null}
          <button type="button" className="btn primary" disabled={!ready || props.busy || Boolean(blocked)} onClick={props.onApprove}>
            {OVERTIME_APPROVE_REQUEST_LABEL}
          </button>
        </>
      ) : (
        <p className="muted small">Waiting for their line manager or an admin.</p>
      )}
    </div>
  )
}

function CogDialog(props: {
  booking: OvertimeBookingInput
  organization: unknown
  timeZone: string
  onClose: () => void
  onSave: (edit: { start: string; end: string; multiplier: number | null }) => void
}) {
  const [start, setStart] = useState(props.booking.workStartTime || '07:30')
  const [end, setEnd] = useState(props.booking.workEndTime || '16:00')
  const [multiplier, setMultiplier] = useState<number | null>(
    typeof props.booking.otMultiplierOverride === 'number' ? props.booking.otMultiplierOverride : null
  )
  const preview = overtimeCogPreview({ booking: props.booking, organization: props.organization, timeZone: props.timeZone, start, end, multiplier })
  const orgRate = organizationOvertimeMultiplier(props.organization, props.booking.dayKey, props.timeZone)
  return (
    <Modal
      open
      title="Change hours or overtime rate"
      subtitle={`${formatPayePayrunDay(props.booking.dayKey)} · ${[props.booking.jobNumber, props.booking.jobName].filter(Boolean).join(' ')}`}
      onClose={props.onClose}
      footer={
        <div className="row" style={{ gap: 8, justifyContent: 'flex-end' }}>
          <button type="button" className="btn" onClick={props.onClose}>
            Cancel
          </button>
          <button type="button" className="btn primary" disabled={Boolean(preview.error) || !preview.changed} onClick={() => props.onSave({ start, end, multiplier })}>
            Save
          </button>
        </div>
      }
    >
      <div className="stack" style={{ gap: 10 }}>
        <label className="small">
          Start
          <input className="input" type="time" step={900} value={start} onChange={(e) => setStart(e.target.value)} />
        </label>
        <label className="small">
          Finish
          <input className="input" type="time" step={900} value={end} onChange={(e) => setEnd(e.target.value)} />
        </label>
        <label className="small">
          Overtime rate
          <select className="input" value={multiplier == null ? 'org' : String(multiplier)} onChange={(e) => setMultiplier(e.target.value === 'org' ? null : Number(e.target.value))}>
            <option value="org">Organisation (×{orgRate})</option>
            {OVERTIME_MULTIPLIER_STEPS.map((step) => (
              <option key={step} value={String(step)}>
                Custom ×{step}
              </option>
            ))}
          </select>
        </label>
        {preview.error ? <p className="small" style={{ color: 'var(--red)' }}>{preview.error}</p> : null}
        <div className="small">
          <div style={{ textDecoration: preview.changed ? 'line-through' : 'none' }}>{preview.beforeText}</div>
          {preview.changed ? <div><b>{preview.afterText}</b></div> : null}
        </div>
      </div>
    </Modal>
  )
}
