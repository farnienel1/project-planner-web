import { getStore } from '@netlify/blobs'
import { interestFromFirestore, type InterestRegistration } from '@/lib/interest/record'
import { INTEREST_STATUSES, type InterestDraft, type InterestStatus } from '@/lib/interest/registration'
import { InterestAdminUnavailable } from '@/lib/interest/adminStore'

const STORE = 'interest-registrations'

function blobsUnavailable(error: unknown): boolean {
  return error instanceof Error && error.name === 'MissingBlobsEnvironmentError'
}

function openStore() {
  try {
    return getStore(STORE, { consistency: 'strong' })
  } catch (error) {
    if (blobsUnavailable(error)) throw new InterestAdminUnavailable()
    throw error
  }
}

function rowFromStored(id: string, data: Record<string, unknown> | null): InterestRegistration | null {
  if (!data) return null
  return interestFromFirestore(id, data)
}

export async function createInterestBlob(draft: InterestDraft): Promise<string> {
  const store = openStore()
  const id = crypto.randomUUID().replace(/-/g, '').slice(0, 20)
  const record = {
    ...draft,
    noteEntries: [],
    createdAt: new Date().toISOString(),
    updatedAt: null,
  }
  await store.setJSON(id, record)
  const saved = rowFromStored(id, await store.get(id, { type: 'json' }))
  if (!saved || saved.email !== draft.email) throw new Error('Registration did not save.')
  return id
}

export async function listInterestBlobs(): Promise<InterestRegistration[]> {
  const store = openStore()
  const listed = await store.list()
  const rows: InterestRegistration[] = []
  for (const blob of listed.blobs) {
    const row = rowFromStored(blob.key, await store.get(blob.key, { type: 'json' }))
    if (row) rows.push(row)
  }
  return rows
}

async function readBlob(id: string): Promise<Record<string, unknown> | null> {
  const store = openStore()
  return store.get(id, { type: 'json' })
}

export async function hasInterestBlob(id: string): Promise<boolean> {
  try {
    const row = await readBlob(id)
    return Boolean(row)
  } catch (error) {
    if (error instanceof InterestAdminUnavailable) return false
    throw error
  }
}

export async function setInterestBlobStatus(id: string, status: InterestStatus): Promise<void> {
  if (!(INTEREST_STATUSES as readonly string[]).includes(status)) throw new Error('Unknown registration status.')
  const store = openStore()
  const current = await store.get(id, { type: 'json' })
  if (!current) throw new Error('That registration is not on the list.')
  await store.setJSON(id, { ...current, status, updatedAt: new Date().toISOString() })
}

export async function addInterestBlobNote(id: string, body: string, authorName: string): Promise<void> {
  const text = body.trim().slice(0, 2000)
  if (!text) return
  const store = openStore()
  const current = (await store.get(id, { type: 'json' })) as Record<string, unknown> | null
  if (!current) throw new Error('That registration is not on the list.')
  const existing = Array.isArray(current.noteEntries) ? current.noteEntries : []
  await store.setJSON(id, {
    ...current,
    noteEntries: [
      ...existing,
      {
        id: crypto.randomUUID(),
        body: text,
        authorName: authorName.trim().slice(0, 120) || 'Owner',
        createdAt: new Date().toISOString(),
      },
    ],
    updatedAt: new Date().toISOString(),
  })
}

export async function deleteInterestBlob(id: string): Promise<void> {
  const store = openStore()
  await store.delete(id)
}

export async function deleteInterestBlobsByEmail(email: string): Promise<number> {
  const target = email.trim().toLowerCase()
  const rows = await listInterestBlobs()
  let removed = 0
  for (const row of rows) {
    if (row.email === target) {
      await deleteInterestBlob(row.id)
      removed += 1
    }
  }
  return removed
}
