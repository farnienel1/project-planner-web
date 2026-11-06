'use client'

/**
 * Rulebook 1.33.0 §21: the person's own "My Projects" / "My Small works" picks, live from
 * `organizations/{orgId}/worksListPicks/{uid}` (`myWorksPicksPath`), so a change on iPhone or in another tab shows at
 * once. Which jobs are on the list, the pre-fill and the order are the rulebook's (`myWorksList`, `myWorksIds`); this
 * file only reads and writes the document.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore'
import { getFirebaseDb } from '@/lib/firebase/ensureFirebase'
import {
  MY_WORKS_PICKS_COLLECTION,
  hasMyWorksList,
  myWorksList,
  myWorksPickerRows,
  myWorksPicksWriteFields,
  parseMyWorksPicks,
  type MyWorksPicks,
  type WorkCatalogue,
  type WorksListContext,
} from '@/lib/canonical'
import { jobAccessViewer } from '@/lib/access/bookingAccess'
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

/** Saves one kind's list (merge; the other kind is left as stored). */
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
  save: (ids: string[]) => Promise<void>
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
  const organizationId = input.organizationId
  const uid = input.user?.id
  const kind = input.kind
  const save = useCallback(
    async (ids: string[]) => {
      if (!organizationId || !uid) throw new Error('Not signed in to an organisation.')
      await saveMyWorksPicks(organizationId, uid, kind, ids)
    },
    [organizationId, uid, kind]
  )
  return { available, loaded, list, pickerRows, save }
}
