'use client'

import { create } from 'zustand'
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  Timestamp,
  where,
} from 'firebase/firestore'
import { db } from '@/lib/firebase/config'
import { newUuid } from '@/lib/firebase/firestoreUtils'
import { omitUndefinedDeep } from '@/lib/ios-parity/firestoreCodec'
import { saveInboxNotification } from '@/lib/firebase/notifyInbox'
import { trackEvent } from '@/lib/analytics/trackEvent'
import { feedbackWriteError } from '@/lib/feedback/errors'
import { consolidateVotesOnMerge, voteId } from '@/lib/feedback/similar'
import {
  ignoreIfDenied,
  loadCanonicalIdeaBoard,
  loadUserDocumentIdeaBoard,
  mergeCanonicalAndUserBoard,
  writeUserAdmin,
  writeUserComment,
  writeUserHistory,
  writeUserIdea,
  writeUserNotes,
  writeUserVote,
} from '@/lib/feedback/platformBoard'
import { platformOwnerProfilePayload } from '@/lib/platform/ownerProfile'
import {
  parseComment,
  parseHistory,
  parseInternalNotes,
  parseVote,
  serializeSuggestion,
} from '@/lib/feedback/serialize'
import {
  defaultPublicStatusForDecision,
  type FeedbackComment,
  type FeedbackHistoryEntry,
  type FeedbackInternalNotes,
  type FeedbackPublicStatus,
  type FeedbackSuggestion,
  type FeedbackVote,
} from '@/lib/feedback/types'

type FeedbackState = {
  suggestions: FeedbackSuggestion[]
  votes: FeedbackVote[]
  comments: FeedbackComment[]
  history: FeedbackHistoryEntry[]
  internalNotes: Record<string, FeedbackInternalNotes>
  loading: boolean
  error: string | null
  loadBoard: (includeHidden: boolean) => Promise<void>
  loadSuggestionExtras: (suggestionId: string, asDeveloper: boolean) => Promise<void>
  submitIdea: (input: {
    title: string
    details: string
    category: FeedbackSuggestion['category']
    relatedFeature: FeedbackSuggestion['relatedFeature']
    userId: string
    authorName: string
    organizationId: string
    organizationName?: string
  }) => Promise<string>
  toggleVote: (suggestion: FeedbackSuggestion, userId: string) => Promise<void>
  addComment: (suggestion: FeedbackSuggestion, userId: string, authorName: string, body: string) => Promise<void>
  updateAdmin: (input: {
    suggestion: FeedbackSuggestion
    actorUserId: string
    actorName: string
    patch: Partial<
      Pick<
        FeedbackSuggestion,
        'publicStatus' | 'productDecision' | 'category' | 'relatedFeature' | 'officialResponse' | 'pinned' | 'hidden'
      >
    >
    reason?: string
  }) => Promise<void>
  saveInternalNotes: (suggestionId: string, notes: string, userId: string) => Promise<void>
  mergeSuggestions: (input: {
    source: FeedbackSuggestion
    destination: FeedbackSuggestion
    actorUserId: string
    actorName: string
    reason?: string
  }) => Promise<void>
}

async function writeHistory(entry: Omit<FeedbackHistoryEntry, 'id' | 'createdAt'> & { id?: string }) {
  if (!db) return
  const id = entry.id || newUuid()
  const createdAt = new Date()
  const payload = omitUndefinedDeep({
    suggestionId: entry.suggestionId,
    actorUserId: entry.actorUserId,
    actorName: entry.actorName,
    field: entry.field,
    fromValue: entry.fromValue,
    toValue: entry.toValue,
    reason: entry.reason || '',
    createdAt: Timestamp.now(),
  })
  await ignoreIfDenied(() => setDoc(doc(db, 'productFeedbackHistory', id), payload))
  await writeUserHistory(
    db,
    entry.actorUserId,
    {
      id,
      suggestionId: entry.suggestionId,
      actorUserId: entry.actorUserId,
      actorName: entry.actorName,
      field: entry.field,
      fromValue: entry.fromValue,
      toValue: entry.toValue,
      reason: entry.reason,
      createdAt,
    },
    platformOwnerProfilePayload()
  )
}

export const useFeedbackStore = create<FeedbackState>((set, get) => ({
  suggestions: [],
  votes: [],
  comments: [],
  history: [],
  internalNotes: {},
  loading: false,
  error: null,

  loadBoard: async (includeHidden) => {
    if (!db) return
    set({ loading: true, error: null })
    try {
      const [canonical, userLoaded] = await Promise.all([loadCanonicalIdeaBoard(db), loadUserDocumentIdeaBoard(db)])
      const merged = mergeCanonicalAndUserBoard(canonical, userLoaded.board, userLoaded.overlays)
      const suggestions = merged.suggestions
        .filter((row) => includeHidden || (!row.hidden && !row.mergedIntoId))
        .sort(
          (a, b) =>
            Number(b.pinned) - Number(a.pinned) || b.voteCount - a.voteCount || b.createdAt.getTime() - a.createdAt.getTime()
        )
      set({
        suggestions,
        votes: merged.votes,
        comments: merged.comments,
        history: merged.history,
        internalNotes: merged.internalNotes,
        loading: false,
        error: null,
      })
    } catch (error: unknown) {
      const mapped = feedbackWriteError(error)
      set({
        error: mapped === 'Could not save this feedback. Stay signed in and try again.' ? 'Could not load feedback' : mapped,
        loading: false,
      })
    }
  },

  loadSuggestionExtras: async (suggestionId, asDeveloper) => {
    if (!db) return
    const current = get()
    let comments = current.comments.filter((comment) => comment.suggestionId === suggestionId)
    let votes = current.votes
    const next: Partial<FeedbackState> = {}
    try {
      const [commentSnap, voteSnap] = await Promise.all([
        getDocs(query(collection(db, 'productFeedbackComments'), where('suggestionId', '==', suggestionId))),
        getDocs(query(collection(db, 'productFeedbackVotes'), where('suggestionId', '==', suggestionId))),
      ])
      comments = commentSnap.docs
        .map((entry) => parseComment(entry.id, entry.data() as Record<string, unknown>))
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      votes = [
        ...current.votes.filter((vote) => vote.suggestionId !== suggestionId),
        ...voteSnap.docs.map((entry) => parseVote(entry.id, entry.data() as Record<string, unknown>)),
      ]
    } catch {
      /* User-document board already has comments and votes. */
    }
    next.comments = comments
    next.votes = votes
    if (asDeveloper) {
      try {
        const [historySnap, notesSnap] = await Promise.all([
          getDocs(query(collection(db, 'productFeedbackHistory'), where('suggestionId', '==', suggestionId))),
          getDoc(doc(db, 'productFeedback', suggestionId, 'private', 'notes')),
        ])
        next.history = historySnap.docs
          .map((entry) => parseHistory(entry.id, entry.data() as Record<string, unknown>))
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        if (notesSnap.exists()) {
          next.internalNotes = {
            ...current.internalNotes,
            [suggestionId]: parseInternalNotes(notesSnap.data() as Record<string, unknown>),
          }
        }
      } catch {
        next.history = current.history.filter((entry) => entry.suggestionId === suggestionId)
        next.internalNotes = current.internalNotes
      }
    }
    set(next)
  },

  submitIdea: async (input) => {
    if (!db) throw new Error('Firestore is not configured')
    const id = newUuid()
    const now = new Date()
    const row: FeedbackSuggestion = {
      id,
      title: input.title.trim(),
      details: input.details.trim(),
      category: input.category,
      relatedFeature: input.relatedFeature,
      authorUserId: input.userId,
      authorName: input.authorName,
      organizationId: input.organizationId,
      organizationName: input.organizationName?.trim() || undefined,
      voteCount: 1,
      commentCount: 0,
      publicStatus: 'under_review',
      productDecision: 'none',
      pinned: false,
      hidden: false,
      createdAt: now,
      updatedAt: now,
    }
    await writeUserIdea(db, input.userId, row)
    await ignoreIfDenied(async () => {
      await setDoc(doc(db, 'productFeedback', id), serializeSuggestion(row))
      await setDoc(doc(db, 'productFeedbackVotes', voteId(id, input.userId)), {
        suggestionId: id,
        userId: input.userId,
        createdAt: Timestamp.now(),
      })
    })
    set({
      suggestions: [row, ...get().suggestions],
      votes: [
        ...get().votes,
        { id: voteId(id, input.userId), suggestionId: id, userId: input.userId, createdAt: now },
      ],
    })
    void trackEvent('idea_submitted', {
      userId: input.userId,
      organizationId: input.organizationId,
      metadata: { category: input.category },
    })
    return id
  },

  toggleVote: async (suggestion, userId) => {
    if (!db) return
    const id = voteId(suggestion.id, userId)
    const existing = get().votes.find((vote) => vote.id === id || (vote.suggestionId === suggestion.id && vote.userId === userId))
    if (existing) {
      await writeUserVote(db, userId, suggestion.id, false)
      await ignoreIfDenied(() => deleteDoc(doc(db, 'productFeedbackVotes', existing.id)))
      const voteCount = Math.max(0, suggestion.voteCount - 1)
      await ignoreIfDenied(() =>
        setDoc(doc(db, 'productFeedback', suggestion.id), { voteCount, updatedAt: Timestamp.now() }, { merge: true })
      )
      set({
        votes: get().votes.filter((vote) => vote.id !== existing.id),
        suggestions: get().suggestions.map((row) => (row.id === suggestion.id ? { ...row, voteCount } : row)),
      })
      return
    }
    await writeUserVote(db, userId, suggestion.id, true)
    const voteCount = suggestion.voteCount + 1
    await ignoreIfDenied(async () => {
      await setDoc(doc(db, 'productFeedbackVotes', id), {
        suggestionId: suggestion.id,
        userId,
        createdAt: Timestamp.now(),
      })
      await setDoc(doc(db, 'productFeedback', suggestion.id), { voteCount, updatedAt: Timestamp.now() }, { merge: true })
    })
    set({
      votes: [...get().votes, { id, suggestionId: suggestion.id, userId, createdAt: new Date() }],
      suggestions: get().suggestions.map((row) => (row.id === suggestion.id ? { ...row, voteCount } : row)),
    })
    void trackEvent('idea_voted', { userId, organizationId: suggestion.organizationId })
  },

  addComment: async (suggestion, userId, authorName, body) => {
    if (!db) return
    const id = newUuid()
    const comment: FeedbackComment = {
      id,
      suggestionId: suggestion.id,
      authorUserId: userId,
      authorName,
      body: body.trim(),
      createdAt: new Date(),
    }
    await writeUserComment(db, userId, comment)
    const commentCount = suggestion.commentCount + 1
    await ignoreIfDenied(async () => {
      await setDoc(doc(db, 'productFeedbackComments', id), {
        suggestionId: suggestion.id,
        authorUserId: userId,
        authorName,
        body: comment.body,
        createdAt: Timestamp.now(),
      })
      await setDoc(doc(db, 'productFeedback', suggestion.id), { commentCount, updatedAt: Timestamp.now() }, { merge: true })
    })
    set({
      comments: [...get().comments, comment],
      suggestions: get().suggestions.map((row) => (row.id === suggestion.id ? { ...row, commentCount } : row)),
    })
    if (suggestion.organizationId && suggestion.authorUserId && suggestion.authorUserId !== userId) {
      void saveInboxNotification({
        organizationId: suggestion.organizationId,
        type: 'idea_comment',
        title: 'New comment on your feedback',
        message: `${authorName} commented on “${suggestion.title}”.`,
        userId: suggestion.authorUserId,
        relatedId: suggestion.id,
      })
    }
  },

  updateAdmin: async ({ suggestion, actorUserId, actorName, patch, reason }) => {
    if (!db) throw new Error('Firestore is not configured')
    const next: FeedbackSuggestion = { ...suggestion, ...patch, updatedAt: new Date() }
    if (patch.productDecision && patch.productDecision !== suggestion.productDecision && !patch.publicStatus) {
      next.publicStatus = defaultPublicStatusForDecision(patch.productDecision)
    }
    if (patch.productDecision && patch.productDecision !== 'none' && !suggestion.reviewedAt) {
      next.reviewedAt = new Date()
      next.reviewedByUserId = actorUserId
    }
    const ownerIdentity = platformOwnerProfilePayload()
    await writeUserAdmin(
      db,
      actorUserId,
      suggestion.id,
      {
        publicStatus: next.publicStatus,
        productDecision: next.productDecision,
        category: next.category,
        relatedFeature: next.relatedFeature,
        officialResponse: next.officialResponse,
        pinned: next.pinned,
        hidden: next.hidden,
        mergedIntoId: next.mergedIntoId,
        reviewedAt: next.reviewedAt,
        reviewedByUserId: next.reviewedByUserId,
      },
      ownerIdentity
    )
    await ignoreIfDenied(() => setDoc(doc(db, 'productFeedback', suggestion.id), serializeSuggestion(next), { merge: true }))
    const fields: Array<keyof typeof patch> = [
      'publicStatus',
      'productDecision',
      'category',
      'relatedFeature',
      'officialResponse',
      'pinned',
      'hidden',
    ]
    for (const field of fields) {
      if (patch[field] === undefined) continue
      const fromValue = String(suggestion[field] ?? '')
      const toValue = String(next[field] ?? '')
      if (fromValue === toValue) continue
      await writeHistory({
        suggestionId: suggestion.id,
        actorUserId,
        actorName,
        field,
        fromValue,
        toValue,
        reason,
      })
    }
    set({
      suggestions: get().suggestions.map((row) => (row.id === suggestion.id ? next : row)),
    })
    const statusChanged = next.publicStatus !== suggestion.publicStatus || next.officialResponse !== suggestion.officialResponse
    if (statusChanged && suggestion.organizationId) {
      void saveInboxNotification({
        organizationId: suggestion.organizationId,
        type: 'idea_status',
        title: 'Update on your feedback',
        message: `“${suggestion.title}” is now ${next.publicStatus.replace('_', ' ')}.`,
        userId: suggestion.authorUserId,
        relatedId: suggestion.id,
      })
    }
  },

  saveInternalNotes: async (suggestionId, notes, userId) => {
    if (!db) throw new Error('Firestore is not configured')
    const payload = { notes, updatedAt: Timestamp.now(), updatedByUserId: userId }
    await writeUserNotes(db, userId, suggestionId, notes, platformOwnerProfilePayload())
    await ignoreIfDenied(() => setDoc(doc(db, 'productFeedback', suggestionId, 'private', 'notes'), payload))
    set({
      internalNotes: {
        ...get().internalNotes,
        [suggestionId]: { notes, updatedAt: new Date(), updatedByUserId: userId },
      },
    })
  },

  mergeSuggestions: async ({ source, destination, actorUserId, actorName, reason }) => {
    if (!db) throw new Error('Firestore is not configured')
    const sourceVotes = get().votes.filter((vote) => vote.suggestionId === source.id)
    const destVotes = get().votes.filter((vote) => vote.suggestionId === destination.id)
    const { keepUserIds } = consolidateVotesOnMerge(destVotes, sourceVotes)
    for (const userId of keepUserIds) {
      await writeUserVote(db, userId, destination.id, true)
      await ignoreIfDenied(() =>
        setDoc(doc(db, 'productFeedbackVotes', voteId(destination.id, userId)), {
          suggestionId: destination.id,
          userId,
          createdAt: Timestamp.now(),
        })
      )
    }
    const voteCount = destination.voteCount + keepUserIds.length
    const commentCount = destination.commentCount + source.commentCount
    const merged: FeedbackSuggestion = {
      ...destination,
      voteCount,
      commentCount,
      updatedAt: new Date(),
    }
    const hiddenSource: FeedbackSuggestion = {
      ...source,
      hidden: true,
      mergedIntoId: destination.id,
      updatedAt: new Date(),
    }
    const ownerIdentity = platformOwnerProfilePayload()
    await writeUserAdmin(
      db,
      actorUserId,
      destination.id,
      {
        publicStatus: merged.publicStatus,
        productDecision: merged.productDecision,
        officialResponse: merged.officialResponse,
        pinned: merged.pinned,
        hidden: merged.hidden,
      },
      ownerIdentity
    )
    await writeUserAdmin(
      db,
      actorUserId,
      source.id,
      {
        hidden: true,
        mergedIntoId: destination.id,
      },
      ownerIdentity
    )
    await ignoreIfDenied(() => setDoc(doc(db, 'productFeedback', destination.id), serializeSuggestion(merged), { merge: true }))
    await ignoreIfDenied(() => setDoc(doc(db, 'productFeedback', source.id), serializeSuggestion(hiddenSource), { merge: true }))
    await writeHistory({
      suggestionId: destination.id,
      actorUserId,
      actorName,
      field: 'merge',
      fromValue: source.id,
      toValue: destination.id,
      reason,
    })
    await writeHistory({
      suggestionId: source.id,
      actorUserId,
      actorName,
      field: 'mergedInto',
      fromValue: source.id,
      toValue: destination.id,
      reason,
    })
    if (source.organizationId) {
      void saveInboxNotification({
        organizationId: source.organizationId,
        type: 'idea_merged',
        title: 'Your feedback was merged',
        message: `“${source.title}” was merged into “${destination.title}”.`,
        userId: source.authorUserId,
        relatedId: destination.id,
      })
    }
    set({
      suggestions: get()
        .suggestions.map((row) => {
          if (row.id === destination.id) return merged
          if (row.id === source.id) return hiddenSource
          return row
        })
        .filter((row) => row.id !== source.id || true),
    })
  },
}))

export function publicStatusLabel(status: FeedbackPublicStatus): string {
  return status.replace(/_/g, ' ')
}

export { feedbackWriteError } from '@/lib/feedback/errors'

export function hasVoted(votes: FeedbackVote[], suggestionId: string, userId: string | undefined): boolean {
  if (!userId) return false
  return votes.some((vote) => vote.suggestionId === suggestionId && vote.userId === userId)
}
