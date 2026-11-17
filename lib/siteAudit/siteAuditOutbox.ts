/**
 * The site audit outbox (owner bug 17 Nov: a stuck upload lost the whole audit).
 *
 * Submit writes the audit — its text, items and prepared photos — to this browser (IndexedDB) BEFORE any upload, so
 * backing out, closing the tab or a stuck photo never loses it. The audit stays listed as "Not sent" until the
 * Firestore save succeeds; each photo's upload state is kept with it, so Retry only sends what failed. Records are
 * keyed by organisation and signed-in user and only that user is shown them (rulebook §1: device storage is a
 * cache; the audit document is still the one source of truth once saved).
 */
import { runPhotoUploads, uploadSummary, type PhotoUpload, type UploadSummary } from '@/lib/siteAudit/auditPhotoUploads'

export type SiteAuditOutboxItem = {
  id: string
  title: string
  location: string
  comments: string
  assignee: string
  annotations: string
  takenAtMs: number
  photo: Blob
  fileName: string
  upload: PhotoUpload
}

export type SiteAuditOutboxRecord = {
  /** The audit document id the photos are filed under. */
  id: string
  kind: 'project' | 'personal'
  organizationId: string
  userId: string
  createdAtMs: number
  updatedAtMs: number
  /** Project audits: the job. */
  project?: { id: string; jobNumber: string; siteName: string }
  meta: {
    type: string
    customTitle: string
    /** `YYYY-MM-DD` as entered. */
    date: string
    authorName: string
    visibleToOperatives?: boolean
    /** Personal audits. */
    jobNumber?: string
    jobName?: string
  }
  items: SiteAuditOutboxItem[]
  /** Last failure to show beside Retry (an upload or the save). */
  lastError?: string
}

export interface SiteAuditOutboxStore {
  put(record: SiteAuditOutboxRecord): Promise<void>
  get(id: string): Promise<SiteAuditOutboxRecord | null>
  list(organizationId: string, userId: string): Promise<SiteAuditOutboxRecord[]>
  /** Every record in this browser, any organisation or user (pruning only). */
  listAll(): Promise<SiteAuditOutboxRecord[]>
  remove(id: string): Promise<void>
}

/** Unsent audits older than this are removed from the browser (privacy; review of #389). */
export const SITE_AUDIT_OUTBOX_MAX_AGE_DAYS = 30

/**
 * The records to remove from this browser: any record not touched for `SITE_AUDIT_OUTBOX_MAX_AGE_DAYS`, and the
 * signed-in user's records in organisations they no longer belong to (only when the membership list is complete —
 * an incomplete list never removes anything).
 */
export function outboxRecordsToPrune(
  records: ReadonlyArray<Pick<SiteAuditOutboxRecord, 'id' | 'organizationId' | 'userId' | 'updatedAtMs' | 'createdAtMs'>>,
  options: { nowMs: number; userId?: string | null; memberOrganizationIds?: ReadonlyArray<string> | null }
): string[] {
  const cutoff = options.nowMs - SITE_AUDIT_OUTBOX_MAX_AGE_DAYS * 24 * 60 * 60 * 1000
  const members = options.memberOrganizationIds ? new Set(options.memberOrganizationIds) : null
  return records
    .filter((record) => {
      if (Math.max(record.updatedAtMs || 0, record.createdAtMs || 0) < cutoff) return true
      return Boolean(members && options.userId && record.userId === options.userId && !members.has(record.organizationId))
    })
    .map((record) => record.id)
}

export function outboxSummary(record: SiteAuditOutboxRecord): UploadSummary {
  return uploadSummary(record.items.map((item) => item.upload))
}

export function memoryOutboxStore(): SiteAuditOutboxStore & { records: Map<string, SiteAuditOutboxRecord> } {
  const records = new Map<string, SiteAuditOutboxRecord>()
  return {
    records,
    async put(record) {
      records.set(record.id, structuredCloneSafe(record))
    },
    async get(id) {
      const found = records.get(id)
      return found ? structuredCloneSafe(found) : null
    },
    async list(organizationId, userId) {
      return [...records.values()]
        .filter((record) => record.organizationId === organizationId && record.userId === userId)
        .map(structuredCloneSafe)
        .sort((a, b) => b.createdAtMs - a.createdAtMs)
    },
    async listAll() {
      return [...records.values()].map(structuredCloneSafe)
    },
    async remove(id) {
      records.delete(id)
    },
  }
}

function structuredCloneSafe<T>(value: T): T {
  // Blobs are immutable, so a shallow copy of arrays and objects is enough here.
  const record = value as unknown as SiteAuditOutboxRecord
  return { ...record, meta: { ...record.meta }, items: record.items.map((item) => ({ ...item, upload: { ...item.upload } })) } as unknown as T
}

const DB_NAME = 'pp-site-audit-outbox'
const STORE = 'audits'

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' })
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Could not open the browser store.'))
  })
}

function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T> | null): Promise<T | undefined> {
  return openDb().then(
    (db) =>
      new Promise<T | undefined>((resolve, reject) => {
        let transaction: IDBTransaction
        let request: IDBRequest<T> | null
        try {
          transaction = db.transaction(STORE, mode)
          request = run(transaction.objectStore(STORE))
        } catch (error) {
          db.close()
          reject(error)
          return
        }
        let done = false
        const fail = (error: unknown) => {
          if (done) return
          done = true
          db.close()
          reject(error ?? new Error('The browser store failed.'))
        }
        transaction.oncomplete = () => {
          if (done) return
          done = true
          db.close()
          resolve(request ? (request.result as T) : undefined)
        }
        transaction.onerror = () => fail(transaction.error)
        // A full disk (QuotaExceededError) aborts the transaction without an error event on some browsers: the
        // caller must hear it, so the memory fallback takes over (review of #389).
        transaction.onabort = () => fail(transaction.error ?? new DOMException('The browser store was aborted.', 'AbortError'))
        if (request) request.onerror = () => fail(request?.error)
      })
  )
}

/** The browser outbox (IndexedDB). Every call can throw (private window, storage blocked): callers fall back. */
export function indexedDbOutboxStore(): SiteAuditOutboxStore {
  return {
    async put(record) {
      await tx('readwrite', (store) => store.put(record))
    },
    async get(id) {
      return ((await tx<SiteAuditOutboxRecord>('readonly', (store) => store.get(id))) as SiteAuditOutboxRecord | undefined) ?? null
    },
    async list(organizationId, userId) {
      const all = ((await tx<SiteAuditOutboxRecord[]>('readonly', (store) => store.getAll())) ?? []) as SiteAuditOutboxRecord[]
      return all
        .filter((record) => record.organizationId === organizationId && record.userId === userId)
        .sort((a, b) => b.createdAtMs - a.createdAtMs)
    },
    async listAll() {
      return ((await tx<SiteAuditOutboxRecord[]>('readonly', (store) => store.getAll())) ?? []) as SiteAuditOutboxRecord[]
    },
    async remove(id) {
      await tx('readwrite', (store) => store.delete(id))
    },
  }
}

/**
 * The browser store with a per-record memory fallback (review of #389): a write the browser refuses (private window,
 * a full disk) keeps that record in this tab only (`memoryOnly`); every other record keeps using the browser store.
 * A remove always removes both copies, so a record never comes back from the other one, and reads prefer the newer
 * copy. Reading a failing browser store gives the memory copies only (never an error).
 */
export function resilientOutboxStore(
  primary: SiteAuditOutboxStore | null,
  memory: SiteAuditOutboxStore,
  memoryOnly: Set<string> = new Set()
): SiteAuditOutboxStore {
  const newer = (a: SiteAuditOutboxRecord | null, b: SiteAuditOutboxRecord | null) =>
    !a ? b : !b ? a : (b.updatedAtMs || 0) > (a.updatedAtMs || 0) ? b : a
  const safely = async <T,>(run: () => Promise<T>, otherwise: T): Promise<T> => {
    try {
      return await run()
    } catch {
      return otherwise
    }
  }
  const mergeLists = (stored: SiteAuditOutboxRecord[], kept: SiteAuditOutboxRecord[]) => {
    const byId = new Map<string, SiteAuditOutboxRecord>()
    for (const record of [...stored, ...kept]) byId.set(record.id, newer(byId.get(record.id) ?? null, record) as SiteAuditOutboxRecord)
    return [...byId.values()].sort((a, b) => b.createdAtMs - a.createdAtMs)
  }
  return {
    async put(record) {
      if (primary) {
        try {
          await primary.put(record)
          memoryOnly.delete(record.id)
          await memory.remove(record.id)
          return
        } catch {
          /* kept in this tab below */
        }
      }
      memoryOnly.add(record.id)
      await memory.put(record)
    },
    async get(id) {
      const stored = primary ? await safely(() => primary.get(id), null) : null
      return newer(stored, await memory.get(id))
    },
    async list(org, user) {
      const stored = primary ? await safely(() => primary.list(org, user), []) : []
      return mergeLists(stored, await memory.list(org, user))
    },
    async listAll() {
      const stored = primary ? await safely(() => primary.listAll(), []) : []
      return mergeLists(stored, await memory.listAll())
    },
    async remove(id) {
      memoryOnly.delete(id)
      await memory.remove(id)
      if (primary) await primary.remove(id)
    },
  }
}

export type SendOutboxDeps = {
  store: SiteAuditOutboxStore
  /** Uploads one item's photo; returns its URL and Storage path. */
  uploadPhoto: (record: SiteAuditOutboxRecord, item: SiteAuditOutboxItem, onProgress: (fraction: number) => void) => Promise<{ imageURL: string; storagePath: string }>
  /** Writes the audit document (every photo uploaded). */
  save: (record: SiteAuditOutboxRecord) => Promise<void>
  /**
   * Whether the audit document already exists (an earlier attempt saved it, or it was edited since). Such a record
   * is finished: it is removed and never written again, so a stale copy never overwrites newer data. Throws when it
   * cannot tell (offline): the save then waits for Retry.
   */
  savedAlready?: (record: SiteAuditOutboxRecord) => Promise<boolean>
  onChange?: (record: SiteAuditOutboxRecord) => void
  now?: () => number
  online?: () => boolean
  sleep?: (ms: number) => Promise<void>
  concurrency?: number
}

export type SendOutboxResult = { saved: boolean; record: SiteAuditOutboxRecord; summary: UploadSummary; error?: string }

/**
 * Sends one outbox record: keeps it stored, uploads every photo not yet uploaded, then saves the audit and removes the
 * record. On any failure the record stays (with each photo's state and the error) for Retry.
 */
export async function sendSiteAuditOutbox(input: SiteAuditOutboxRecord, deps: SendOutboxDeps): Promise<SendOutboxResult> {
  const now = deps.now ?? Date.now
  let record: SiteAuditOutboxRecord = { ...input, lastError: undefined, updatedAtMs: now() }
  await deps.store.put(record)
  deps.onChange?.(record)
  let lastPersistedStatuses = statusKey(record)
  // Status writes run one after another and are awaited before the end, so a finished photo is on disk.
  let persisting: Promise<void> = Promise.resolve()
  const persist = (next: SiteAuditOutboxRecord) => {
    persisting = persisting.then(() => deps.store.put(next)).catch(() => undefined)
  }
  const finishedElsewhere = async (): Promise<boolean> => {
    if (!deps.savedAlready) return false
    try {
      return await deps.savedAlready(record)
    } catch {
      return false
    }
  }
  if (await finishedElsewhere()) {
    await deps.store.remove(record.id)
    return { saved: true, record, summary: uploadSummary(record.items.map((item) => item.upload)) }
  }

  const finalPhotos = await runPhotoUploads({
    photos: record.items.map((item) => item.upload),
    concurrency: deps.concurrency,
    online: deps.online,
    sleep: deps.sleep,
    upload: (itemId, { onProgress }) => {
      const item = record.items.find((row) => row.id === itemId)
      if (!item) return Promise.reject(new Error('This photo is missing from the audit.'))
      return deps.uploadPhoto(record, item, onProgress)
    },
    onChange: (photos) => {
      record = { ...record, items: record.items.map((item) => ({ ...item, upload: photos.find((photo) => photo.itemId === item.id) ?? item.upload })) }
      deps.onChange?.(record)
      // Persist on a status change (not on every progress tick), so a finished photo is never re-sent after a reload.
      const key = statusKey(record)
      if (key !== lastPersistedStatuses) {
        lastPersistedStatuses = key
        persist({ ...record, updatedAtMs: now() })
      }
    },
  })
  await persisting
  record = { ...record, items: record.items.map((item) => ({ ...item, upload: finalPhotos.find((photo) => photo.itemId === item.id) ?? item.upload })) }
  const summary = uploadSummary(finalPhotos)
  if (summary.done !== summary.total) {
    const firstError = finalPhotos.find((photo) => photo.status === 'failed')?.error
    record = { ...record, lastError: firstError ? `${summary.label}. ${firstError}` : summary.label, updatedAtMs: now() }
    await deps.store.put(record)
    deps.onChange?.(record)
    return { saved: false, record, summary, error: record.lastError }
  }
  try {
    if (deps.savedAlready && (await deps.savedAlready(record))) {
      await deps.store.remove(record.id)
      return { saved: true, record, summary }
    }
    await deps.save(record)
  } catch (error) {
    const message = error instanceof Error && error.message ? error.message : 'The audit could not be saved.'
    record = { ...record, lastError: `Photos uploaded, but the audit was not saved: ${message} Retry to save it.`, updatedAtMs: now() }
    await deps.store.put(record)
    deps.onChange?.(record)
    return { saved: false, record, summary, error: record.lastError }
  }
  await deps.store.remove(record.id)
  return { saved: true, record, summary }
}

function statusKey(record: SiteAuditOutboxRecord): string {
  return record.items.map((item) => `${item.id}:${item.upload.status}`).join('|')
}
