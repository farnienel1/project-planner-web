import {
  InterestAdminUnavailable,
  addInterestNoteAdmin,
  createInterestRegistration,
  deleteInterestRegistrationAdmin,
  listInterestRegistrations,
  markInterestUnsubscribedByEmailAdmin,
  setInterestStatusAdmin,
} from '@/lib/interest/adminStore'
import {
  addInterestBlobNote,
  createInterestBlob,
  deleteInterestBlob,
  hasInterestBlob,
  listInterestBlobs,
  markInterestBlobsUnsubscribedByEmail,
  setInterestBlobStatus,
} from '@/lib/interest/blobStore'
import { normalizeInterestEmail } from '@/lib/interest/unsubscribeToken'
import type { InterestRegistration } from '@/lib/interest/record'
import type { InterestDraft, InterestStatus } from '@/lib/interest/registration'

function sortRows(rows: InterestRegistration[]): InterestRegistration[] {
  return [...rows].sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0))
}

export async function saveInterestRegistration(draft: InterestDraft): Promise<string> {
  try {
    return await createInterestRegistration(draft)
  } catch (error) {
    if (!(error instanceof InterestAdminUnavailable)) throw error
  }
  return createInterestBlob(draft)
}

export async function loadInterestRegistrations(): Promise<InterestRegistration[]> {
  const rows = new Map<string, InterestRegistration>()
  let firestoreReady = false
  try {
    for (const row of await listInterestRegistrations()) rows.set(row.id, row)
    firestoreReady = true
  } catch (error) {
    if (!(error instanceof InterestAdminUnavailable)) throw error
  }
  try {
    for (const row of await listInterestBlobs()) {
      if (!rows.has(row.id)) rows.set(row.id, row)
    }
  } catch (error) {
    if (error instanceof InterestAdminUnavailable) {
      if (!firestoreReady) throw error
    } else if (!firestoreReady) {
      throw error
    }
  }
  return sortRows([...rows.values()])
}

export async function updateInterestStatus(id: string, status: InterestStatus): Promise<void> {
  if (await hasInterestBlob(id)) {
    await setInterestBlobStatus(id, status)
    return
  }
  await setInterestStatusAdmin(id, status)
}

export async function updateInterestNote(id: string, body: string, authorName: string): Promise<void> {
  if (await hasInterestBlob(id)) {
    await addInterestBlobNote(id, body, authorName)
    return
  }
  await addInterestNoteAdmin(id, body, authorName)
}

export async function removeInterestRegistration(id: string): Promise<void> {
  if (await hasInterestBlob(id)) {
    await deleteInterestBlob(id)
    return
  }
  await deleteInterestRegistrationAdmin(id)
}

export async function markInterestRegistrationsUnsubscribed(email: string): Promise<void> {
  const normalized = normalizeInterestEmail(email)
  let firestoreReady = false
  try {
    await markInterestUnsubscribedByEmailAdmin(normalized)
    firestoreReady = true
  } catch (error) {
    if (!(error instanceof InterestAdminUnavailable)) throw error
  }
  try {
    await markInterestBlobsUnsubscribedByEmail(normalized)
  } catch (error) {
    if (error instanceof InterestAdminUnavailable) {
      if (!firestoreReady) throw error
    } else if (!firestoreReady) {
      throw error
    }
  }
}
