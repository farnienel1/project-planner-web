'use client'

/**
 * Rulebook 1.33.0 §21: the person's own "My Projects" / "My Small works" picks, live from
 * `organizations/{orgId}/worksListPicks/{uid}` (`myWorksPicksPath`), so a change on iPhone or in another tab shows at
 * once. Which jobs are on the list, the pre-fill and the order are the rulebook's (`myWorksList`, `myWorksIds`); this
 * file only reads and writes the document.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore'
import { getFirebaseDb } from '@/lib/firebase/ensureFirebase'
import {
  MY_WORKS_PICKS_COLLECTION,
  hasMyWorksList,
  myWorksIds,
  myWorksList,
  myWorksPickerRows,
  myWorksPicksWriteFields,
  parseMyWorksPicks,
  type MyWorksPicks,
  type WorkCatalogue,
  type WorksListContext,
} from '@/lib/canonical'
import { jobAccessViewer } from '@/lib/access/bookingAccess'
import { watchWrite } from '@/lib/works/watchWrite'
import type { Project, User } from '@/types'

const NEVER_SAVED: MyWorksPicks = { projects: null, smallWorks: null }

export type MyWorksPicksState = {
  /** The stored picks (`null` per kind = never saved, so the pre-fill applies). */
  picks: MyWorksPicks
  /** True once the document has been read for this person and organisation. */
  loaded: boolean
  error: string | null
}

export function useMyWorksPicks(organizationId: string | null | undefined, uid: string | null | undefined, enabled: boolean): MyWorksPicksState {
  const [state, setState] = useState<MyWorksPicksState & { key: string }>({ picks: NEVER_SAVED, loaded: false, error: null, key: '' })
  const key = enabled && organizationId && uid ? `${organizationId}/${uid}` : ''
  useEffect(() => {
    if (!key || !organizationId || !uid) return
    // Organisation context: a switch re-subscribes; the previous company's picks are never shown.
    setState({ picks: NEVER_SAVED, loaded: false, error: null, key })
    const unsubscribe = onSnapshot(
      doc(getFirebaseDb(), 'organizations', organizationId, MY_WORKS_PICKS_COLLECTION, uid),
      (snap) => setState({ picks: parseMyWorksPicks(snap.exists() ? snap.data() : null), loaded: true, error: null, key }),
      (error) => setState({ picks: NEVER_SAVED, loaded: true, error: error.message, key })
    )
    return () => unsubscribe()
  }, [key, organizationId, uid])
  if (!key || state.key !== key) return { picks: NEVER_SAVED, loaded: false, error: null }
  return { picks: state.picks, loaded: state.loaded, error: state.error }
}

/**
 * Saves one kind's list (merge; the other kind is left as stored). The promise settles when the server confirms; callers
 * do not wait for it on screen (`watchWrite`) — the live listener shows the new list at once from the local write.
 */
export async function saveMyWorksPicks(
  organizationId: string,
  uid: string,
  kind: WorkCatalogue,
  ids: ReadonlyArray<string>
): Promise<void> {
  await setDoc(
    doc(getFirebaseDb(), 'organizations', organizationId, MY_WORKS_PICKS_COLLECTION, uid),
    myWorksPicksWriteFields(kind, ids, serverTimestamp()),
    { merge: true }
  )
}

/**
 * `pending`: the server has not confirmed yet (after `WRITE_CONFIRM_TIMEOUT_MS`). `unconfirmed`: still no answer after
 * `MY_WORKS_SAVE_UNCONFIRMED_AFTER_MS` — a neutral notice, never left saying "Saving…" for ever. `refused`: the server
 * said no.
 */
export type MyWorksSaveNotice = { status: 'pending' | 'unconfirmed' | 'refused'; message: string }

/** Web keeps no offline copy (no persistent Firestore cache): a write still waiting is lost if the page closes. */
export const MY_WORKS_SAVE_PENDING_MESSAGE = "Saving… keep this page open until it's saved."

export const MY_WORKS_SAVE_UNCONFIRMED_MESSAGE =
  'We could not confirm your list was saved. Reload the page to check it, and save again if it is not right.'

/** How long a pending notice stays before it turns into the neutral `unconfirmed` notice. */
export const MY_WORKS_SAVE_UNCONFIRMED_AFTER_MS = 60_000

/** The My list for one screen: who gets it, the jobs on it and the ⚙ rows (all from the rulebook). */
export function useMyWorksList<T extends Project>(input: {
  kind: WorkCatalogue
  organizationId: string | null | undefined
  user: User | null
  /** Every job of the list before visibility (the store's documents). */
  jobs: T[]
  context: WorksListContext
}): {
  available: boolean
  loaded: boolean
  list: T[]
  pickerRows: Array<{ job: T; picked: boolean }>
  /**
   * The whole stored list for this kind (`myWorksIds`: the saved ids, else the pre-fill), including ids of jobs that
   * were deleted or are hidden from the viewer. The ⚙ starts from this, so Save keeps those ids (rulebook §21: a saved
   * id of a deleted job "stays stored").
   */
  storedIds: string[]
  /** Hands the list to Firestore and returns at once; the outcome shows in `saveNotice`. */
  save: (ids: string[]) => void
  /** Non-blocking notice for the list screen: the last save still waiting for the server, or refused. */
  saveNotice: MyWorksSaveNotice | null
} {
  const viewer = useMemo(() => jobAccessViewer(input.user), [input.user])
  const available = hasMyWorksList(viewer)
  const { picks, loaded } = useMyWorksPicks(input.organizationId, input.user?.id, available)
  const list = useMemo(
    () => (available && loaded ? myWorksList(input.jobs, picks, viewer, input.context, input.kind) : []),
    [available, loaded, input.jobs, picks, viewer, input.context, input.kind]
  )
  const pickerRows = useMemo(
    () => (available && loaded ? myWorksPickerRows(input.jobs, picks, viewer, input.context, input.kind) : []),
    [available, loaded, input.jobs, picks, viewer, input.context, input.kind]
  )
  const storedIds = useMemo(
    () => (available && loaded ? myWorksIds(picks, input.jobs, viewer, input.context, input.kind) : []),
    [available, loaded, input.jobs, picks, viewer, input.context, input.kind]
  )
  const organizationId = input.organizationId
  const uid = input.user?.id
  const kind = input.kind
  const noticeKey = organizationId && uid ? `${organizationId}/${uid}/${kind}` : ''
  const [notice, setNotice] = useState<(MyWorksSaveNotice & { key: string }) | null>(null)
  // Only the latest save may change the notice (an older, slower write settling later never overwrites it).
  const saveSeq = useRef(0)
  const unconfirmedTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const clearUnconfirmedTimer = () => {
    if (unconfirmedTimer.current) clearTimeout(unconfirmedTimer.current)
    unconfirmedTimer.current = null
  }
  useEffect(() => clearUnconfirmedTimer, [])
  const save = useCallback(
    (ids: string[]) => {
      const seq = ++saveSeq.current
      if (!organizationId || !uid) {
        setNotice({ key: noticeKey, status: 'refused', message: 'Your list was not saved: not signed in to an organisation.' })
        return
      }
      clearUnconfirmedTimer()
      setNotice(null)
      void watchWrite(saveMyWorksPicks(organizationId, uid, kind, ids), (outcome) => {
        if (saveSeq.current !== seq) return
        clearUnconfirmedTimer()
        if (outcome.status === 'saved') setNotice(null)
        else if (outcome.status === 'pending') {
          setNotice({ key: noticeKey, status: 'pending', message: MY_WORKS_SAVE_PENDING_MESSAGE })
          unconfirmedTimer.current = setTimeout(() => {
            unconfirmedTimer.current = null
            if (saveSeq.current !== seq) return
            setNotice((current) =>
              current && current.status === 'pending'
                ? { key: current.key, status: 'unconfirmed', message: MY_WORKS_SAVE_UNCONFIRMED_MESSAGE }
                : current
            )
          }, MY_WORKS_SAVE_UNCONFIRMED_AFTER_MS)
        } else setNotice({ key: noticeKey, status: 'refused', message: `Your list was not saved: ${outcome.message}` })
      })
    },
    [organizationId, uid, kind, noticeKey]
  )
  const saveNotice = notice && notice.key === noticeKey ? { status: notice.status, message: notice.message } : null
  return { available, loaded, list, pickerRows, storedIds, save, saveNotice }
}
