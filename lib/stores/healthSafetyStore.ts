'use client'

import { create } from 'zustand'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase/config'
import {
  healthSafetyDocPath,
  legacyHealthSafetySettingsDocId,
} from '@/lib/healthSafety/healthSafetyPaths'
import { parseHealthSafetyPayload, mergeHealthSafetyPayload } from '@/lib/healthSafety/parseHealthSafety'
import { serializeHealthSafetyPayload } from '@/lib/healthSafety/serializeHealthSafety'
import type { HSProjectSafetyData, HSToolboxTalk } from '@/types'
import { newUuid, sanitizeForFirestore } from '@/lib/firebase/firestoreUtils'
import { startOfWeek } from 'date-fns'
import { saveInboxNotification } from '@/lib/firebase/notifyInbox'

const emptyData = (): HSProjectSafetyData => ({
  talks: [],
  issues: [],
  signatures: [],
  ramsDocuments: [],
  otherDocuments: [],
  updatedAt: new Date(),
})

function hsDocRef(organizationId: string, projectId: string, isSmallWorks: boolean) {
  const { segments } = healthSafetyDocPath(organizationId, projectId, isSmallWorks)
  return doc(db, ...(segments as [string, string, string, string, string, string]))
}

function legacyHsDocRef(organizationId: string, projectId: string, isSmallWorks: boolean) {
  return doc(
    db,
    'organizations',
    organizationId,
    'settings',
    legacyHealthSafetySettingsDocId(projectId, isSmallWorks)
  )
}

interface HealthSafetyState {
  data: HSProjectSafetyData | null
  projectKey: string | null
  loading: boolean
  error: string | null
  load: (organizationId: string, projectId: string, isSmallWorks: boolean) => Promise<void>
  save: (organizationId: string, projectId: string, isSmallWorks: boolean, data: HSProjectSafetyData) => Promise<void>
  issueToolboxTalk: (
    organizationId: string,
    projectId: string,
    isSmallWorks: boolean,
    talkId: string,
    recipientUserIds: string[],
    issuedByUserId: string,
    options?: { weekCommencing?: Date; publishAt?: Date }
  ) => Promise<void>
  signToolboxTalk: (
    organizationId: string,
    projectId: string,
    isSmallWorks: boolean,
    issueId: string,
    userId: string,
    signatureImageBase64: string,
    aliasUserIds?: string[]
  ) => Promise<void>
  addToolboxTalk: (
    organizationId: string,
    projectId: string,
    isSmallWorks: boolean,
    talk: Omit<HSToolboxTalk, 'id' | 'updatedAt'> & { id?: string }
  ) => Promise<void>
  remindPending: (
    organizationId: string,
    projectId: string,
    isSmallWorks: boolean,
    issueId: string,
    talkTitle: string
  ) => Promise<void>
  addRecipients: (
    organizationId: string,
    projectId: string,
    isSmallWorks: boolean,
    issueId: string,
    userIds: string[]
  ) => Promise<void>
}

export const useHealthSafetyStore = create<HealthSafetyState>((set, get) => ({
  data: null,
  projectKey: null,
  loading: false,
  error: null,

  load: async (organizationId, projectId, isSmallWorks) => {
    const projectKey = `${organizationId}:${projectId}:${isSmallWorks ? 'sw' : 'p'}`
    const stale = get().projectKey !== projectKey
    if (stale || !get().data) set({ loading: true, error: null, data: stale ? null : get().data, projectKey })
    else set({ error: null })
    try {
      const [primary, legacy] = await Promise.all([
        getDoc(hsDocRef(organizationId, projectId, isSmallWorks)),
        getDoc(legacyHsDocRef(organizationId, projectId, isSmallWorks)),
      ])
      const parsedPrimary = primary.exists()
        ? parseHealthSafetyPayload(primary.data() as Record<string, unknown>, projectId)
        : emptyData()
      const parsedLegacy = legacy.exists()
        ? parseHealthSafetyPayload(legacy.data() as Record<string, unknown>, projectId)
        : emptyData()
      const data = mergeHealthSafetyPayload(parsedPrimary, parsedLegacy)
      set({ data, projectKey, loading: false, error: null })
    } catch (error: unknown) {
      set({ error: error instanceof Error ? error.message : 'Failed to load H&S', loading: false })
    }
  },

  save: async (organizationId, projectId, isSmallWorks, data) => {
    const payload = sanitizeForFirestore(serializeHealthSafetyPayload(data)) as Record<string, unknown>
    await Promise.all([
      setDoc(hsDocRef(organizationId, projectId, isSmallWorks), payload, { merge: true }),
      setDoc(legacyHsDocRef(organizationId, projectId, isSmallWorks), payload, { merge: true }),
    ])
    set({ data: { ...data, updatedAt: new Date() } })
  },

  issueToolboxTalk: async (organizationId, projectId, isSmallWorks, talkId, recipientUserIds, issuedByUserId, options) => {
    const current = get().data ?? emptyData()
    const issueId = newUuid()
    const now = new Date()
    const weekCommencing = options?.weekCommencing ?? startOfWeek(now, { weekStartsOn: 1 })
    const issue = {
      id: issueId,
      projectId,
      talkId,
      weekCommencing,
      issuedByUserId,
      issuedAt: now,
      publishAt: options?.publishAt,
      recipientUserIds,
      status: options?.publishAt && options.publishAt > now ? 'scheduled' : 'awaiting',
    }
    const signatures = recipientUserIds.map((userId) => ({
      id: newUuid(),
      issueId,
      userId,
      status: 'pending',
      readConfirmed: false,
    }))
    await get().save(organizationId, projectId, isSmallWorks, {
      ...current,
      issues: [issue, ...current.issues],
      signatures: [...signatures, ...current.signatures],
    })
  },

  signToolboxTalk: async (organizationId, projectId, isSmallWorks, issueId, userId, signatureImageBase64, aliasUserIds) => {
    const current = get().data ?? emptyData()
    const now = new Date()
    const ids = new Set([userId, ...(aliasUserIds || [])].filter(Boolean))
    const signatures = current.signatures.map((sig) =>
      sig.issueId === issueId && ids.has(sig.userId)
        ? {
            ...sig,
            status: 'signed',
            readConfirmed: true,
            signatureImageBase64,
            signedAt: now,
          }
        : sig
    )
    const allSigned = signatures
      .filter((s) => s.issueId === issueId)
      .every((s) => s.status === 'signed')
    const issues = current.issues.map((issue) =>
      issue.id === issueId ? { ...issue, status: allSigned ? 'complete' : issue.status } : issue
    )
    await get().save(organizationId, projectId, isSmallWorks, { ...current, signatures, issues })
  },

  addToolboxTalk: async (organizationId, projectId, isSmallWorks, talk) => {
    const current = get().data ?? emptyData()
    const entry: HSToolboxTalk = {
      id: talk.id || newUuid(),
      referenceCode: talk.referenceCode,
      title: talk.title,
      category: talk.category,
      isGeneral: talk.isGeneral,
      trades: talk.trades,
      purpose: talk.purpose,
      keyPoints: talk.keyPoints,
      source: talk.source || 'uploaded',
      status: talk.status || 'approved',
      version: talk.version ?? 1,
      updatedAt: new Date(),
      fileURL: talk.fileURL,
    }
    await get().save(organizationId, projectId, isSmallWorks, {
      ...current,
      talks: [entry, ...current.talks.filter((t) => t.id !== entry.id)],
    })
  },

  remindPending: async (organizationId, projectId, isSmallWorks, issueId, talkTitle) => {
    const current = get().data ?? emptyData()
    const now = new Date()
    const pending = current.signatures.filter((sig) => sig.issueId === issueId && sig.status !== 'signed')
    const signatures = current.signatures.map((sig) =>
      sig.issueId === issueId && sig.status !== 'signed' ? { ...sig, reminderSentAt: now } : sig
    )
    await get().save(organizationId, projectId, isSmallWorks, { ...current, signatures })
    await Promise.all(
      pending.map((sig) =>
        saveInboxNotification({
          organizationId,
          type: 'hs_toolbox_reminder',
          title: 'Toolbox talk reminder',
          message: `Please sign “${talkTitle}”.`,
          userId: sig.userId,
          relatedId: issueId,
        })
      )
    )
  },

  addRecipients: async (organizationId, projectId, isSmallWorks, issueId, userIds) => {
    const current = get().data ?? emptyData()
    const issue = current.issues.find((row) => row.id === issueId)
    if (!issue) return
    const existing = new Set(issue.recipientUserIds)
    const extra = userIds.filter((id) => id && !existing.has(id))
    if (extra.length === 0) return
    const signatures = [
      ...extra.map((userId) => ({
        id: newUuid(),
        issueId,
        userId,
        status: 'pending' as const,
        readConfirmed: false,
      })),
      ...current.signatures,
    ]
    const issues = current.issues.map((row) =>
      row.id === issueId
        ? {
            ...row,
            recipientUserIds: [...row.recipientUserIds, ...extra],
            status: row.status === 'complete' ? 'awaiting' : row.status,
          }
        : row
    )
    await get().save(organizationId, projectId, isSmallWorks, { ...current, issues, signatures })
  },
}))
