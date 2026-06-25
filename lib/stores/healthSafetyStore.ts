'use client'

import { create } from 'zustand'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase/config'
import {
  healthSafetyDocPath,
  legacyHealthSafetySettingsDocId,
} from '@/lib/healthSafety/healthSafetyPaths'
import { parseHealthSafetyPayload } from '@/lib/healthSafety/parseHealthSafety'
import { serializeHealthSafetyPayload } from '@/lib/healthSafety/serializeHealthSafety'
import type { HSProjectSafetyData, HSToolboxTalk } from '@/types'
import { newUuid } from '@/lib/firebase/firestoreUtils'
import { startOfWeek } from 'date-fns'

const emptyData = (): HSProjectSafetyData => ({
  talks: [],
  issues: [],
  signatures: [],
  ramsDocuments: [],
  otherDocuments: [],
  updatedAt: new Date(),
})

function hsDocRef(organizationId: string, projectId: string, isSmallWorks: boolean) {
  const { collection, segments } = healthSafetyDocPath(organizationId, projectId, isSmallWorks)
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
    signatureImageBase64: string
  ) => Promise<void>
  addToolboxTalk: (
    organizationId: string,
    projectId: string,
    isSmallWorks: boolean,
    talk: Omit<HSToolboxTalk, 'id' | 'updatedAt'> & { id?: string }
  ) => Promise<void>
}

export const useHealthSafetyStore = create<HealthSafetyState>((set, get) => ({
  data: null,
  loading: false,
  error: null,

  load: async (organizationId, projectId, isSmallWorks) => {
    set({ loading: true, error: null })
    try {
      const primary = await getDoc(hsDocRef(organizationId, projectId, isSmallWorks))
      if (primary.exists()) {
        set({
          data: parseHealthSafetyPayload(primary.data() as Record<string, unknown>, projectId),
          loading: false,
        })
        return
      }

      const legacy = await getDoc(legacyHsDocRef(organizationId, projectId, isSmallWorks))
      if (legacy.exists()) {
        const parsed = parseHealthSafetyPayload(legacy.data() as Record<string, unknown>, projectId)
        set({ data: parsed, loading: false })
        await setDoc(hsDocRef(organizationId, projectId, isSmallWorks), serializeHealthSafetyPayload(parsed), {
          merge: true,
        })
        return
      }

      set({ data: emptyData(), loading: false })
    } catch (error: unknown) {
      set({ error: error instanceof Error ? error.message : 'Failed to load H&S', loading: false })
    }
  },

  save: async (organizationId, projectId, isSmallWorks, data) => {
    const ref = hsDocRef(organizationId, projectId, isSmallWorks)
    await setDoc(ref, serializeHealthSafetyPayload(data), { merge: true })
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

  signToolboxTalk: async (organizationId, projectId, isSmallWorks, issueId, userId, signatureImageBase64) => {
    const current = get().data ?? emptyData()
    const now = new Date()
    const signatures = current.signatures.map((sig) =>
      sig.issueId === issueId && sig.userId === userId
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
}))
