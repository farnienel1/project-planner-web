/**
 * iOS parity source: FirebaseBackend.swift saveDeadlines / deadlineAssignments (~L8674).
 * A failed load must not be written back as an empty programme.
 */

'use client'

import { create } from 'zustand'
import { doc, getDoc, setDoc, Timestamp, updateDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase/config'
import { parseFirestoreDate } from '@/lib/firebase/firestoreUtils'
import { asUppercaseUuid } from '@/lib/ios-parity/uuid'
import { deadlinesSettingsDocId, parseDeadline, serializeDeadline } from '@/lib/deadlines/codec'
import { mergeDeadlinesFirstWriterWins } from '@/lib/deadlines/logic'
import type { Deadline } from '@/lib/deadlines/types'

const FWW_GRACE_MS = 400

function deadlinesRef(organizationId: string, projectId: string, isSmallWorks: boolean) {
  return doc(db, 'organizations', organizationId, 'settings', deadlinesSettingsDocId(projectId, isSmallWorks))
}

function assignmentsRef(organizationId: string) {
  return doc(db, 'organizations', organizationId, 'settings', 'deadlineAssignments')
}

function isMissingDoc(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && (error as { code?: string }).code === 'not-found'
}

async function writeAssignments(organizationId: string, projectId: string, assigneeIds: string[]): Promise<void> {
  const ref = assignmentsRef(organizationId)
  const projectKey = asUppercaseUuid(projectId)
  const payload = {
    [`projects.${projectKey}`]: assigneeIds,
    updatedAt: Timestamp.now(),
  }
  try {
    await updateDoc(ref, payload)
  } catch (error) {
    if (!isMissingDoc(error)) throw error
    await setDoc(ref, {
      projects: { [projectKey]: assigneeIds },
      updatedAt: Timestamp.now(),
    })
  }
}

interface DeadlineState {
  items: Deadline[]
  updatedAt: Date | null
  loaded: boolean
  loading: boolean
  saving: boolean
  error: string | null
  projectKey: string | null
  assignedProjectIds: string[]
  load: (organizationId: string, projectId: string, isSmallWorks: boolean) => Promise<void>
  save: (organizationId: string, projectId: string, isSmallWorks: boolean, items: Deadline[]) => Promise<Deadline[]>
  loadAssignedProjectIds: (organizationId: string, userId: string) => Promise<void>
}

export const useDeadlineStore = create<DeadlineState>((set, get) => ({
  items: [],
  updatedAt: null,
  loaded: false,
  loading: false,
  saving: false,
  error: null,
  projectKey: null,
  assignedProjectIds: [],

  load: async (organizationId, projectId, isSmallWorks) => {
    const projectKey = `${organizationId}:${deadlinesSettingsDocId(projectId, isSmallWorks)}`
    if (get().projectKey !== projectKey) {
      set({ items: [], updatedAt: null, loaded: false, error: null, projectKey })
    }
    set({ loading: true, error: null })
    try {
      const snap = await getDoc(deadlinesRef(organizationId, projectId, isSmallWorks))
      if (get().projectKey !== projectKey) return
      if (!snap.exists()) {
        set({ items: [], updatedAt: null, loaded: true, loading: false })
        return
      }
      const data = snap.data() as Record<string, unknown>
      const raw = Array.isArray(data.items) ? data.items : []
      const items = raw
        .map((row) => (row && typeof row === 'object' ? parseDeadline(row as Record<string, unknown>, projectId) : null))
        .filter((row): row is Deadline => row !== null)
        .sort((a, b) => a.due.getTime() - b.due.getTime())
      set({
        items,
        updatedAt: parseFirestoreDate(data.updatedAt) ?? null,
        loaded: true,
        loading: false,
      })
    } catch (error: unknown) {
      if (get().projectKey !== projectKey) return
      set({
        loading: false,
        loaded: false,
        error: error instanceof Error ? error.message : 'Could not load deadlines.',
      })
    }
  },

  save: async (organizationId, projectId, isSmallWorks, items) => {
    const projectKey = `${organizationId}:${deadlinesSettingsDocId(projectId, isSmallWorks)}`
    if (!get().loaded || get().projectKey !== projectKey) {
      throw new Error('Deadlines are still loading.')
    }
    if (items.length === 0 && get().items.length > 0) {
      throw new Error('Refusing to clear the deadline programme.')
    }
    set({ saving: true, error: null })
    try {
      const ref = deadlinesRef(organizationId, projectId, isSmallWorks)
      let itemsToWrite = items
      const base = get().updatedAt
      if (base) {
        const remoteSnap = await getDoc(ref)
        const remoteUpdated = remoteSnap.exists() ? parseFirestoreDate(remoteSnap.data()?.updatedAt) : null
        if (remoteUpdated && remoteUpdated.getTime() > base.getTime() + FWW_GRACE_MS) {
          const raw = Array.isArray(remoteSnap.data()?.items) ? remoteSnap.data()?.items : []
          const remoteItems = (raw as unknown[])
            .map((row) => (row && typeof row === 'object' ? parseDeadline(row as Record<string, unknown>, projectId) : null))
            .filter((row): row is Deadline => row !== null)
          itemsToWrite = mergeDeadlinesFirstWriterWins(remoteItems, items)
        }
      }
      await setDoc(
        ref,
        {
          items: itemsToWrite.map(serializeDeadline),
          updatedAt: Timestamp.now(),
          projectId: asUppercaseUuid(projectId),
        },
        { merge: true }
      )
      const assigneeIds = Array.from(new Set(itemsToWrite.flatMap((item) => item.assigneeUserIds))).sort()
      await writeAssignments(organizationId, projectId, assigneeIds)
      const updatedAt = new Date()
      if (get().projectKey === projectKey) {
        set({ items: itemsToWrite, updatedAt, loaded: true, saving: false })
      } else {
        set({ saving: false })
      }
      return itemsToWrite
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Could not save deadlines.'
      set({ saving: false, error: message })
      throw error instanceof Error ? error : new Error(message)
    }
  },

  loadAssignedProjectIds: async (organizationId, userId) => {
    const trimmed = userId.trim()
    if (!trimmed) {
      set({ assignedProjectIds: [] })
      return
    }
    try {
      const snap = await getDoc(assignmentsRef(organizationId))
      const projects = snap.data()?.projects
      if (!projects || typeof projects !== 'object') {
        set({ assignedProjectIds: [] })
        return
      }
      const ids = Object.entries(projects as Record<string, unknown>)
        .filter(([, value]) => Array.isArray(value) && value.includes(trimmed))
        .map(([key]) => key)
      set({ assignedProjectIds: ids })
    } catch {
      set({ assignedProjectIds: [] })
    }
  },
}))
