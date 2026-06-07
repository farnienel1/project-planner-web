'use client'

import { create } from 'zustand'
import { collection, deleteDoc, doc, getDocs, setDoc, Timestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase/config'
import type { ProjectTask, ProjectTaskPriority, ProjectTaskStatus } from '@/types'
import { newUuid, parseFirestoreDate, parseOptionalString, parseString } from '@/lib/firebase/firestoreUtils'

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
    dueDate: parseFirestoreDate(data.dueDate),
    completedBy: parseOptionalString(data.completedBy),
    completedAt: parseFirestoreDate(data.completedAt),
    completionNotes: parseOptionalString(data.completionNotes),
    attachedImageURLs: Array.isArray(data.attachedImageURLs) ? (data.attachedImageURLs as string[]) : [],
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
  if (task.dueDate) data.dueDate = Timestamp.fromDate(task.dueDate)
  if (task.completedBy) data.completedBy = task.completedBy
  if (task.completedAt) data.completedAt = Timestamp.fromDate(task.completedAt)
  if (task.completionNotes) data.completionNotes = task.completionNotes
  if (task.attachedImageURLs?.length) data.attachedImageURLs = task.attachedImageURLs
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
    set({ loading: true, error: null })
    try {
      const snapshot = await getDocs(collection(db, 'organizations', organizationId, 'tasks'))
      const tasks = snapshot.docs.map((entry) =>
        mapTask(entry.id, entry.data() as Record<string, unknown>, organizationId)
      )
      set({ tasks, loading: false })
    } catch (error: unknown) {
      set({ error: error instanceof Error ? error.message : 'Failed to load tasks', loading: false })
    }
  },

  saveTask: async (task) => {
    const id = task.id || newUuid()
    const payload = taskPayload({ ...task, id, updatedAt: new Date() })
    await setDoc(doc(db, 'organizations', task.organizationId, 'tasks', id), payload)
    const saved = mapTask(id, payload as Record<string, unknown>, task.organizationId)
    const { tasks } = get()
    set({ tasks: [...tasks.filter((t) => t.id !== id), saved] })
  },

  deleteTask: async (organizationId, taskId) => {
    await deleteDoc(doc(db, 'organizations', organizationId, 'tasks', taskId))
    set({ tasks: get().tasks.filter((t) => t.id !== taskId) })
  },
}))
