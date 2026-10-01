import { restFieldsToPlain } from '@/lib/owner/firestoreRest'
import { adminGoogleAccessToken, firebaseAdminConfigured } from '@/lib/owner/identityToolkitAdmin'
import { firestoreValue } from '@/lib/stripe/writeOrgBilling'
import { interestFromFirestore, type InterestRegistration } from '@/lib/interest/record'
import { INTEREST_STATUSES, type InterestDraft, type InterestStatus } from '@/lib/interest/registration'

export class InterestAdminUnavailable extends Error {
  constructor() {
    super('FIREBASE_SERVICE_ACCOUNT_JSON is not set on the server.')
    this.name = 'InterestAdminUnavailable'
  }
}

const COLLECTION = 'interestRegistrations'

function projectFallback(): string {
  return process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'project-planner-f986c'
}

function emulatorOrigin(): string | null {
  const host = process.env.FIRESTORE_EMULATOR_HOST?.trim()
  if (!host || process.env.NODE_ENV === 'production') return null
  return host.startsWith('http') ? host.replace(/\/$/, '') : `http://${host}`
}

async function documentsRoot(): Promise<{ root: string; headers: Record<string, string> }> {
  const emulator = emulatorOrigin()
  if (emulator) {
    return {
      root: `${emulator}/v1/projects/${encodeURIComponent(projectFallback())}/databases/(default)/documents`,
      headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' },
    }
  }
  if (!firebaseAdminConfigured()) throw new InterestAdminUnavailable()
  const { token, projectId } = await adminGoogleAccessToken(['https://www.googleapis.com/auth/datastore'])
  const project = projectId || projectFallback()
  if (!project) throw new Error('Firebase project id is missing.')
  return {
    root: `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(project)}/databases/(default)/documents`,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  }
}

export function interestCreateBody(draft: InterestDraft, createdAt = new Date()): { fields: Record<string, unknown> } {
  const encoded = firestoreValue({ ...draft, createdAt }) as { mapValue?: { fields?: Record<string, unknown> } }
  return { fields: encoded.mapValue?.fields || {} }
}

function idFromName(name: string): string {
  const parts = name.split('/')
  return parts[parts.length - 1] || ''
}

function registrationFromDocument(document: { name?: string; fields?: Record<string, unknown> }): InterestRegistration | null {
  const id = idFromName(document.name || '')
  if (!id) return null
  return interestFromFirestore(id, restFieldsToPlain(document.fields))
}

async function readError(response: Response): Promise<string> {
  const text = await response.text()
  return text.slice(0, 500) || `Firestore request failed (${response.status})`
}

export async function createInterestRegistration(draft: InterestDraft): Promise<string> {
  const { root, headers } = await documentsRoot()
  const response = await fetch(`${root}/${COLLECTION}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(interestCreateBody(draft)),
  })
  if (!response.ok) throw new Error(await readError(response))
  const created = (await response.json()) as { name?: string }
  const id = idFromName(created.name || '')
  if (!id) throw new Error('Registration did not save.')
  const saved = await fetch(`${root}/${COLLECTION}/${encodeURIComponent(id)}`, { headers })
  if (!saved.ok) throw new Error('Registration did not save.')
  return id
}

export async function listInterestRegistrations(): Promise<InterestRegistration[]> {
  const { root, headers } = await documentsRoot()
  const rows: InterestRegistration[] = []
  let pageToken = ''
  do {
    const url = new URL(`${root}/${COLLECTION}`)
    url.searchParams.set('pageSize', '200')
    if (pageToken) url.searchParams.set('pageToken', pageToken)
    const response = await fetch(url, { headers, cache: 'no-store' })
    if (!response.ok) throw new Error(await readError(response))
    const body = (await response.json()) as {
      documents?: { name?: string; fields?: Record<string, unknown> }[]
      nextPageToken?: string
    }
    for (const document of body.documents || []) {
      const row = registrationFromDocument(document)
      if (row) rows.push(row)
    }
    pageToken = body.nextPageToken || ''
  } while (pageToken && rows.length < 2000)
  rows.sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0))
  return rows
}

async function readRegistration(id: string): Promise<InterestRegistration | null> {
  const { root, headers } = await documentsRoot()
  const response = await fetch(`${root}/${COLLECTION}/${encodeURIComponent(id)}`, { headers, cache: 'no-store' })
  if (response.status === 404) return null
  if (!response.ok) throw new Error(await readError(response))
  const document = (await response.json()) as { name?: string; fields?: Record<string, unknown> }
  return registrationFromDocument(document)
}

async function patchRegistration(id: string, fields: Record<string, unknown>, fieldPaths: string[]): Promise<void> {
  const { root, headers } = await documentsRoot()
  const url = new URL(`${root}/${COLLECTION}/${encodeURIComponent(id)}`)
  for (const name of fieldPaths) url.searchParams.append('updateMask.fieldPaths', name)
  const response = await fetch(url, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ fields }),
  })
  if (!response.ok) throw new Error(await readError(response))
}

export async function setInterestStatusAdmin(id: string, status: InterestStatus): Promise<void> {
  if (!(INTEREST_STATUSES as readonly string[]).includes(status)) {
    throw new Error('Unknown registration status.')
  }
  const encoded = firestoreValue({ status, updatedAt: new Date() }) as { mapValue?: { fields?: Record<string, unknown> } }
  await patchRegistration(id, encoded.mapValue?.fields || {}, ['status', 'updatedAt'])
}

export async function addInterestNoteAdmin(id: string, body: string, authorName: string): Promise<void> {
  const text = body.trim().slice(0, 2000)
  if (!text) return
  const current = await readRegistration(id)
  if (!current) throw new Error('That registration is not on the list.')
  const notes = [
    ...current.notes.map((note) => ({
      id: note.id,
      body: note.body,
      authorName: note.authorName,
      createdAt: note.createdAt,
    })),
    {
      id: crypto.randomUUID(),
      body: text,
      authorName: authorName.trim().slice(0, 120) || 'Owner',
      createdAt: new Date(),
    },
  ]
  const encoded = firestoreValue({ noteEntries: notes, updatedAt: new Date() }) as {
    mapValue?: { fields?: Record<string, unknown> }
  }
  await patchRegistration(id, encoded.mapValue?.fields || {}, ['noteEntries', 'updatedAt'])
}

export async function deleteInterestRegistrationAdmin(id: string): Promise<void> {
  const { root, headers } = await documentsRoot()
  const response = await fetch(`${root}/${COLLECTION}/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers,
  })
  if (!response.ok && response.status !== 404) throw new Error(await readError(response))
}

export function serializeInterestRegistration(row: InterestRegistration): Record<string, unknown> {
  return {
    id: row.id,
    firstName: row.firstName,
    lastName: row.lastName,
    company: row.company,
    email: row.email,
    phone: row.phone,
    role: row.role,
    teamSize: row.teamSize,
    sectors: row.sectors,
    currentTools: row.currentTools,
    message: row.message,
    status: row.status,
    source: row.source,
    campaign: row.campaign,
    referrer: row.referrer,
    pagePath: row.pagePath,
    userAgent: row.userAgent,
    noteEntries: row.notes.map((note) => ({
      id: note.id,
      body: note.body,
      authorName: note.authorName,
      createdAt: note.createdAt.toISOString(),
    })),
    createdAt: row.createdAt ? row.createdAt.toISOString() : null,
    updatedAt: row.updatedAt ? row.updatedAt.toISOString() : null,
  }
}
