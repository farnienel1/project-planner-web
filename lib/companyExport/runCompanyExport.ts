/**
 * Company data export (launch checklist 2.1): reads the open organisation's documents in pages, builds the zip in
 * the browser and hands it to the browser as a download.
 *
 * Organisation context (AGENTS.md rule 2): the organisation id is captured once (`captureOrganizationContext`) and
 * checked after every page (`organizationContextStillCurrent`); a switch of company stops the export, so a zip never
 * mixes two companies. Only `organizations/{orgId}/…` of that organisation and the `users` roster query
 * (`organizationId ==` it, rulebook §1 / §11) plus its anchored members by id are read.
 *
 * The security rules are the guard. Every read here is one they allow an admin of the organisation; a read they
 * refuse is recorded in the README ("Could not be read") instead of failing the whole export.
 */
import {
  collection,
  doc,
  documentId,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
  where,
  type DocumentData,
  type Firestore,
  type QueryConstraint,
  type QueryDocumentSnapshot,
  type QuerySnapshot,
} from 'firebase/firestore'
import { captureOrganizationContext, organizationContextStillCurrent } from '@/lib/canonical'
import manifest from '@/lib/canonical/dist/canonical-manifest.json'
import {
  companyExportEntries,
  companyExportFileName,
  companyExportZip,
  type CollectedDocument,
  type CollectionProblem,
} from './archive'
import { canExportCompanyData, COMPANY_EXPORT_REFUSED_MESSAGE } from './access'
import { JOB_COLLECTIONS, organizationCollectionReads } from './sources'
import { organizationTimeZone } from '../canonical/organizationTimeZone'
import { parseOrganizationName } from '../canonical/organizationSettings'

export const COMPANY_EXPORT_PAGE_SIZE = 500
const JOB_READ_CONCURRENCY = 6

export type CompanyExportProgress = {
  /** What is being read, e.g. "Bookings". */
  label: string
  /** Documents read so far, all collections. */
  documentsRead: number
  step: number
  totalSteps: number
}

export class CompanyExportCancelled extends Error {
  constructor(message = 'Export cancelled.') {
    super(message)
    this.name = 'CompanyExportCancelled'
  }
}

export type CompanyExportResult = {
  fileName: string
  blob: Blob
  documentCount: number
  problems: CollectionProblem[]
}

type Viewer = Parameters<typeof canExportCompanyData>[0]

function errorMessage(error: unknown): string {
  const code = (error as { code?: unknown })?.code
  if (code === 'permission-denied') return 'permission denied by the security rules'
  if (typeof code === 'string' && code) return code
  return error instanceof Error ? error.message : 'read failed'
}

function isPermissionDenied(error: unknown): boolean {
  return (error as { code?: unknown })?.code === 'permission-denied'
}

function labelFor(name: string): string {
  return name.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase())
}

export async function runCompanyExport(options: {
  db: Firestore
  organizationId: string
  viewer: Viewer
  includeNotifications: boolean
  signal?: AbortSignal
  onProgress?: (progress: CompanyExportProgress) => void
  now?: () => Date
}): Promise<CompanyExportResult> {
  const { db, organizationId, signal } = options
  if (!canExportCompanyData(options.viewer, organizationId)) throw new Error(COMPANY_EXPORT_REFUSED_MESSAGE)
  const captured = captureOrganizationContext()
  const documents: CollectedDocument[] = []
  const problems: CollectionProblem[] = []
  const reads = organizationCollectionReads({ includeNotifications: options.includeNotifications })
  const totalSteps = reads.length + 3
  let step = 0
  let label = 'Organisation'

  const checkpoint = () => {
    if (signal?.aborted) throw new CompanyExportCancelled()
    if (!organizationContextStillCurrent(organizationId, captured)) {
      throw new CompanyExportCancelled('The organisation changed during the export, so it was stopped.')
    }
  }
  const report = () =>
    options.onProgress?.({ label, documentsRead: documents.length, step, totalSteps })

  /** Every document of a query, `COMPANY_EXPORT_PAGE_SIZE` at a time, in document-id order. */
  const readPaged = async (
    path: string[],
    collectionName: string,
    constraints: QueryConstraint[] = []
  ): Promise<QueryDocumentSnapshot<DocumentData>[]> => {
    const ref = collection(db, path[0], ...path.slice(1))
    const out: QueryDocumentSnapshot<DocumentData>[] = []
    let last: QueryDocumentSnapshot<DocumentData> | null = null
    for (;;) {
      checkpoint()
      const page: QuerySnapshot<DocumentData> = await getDocs(
        query(
          ref,
          ...constraints,
          orderBy(documentId()),
          ...(last ? [startAfter(last)] : []),
          limit(COMPANY_EXPORT_PAGE_SIZE)
        )
      )
      checkpoint()
      for (const snap of page.docs) {
        out.push(snap)
        documents.push({ collectionPath: path.join('/'), collection: collectionName, id: snap.id, data: snap.data() })
      }
      report()
      if (page.docs.length < COMPANY_EXPORT_PAGE_SIZE) return out
      last = page.docs[page.docs.length - 1]
    }
  }

  // 1. The organisation document.
  report()
  const orgSnap = await getDoc(doc(db, 'organizations', organizationId))
  checkpoint()
  if (!orgSnap.exists()) throw new Error('The organisation could not be read.')
  const organization = orgSnap.data() as Record<string, unknown>
  step += 1

  // 2. The roster: users where organizationId is this organisation, then anchored members by id.
  label = 'People'
  report()
  const seenUsers = new Set<string>()
  try {
    const users = await readPaged(['users'], 'users', [where('organizationId', '==', organizationId)])
    users.forEach((snap) => seenUsers.add(snap.id))
  } catch (error) {
    if (error instanceof CompanyExportCancelled) throw error
    problems.push({ collectionPath: `users (organizationId == ${organizationId})`, message: errorMessage(error) })
  }
  const members = organization.members && typeof organization.members === 'object' ? Object.keys(organization.members) : []
  const anchored = [...members, typeof organization.creatorUserId === 'string' ? organization.creatorUserId : '']
    .map((id) => id.trim())
    .filter((id) => id && !id.includes('/') && !seenUsers.has(id))
  for (const userId of [...new Set(anchored)]) {
    checkpoint()
    try {
      const snap = await getDoc(doc(db, 'users', userId))
      checkpoint()
      if (snap.exists()) {
        seenUsers.add(userId)
        documents.push({ collectionPath: 'users', collection: 'users', id: userId, data: snap.data() })
      }
    } catch (error) {
      if (error instanceof CompanyExportCancelled) throw error
      // A member whose users document names another company and that the rules do not let us read: skipped.
    }
  }
  step += 1

  // 3. Every organisation collection.
  const jobIds: Record<string, string[]> = { projects: [], smallWorks: [] }
  const deferred: typeof reads = []
  for (const read of reads) {
    label = labelFor(read.collection)
    report()
    const path = ['organizations', organizationId, read.collection]
    try {
      const snaps = await readPaged(path, read.collection)
      if (read.collection in jobIds) jobIds[read.collection] = snaps.map((snap) => snap.id)
    } catch (error) {
      if (error instanceof CompanyExportCancelled) throw error
      if (read.perJobFallbackField && isPermissionDenied(error)) deferred.push(read)
      else problems.push({ collectionPath: path.join('/'), message: errorMessage(error) })
    }
    step += 1
  }

  // Variations: the rules only allow queries that name the job (`parentId ==`), one job at a time.
  for (const read of deferred) {
    label = labelFor(read.collection)
    const path = ['organizations', organizationId, read.collection]
    const failures: string[] = []
    for (const jobId of [...jobIds.projects, ...jobIds.smallWorks]) {
      try {
        await readPaged(path, read.collection, [where(read.perJobFallbackField as string, '==', jobId)])
      } catch (error) {
        if (error instanceof CompanyExportCancelled) throw error
        failures.push(`${jobId}: ${errorMessage(error)}`)
      }
    }
    if (failures.length > 0) {
      problems.push({ collectionPath: path.join('/'), message: `some jobs could not be read (${failures.slice(0, 5).join('; ')})` })
    }
  }

  // 4. Each job's nested health & safety documents.
  label = 'Health & safety'
  report()
  const jobs = JOB_COLLECTIONS.flatMap((kind) => jobIds[kind].map((id) => ({ kind, id })))
  let next = 0
  const hsFailures: string[] = []
  const worker = async () => {
    while (next < jobs.length) {
      const job = jobs[next++]
      try {
        await readPaged(['organizations', organizationId, job.kind, job.id, 'healthSafety'], 'healthSafety')
      } catch (error) {
        if (error instanceof CompanyExportCancelled) throw error
        hsFailures.push(`${job.kind}/${job.id}: ${errorMessage(error)}`)
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(JOB_READ_CONCURRENCY, jobs.length) }, worker))
  if (hsFailures.length > 0) {
    problems.push({
      collectionPath: `organizations/${organizationId}/{projects|smallWorks}/{jobId}/healthSafety`,
      message: `${hsFailures.length} job(s) could not be read (${hsFailures.slice(0, 5).join('; ')})`,
    })
  }
  step += 1

  // 5. Build the zip.
  label = 'Building the zip'
  report()
  checkpoint()
  const exportedAt = (options.now ?? (() => new Date()))()
  const entries = companyExportEntries({
    organizationId,
    organization,
    documents,
    problems,
    includeNotifications: options.includeNotifications,
    exportedAt,
    rulebookVersion: typeof manifest.rulebookVersion === 'string' ? manifest.rulebookVersion : '',
  })
  const bytes = companyExportZip(entries, exportedAt)
  checkpoint()
  const timeZone = organizationTimeZone(typeof organization.countryCode === 'string' ? organization.countryCode : null)
  return {
    fileName: companyExportFileName(parseOrganizationName(organization) || 'company', exportedAt, timeZone),
    blob: new Blob([bytes as BlobPart], { type: 'application/zip' }),
    documentCount: documents.length + 1,
    problems,
  }
}

/** Hands a blob to the browser as a download (blob URL + anchor). */
export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.rel = 'noopener'
  anchor.style.display = 'none'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  // Give the browser time to start the download before the URL is released.
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000)
}
