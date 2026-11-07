'use client'

import { create } from 'zustand'
import {
  arrayUnion,
  doc,
  FieldPath,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  type DocumentReference,
  type Unsubscribe,
} from 'firebase/firestore'
import { db } from '@/lib/firebase/config'
import { liveResultStillCurrent } from '@/lib/firebase/liveResult'
import { healthSafetyDocPath } from '@/lib/healthSafety/healthSafetyPaths'
import { parseHealthSafetyPayload, mergeHealthSafetyPayload } from '@/lib/healthSafety/parseHealthSafety'
import { serializeHealthSafetyPayload } from '@/lib/healthSafety/serializeHealthSafety'
import type { HSProjectSafetyData, HSToolboxTalk, User } from '@/types'
import { newUuid, sanitizeForFirestore } from '@/lib/firebase/firestoreUtils'
import { organizationWeekStartInstant } from '@/lib/orgTime/organizationWeek'
import { inboxActorUserId, saveInboxNotification } from '@/lib/firebase/notifyInbox'
import {
  healthSafetyDocumentId,
  healthSafetyDocumentIds,
  healthSafetyDocumentWriteFields,
  healthSafetyIssueStatus,
  healthSafetySignatureKey,
  healthSafetySignatureWriteFields,
  normalizeHSIssueStatus,
  normalizeHSSignatureStatus,
  toolboxTalkRecipients,
  type HealthSafetySignatureWrite,
} from '@/lib/canonical'
import { firestoreUpdateFields } from '@/lib/firebase/partialWrite'
import { rulebookPerson, rulebookRoster } from '@/lib/staff/rulebookPeople'

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

/** The settings copy iOS reads: `healthSafetyDocumentId` (job id upper-cased, rulebook 1.8.0). */
function legacyHsDocRef(organizationId: string, projectId: string, isSmallWorks: boolean) {
  return doc(db, 'organizations', organizationId, 'settings', healthSafetyDocumentId(projectId, isSmallWorks))
}

type HSArrays = Parameters<typeof healthSafetyDocumentWriteFields>[1]
/** Rulebook 1.9.0: row ids the user deliberately removed in this save (lets the last row go). */
type HSRemovedIds = NonNullable<NonNullable<Parameters<typeof healthSafetyDocumentWriteFields>[2]>['removedIds']>

/** The live listeners for the job whose health & safety screen is open (rulebook 1.9.0 §1). */
let hsUnsubs: Unsubscribe[] = []
let hsListeningKey = ''

/** One health & safety copy saved as `healthSafetyDocumentWriteFields` says (create when missing). */
async function saveHealthSafetyArrays(
  ref: DocumentReference,
  payload: Record<string, unknown>,
  removedIds?: HSRemovedIds
): Promise<void> {
  const snap = await getDoc(ref)
  const stored = snap.exists() ? (snap.data() as Record<string, unknown>) : null
  const write = healthSafetyDocumentWriteFields(stored, payload as HSArrays, { removedIds })
  if (Object.keys(write.set).length === 0 && write.remove.length === 0) return
  if (!stored) {
    await setDoc(ref, { ...write.set, updatedAt: serverTimestamp() }, { merge: true })
    return
  }
  await updateDoc(ref, { ...firestoreUpdateFields(write), updatedAt: serverTimestamp() })
}

/** Per-signer field-path updates (`signatureRecords.{key}`) plus an arrayUnion of each row onto `signatures`. */
async function writeSignatures(ref: DocumentReference, writes: HealthSafetySignatureWrite[]): Promise<void> {
  if (writes.length === 0) return
  const snap = await getDoc(ref)
  if (!snap.exists()) {
    const records: Record<string, unknown> = {}
    for (const write of writes) records[write.fieldPath[1]] = write.value
    await setDoc(
      ref,
      { signatureRecords: records, signatures: arrayUnion(...writes.map((write) => write.arrayRow)), updatedAt: serverTimestamp() },
      { merge: true }
    )
    return
  }
  const pairs: unknown[] = []
  for (const write of writes) pairs.push(new FieldPath(...write.fieldPath), write.value)
  await updateDoc(
    ref,
    new FieldPath('signatures'),
    arrayUnion(...writes.map((write) => write.arrayRow)),
    new FieldPath('updatedAt'),
    serverTimestamp(),
    ...pairs
  )
}

interface HealthSafetyState {
  data: HSProjectSafetyData | null
  projectKey: string | null
  loading: boolean
  error: string | null
  load: (organizationId: string, projectId: string, isSmallWorks: boolean) => Promise<void>
  save: (
    organizationId: string,
    projectId: string,
    isSmallWorks: boolean,
    data: HSProjectSafetyData,
    options?: { removedIds?: HSRemovedIds }
  ) => Promise<void>
  /** Stop listening (the screen closed). */
  stopListening: () => void
  issueToolboxTalk: (
    organizationId: string,
    projectId: string,
    isSmallWorks: boolean,
    talkId: string,
    recipientUserIds: string[],
    issuedByUserId: string,
    options?: {
      weekCommencing?: Date
      publishAt?: Date
      /** Rulebook 1.10.0 §13: writes `toolbox_talk_issued` to `toolboxTalkRecipients` (never the issuer). */
      audience?: { users: User[]; actor: User | null; talkTitle?: string; siteName?: string }
    }
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
    talkTitle: string,
    /** Who sends the reminder (the signed-in user) and the organisation roster, for `toolboxTalkRecipients`. */
    audience?: { actor?: User | null; users?: ReadonlyArray<User> }
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

  // Rulebook 1.9.0 §1 (`LIVE_COLLECTIONS`): the open job's health & safety documents are live. Every copy (the nested
  // web document and each settings id, `healthSafetyDocumentIds`) has a listener; the merged result is published on
  // each change, so an issue or signature from iOS appears without reopening the screen.
  load: async (organizationId, projectId, isSmallWorks) => {
    const projectKey = `${organizationId}:${projectId}:${isSmallWorks ? 'sw' : 'p'}`
    const stale = get().projectKey !== projectKey
    if (stale || !get().data) set({ loading: true, error: null, data: stale ? null : get().data, projectKey })
    else set({ error: null })
    if (hsListeningKey === projectKey && hsUnsubs.length > 0) {
      set({ loading: false })
      return
    }
    for (const stop of hsUnsubs) stop()
    hsUnsubs = []
    hsListeningKey = projectKey
    const refs = [
      hsDocRef(organizationId, projectId, isSmallWorks),
      ...healthSafetyDocumentIds(projectId, isSmallWorks).map((id) => doc(db, 'organizations', organizationId, 'settings', id)),
    ]
    const latest: Array<HSProjectSafetyData | undefined> = refs.map(() => undefined)
    await new Promise<void>((resolve) => {
      let resolved = false
      const finish = () => {
        if (!resolved) {
          resolved = true
          resolve()
        }
      }
      const publish = () => {
        if (hsListeningKey !== projectKey || !liveResultStillCurrent(organizationId)) return
        if (latest.some((entry) => entry === undefined)) return
        const data = (latest as HSProjectSafetyData[]).reduce((merged, next) => mergeHealthSafetyPayload(merged, next))
        set({ data, projectKey, loading: false, error: null })
        finish()
      }
      refs.forEach((ref, index) => {
        hsUnsubs.push(
          onSnapshot(
            ref,
            (snap) => {
              latest[index] = snap.exists()
                ? parseHealthSafetyPayload(snap.data() as Record<string, unknown>, projectId)
                : emptyData()
              publish()
            },
            (error) => {
              // A copy this account cannot read counts as empty; the others still publish.
              latest[index] = emptyData()
              if (latest.every((entry) => entry !== undefined)) publish()
              else if (index === 0) set({ error: error.message })
              finish()
            }
          )
        )
      })
    })
    if (get().loading && hsListeningKey === projectKey) set({ loading: false })
  },

  stopListening: () => {
    for (const stop of hsUnsubs) stop()
    hsUnsubs = []
    hsListeningKey = ''
  },

  save: async (organizationId, projectId, isSmallWorks, data, options) => {
    const payload = sanitizeForFirestore(serializeHealthSafetyPayload(data)) as Record<string, unknown>
    // Rulebook 1.8.0 §1 (`healthSafetyDocumentWriteFields`): only arrays that changed are written, each row laid over
    // its stored row (iOS-only fields kept), an empty list never replaces a stored one, issue status stored
    // `completed`, and `signatureRecords` (per-signer signatures) is never touched.
    await Promise.all(
      [hsDocRef(organizationId, projectId, isSmallWorks), legacyHsDocRef(organizationId, projectId, isSmallWorks)].map(
        (ref) => saveHealthSafetyArrays(ref, payload, options?.removedIds)
      )
    )
    set({ data: { ...data, updatedAt: new Date() } })
  },

  issueToolboxTalk: async (organizationId, projectId, isSmallWorks, talkId, recipientUserIds, issuedByUserId, options) => {
    const current = get().data ?? emptyData()
    const issueId = newUuid()
    const now = new Date()
    // Rulebook §1 (1.36.0, FU-4): organisation-zone midnight of the organisation week's Monday, not the browser's.
    const weekCommencing = options?.weekCommencing ?? organizationWeekStartInstant(now)
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
    // Rulebook 1.10.0 §13 (`toolbox_talk_issued`, written by web too): the chosen people without the issuer
    // (`toolboxTalkRecipients`); relatedId is the issue id (`notificationRelatedIdFor`).
    const audience = options?.audience
    if (audience) {
      const actor = audience.actor ? rulebookPerson(audience.actor, audience.users) : inboxActorUserId() || null
      const recipients = toolboxTalkRecipients(recipientUserIds, actor, rulebookRoster(audience.users))
      const detail = audience.talkTitle?.trim() || 'a toolbox talk'
      const place = audience.siteName?.trim() || 'a job'
      const by = audience.actor ? `${audience.actor.firstName} ${audience.actor.surname}`.trim() : 'Your manager'
      await Promise.all(
        recipients.map((userId) =>
          saveInboxNotification({
            organizationId,
            type: 'toolbox_talk_issued',
            title: 'Toolbox talk issued',
            message: `${by} issued ${detail} on ${place}.`,
            userId,
            relatedId: issueId,
          }).catch(() => undefined)
        )
      )
    }
  },

  signToolboxTalk: async (organizationId, projectId, isSmallWorks, issueId, userId, signatureImageBase64, aliasUserIds) => {
    const current = get().data ?? emptyData()
    const now = new Date()
    const ids = new Set([userId, ...(aliasUserIds || [])].filter(Boolean).map((id) => id.toLowerCase()))
    const own = current.signatures.filter((sig) => sig.issueId === issueId && ids.has(sig.userId.toLowerCase()))
    const signers = own.length > 0 ? own : [{ id: '', issueId, userId }]
    // Rulebook 1.8.0 (`healthSafetySignatureWriteFields`): each signature is its own map entry
    // (`signatureRecords.{issue}__{user}`, plus an arrayUnion onto `signatures` for older builds), so two people
    // signing at once never overwrite each other. The `signatures` array is never rewritten here.
    const writes = signers
      .map((sig) =>
        healthSafetySignatureWriteFields({
          issueId,
          userId: sig.userId,
          signatureId: sig.id,
          status: 'signed',
          readConfirmed: true,
          signatureImageBase64,
          signedAt: Timestamp.fromDate(now),
        })
      )
      .filter((write): write is NonNullable<typeof write> => write !== null)
    await Promise.all(
      [hsDocRef(organizationId, projectId, isSmallWorks), legacyHsDocRef(organizationId, projectId, isSmallWorks)].map(
        (ref) => writeSignatures(ref, writes)
      )
    )
    const signedKeys = new Set(writes.map((write) => write.fieldPath[1]))
    const signatures = current.signatures.map((sig) =>
      signedKeys.has(healthSafetySignatureKey(sig.issueId, sig.userId))
        ? { ...sig, status: 'signed', readConfirmed: true, signatureImageBase64, signedAt: now }
        : sig
    )
    const issue = current.issues.find((row) => row.id === issueId)
    const status = issue
      ? healthSafetyIssueStatus(
          { id: issue.id, status: normalizeHSIssueStatus(issue.status), recipientUserIds: issue.recipientUserIds },
          signatures.map((sig) => ({ issueId: sig.issueId, userId: sig.userId, status: normalizeHSSignatureStatus(sig.status) }))
        )
      : null
    if (issue && status && status !== normalizeHSIssueStatus(issue.status)) {
      const issues = current.issues.map((row) => (row.id === issueId ? { ...row, status } : row))
      await get().save(organizationId, projectId, isSmallWorks, { ...current, signatures, issues })
    } else {
      set({ data: { ...current, signatures, updatedAt: now } })
    }
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

  remindPending: async (organizationId, projectId, isSmallWorks, issueId, talkTitle, audience) => {
    const current = get().data ?? emptyData()
    const now = new Date()
    const pending = current.signatures.filter((sig) => sig.issueId === issueId && sig.status !== 'signed')
    const signatures = current.signatures.map((sig) =>
      sig.issueId === issueId && sig.status !== 'signed' ? { ...sig, reminderSentAt: now } : sig
    )
    await get().save(organizationId, projectId, isSmallWorks, { ...current, signatures })
    // `toolboxTalkRecipients`: the people still to sign, never the person sending the reminder.
    const users = audience?.users ?? []
    const actor = audience?.actor ? rulebookPerson(audience.actor, users) : inboxActorUserId() || null
    const recipients = toolboxTalkRecipients(
      pending.map((sig) => sig.userId),
      actor,
      rulebookRoster(users)
    )
    await Promise.all(
      recipients.map((userId) =>
        saveInboxNotification({
          organizationId,
          type: 'hs_toolbox_reminder',
          title: 'Toolbox talk reminder',
          message: `Please sign “${talkTitle}”.`,
          userId,
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
