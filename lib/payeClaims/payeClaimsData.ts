/**
 * Rulebook 1.30.0 §26: PAYE price work, expenses and personal site audits — web reads and writes. Every rule is in
 * `@/lib/canonical` (payeClaims.ts, personalSiteAudits.ts); this file only turns the rulebook's write fields into
 * Firestore and Storage calls. Online only. Evidence and audit photos are stored by path; screens fetch them with
 * `getDownloadURL`, so the Storage rules decide who sees them.
 */
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore'
import { getDownloadURL, ref } from 'firebase/storage'
import {
  EXPENSE_ITEMS_COLLECTION,
  PAYE_CLAIM_REPORTS_COLLECTION,
  PERSONAL_SITE_AUDITS_COLLECTION,
  PRICE_WORK_ITEMS_COLLECTION,
  expenseValidationError,
  expenseWriteFields,
  parseExpenseDocument,
  parsePayeClaimReportDocument,
  parsePersonalSiteAuditDocument,
  parsePriceWorkDocument,
  parseTimesheetEntries,
  payeClaimEvidencePath,
  payeClaimReportSnapshot,
  personalSiteAuditEvidence,
  personalSiteAuditImagePath,
  personalSiteAuditValidationError,
  personalSiteAuditWriteFields,
  priceWorkValidationError,
  priceWorkWriteFields,
  writeMetadataFields,
  type ExpenseDraft,
  type ExpenseItem,
  type LineManagerRosterPerson,
  type LineManagerSubject,
  type PayeClaimEvidence,
  type PayeClaimEvidenceKind,
  type PayeClaimItem,
  type PayeClaimKind,
  type PayeClaimReportSnapshot,
  type PersonalSiteAudit,
  type PersonalSiteAuditDraft,
  type PriceWorkDraft,
  type PriceWorkItem,
  type TimesheetEntriesDocument,
} from '@/lib/canonical'
import { auth, db, storage } from '@/lib/firebase/config'
import { uploadFile } from '@/lib/firebase/storageUtils'
import { fileExtension } from '@/lib/security/uploadLimits'

function uid(): string {
  return auth?.currentUser?.uid || ''
}

function metadata(): Record<string, unknown> {
  return { ...(writeMetadataFields(uid(), 'web') ?? {}), updatedAt: serverTimestamp() }
}

const COLLECTION: Record<PayeClaimKind, string> = { priceWork: PRICE_WORK_ITEMS_COLLECTION, expense: EXPENSE_ITEMS_COLLECTION }

/** Live items of one person (`userId ==`, the query the read rules allow for the person, their line managers and admins). */
export function listenPayeClaims(
  organizationId: string,
  userId: string,
  kind: PayeClaimKind,
  timeZone: string,
  onChange: (rows: PayeClaimItem[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const q = query(collection(db, 'organizations', organizationId, COLLECTION[kind]), where('userId', '==', userId))
  return onSnapshot(
    q,
    (snap) =>
      onChange(
        snap.docs.map((row) =>
          kind === 'priceWork' ? parsePriceWorkDocument(row.id, row.data(), { timeZone }) : parseExpenseDocument(row.id, row.data(), { timeZone })
        )
      ),
    (error) => onError?.(error)
  )
}

/** Live saved report copies of one person. */
export function listenPayeClaimReports(
  organizationId: string,
  userId: string,
  onChange: (rows: Array<ReturnType<typeof parsePayeClaimReportDocument>>) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const q = query(collection(db, 'organizations', organizationId, PAYE_CLAIM_REPORTS_COLLECTION), where('userId', '==', userId))
  return onSnapshot(
    q,
    (snap) => onChange(snap.docs.map((row) => parsePayeClaimReportDocument(row.id, row.data()))),
    (error) => onError?.(error)
  )
}

/** Uploads one evidence file into the signed-in person's claim folder and returns its evidence entry. */
export async function uploadClaimEvidence(input: {
  organizationId: string
  file: Blob
  name: string
  contentType: string
  kind: PayeClaimEvidenceKind
  auditId?: string | null
}): Promise<PayeClaimEvidence> {
  const me = uid()
  const extension = input.contentType === 'application/pdf' ? 'pdf' : fileExtension(input.name) || (input.contentType === 'image/png' ? 'png' : 'jpg')
  const path = payeClaimEvidencePath({ organizationId: input.organizationId, userId: me, unixMs: Date.now(), extension })
  if (!path) throw new Error('You must be signed in to upload evidence.')
  await uploadFile(path, input.file, input.contentType || 'application/octet-stream')
  return { path, name: input.name, kind: input.kind, contentType: input.contentType, auditId: input.auditId ?? null }
}

/** Add Price Work: validated and shaped by `priceWorkWriteFields`; refused (with the rulebook message) otherwise. */
export async function addPriceWork(input: {
  organizationId: string
  draft: PriceWorkDraft
  person: LineManagerSubject
  roster: ReadonlyArray<LineManagerRosterPerson>
  currency: string
}): Promise<string> {
  const me = uid()
  const context = { person: input.person, roster: input.roster, organizationId: input.organizationId }
  const error = priceWorkValidationError(input.draft, context)
  if (error) throw new Error(error)
  const fields = priceWorkWriteFields({ userId: me, draft: input.draft, ...context, currency: input.currency })
  if (!fields) throw new Error('This price work cannot be added.')
  const created = await addDoc(collection(db, 'organizations', input.organizationId, PRICE_WORK_ITEMS_COLLECTION), {
    ...fields,
    createdAt: serverTimestamp(),
    ...metadata(),
  })
  return created.id
}

/** Add Expense: needs at least one piece of evidence (`expenseValidationError`). */
export async function addExpense(input: { organizationId: string; draft: ExpenseDraft; currency: string }): Promise<string> {
  const me = uid()
  const error = expenseValidationError(input.draft, { organizationId: input.organizationId, userId: me })
  if (error) throw new Error(error)
  const fields = expenseWriteFields({ userId: me, draft: input.draft, currency: input.currency, organizationId: input.organizationId })
  if (!fields) throw new Error('This expense cannot be added.')
  const created = await addDoc(collection(db, 'organizations', input.organizationId, EXPENSE_ITEMS_COLLECTION), {
    ...fields,
    createdAt: serverTimestamp(),
    ...metadata(),
  })
  return created.id
}

/** The person removes one of their own items (the evidence files are kept, §24). */
export async function removePayeClaim(organizationId: string, item: Pick<PayeClaimItem, 'kind' | 'id'>): Promise<void> {
  await deleteDoc(doc(db, 'organizations', organizationId, COLLECTION[item.kind], item.id))
}

/** Generate price work / expenses report: saves the frozen copy (written once) and returns it with its id. */
export async function savePayeClaimReport(input: {
  organizationId: string
  kind: PayeClaimKind
  userId: string
  userName: string
  companyName: string
  currency: string
  rangeStart: string
  rangeEnd: string
  items: ReadonlyArray<PriceWorkItem | ExpenseItem>
}): Promise<PayeClaimReportSnapshot & { id: string }> {
  const snapshot = payeClaimReportSnapshot({ ...input, generatedBy: uid() })
  const created = await addDoc(collection(db, 'organizations', input.organizationId, PAYE_CLAIM_REPORTS_COLLECTION), {
    ...snapshot,
    generatedAt: serverTimestamp(),
    ...metadata(),
  })
  return { ...snapshot, id: created.id }
}

/** A self-employed person's timesheets (`settings/timesheet_*` with their `userId`), read through `parseTimesheetEntries`. */
export async function loadTimesheetClaimSheets(
  organizationId: string,
  userId: string,
  timeZone: string
): Promise<Array<{ id: string; entries: TimesheetEntriesDocument }>> {
  const snap = await getDocs(query(collection(db, 'organizations', organizationId, 'settings'), where('userId', '==', userId)))
  return snap.docs
    .filter((row) => row.id.startsWith('timesheet_'))
    .map((row) => ({ id: row.id, entries: parseTimesheetEntries(row.id, row.data(), { timeZone }) }))
}

/** A download URL for a stored path (the Storage rules decide who may read it). */
export async function storedFileUrl(path: string): Promise<string> {
  return getDownloadURL(ref(storage, path))
}

/** The bytes of a stored file, for the report PDF. */
export async function storedFileBytes(path: string): Promise<Uint8Array> {
  const response = await fetch(await getDownloadURL(ref(storage, path)))
  if (!response.ok) throw new Error(`The file could not be read (${response.status}).`)
  return new Uint8Array(await response.arrayBuffer())
}

// MARK: - Personal site audits

/** Live personal site audits of the signed-in person only (`ownerUserId ==`; nobody else can read them). */
export function listenPersonalSiteAudits(
  organizationId: string,
  ownerUserId: string,
  timeZone: string,
  onChange: (rows: PersonalSiteAudit[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const q = query(collection(db, 'organizations', organizationId, PERSONAL_SITE_AUDITS_COLLECTION), where('ownerUserId', '==', ownerUserId))
  return onSnapshot(
    q,
    (snap) => onChange(snap.docs.map((row) => parsePersonalSiteAuditDocument(row.id, row.data(), { timeZone }))),
    (error) => onError?.(error)
  )
}

/** Uploads one personal audit photo into the owner's folder and returns its path. */
export async function uploadPersonalAuditPhoto(organizationId: string, auditId: string, file: Blob, name: string): Promise<string> {
  const path = personalSiteAuditImagePath({
    organizationId,
    ownerUserId: uid(),
    auditId,
    unixMs: Date.now(),
    extension: fileExtension(name) || 'jpg',
  })
  if (!path) throw new Error('You must be signed in to upload photos.')
  await uploadFile(path, file, file.type || 'image/jpeg')
  return path
}

/** Create Personal Site Audit (`personalSiteAuditWriteFields`); the document id is the one its photos were filed under. */
export async function savePersonalSiteAudit(organizationId: string, auditId: string, draft: PersonalSiteAuditDraft): Promise<void> {
  const me = uid()
  const error = personalSiteAuditValidationError(draft, { organizationId, ownerUserId: me })
  if (error) throw new Error(error)
  const fields = personalSiteAuditWriteFields({ ownerUserId: me, draft, organizationId })
  if (!fields) throw new Error('This audit cannot be saved.')
  await setDoc(doc(db, 'organizations', organizationId, PERSONAL_SITE_AUDITS_COLLECTION, auditId), {
    ...fields,
    createdAt: serverTimestamp(),
    ...metadata(),
  })
}

/** Attach a personal site audit: upload its frozen PDF copy into the claim folder and return the evidence entry. */
export async function attachPersonalAuditCopy(organizationId: string, audit: PersonalSiteAudit, pdfBytes: Uint8Array): Promise<PayeClaimEvidence> {
  const evidence = await uploadClaimEvidence({
    organizationId,
    file: new Blob([pdfBytes as BlobPart], { type: 'application/pdf' }),
    name: 'audit.pdf',
    contentType: 'application/pdf',
    kind: 'personalSiteAudit',
    auditId: audit.id,
  })
  return personalSiteAuditEvidence(audit, evidence.path)
}
