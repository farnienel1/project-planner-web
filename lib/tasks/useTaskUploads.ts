'use client'

/**
 * Rulebook 1.89.0 §34 (tasks, issue 1): the web side of the one upload pipeline for task attachments and proof of
 * work. Files are checked against the task limits when picked (`taskAttachmentCheck`), prepared with the §24 photo
 * pipeline (`prepareClientUpload`: location dropped, at most 2560 px), uploaded `TASK_ATTACHMENT_RULES.upload.parallel`
 * at a time with progress, and a file that sends nothing for `stallTimeoutSeconds` stops with Retry / Remove. Nothing
 * hangs: `uploadAll` always settles. Uploads start only on Save, after the task id exists, so the paths are final; the
 * task is written once, after every file is up (the caller). Cancel stops uploads and deletes what this person just
 * uploaded (the rules allow the uploader 15 minutes, §24).
 */

import { useCallback, useRef, useState } from 'react'
import { TASK_ATTACHMENT_RULES, taskAttachmentCheck, taskCopyText, TASK_COPY } from '@/lib/canonical'
import {
  deleteJustUploadedFile,
  startTrackedUpload,
  taskAttachmentPath,
  type TrackedUpload,
  UploadCancelledError,
} from '@/lib/firebase/storageUtils'
import { prepareClientUpload } from '@/lib/security/stripPhotoLocation'
import { isTimeoutError } from '@/lib/client/withTimeout'

export type TaskUploadState = 'waiting' | 'preparing' | 'uploading' | 'uploaded' | 'failed'

export type TaskUploadItem = {
  key: string
  file: File
  name: string
  isImage: boolean
  originalBytes: number
  preparedBytes: number | null
  sent: number
  total: number
  state: TaskUploadState
  url: string | null
  error: string | null
  /** A local preview URL for a photo. */
  preview: string | null
}

export type TaskUploadResult = { ok: true; images: string[]; documents: Array<{ url: string; name: string }> } | { ok: false }

function isPdf(file: File): boolean {
  return file.type === 'application/pdf' || /\.pdf$/i.test(file.name)
}

function mimeOf(file: File): string {
  if (file.type) return file.type
  if (/\.pdf$/i.test(file.name)) return 'application/pdf'
  if (/\.(heic|heif)$/i.test(file.name)) return 'image/heic'
  if (/\.png$/i.test(file.name)) return 'image/png'
  if (/\.webp$/i.test(file.name)) return 'image/webp'
  if (/\.(jpe?g)$/i.test(file.name)) return 'image/jpeg'
  return ''
}

let counter = 0

export function useTaskUploads() {
  const [items, setItems] = useState<TaskUploadItem[]>([])
  const itemsRef = useRef<TaskUploadItem[]>([])
  const running = useRef(new Map<string, TrackedUpload>())

  const commit = useCallback((next: TaskUploadItem[]) => {
    itemsRef.current = next
    setItems(next)
  }, [])

  const patch = useCallback(
    (key: string, change: Partial<TaskUploadItem>) => {
      commit(itemsRef.current.map((item) => (item.key === key ? { ...item, ...change } : item)))
    },
    [commit]
  )

  /** Add picked files. `existing` = files already stored on the task; returns the first refusal message, if any. */
  const add = useCallback(
    (files: File[], existing: { files: number; documents: number }): string | null => {
      let refusal: string | null = null
      const next = [...itemsRef.current]
      for (const file of files) {
        const documents = existing.documents + next.filter((item) => !item.isImage).length
        const check = taskAttachmentCheck({
          name: file.name,
          mime: mimeOf(file),
          // A photo is judged after it is scaled; only a PDF is judged as picked.
          sizeBytes: isPdf(file) ? file.size : 0,
          existingFiles: existing.files + next.length,
          existingDocuments: documents,
        })
        if (check.result !== 'ok') {
          refusal ??= check.message
          continue
        }
        const isImage = !isPdf(file)
        next.push({
          key: `up-${Date.now()}-${(counter += 1)}`,
          file,
          name: file.name,
          isImage,
          originalBytes: file.size,
          preparedBytes: null,
          sent: 0,
          total: file.size,
          state: 'waiting',
          url: null,
          error: null,
          preview: isImage && typeof URL !== 'undefined' ? URL.createObjectURL(file) : null,
        })
      }
      commit(next)
      return refusal
    },
    [commit]
  )

  const remove = useCallback(
    (key: string) => {
      const item = itemsRef.current.find((row) => row.key === key)
      running.current.get(key)?.cancel()
      running.current.delete(key)
      if (item?.url) void deleteJustUploadedFile(item.url)
      if (item?.preview) URL.revokeObjectURL(item.preview)
      commit(itemsRef.current.filter((row) => row.key !== key))
    },
    [commit]
  )

  const retry = useCallback(
    (key: string) => {
      patch(key, { state: 'waiting', error: null, sent: 0 })
    },
    [patch]
  )

  const uploadOne = useCallback(
    async (item: TaskUploadItem, organizationId: string, taskId: string) => {
      patch(item.key, { state: 'preparing', error: null })
      try {
        const prepared = await prepareClientUpload(item.file, 'work')
        if (prepared.error) throw new Error(prepared.error)
        const check = taskAttachmentCheck({ name: item.name, mime: prepared.file.type || mimeOf(item.file), sizeBytes: prepared.file.size })
        if (check.result === 'tooBig' || check.result === 'wrongType') throw new Error(check.message ?? 'File refused.')
        patch(item.key, { state: 'uploading', preparedBytes: prepared.file.size, total: prepared.file.size, sent: 0 })
        const upload = startTrackedUpload(
          taskAttachmentPath(organizationId, taskId, prepared.file.name),
          prepared.file,
          prepared.file.type,
          {
            stallMs: TASK_ATTACHMENT_RULES.upload.stallTimeoutSeconds * 1000,
            sdkRetryMs: TASK_ATTACHMENT_RULES.upload.sdkMaxUploadRetrySeconds * 1000,
            onProgress: (sent, total) => patch(item.key, { sent, total }),
          }
        )
        running.current.set(item.key, upload)
        const url = await upload.done
        running.current.delete(item.key)
        patch(item.key, { state: 'uploaded', url, sent: prepared.file.size })
      } catch (error) {
        running.current.delete(item.key)
        if (error instanceof UploadCancelledError) return
        const message = isTimeoutError(error)
          ? taskCopyText(TASK_COPY.errors.uploadStalled, { name: item.name })
          : error instanceof Error && error.message
            ? error.message
            : taskCopyText(TASK_COPY.attachments.failed, { name: item.name })
        patch(item.key, { state: 'failed', error: message })
      }
    },
    [patch]
  )

  /** Upload every file not yet up (parallel, never hangs). Resolves with the URLs when every file is up. */
  const uploadAll = useCallback(
    async (organizationId: string, taskId: string): Promise<TaskUploadResult> => {
      const pending = itemsRef.current.filter((item) => item.state === 'waiting' || item.state === 'failed')
      const queue = [...pending]
      const workers = Array.from({ length: Math.min(TASK_ATTACHMENT_RULES.upload.parallel, queue.length) }, async () => {
        while (queue.length > 0) {
          const next = queue.shift()
          if (next) await uploadOne(next, organizationId, taskId)
        }
      })
      await Promise.all(workers)
      const all = itemsRef.current
      if (all.some((item) => item.state !== 'uploaded' || !item.url)) return { ok: false }
      return {
        ok: true,
        images: all.filter((item) => item.isImage).map((item) => item.url as string),
        documents: all.filter((item) => !item.isImage).map((item) => ({ url: item.url as string, name: item.name })),
      }
    },
    [uploadOne]
  )

  /** Stop every upload and delete what was uploaded (Cancel on the form). */
  const cancelAll = useCallback(() => {
    for (const upload of running.current.values()) upload.cancel()
    running.current.clear()
    for (const item of itemsRef.current) {
      if (item.url) void deleteJustUploadedFile(item.url)
      if (item.preview) URL.revokeObjectURL(item.preview)
    }
    commit([])
  }, [commit])

  /** Forget the list after a successful save (the files now belong to the task). */
  const clear = useCallback(() => {
    for (const item of itemsRef.current) if (item.preview) URL.revokeObjectURL(item.preview)
    commit([])
  }, [commit])

  const progress = (() => {
    const total = items.reduce((sum, item) => sum + (item.total || 0), 0)
    const sent = items.reduce((sum, item) => sum + (item.state === 'uploaded' ? item.total : item.sent), 0)
    const done = items.filter((item) => item.state === 'uploaded').length
    return { total: items.length, done, percent: total > 0 ? (sent / total) * 100 : 0 }
  })()

  return { items, add, remove, retry, uploadAll, cancelAll, clear, progress }
}
