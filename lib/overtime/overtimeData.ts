/**
 * Rulebook 1.29.0 §25: PAYE overtime — web reads and writes. Every rule is in `@/lib/canonical` (payeOvertime.ts,
 * payePayrun.ts); this file only maps web rows to the rulebook inputs and turns the rulebook's write fields into
 * Firestore calls. Online only (web has no offline mode).
 */
import {
  addDoc,
  collection,
  deleteField,
  doc,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore'
import {
  BOOKING_HOURS_CHANGED_BY_OWNER_TYPE,
  OVERTIME_REQUEST_REVIEWED_TYPE,
  OVERTIME_REQUEST_SUBMITTED_TYPE,
  bookingHoursChangedRecipients,
  jobManagerIds,
  overtimeApprovalWrites,
  overtimeDirectWrites,
  overtimeRequestRecipients,
  overtimeRequestWithdrawWriteFields,
  overtimeRequestWriteFields,
  overtimeRequestsToReplace,
  overtimeReviewedRecipients,
  overtimeReportSnapshot,
  parseBookingDocument,
  parseManagerSiteBookingDocument,
  parseOvertimeReportDocument,
  parseOvertimeRequestDocument,
  parseOvertimeReviewDocument,
  payePaydayWriteFields,
  writeMetadataFields,
  type OvertimeBookingInput,
  type OvertimeDecision,
  type OvertimeLine,
  type OvertimeOrganization,
  type OvertimeReportSnapshot,
  type OvertimeRequestLine,
  type OvertimeRequestRecord,
  type OvertimeReviewRecord,
} from '@/lib/canonical'
import { auth, db } from '@/lib/firebase/config'
import { saveInboxNotification } from '@/lib/firebase/notifyInbox'
import { dayKeyInZone } from '@/lib/orgTime/zoneTime'
import type { ManagerSiteBooking } from '@/lib/scheduling/managerSiteBookingUtils'
import { rulebookPerson, rulebookRoster } from '@/lib/staff/rulebookPeople'
import type { Booking, Project, User } from '@/types'

function uid(): string {
  return auth?.currentUser?.uid || ''
}

function metadata(): Record<string, unknown> {
  return { ...(writeMetadataFields(uid(), 'web') ?? {}), updatedAt: serverTimestamp() }
}

function jobLookup(projects: ReadonlyArray<Project>, smallWorks: ReadonlyArray<Project>) {
  const byId = new Map<string, Project>()
  for (const job of [...projects, ...smallWorks]) byId.set(String(job.id).toLowerCase(), job)
  return (id: string | null | undefined) => (id ? byId.get(String(id).toLowerCase()) : undefined)
}

/** Web bookings (labour and job-linked or own manager site bookings) → the rulebook's overtime inputs. */
export function overtimeBookingInputs(input: {
  bookings: ReadonlyArray<Booking>
  managerSiteBookings: ReadonlyArray<ManagerSiteBooking>
  projects: ReadonlyArray<Project>
  smallWorks: ReadonlyArray<Project>
  timeZone: string
}): OvertimeBookingInput[] {
  const job = jobLookup(input.projects, input.smallWorks)
  const labour = input.bookings
    .filter((booking) => booking.source !== 'manager')
    .map((booking) => {
      const row = job(booking.projectId)
      return {
        id: booking.id,
        collection: 'bookings',
        personId: booking.operativeId,
        dayKey: dayKeyInZone(new Date(booking.date), input.timeZone),
        timeSlot: String(booking.timeSlot),
        workStartTime: booking.workStartTime ?? null,
        workEndTime: booking.workEndTime ?? null,
        isBreakRemoved: booking.isBreakRemoved === true,
        otMultiplierOverride: booking.otMultiplierOverride ?? null,
        status: String(booking.status),
        jobId: booking.projectId,
        jobNumber: row?.jobNumber ?? '',
        jobName: row?.siteName ?? '',
      } satisfies OvertimeBookingInput
    })
  const manager = input.managerSiteBookings.map((booking) => {
    const row = job(booking.locationId)
    return {
      id: booking.id,
      collection: 'managerSiteBookings',
      personId: booking.userId,
      dayKey: dayKeyInZone(new Date(booking.date), input.timeZone),
      timeSlot: String(booking.timeSlot),
      workStartTime: booking.workStartTime ?? null,
      workEndTime: booking.workEndTime ?? null,
      isBreakRemoved: booking.isBreakRemoved === true,
      otMultiplierOverride: booking.otMultiplierOverride ?? null,
      jobId: booking.locationId ?? null,
      jobNumber: row?.jobNumber ?? '',
      jobName: row?.siteName ?? booking.customLocationName ?? '',
    } satisfies OvertimeBookingInput
  })
  return [...labour, ...manager]
}

/** Live overtime requests: one person's (`userId`), or every request (admins only, `userId` null). */
export function listenOvertimeRequests(
  organizationId: string,
  userId: string | null,
  onChange: (rows: OvertimeRequestRecord[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const ref = collection(db, 'organizations', organizationId, 'overtimeRequests')
  const q = userId ? query(ref, where('userId', '==', userId)) : ref
  return onSnapshot(
    q,
    (snap) => onChange(snap.docs.map((row) => parseOvertimeRequestDocument(row.id, row.data()))),
    (error) => onError?.(error)
  )
}

/** Live approved lines of one person. */
export function listenOvertimeReviews(
  organizationId: string,
  userId: string,
  onChange: (rows: OvertimeReviewRecord[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const q = query(collection(db, 'organizations', organizationId, 'overtimeReviews'), where('userId', '==', userId))
  return onSnapshot(
    q,
    (snap) => onChange(snap.docs.map((row) => parseOvertimeReviewDocument(row.id, row.data()))),
    (error) => onError?.(error)
  )
}

/** Saved reports of one person (newest first). */
export function listenOvertimeReports(
  organizationId: string,
  userId: string,
  onChange: (rows: Array<ReturnType<typeof parseOvertimeReportDocument>>) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const q = query(collection(db, 'organizations', organizationId, 'overtimeReports'), where('userId', '==', userId))
  return onSnapshot(
    q,
    (snap) =>
      onChange(
        snap.docs
          .map((row) => parseOvertimeReportDocument(row.id, row.data()))
          .sort((a, b) => (b.generatedAtMs ?? 0) - (a.generatedAtMs ?? 0))
      ),
    (error) => onError?.(error)
  )
}

/** Save the PAYE payday (admins; §4.5). Nothing is written when unchanged. */
export async function savePayePayday(organizationId: string, organizationDoc: unknown, day: number, todayKey: string): Promise<boolean> {
  const fields = payePaydayWriteFields(organizationDoc, day, todayKey)
  if (!fields) return false
  await updateDoc(doc(db, 'organizations', organizationId), { ...fields, ...metadata() })
  return true
}

/**
 * Send for approval (PAYE operative, or a PAYE manager for bookings they cannot edit): withdraws their pending
 * request for the same range and creates the new one in one batch, then notifies the approvers.
 */
export async function sendOvertimeRequest(input: {
  organizationId: string
  requester: User
  users: ReadonlyArray<User>
  rangeStart: string
  rangeEnd: string
  lines: ReadonlyArray<OvertimeRequestLine>
  existing: ReadonlyArray<OvertimeRequestRecord>
}): Promise<string | null> {
  const fields = overtimeRequestWriteFields({ userId: input.requester.id, rangeStart: input.rangeStart, rangeEnd: input.rangeEnd, lines: input.lines })
  if (!fields) return null
  const batch = writeBatch(db)
  for (const id of overtimeRequestsToReplace(input.existing, input.requester.id, input.rangeStart, input.rangeEnd)) {
    batch.update(doc(db, 'organizations', input.organizationId, 'overtimeRequests', id), {
      status: 'withdrawn',
      withdrawnAt: serverTimestamp(),
      ...metadata(),
    })
  }
  const ref = doc(collection(db, 'organizations', input.organizationId, 'overtimeRequests'))
  batch.set(ref, { ...fields, createdAt: serverTimestamp(), ...metadata() })
  await batch.commit()
  const recipients = overtimeRequestRecipients(rulebookPerson(input.requester, input.users), rulebookRoster(input.users))
  const name = [input.requester.firstName, input.requester.surname].filter(Boolean).join(' ') || 'Someone'
  await Promise.all(
    recipients.map((userId) =>
      saveInboxNotification({
        organizationId: input.organizationId,
        type: OVERTIME_REQUEST_SUBMITTED_TYPE,
        title: `Overtime request from ${name}`,
        message: `${name} sent their overtime for ${input.rangeStart} to ${input.rangeEnd} for approval.`,
        userId,
        relatedId: ref.id,
        deepLinkUserId: input.requester.id,
      }).catch(() => undefined)
    )
  )
  return ref.id
}

/** The person withdraws their pending request. */
export async function withdrawOvertimeRequest(organizationId: string, request: OvertimeRequestRecord): Promise<void> {
  const fields = overtimeRequestWithdrawWriteFields(request)
  if (!fields) return
  await updateDoc(doc(db, 'organizations', organizationId, 'overtimeRequests', request.id), {
    ...fields,
    withdrawnAt: serverTimestamp(),
    ...metadata(),
  })
}

function bookingInputFromDoc(
  collectionName: 'bookings' | 'managerSiteBookings',
  id: string,
  data: Record<string, unknown>,
  timeZone: string
): OvertimeBookingInput | null {
  if (collectionName === 'bookings') {
    const parsed = parseBookingDocument(id, data, { timeZone })
    if (!parsed.ok) return null
    const b = parsed.booking
    return {
      id,
      collection: 'bookings',
      personId: b.operativeId,
      dayKey: dayKeyInZone(new Date(b.dateMs), timeZone),
      timeSlot: b.timeSlot,
      workStartTime: b.workStartTime ?? null,
      workEndTime: b.workEndTime ?? null,
      isBreakRemoved: b.isBreakRemoved,
      otMultiplierOverride: b.otMultiplierOverride ?? null,
      status: b.status,
      jobId: b.projectId,
    }
  }
  const parsed = parseManagerSiteBookingDocument(id, data, { timeZone })
  if (!parsed.ok) return null
  const b = parsed.booking
  return {
    id,
    collection: 'managerSiteBookings',
    personId: b.userId,
    dayKey: dayKeyInZone(new Date(b.dateMs), timeZone),
    timeSlot: b.timeSlot,
    workStartTime: b.workStartTime ?? null,
    workEndTime: b.workEndTime ?? null,
    isBreakRemoved: b.isBreakRemoved,
    otMultiplierOverride: b.otMultiplierOverride ?? null,
    jobId: b.locationId ?? null,
  }
}

export class OvertimeApprovalRefused extends Error {
  readonly bookingIds: string[]
  constructor(message: string, bookingIds: string[]) {
    super(message)
    this.name = 'OvertimeApprovalRefused'
    this.bookingIds = bookingIds
  }
}

/**
 * Approve Overtime Request (line manager or admin): one transaction that re-reads the request and every booking,
 * refuses the whole approval when a booking changed since the request (`overtimeApprovalWrites`), and otherwise
 * writes the bookings, one review per line and the approved request together. Then "Overtime update" to the person.
 */
export async function approveOvertimeRequest(input: {
  organizationId: string
  requestId: string
  decisions: Record<string, OvertimeDecision>
  organization: OvertimeOrganization
  timeZone: string
  decider: User
  requester: User | null
  users: ReadonlyArray<User>
}): Promise<{ droppedBookingIds: string[] }> {
  const orgId = input.organizationId
  const result = await runTransaction(db, async (tx) => {
    const requestRef = doc(db, 'organizations', orgId, 'overtimeRequests', input.requestId)
    const requestSnap = await tx.get(requestRef)
    if (!requestSnap.exists()) throw new OvertimeApprovalRefused('This request no longer exists.', [])
    const request = parseOvertimeRequestDocument(requestSnap.id, requestSnap.data())
    const bookings: Record<string, OvertimeBookingInput | null> = {}
    for (const line of request.lines) {
      const snap = await tx.get(doc(db, 'organizations', orgId, line.collection, line.bookingId))
      bookings[line.bookingId] = snap.exists()
        ? bookingInputFromDoc(line.collection, snap.id, snap.data() as Record<string, unknown>, input.timeZone)
        : null
    }
    const writes = overtimeApprovalWrites({
      request,
      decisions: input.decisions,
      bookings,
      organization: input.organization,
      timeZone: input.timeZone,
      deciderId: input.decider.id,
    })
    if (!writes.ok) throw new OvertimeApprovalRefused(writes.message, writes.bookingIds)
    for (const write of writes.bookingWrites) {
      const update: Record<string, unknown> = { ...write.set, ...metadata() }
      for (const key of write.remove) update[key] = deleteField()
      tx.update(doc(db, 'organizations', orgId, write.collection, write.bookingId), update)
    }
    for (const review of writes.reviewWrites) {
      tx.set(doc(db, 'organizations', orgId, 'overtimeReviews', review.docId), {
        ...review.fields,
        reviewedAt: serverTimestamp(),
        ...metadata(),
      })
    }
    tx.update(requestRef, { ...writes.requestFields, decidedAt: serverTimestamp(), ...metadata() })
    return { droppedBookingIds: writes.droppedBookingIds, userId: request.userId }
  })
  const roster = rulebookRoster(input.users)
  const recipients = overtimeReviewedRecipients(result.userId, rulebookPerson(input.decider, input.users), roster)
  await Promise.all(
    recipients.map((userId) =>
      saveInboxNotification({
        organizationId: orgId,
        type: OVERTIME_REQUEST_REVIEWED_TYPE,
        title: 'Overtime update',
        message: 'Your overtime request was approved. Open Overtime to see the final hours.',
        userId,
        relatedId: input.requestId,
      }).catch(() => undefined)
    )
  )
  return { droppedBookingIds: result.droppedBookingIds }
}

/**
 * A direct tick, X or cog by a PAYE admin or a PAYE manager who may edit the booking: the booking change and the
 * line's review in one batch; when the booking changes, `booking_hours_changed_by_owner` to the job's managers and
 * the person's line managers (inbox only).
 */
export async function applyDirectOvertime(input: {
  organizationId: string
  booking: OvertimeBookingInput
  action: OvertimeDecision
  organization: OvertimeOrganization
  timeZone: string
  person: User
  users: ReadonlyArray<User>
  job: Project | null | undefined
}): Promise<boolean> {
  const writes = overtimeDirectWrites({
    booking: input.booking,
    action: input.action,
    userId: input.person.id,
    reviewerId: input.person.id,
    organization: input.organization,
    timeZone: input.timeZone,
  })
  if (!writes) return false
  const batch = writeBatch(db)
  if (writes.bookingWrite) {
    const update: Record<string, unknown> = { ...writes.bookingWrite.set, ...metadata() }
    for (const key of writes.bookingWrite.remove) update[key] = deleteField()
    batch.update(doc(db, 'organizations', input.organizationId, writes.bookingWrite.collection, writes.bookingWrite.bookingId), update)
  }
  batch.set(doc(db, 'organizations', input.organizationId, 'overtimeReviews', writes.reviewWrite.docId), {
    ...writes.reviewWrite.fields,
    reviewedAt: serverTimestamp(),
    ...metadata(),
  })
  await batch.commit()
  if (writes.hoursChanged) {
    const recipients = bookingHoursChangedRecipients(
      rulebookPerson(input.person, input.users),
      input.job ? jobManagerIds(input.job as unknown as Record<string, unknown>) : [],
      rulebookRoster(input.users)
    )
    const name = [input.person.firstName, input.person.surname].filter(Boolean).join(' ') || 'Someone'
    await Promise.all(
      recipients.map((userId) =>
        saveInboxNotification({
          organizationId: input.organizationId,
          type: BOOKING_HOURS_CHANGED_BY_OWNER_TYPE,
          title: 'Hours changed',
          message: `${name} changed the hours of their booking on ${input.booking.dayKey}${input.booking.jobNumber ? ` (${input.booking.jobNumber})` : ''}.`,
          userId,
          relatedId: input.booking.id,
          dayKey: input.booking.dayKey,
        }).catch(() => undefined)
      )
    )
  }
  return true
}

/** Generate overtime report: saves the snapshot (written once) and returns it with its id. */
export async function saveOvertimeReport(input: {
  organizationId: string
  person: User
  companyName: string
  rangeStart: string
  rangeEnd: string
  lines: ReadonlyArray<OvertimeLine>
}): Promise<OvertimeReportSnapshot & { id: string }> {
  const snapshot = overtimeReportSnapshot({
    userId: input.person.id,
    userName: [input.person.firstName, input.person.surname].filter(Boolean).join(' ') || input.person.email || '',
    companyName: input.companyName,
    rangeStart: input.rangeStart,
    rangeEnd: input.rangeEnd,
    lines: input.lines,
    generatedBy: input.person.id,
  })
  const ref = await addDoc(collection(db, 'organizations', input.organizationId, 'overtimeReports'), {
    ...snapshot,
    generatedAt: serverTimestamp(),
    ...metadata(),
  })
  return { ...snapshot, id: ref.id }
}

/**
 * Live bookings of one person for the Overtime screens: labour bookings under each of their ids (`operativeId ==`,
 * one query per id, as the read rules require) and their manager site bookings (`userId ==`). Mapped through the
 * rulebook readers; job number and name from `jobs`.
 */
export function listenPersonOvertimeBookings(input: {
  organizationId: string
  operativeIds: ReadonlyArray<string>
  userIds: ReadonlyArray<string>
  timeZone: string
  jobs: ReadonlyArray<Project>
  onChange: (rows: OvertimeBookingInput[]) => void
  onError?: (error: Error) => void
}): Unsubscribe {
  const job = jobLookup(input.jobs, [])
  const parts = new Map<string, OvertimeBookingInput[]>()
  const emit = () => {
    const seen = new Set<string>()
    const out: OvertimeBookingInput[] = []
    for (const rows of parts.values()) {
      for (const row of rows) {
        const key = `${row.collection}/${row.id}`
        if (seen.has(key)) continue
        seen.add(key)
        const found = job(row.jobId)
        out.push({ ...row, jobNumber: found?.jobNumber ?? row.jobNumber ?? '', jobName: found?.siteName ?? row.jobName ?? '' })
      }
    }
    input.onChange(out)
  }
  const unsubs: Unsubscribe[] = []
  const listen = (key: string, collectionName: 'bookings' | 'managerSiteBookings', field: string, value: string) => {
    unsubs.push(
      onSnapshot(
        query(collection(db, 'organizations', input.organizationId, collectionName), where(field, '==', value)),
        (snap) => {
          parts.set(
            key,
            snap.docs
              .map((row) => bookingInputFromDoc(collectionName, row.id, row.data() as Record<string, unknown>, input.timeZone))
              .filter((row): row is OvertimeBookingInput => row != null)
          )
          emit()
        },
        (error) => input.onError?.(error)
      )
    )
  }
  for (const id of Array.from(new Set(input.operativeIds.filter(Boolean)))) listen(`b:${id}`, 'bookings', 'operativeId', id)
  for (const id of Array.from(new Set(input.userIds.filter(Boolean)))) listen(`m:${id}`, 'managerSiteBookings', 'userId', id)
  return () => unsubs.forEach((stop) => stop())
}
