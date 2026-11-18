'use client'

/**
 * One sender per browser tab for site audits (project and personal). Uploads keep going after the create dialog
 * closes, every screen sees the same live state, and an audit that is not sent stays listed with Retry / Discard.
 */
import { useEffect, useState } from 'react'
import { deleteObject, getDownloadURL, ref } from 'firebase/storage'
import { doc, getDocFromServer } from 'firebase/firestore'
import { auth, db, storage } from '@/lib/firebase/config'
import { dateFromDayKeyInZone } from '@/lib/orgTime/zoneTime'
import { PERSONAL_SITE_AUDITS_COLLECTION } from '@/lib/canonical/personalSiteAudits'
import { organizationZoneOr } from '@/lib/orgTime/activeOrganizationZone'
import { watchedUpload } from '@/lib/firebase/watchedUpload'
import { savePersonalSiteAudit } from '@/lib/payeClaims/payeClaimsData'
import { useSiteAuditStore } from '@/lib/stores/siteAuditStore'
import {
  indexedDbOutboxStore,
  memoryOutboxStore,
  resilientOutboxStore,
  outboxRecordsToPrune,
  sendSiteAuditOutbox,
  uploadSiteAuditPhoto,
  type SendOutboxResult,
  type SiteAuditOutboxRecord,
  type SiteAuditOutboxStore,
} from '@/lib/siteAudit/siteAuditOutbox'

const memoryOnly = new Set<string>()

const store = resilientOutboxStore(typeof indexedDB === 'undefined' ? null : indexedDbOutboxStore(), memoryOutboxStore(), memoryOnly)
const live = new Map<string, SiteAuditOutboxRecord>()
const inFlight = new Map<string, Promise<SendOutboxResult>>()
const controllers = new Map<string, AbortController>()
const listeners = new Set<() => void>()
const notify = () => listeners.forEach((listener) => listener())

async function uploadPhoto(record: SiteAuditOutboxRecord, item: SiteAuditOutboxRecord['items'][number], onProgress: (f: number) => void) {
  const signedIn = auth?.currentUser?.uid
  if (!signedIn || signedIn !== record.userId) {
    throw Object.assign(new Error('Sign in as the person who made this audit, then retry.'), { code: 'storage/unauthenticated' })
  }
  const signal = controllers.get(record.id)?.signal
  return uploadSiteAuditPhoto(record, item.id, onProgress, {
    upload: async (path, progress) => {
      const result = await watchedUpload(path, item.photo, item.photo.type, { onProgress: progress, signal })
      return { imageURL: result.downloadURL, storagePath: result.storagePath }
    },
    existingImageURL: async (path) => {
      if (!storage) return null
      try {
        return await getDownloadURL(ref(storage, path))
      } catch {
        return null
      }
    },
  })
}

/** Whether the audit document is already saved (an earlier attempt, or edited since). Throws when it cannot tell. */
async function savedAlready(record: SiteAuditOutboxRecord): Promise<boolean> {
  if (!db) throw new Error('The database is not configured.')
  const path =
    record.kind === 'personal'
      ? doc(db, 'organizations', record.organizationId, PERSONAL_SITE_AUDITS_COLLECTION, record.id)
      : doc(db, 'organizations', record.organizationId, 'siteAudits', record.id)
  return (await getDocFromServer(path)).exists()
}

async function save(record: SiteAuditOutboxRecord): Promise<void> {
  if (controllers.get(record.id)?.signal.aborted) throw new Error('Stopped.')
  // Signed out or switched to another person while the photos uploaded: never save under someone else.
  if (auth?.currentUser?.uid !== record.userId) {
    throw Object.assign(new Error('Sign in as the person who made this audit, then retry.'), { code: 'unauthenticated' })
  }
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
  // The day as entered, at midnight in the organisation's time zone (never the browser's).
  const date = dateFromDayKeyInZone(record.meta.date, organizationZoneOr())
  await useSiteAuditStore.getState().saveAudit(record.organizationId, {
    id: record.id,
    projectId: project.id,
    projectJobNumber: project.jobNumber,
    projectName: project.siteName,
    type: record.meta.type,
    customTitle: record.meta.customTitle || undefined,
    authorName: record.meta.authorName,
    date,
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
  const controller = new AbortController()
  controllers.set(record.id, controller)
  const promise = sendSiteAuditOutbox(record, {
    store,
    signal: controller.signal,
    uploadPhoto,
    save,
    savedAlready,
    onChange: (next) => {
      live.set(next.id, next)
      notify()
    },
  }).finally(() => {
    inFlight.delete(record.id)
    controllers.delete(record.id)
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
 * Removes one unsent audit from this browser. Photos it already uploaded are deleted when the rules allow (the
 * uploader within the 15-minute undo window, rulebook §24); otherwise they are kept for recovery. An audit whose
 * document exists was saved (an earlier attempt finished): its photos are in use, so only this browser's copy goes
 * (review of #389). When that cannot be checked (offline), the photos are kept too.
 */
async function removeRecord(stored: SiteAuditOutboxRecord): Promise<void> {
  let saved = true
  try {
    saved = await savedAlready(stored)
  } catch {
    saved = true
  }
  if (storage && !saved) {
    await Promise.all(
      stored.items
        .map((item) => item.upload.storagePath)
        .filter((path): path is string => Boolean(path))
        .map((path) => deleteObject(ref(storage!, path)).catch(() => undefined))
    )
  }
  await store.remove(stored.id)
}

export async function discardSiteAudit(id: string): Promise<void> {
  if (inFlight.has(id)) throw new Error('This audit is still uploading. Wait for it to finish or fail, then discard it.')
  const stored = await store.get(id)
  if (stored) await removeRecord(stored)
  else await store.remove(id)
  notify()
}

/** The signed-in person's unsent audits in this browser, any organisation (the sign-out warning). */
export async function unsentSiteAuditCount(userId: string | null | undefined): Promise<number> {
  if (!userId) return 0
  const all = await store.listAll().catch(() => [])
  return all.filter((record) => record.userId === userId).length
}

/**
 * Removes the person's unsent audits from this browser — only after they chose to sign out and confirmed the warning
 * (review of #389, as the iPhone since 14 Nov). A forced sign-out never calls this: their audits stay, hidden from
 * anyone else, until they sign back in.
 */
export async function removeUnsentSiteAuditsFor(userId: string): Promise<void> {
  const all = await store.listAll().catch(() => [])
  for (const record of all) {
    if (record.userId !== userId) continue
    let latest: SiteAuditOutboxRecord | null = record
    const running = inFlight.get(record.id)
    if (running) {
      // Still uploading: stop it, wait for it to stop, then remove what it uploaded — so "removes it" is true.
      controllers.get(record.id)?.abort()
      const result = await running.catch(() => null)
      if (result?.saved) continue
      latest = result?.record ?? (await store.get(record.id).catch(() => null)) ?? record
    }
    await removeRecord(latest).catch(() => store.remove(record.id).catch(() => undefined))
  }
  notify()
}

/** Removes stale records (older than 30 days, or this person's in organisations they left — complete list only). */
export async function pruneSiteAuditOutbox(options: { userId?: string | null; memberOrganizationIds?: ReadonlyArray<string> | null }): Promise<void> {
  const all = await store.listAll().catch(() => [])
  const ids = outboxRecordsToPrune(all, { nowMs: Date.now(), ...options }).filter((id) => !inFlight.has(id))
  for (const id of ids) await store.remove(id).catch(() => undefined)
  if (ids.length > 0) notify()
}

export function isSiteAuditSending(id: string): boolean {
  return inFlight.has(id)
}

/** False while any unsent audit is kept only in this tab (the browser refused to store it): the screens say so. */
export function siteAuditOutboxPersistent(): boolean {
  return typeof indexedDB !== 'undefined' && memoryOnly.size === 0
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
    void pruneSiteAuditOutbox({ userId })
    listeners.add(load)
    return () => {
      active = false
      listeners.delete(load)
    }
  }, [organizationId, userId, filter?.kind, filter?.projectId])
  return records
}
