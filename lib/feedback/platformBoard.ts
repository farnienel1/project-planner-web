import {
  collection,
  deleteField,
  doc,
  documentId,
  getDocs,
  limit,
  orderBy,
  query,
  setDoc,
  startAfter,
  Timestamp,
  updateDoc,
  where,
  type DocumentData,
  type Firestore,
  type QueryDocumentSnapshot,
} from 'firebase/firestore'
import { isPermissionDenied } from '@/lib/analytics/ownerDirectory'
import { voteId } from '@/lib/feedback/similar'
import {
  parseComment,
  parseHistory,
  parseInternalNotes,
  parseSuggestion,
  parseVote,
  serializeSuggestion,
} from '@/lib/feedback/serialize'
import type {
  FeedbackComment,
  FeedbackHistoryEntry,
  FeedbackInternalNotes,
  FeedbackSuggestion,
  FeedbackVote,
} from '@/lib/feedback/types'

export const BOARD_FLAG = 'ppIdeaBoard'
export const BOARD_IDEAS = 'ppIdeas'
export const BOARD_VOTES = 'ppIdeaVotes'
export const BOARD_COMMENTS = 'ppIdeaComments'
export const BOARD_ADMIN = 'ppIdeaAdmin'
export const BOARD_HISTORY = 'ppIdeaHistory'
export const BOARD_NOTES = 'ppIdeaNotes'

const PAGE = 400

export type IdeaBoardSnapshot = {
  suggestions: FeedbackSuggestion[]
  votes: FeedbackVote[]
  comments: FeedbackComment[]
  history: FeedbackHistoryEntry[]
  internalNotes: Record<string, FeedbackInternalNotes>
}

export type IdeaAdminOverlay = Partial<
  Pick<
    FeedbackSuggestion,
    | 'publicStatus'
    | 'productDecision'
    | 'category'
    | 'relatedFeature'
    | 'officialResponse'
    | 'pinned'
    | 'hidden'
    | 'mergedIntoId'
    | 'reviewedAt'
    | 'reviewedByUserId'
  >
>

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

function isNotFound(error: unknown): boolean {
  const code = error && typeof error === 'object' && 'code' in error ? String((error as { code: unknown }).code) : ''
  const message = error instanceof Error ? error.message : String(error || '')
  return code === 'not-found' || /not[- ]found|no document/i.test(message)
}

export function applyAdminOverlay(row: FeedbackSuggestion, overlay: IdeaAdminOverlay | undefined): FeedbackSuggestion {
  if (!overlay) return row
  return {
    ...row,
    ...overlay,
    updatedAt: overlay.reviewedAt && overlay.reviewedAt.getTime() > row.updatedAt.getTime() ? overlay.reviewedAt : row.updatedAt,
  }
}

export function recountBoard(input: {
  suggestions: FeedbackSuggestion[]
  votes: FeedbackVote[]
  comments: FeedbackComment[]
}): FeedbackSuggestion[] {
  const voters = new Map<string, Set<string>>()
  for (const vote of input.votes) {
    if (!vote.suggestionId || !vote.userId) continue
    const set = voters.get(vote.suggestionId) || new Set<string>()
    set.add(vote.userId)
    voters.set(vote.suggestionId, set)
  }
  const comments = new Map<string, number>()
  for (const comment of input.comments) {
    if (!comment.suggestionId) continue
    comments.set(comment.suggestionId, (comments.get(comment.suggestionId) || 0) + 1)
  }
  return input.suggestions.map((row) => {
    const fromVotes = voters.get(row.id)?.size || 0
    const fromComments = comments.get(row.id) || 0
    return {
      ...row,
      voteCount: input.votes.length > 0 ? fromVotes : row.voteCount,
      commentCount: input.comments.length > 0 ? fromComments : row.commentCount,
    }
  })
}

export function mergeIdeaBoards(primary: IdeaBoardSnapshot, extra: IdeaBoardSnapshot): IdeaBoardSnapshot {
  const suggestions = new Map<string, FeedbackSuggestion>()
  for (const row of extra.suggestions) suggestions.set(row.id, row)
  for (const row of primary.suggestions) suggestions.set(row.id, { ...suggestions.get(row.id), ...row })
  const votes = new Map<string, FeedbackVote>()
  for (const row of [...extra.votes, ...primary.votes]) {
    const id = row.id || voteId(row.suggestionId, row.userId)
    if (!row.suggestionId || !row.userId) continue
    votes.set(id, { ...row, id })
  }
  const comments = new Map<string, FeedbackComment>()
  for (const row of [...extra.comments, ...primary.comments]) {
    if (!row.id) continue
    comments.set(row.id, row)
  }
  const history = new Map<string, FeedbackHistoryEntry>()
  for (const row of [...extra.history, ...primary.history]) {
    if (!row.id) continue
    history.set(row.id, row)
  }
  const counted = recountBoard({
    suggestions: [...suggestions.values()],
    votes: [...votes.values()],
    comments: [...comments.values()],
  }).sort(
    (a, b) =>
      Number(b.pinned) - Number(a.pinned) ||
      b.voteCount - a.voteCount ||
      b.createdAt.getTime() - a.createdAt.getTime()
  )
  return {
    suggestions: counted,
    votes: [...votes.values()],
    comments: [...comments.values()],
    history: [...history.values()].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()),
    internalNotes: { ...extra.internalNotes, ...primary.internalNotes },
  }
}

export function parseUserIdeaBoard(userId: string, data: Record<string, unknown>): IdeaBoardSnapshot {
  const ideas = asRecord(data[BOARD_IDEAS])
  const votes = asRecord(data[BOARD_VOTES])
  const comments = asRecord(data[BOARD_COMMENTS])
  const admin = asRecord(data[BOARD_ADMIN])
  const history = asRecord(data[BOARD_HISTORY])
  const notes = asRecord(data[BOARD_NOTES])
  const suggestions = Object.entries(ideas).map(([id, value]) => {
    const parsed = parseSuggestion(id, asRecord(value))
    return applyAdminOverlay(parsed, parseAdminOverlay(asRecord(admin[id])))
  })
  const voteRows: FeedbackVote[] = Object.entries(votes).flatMap(([suggestionId, value]) => {
    if (value === false || value == null) return []
    const rec = asRecord(value)
    const createdAt =
      value instanceof Date
        ? value
        : typeof value === 'boolean' || typeof value === 'number'
          ? new Date()
          : parseVote(voteId(suggestionId, userId), { suggestionId, userId, createdAt: rec.createdAt }).createdAt
    return [{ id: voteId(suggestionId, userId), suggestionId, userId, createdAt }]
  })
  const commentRows = Object.entries(comments).map(([id, value]) => parseComment(id, asRecord(value)))
  const historyRows = Object.entries(history).map(([id, value]) => parseHistory(id, asRecord(value)))
  const internalNotes: Record<string, FeedbackInternalNotes> = {}
  for (const [id, value] of Object.entries(notes)) {
    internalNotes[id] = parseInternalNotes(asRecord(value))
  }
  for (const [id, value] of Object.entries(admin)) {
    const overlay = asRecord(value)
    if (overlay.notes && typeof overlay.notes === 'string' && !internalNotes[id]) {
      internalNotes[id] = parseInternalNotes(overlay)
    }
  }
  return {
    suggestions: recountBoard({ suggestions, votes: voteRows, comments: commentRows }),
    votes: voteRows,
    comments: commentRows,
    history: historyRows,
    internalNotes,
  }
}

function parseAdminOverlay(data: Record<string, unknown>): IdeaAdminOverlay | undefined {
  if (Object.keys(data).length === 0) return undefined
  const parsed = parseSuggestion('overlay', data)
  const overlay: IdeaAdminOverlay = {}
  if (typeof data.publicStatus === 'string') overlay.publicStatus = parsed.publicStatus
  if (typeof data.productDecision === 'string') overlay.productDecision = parsed.productDecision
  if (typeof data.category === 'string') overlay.category = parsed.category
  if (typeof data.relatedFeature === 'string') overlay.relatedFeature = parsed.relatedFeature
  if (typeof data.officialResponse === 'string') overlay.officialResponse = parsed.officialResponse
  if (typeof data.pinned === 'boolean') overlay.pinned = parsed.pinned
  if (typeof data.hidden === 'boolean') overlay.hidden = parsed.hidden
  if (typeof data.mergedIntoId === 'string' && data.mergedIntoId) overlay.mergedIntoId = parsed.mergedIntoId
  if (data.reviewedAt) overlay.reviewedAt = parsed.reviewedAt
  if (typeof data.reviewedByUserId === 'string') overlay.reviewedByUserId = parsed.reviewedByUserId
  return overlay
}

export function applyOverlaysFromDocs(board: IdeaBoardSnapshot, overlays: Record<string, IdeaAdminOverlay>): IdeaBoardSnapshot {
  return {
    ...board,
    suggestions: recountBoard({
      suggestions: board.suggestions.map((row) => applyAdminOverlay(row, overlays[row.id])),
      votes: board.votes,
      comments: board.comments,
    }),
  }
}

async function fetchPaged(db: Firestore, collectionName: string): Promise<QueryDocumentSnapshot<DocumentData>[]> {
  const out: QueryDocumentSnapshot<DocumentData>[] = []
  let cursor: QueryDocumentSnapshot<DocumentData> | undefined
  for (;;) {
    const page = cursor
      ? query(collection(db, collectionName), orderBy(documentId()), startAfter(cursor), limit(PAGE))
      : query(collection(db, collectionName), orderBy(documentId()), limit(PAGE))
    const snap = await getDocs(page)
    out.push(...snap.docs)
    if (snap.size < PAGE) break
    cursor = snap.docs[snap.docs.length - 1]
  }
  return out
}

export async function loadCanonicalIdeaBoard(db: Firestore): Promise<IdeaBoardSnapshot | null> {
  try {
    const [suggestionSnap, voteSnap] = await Promise.all([
      getDocs(collection(db, 'productFeedback')),
      getDocs(collection(db, 'productFeedbackVotes')),
    ])
    return {
      suggestions: suggestionSnap.docs.map((entry) => parseSuggestion(entry.id, entry.data() as Record<string, unknown>)),
      votes: voteSnap.docs.map((entry) => parseVote(entry.id, entry.data() as Record<string, unknown>)),
      comments: [],
      history: [],
      internalNotes: {},
    }
  } catch (error) {
    if (isPermissionDenied(error)) return null
    throw error
  }
}

export async function loadUserDocumentIdeaBoard(db: Firestore): Promise<IdeaBoardSnapshot> {
  let docs: QueryDocumentSnapshot<DocumentData>[] = []
  try {
    const flagged = await getDocs(query(collection(db, 'users'), where(BOARD_FLAG, '==', true)))
    docs = flagged.docs
  } catch {
    docs = []
  }
  if (docs.length === 0) {
    try {
      docs = await fetchPaged(db, 'users')
    } catch (error) {
      if (isPermissionDenied(error)) return emptyBoard()
      throw error
    }
  }
  let board = emptyBoard()
  const overlays: Record<string, IdeaAdminOverlay> = {}
  for (const entry of docs) {
    const data = entry.data() as Record<string, unknown>
    const parsed = parseUserIdeaBoard(entry.id, data)
    board = mergeIdeaBoards(parsed, board)
    for (const [id, value] of Object.entries(asRecord(data[BOARD_ADMIN]))) {
      overlays[id] = { ...overlays[id], ...parseAdminOverlay(asRecord(value)) }
    }
  }
  return applyOverlaysFromDocs(board, overlays)
}

export function emptyBoard(): IdeaBoardSnapshot {
  return { suggestions: [], votes: [], comments: [], history: [], internalNotes: {} }
}

async function patchUserDoc(db: Firestore, userId: string, fields: Record<string, unknown>, createFallback?: Record<string, unknown>) {
  const ref = doc(db, 'users', userId)
  const payload = { ...fields, [BOARD_FLAG]: true, updatedAt: Timestamp.now() }
  try {
    await updateDoc(ref, payload)
  } catch (error) {
    if (!isNotFound(error)) throw error
    await setDoc(
      ref,
      {
        ...(createFallback || {}),
        [BOARD_FLAG]: true,
        updatedAt: Timestamp.now(),
      },
      { merge: true }
    )
    await updateDoc(ref, payload)
  }
}

export async function writeUserIdea(
  db: Firestore,
  userId: string,
  row: FeedbackSuggestion,
  identity?: Record<string, unknown>
) {
  await patchUserDoc(
    db,
    userId,
    {
      [`${BOARD_IDEAS}.${row.id}`]: serializeSuggestion(row),
      [`${BOARD_VOTES}.${row.id}`]: { suggestionId: row.id, userId, createdAt: Timestamp.fromDate(row.createdAt) },
    },
    identity
  )
}

export async function writeUserVote(db: Firestore, userId: string, suggestionId: string, on: boolean) {
  await patchUserDoc(db, userId, {
    [`${BOARD_VOTES}.${suggestionId}`]: on
      ? { suggestionId, userId, createdAt: Timestamp.now() }
      : deleteField(),
  })
}

export async function writeUserComment(db: Firestore, userId: string, comment: FeedbackComment) {
  await patchUserDoc(db, userId, {
    [`${BOARD_COMMENTS}.${comment.id}`]: {
      suggestionId: comment.suggestionId,
      authorUserId: comment.authorUserId,
      authorName: comment.authorName,
      body: comment.body,
      createdAt: Timestamp.fromDate(comment.createdAt),
    },
  })
}

export async function writeUserAdmin(db: Firestore, ownerUserId: string, suggestionId: string, overlay: IdeaAdminOverlay) {
  const payload: Record<string, unknown> = {}
  if (overlay.publicStatus !== undefined) payload.publicStatus = overlay.publicStatus
  if (overlay.productDecision !== undefined) payload.productDecision = overlay.productDecision
  if (overlay.category !== undefined) payload.category = overlay.category
  if (overlay.relatedFeature !== undefined) payload.relatedFeature = overlay.relatedFeature
  if (overlay.officialResponse !== undefined) payload.officialResponse = overlay.officialResponse
  if (overlay.pinned !== undefined) payload.pinned = overlay.pinned
  if (overlay.hidden !== undefined) payload.hidden = overlay.hidden
  if (overlay.mergedIntoId !== undefined) payload.mergedIntoId = overlay.mergedIntoId
  if (overlay.reviewedAt) payload.reviewedAt = Timestamp.fromDate(overlay.reviewedAt)
  if (overlay.reviewedByUserId !== undefined) payload.reviewedByUserId = overlay.reviewedByUserId
  await patchUserDoc(db, ownerUserId, {
    [`${BOARD_ADMIN}.${suggestionId}`]: payload,
  })
}

export async function writeUserNotes(db: Firestore, ownerUserId: string, suggestionId: string, notes: string) {
  await patchUserDoc(db, ownerUserId, {
    [`${BOARD_NOTES}.${suggestionId}`]: {
      notes,
      updatedAt: Timestamp.now(),
      updatedByUserId: ownerUserId,
    },
  })
}

export async function writeUserHistory(db: Firestore, ownerUserId: string, entry: FeedbackHistoryEntry) {
  await patchUserDoc(db, ownerUserId, {
    [`${BOARD_HISTORY}.${entry.id}`]: {
      suggestionId: entry.suggestionId,
      actorUserId: entry.actorUserId,
      actorName: entry.actorName,
      field: entry.field,
      fromValue: entry.fromValue,
      toValue: entry.toValue,
      reason: entry.reason || '',
      createdAt: Timestamp.fromDate(entry.createdAt),
    },
  })
}

export async function ignoreIfDenied(work: () => Promise<void>): Promise<boolean> {
  try {
    await work()
    return true
  } catch (error) {
    if (isPermissionDenied(error)) return false
    throw error
  }
}
