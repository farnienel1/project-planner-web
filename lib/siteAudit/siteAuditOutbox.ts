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
  remove(id: string): Promise<void>
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
        const transaction = db.transaction(STORE, mode)
        const request = run(transaction.objectStore(STORE))
        transaction.oncomplete = () => {
          db.close()
          resolve(request ? (request.result as T) : undefined)
        }
        transaction.onerror = () => {
          db.close()
          reject(transaction.error ?? new Error('The browser store failed.'))
        }
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
    async remove(id) {
      await tx('readwrite', (store) => store.delete(id))
    },
  }
}

export type SendOutboxDeps = {
  store: SiteAuditOutboxStore
  /** Uploads one item's photo; returns its URL and Storage path. */
  uploadPhoto: (record: SiteAuditOutboxRecord, item: SiteAuditOutboxItem, onProgress: (fraction: number) => void) => Promise<{ imageURL: string; storagePath: string }>
  /** Writes the audit document (every photo uploaded). */
  save: (record: SiteAuditOutboxRecord) => Promise<void>
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
        void deps.store.put({ ...record, updatedAtMs: now() }).catch(() => undefined)
      }
    },
  })
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
