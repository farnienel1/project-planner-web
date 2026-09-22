'use client'

import { create } from 'zustand'
import { collection, deleteDoc, doc, getDocs, setDoc, Timestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase/config'
import type { ProjectTask, ProjectTaskPriority, ProjectTaskStatus } from '@/types'
import { newUuid, parseFirestoreDate, parseOptionalString, parseString, sanitizeForFirestore } from '@/lib/firebase/firestoreUtils'
import { trackEvent } from '@/lib/analytics/trackEvent'
import { useAuthStore } from '@/lib/stores/authStore'
import { invalidateOrgLoad, runOrgLoad } from '@/lib/stores/orgLoadCache'

function mapTask(docId: string, data: Record<string, unknown>, organizationId: string): ProjectTask {
  return {
    id: docId,
    organizationId,
    projectId: parseString(data.projectId),
    title: parseString(data.title),
    details: parseOptionalString(data.details),
    createdBy: parseString(data.createdBy),
    status: (parseString(data.status, 'To Do') as ProjectTaskStatus) || 'To Do',
    priority: (parseString(data.priority, 'Normal') as ProjectTaskPriority) || 'Normal',
    assignedOperativeId: parseOptionalString(data.assignedOperativeId),
    assignedManagerId: parseOptionalString(data.assignedManagerId),
    assignedOperativeIds: Array.isArray(data.assignedOperativeIds)
      ? (data.assignedOperativeIds as unknown[]).map((id) => String(id))
      : [],
    assignedManagerIds: Array.isArray(data.assignedManagerIds)
      ? (data.assignedManagerIds as unknown[]).map((id) => String(id))
      : [],
    dueDate: parseFirestoreDate(data.dueDate),
    completedBy: parseOptionalString(data.completedBy),
    completedAt: parseFirestoreDate(data.completedAt),
    completionNotes: parseOptionalString(data.completionNotes),
    completionImages: Array.isArray(data.completionImages)
      ? (data.completionImages as unknown[]).filter((url): url is string => typeof url === 'string' && Boolean(url))
      : [],
    completionFiles: Array.isArray(data.completionFiles)
      ? (data.completionFiles as Record<string, unknown>[])
          .map((file) => ({
            name: parseString(file.name) || parseString(file.fileName),
            url: parseString(file.url) || parseString(file.fileURL),
          }))
          .filter((file) => file.url)
      : [],
    attachedImageURLs: Array.isArray(data.attachedImageURLs) ? (data.attachedImageURLs as string[]) : [],
    attachedFileURL: parseOptionalString(data.attachedFileURL),
    attachedFileName: parseOptionalString(data.attachedFileName),
    attachedSiteAuditId: parseOptionalString(data.attachedSiteAuditId),
    attachedSiteAuditTitle: parseOptionalString(data.attachedSiteAuditTitle),
    items: Array.isArray(data.items)
      ? (data.items as Record<string, unknown>[])
          .map((item) => ({
            id: parseString(item.id) || newUuid(),
            title: parseString(item.title),
            description: parseOptionalString(item.description),
          }))
          .filter((item) => item.title)
      : [],
    completedItemIds: Array.isArray(data.completedItemIds)
      ? (data.completedItemIds as unknown[]).map((id) => String(id))
      : [],
    createdAt: parseFirestoreDate(data.createdAt) || new Date(),
    updatedAt: parseFirestoreDate(data.updatedAt) || new Date(),
  }
}

function taskPayload(task: ProjectTask): Record<string, unknown> {
  const data: Record<string, unknown> = {
    organizationId: task.organizationId,
    projectId: task.projectId,
    title: task.title.trim(),
    details: task.details?.trim() || '',
    createdBy: task.createdBy,
    status: task.status,
    priority: task.priority,
    createdAt: Timestamp.fromDate(task.createdAt),
    updatedAt: Timestamp.fromDate(task.updatedAt),
  }
  if (task.assignedOperativeId) data.assignedOperativeId = task.assignedOperativeId
  if (task.assignedManagerId) data.assignedManagerId = task.assignedManagerId
  if (task.assignedOperativeIds?.length) data.assignedOperativeIds = task.assignedOperativeIds
  if (task.assignedManagerIds?.length) data.assignedManagerIds = task.assignedManagerIds
  if (task.dueDate) data.dueDate = Timestamp.fromDate(task.dueDate)
  if (task.completedBy) data.completedBy = task.completedBy
  if (task.completedAt) data.completedAt = Timestamp.fromDate(task.completedAt)
  if (task.completionNotes) data.completionNotes = task.completionNotes
  if (task.completionImages?.length) data.completionImages = task.completionImages
  if (task.completionFiles?.length) {
    data.completionFiles = task.completionFiles.map((file) => ({
      name: file.name,
      url: file.url,
    }))
  }
  if (task.attachedImageURLs?.length) data.attachedImageURLs = task.attachedImageURLs
  if (task.attachedFileURL) data.attachedFileURL = task.attachedFileURL
  if (task.attachedFileName) data.attachedFileName = task.attachedFileName
  if (task.attachedSiteAuditId) data.attachedSiteAuditId = task.attachedSiteAuditId
  if (task.attachedSiteAuditTitle) data.attachedSiteAuditTitle = task.attachedSiteAuditTitle
  if (task.items?.length) {
    data.items = task.items.map((item) => ({
      id: item.id,
      title: item.title,
      description: item.description || '',
    }))
  }
  if (task.completedItemIds?.length) data.completedItemIds = task.completedItemIds
  return data
}

interface TaskState {
  tasks: ProjectTask[]
  loading: boolean
  error: string | null
  loadTasks: (organizationId: string) => Promise<void>
  saveTask: (task: ProjectTask) => Promise<void>
  deleteTask: (organizationId: string, taskId: string) => Promise<void>
}

export const useTaskStore = create<TaskState>((set, get) => ({
  tasks: [],
  loading: false,
  error: null,

  loadTasks: async (organizationId) => {
    await runOrgLoad(`taskStore:tasks`, organizationId, async () => {
      set({ loading: get().tasks.length === 0, error: null })
      try {
        const snapshot = await getDocs(collection(db, 'organizations', organizationId, 'tasks'))
        const tasks = snapshot.docs.map((entry) =>
          mapTask(entry.id, entry.data() as Record<string, unknown>, organizationId)
        )
        set({ tasks, loading: false })
      } catch (error: unknown) {
        set({ error: error instanceof Error ? error.message : 'Failed to load tasks', loading: false })
      }
    })
  },

  saveTask: async (task) => {
    const id = task.id || newUuid()
    const isNew = !get().tasks.some((row) => row.id === id)
    const payload = sanitizeForFirestore(taskPayload({ ...task, id, updatedAt: new Date() })) as Record<string, unknown>
    await setDoc(doc(db, 'organizations', task.organizationId, 'tasks', id), payload)
    invalidateOrgLoad('taskStore:tasks')
    const saved = mapTask(id, payload as Record<string, unknown>, task.organizationId)
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
    invalidateOrgLoad('taskStore:tasks')
    set({ tasks: get().tasks.filter((t) => t.id !== taskId) })
    void trackEvent('task_deleted', {
      userId: useAuthStore.getState().user?.id || existing?.createdBy,
      organizationId,
      metadata: { taskId },
    })
  },
}))
