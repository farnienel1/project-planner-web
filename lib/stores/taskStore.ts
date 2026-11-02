'use client'

import { create } from 'zustand'
import { collection, deleteDoc, doc, getDocs, Timestamp } from 'firebase/firestore'
import { parseTaskDocument, taskFields, taskWriteFields } from '@/lib/canonical'
import { savePartialDocument } from '@/lib/firebase/partialWrite'
import { organizationZoneOr } from '@/lib/orgTime/activeOrganizationZone'
import { db } from '@/lib/firebase/config'
import type { ProjectTask, ProjectTaskPriority, ProjectTaskStatus } from '@/types'
import { newUuid } from '@/lib/firebase/firestoreUtils'
import { trackEvent } from '@/lib/analytics/trackEvent'
import { useAuthStore } from '@/lib/stores/authStore'
import { invalidateOrgLoad, runOrgLoad } from '@/lib/stores/orgLoadCache'
import { markRowsRemoved, retainScopedRows } from '@/lib/staff/rosterRetain'
import { completionFileUrls } from '@/lib/tasks/completionFiles'

/** `tasks/{id}` through the rulebook reader `parseTaskDocument` (rulebook 1.8.0): status synonyms, ids in stored case,
 * a derived id for an item stored without one. */
function mapTask(docId: string, data: Record<string, unknown>, organizationId: string): ProjectTask | null {
  const parsed = parseTaskDocument(docId, data, { timeZone: organizationZoneOr() })
  if (!parsed) return null
  const when = (ms: number | null) => (ms != null ? new Date(ms) : undefined)
  return {
    id: parsed.id,
    organizationId,
    projectId: parsed.projectId,
    title: parsed.title,
    details: parsed.details ?? undefined,
    createdBy: parsed.createdBy,
    status: parsed.status as ProjectTaskStatus,
    priority: parsed.priority as ProjectTaskPriority,
    assignedOperativeId: parsed.assignedOperativeId ?? undefined,
    assignedManagerId: parsed.assignedManagerId ?? undefined,
    assignedOperativeIds: parsed.assignedOperativeIds,
    assignedManagerIds: parsed.assignedManagerIds,
    dueDate: when(parsed.dueDateMs),
    completedBy: parsed.completedBy ?? undefined,
    completedAt: when(parsed.completedAtMs),
    completionNotes: parsed.completionNotes ?? undefined,
    completionImages: parsed.completionImages,
    completionFiles: completionFileUrls(data.completionFiles),
    attachedImageURLs: parsed.attachedImageURLs,
    attachedFileURL: parsed.attachedFileURL ?? undefined,
    attachedFileName: parsed.attachedFileName ?? undefined,
    attachedSiteAuditId: parsed.attachedSiteAuditId ?? undefined,
    attachedSiteAuditTitle: parsed.attachedSiteAuditTitle ?? undefined,
    items: parsed.items.map((item) => ({ id: item.id, title: item.title, description: item.description ?? undefined })),
    completedItemIds: parsed.completedItemIds,
    createdAt: when(parsed.createdAtMs) ?? new Date(),
    updatedAt: when(parsed.updatedAtMs) ?? new Date(),
  }
}

/** The stored shape (`taskFields`): blank optionals are null so a partial save removes them. */
function taskPayload(task: ProjectTask): Record<string, unknown> {
  const stamp = (date: Date | undefined) => (date ? Timestamp.fromDate(date) : null)
  return taskFields({
    id: task.id,
    projectId: task.projectId,
    title: task.title,
    details: task.details ?? null,
    createdBy: task.createdBy,
    status: task.status,
    priority: task.priority,
    assignedOperativeId: task.assignedOperativeId ?? null,
    assignedManagerId: task.assignedManagerId ?? null,
    assignedOperativeIds: task.assignedOperativeIds ?? null,
    assignedManagerIds: task.assignedManagerIds ?? null,
    dueDate: stamp(task.dueDate),
    completedBy: task.completedBy ?? null,
    completedAt: stamp(task.completedAt),
    completionNotes: task.completionNotes ?? null,
    completionImages: task.completionImages ?? null,
    completionFiles: task.completionFiles?.length ? completionFileUrls(task.completionFiles) : null,
    attachedImageURLs: task.attachedImageURLs ?? null,
    attachedFileURL: task.attachedFileURL ?? null,
    attachedFileName: task.attachedFileName ?? null,
    attachedSiteAuditId: task.attachedSiteAuditId ?? null,
    attachedSiteAuditTitle: task.attachedSiteAuditTitle ?? null,
    items: task.items ?? null,
    completedItemIds: task.completedItemIds ?? null,
    createdAt: Timestamp.fromDate(task.createdAt),
    organizationId: task.organizationId,
  })
}

interface TaskState {
  tasks: ProjectTask[]
  loading: boolean
  error: string | null
  tasksLoadedOrgId: string | null
  loadTasks: (organizationId: string) => Promise<void>
  saveTask: (task: ProjectTask) => Promise<void>
  deleteTask: (organizationId: string, taskId: string) => Promise<void>
}

let tasksOrgId = ''

export const useTaskStore = create<TaskState>((set, get) => ({
  tasks: [],
  loading: false,
  error: null,
  tasksLoadedOrgId: null,

  loadTasks: async (organizationId) => {
    await runOrgLoad(`taskStore:tasks`, organizationId, async () => {
      set({ loading: get().tasks.length === 0, error: null })
      try {
        const snapshot = await getDocs(collection(db, 'organizations', organizationId, 'tasks'))
        const mapped = snapshot.docs
          .map((entry) => mapTask(entry.id, entry.data() as Record<string, unknown>, organizationId))
          .filter((task): task is ProjectTask => task !== null)
        const previous = tasksOrgId === organizationId ? get().tasks : []
        const tasks = retainScopedRows(`tasks:${organizationId}`, previous, mapped)
        tasksOrgId = organizationId
        set({ tasks, loading: false, tasksLoadedOrgId: organizationId })
      } catch (error: unknown) {
        set({ error: error instanceof Error ? error.message : 'Failed to load tasks', loading: false })
        throw error
      }
    })
  },

  saveTask: async (task) => {
    const id = task.id || newUuid()
    const isNew = !get().tasks.some((row) => row.id === id)
    const payload = taskPayload({ ...task, id })
    // Rulebook 1.8.0 §1: a partial update of the changed fields (`taskWriteFields`), never a whole-task setDoc.
    await savePartialDocument(doc(db, 'organizations', task.organizationId, 'tasks', id), payload, taskWriteFields, {
      userId: useAuthStore.getState().user?.id,
    })
    invalidateOrgLoad('taskStore:tasks')
    const saved = mapTask(id, { ...payload, updatedAt: Timestamp.now() }, task.organizationId)
    if (!saved) return
    const { tasks } = get()
    set({ tasks: [...tasks.filter((t) => t.id !== id), saved] })
    const eventName =
      saved.status === 'Completed' && (isNew || tasks.find((row) => row.id === id)?.status !== 'Completed')
        ? 'task_completed'
        : isNew
          ? 'task_created'
          : 'task_updated'
    void trackEvent(eventName, {
      userId: useAuthStore.getState().user?.id || task.createdBy,
      organizationId: task.organizationId,
      metadata: { taskId: id, projectId: task.projectId },
    })
  },

  deleteTask: async (organizationId, taskId) => {
    const existing = get().tasks.find((row) => row.id === taskId)
    await deleteDoc(doc(db, 'organizations', organizationId, 'tasks', taskId))
    markRowsRemoved(`tasks:${organizationId}`, [taskId])
    invalidateOrgLoad('taskStore:tasks')
    set({ tasks: get().tasks.filter((t) => t.id !== taskId) })
    void trackEvent('task_deleted', {
      userId: useAuthStore.getState().user?.id || existing?.createdBy,
      organizationId,
      metadata: { taskId },
    })
  },
}))
