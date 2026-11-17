'use client'

/**
 * One sender per browser tab for site audits (project and personal). Uploads keep going after the create dialog
 * closes, every screen sees the same live state, and an audit that is not sent stays listed with Retry / Discard.
 */
import { useEffect, useState } from 'react'
import { deleteObject, ref } from 'firebase/storage'
import { auth, storage } from '@/lib/firebase/config'
import { watchedUpload } from '@/lib/firebase/watchedUpload'
import { siteAuditImagePath } from '@/lib/firebase/storageUtils'
import { personalSiteAuditImagePath } from '@/lib/canonical/personalSiteAudits'
import { fileExtension } from '@/lib/security/uploadLimits'
import { savePersonalSiteAudit } from '@/lib/payeClaims/payeClaimsData'
import { useSiteAuditStore } from '@/lib/stores/siteAuditStore'
import {
  indexedDbOutboxStore,
  memoryOutboxStore,
  sendSiteAuditOutbox,
  type SendOutboxResult,
  type SiteAuditOutboxRecord,
  type SiteAuditOutboxStore,
} from '@/lib/siteAudit/siteAuditOutbox'

let fallback: SiteAuditOutboxStore | null = null
/** False when this browser cannot keep a copy (private window, storage blocked): the screens say so. */
let persistent = true

function resilientStore(): SiteAuditOutboxStore {
  const primary = typeof indexedDB === 'undefined' ? null : indexedDbOutboxStore()
  const memory = () => (fallback ??= memoryOutboxStore())
  const guard = async <T,>(run: (store: SiteAuditOutboxStore) => Promise<T>): Promise<T> => {
    if (primary && persistent) {
      try {
        return await run(primary)
      } catch {
        persistent = false
      }
    } else {
      persistent = false
    }
    return run(memory())
  }
  return {
    put: (record) => guard((store) => store.put(record)),
    get: (id) => guard((store) => store.get(id)),
    list: (org, user) => guard((store) => store.list(org, user)),
    remove: (id) => guard((store) => store.remove(id)),
  }
}

const store = resilientStore()
const live = new Map<string, SiteAuditOutboxRecord>()
const inFlight = new Map<string, Promise<SendOutboxResult>>()
const listeners = new Set<() => void>()
const notify = () => listeners.forEach((listener) => listener())

function itemExtension(fileName: string, type: string): string {
  return fileExtension(fileName) || (type === 'image/png' ? 'png' : type === 'image/webp' ? 'webp' : type.includes('hei') ? 'heic' : 'jpg')
}

async function uploadPhoto(record: SiteAuditOutboxRecord, item: SiteAuditOutboxRecord['items'][number], onProgress: (f: number) => void) {
  const signedIn = auth?.currentUser?.uid
  if (!signedIn || signedIn !== record.userId) {
    throw Object.assign(new Error('Sign in as the person who made this audit, then retry.'), { code: 'storage/unauthenticated' })
  }
  const path =
    record.kind === 'personal'
      ? personalSiteAuditImagePath({
          organizationId: record.organizationId,
          ownerUserId: record.userId,
          auditId: record.id,
          unixMs: Date.now(),
          extension: itemExtension(item.fileName, item.photo.type),
        })
      : siteAuditImagePath(record.organizationId, record.id, item.fileName)
  if (!path) throw Object.assign(new Error('This photo has no valid place to upload to.'), { code: 'storage/invalid-argument' })
  const result = await watchedUpload(path, item.photo, item.photo.type, { onProgress })
  return { imageURL: result.downloadURL, storagePath: result.storagePath }
}

async function save(record: SiteAuditOutboxRecord): Promise<void> {
  if (record.kind === 'personal') {
    await savePersonalSiteAudit(record.organizationId, record.id, {
      jobNumber: record.meta.jobNumber ?? '',
      jobName: record.meta.jobName ?? '',
      type: record.meta.type,
      customTitle: record.meta.customTitle,
      date: record.meta.date,
      authorName: record.meta.authorName,
      items: record.items.map((item) => ({
        id: item.id,
        title: item.title,
        location: item.location,
        comments: item.comments,
        imagePath: item.upload.storagePath ?? '',
        takenAtMs: item.takenAtMs,
      })),
    })
    return
  }
  const project = record.project
  if (!project) throw new Error('This audit has no job.')
  const [y, m, d] = record.meta.date.split('-').map(Number)
  await useSiteAuditStore.getState().saveAudit(record.organizationId, {
    id: record.id,
    projectId: project.id,
    projectJobNumber: project.jobNumber,
    projectName: project.siteName,
    type: record.meta.type,
    customTitle: record.meta.customTitle || undefined,
    authorName: record.meta.authorName,
    date: new Date(y, (m || 1) - 1, d || 1),
    createdByUserId: record.userId,
    visibleToOperatives: record.meta.visibleToOperatives ?? true,
    items: record.items.map((item) => ({
      id: item.id,
      title: item.title,
      location: item.location,
      assignee: item.assignee,
      comments: item.comments,
      annotations: item.annotations,
      imageURL: item.upload.imageURL,
      createdAt: new Date(item.takenAtMs),
      imageCapturedAt: new Date(item.takenAtMs),
    })),
  })
}

/** Stores the audit in this browser, then uploads and saves it. Safe to call again for Retry. */
export function sendSiteAudit(record: SiteAuditOutboxRecord): Promise<SendOutboxResult> {
  const running = inFlight.get(record.id)
  if (running) return running
  const promise = sendSiteAuditOutbox(record, {
    store,
    uploadPhoto,
    save,
    onChange: (next) => {
      live.set(next.id, next)
      notify()
    },
  }).finally(() => {
    inFlight.delete(record.id)
    live.delete(record.id)
    notify()
  })
  inFlight.set(record.id, promise)
  return promise
}

export async function retrySiteAudit(id: string): Promise<SendOutboxResult | null> {
  const stored = live.get(id) ?? (await store.get(id))
  return stored ? sendSiteAudit(stored) : null
}

/**
 * Removes an unsent audit from this browser. Photos it already uploaded are deleted when the rules allow (the
 * uploader within the 15-minute undo window, rulebook §24); otherwise they are kept for recovery.
 */
export async function discardSiteAudit(id: string): Promise<void> {
  if (inFlight.has(id)) throw new Error('This audit is still uploading. Wait for it to finish or fail, then discard it.')
  const stored = await store.get(id)
  if (stored && storage) {
    await Promise.all(
      stored.items
        .map((item) => item.upload.storagePath)
        .filter((path): path is string => Boolean(path))
        .map((path) => deleteObject(ref(storage, path)).catch(() => undefined))
    )
  }
  await store.remove(id)
  notify()
}

export function isSiteAuditSending(id: string): boolean {
  return inFlight.has(id)
}

export function siteAuditOutboxPersistent(): boolean {
  return persistent
}

/** Unsent audits of the signed-in user in this organisation, with live upload state; optional job filter. */
export function useSiteAuditOutbox(
  organizationId: string | null | undefined,
  userId: string | null | undefined,
  filter?: { kind?: SiteAuditOutboxRecord['kind']; projectId?: string }
): SiteAuditOutboxRecord[] {
  const [records, setRecords] = useState<SiteAuditOutboxRecord[]>([])
  useEffect(() => {
    if (!organizationId || !userId) {
      setRecords([])
      return
    }
    let active = true
    const load = () => {
      void store
        .list(organizationId, userId)
        .then((stored) => {
          if (!active) return
          const merged = stored.map((record) => live.get(record.id) ?? record)
          setRecords(
            merged.filter(
              (record) =>
                (!filter?.kind || record.kind === filter.kind) &&
                (!filter?.projectId || record.project?.id.toLowerCase() === filter.projectId.toLowerCase())
            )
          )
        })
        .catch(() => undefined)
    }
    load()
    listeners.add(load)
    return () => {
      active = false
      listeners.delete(load)
    }
  }, [organizationId, userId, filter?.kind, filter?.projectId])
  return records
}
