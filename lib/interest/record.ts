import { Timestamp } from 'firebase/firestore'
import { parseFirestoreDate, parseString } from '@/lib/firebase/firestoreUtils'
import { INTEREST_STATUSES, type InterestStatus } from '@/lib/interest/registration'

export type InterestNote = {
  id: string
  body: string
  authorName: string
  createdAt: Date
}

export type InterestRegistration = {
  id: string
  firstName: string
  lastName: string
  company: string
  email: string
  phone: string
  role: string
  teamSize: string
  sectors: string[]
  currentTools: string
  message: string
  status: InterestStatus
  source: string
  campaign: string
  referrer: string
  pagePath: string
  userAgent: string
  notes: InterestNote[]
  createdAt: Date | null
  updatedAt: Date | null
}

function statusOf(value: string): InterestStatus {
  return (INTEREST_STATUSES as readonly string[]).includes(value) ? (value as InterestStatus) : 'new'
}

export function interestFromFirestore(id: string, data: Record<string, unknown>): InterestRegistration {
  const noteRaw = Array.isArray(data.noteEntries) ? data.noteEntries : []
  const notes = noteRaw
    .map((row) => {
      if (!row || typeof row !== 'object') return null
      const item = row as Record<string, unknown>
      const body = parseString(item.body)
      if (!body) return null
      return {
        id: parseString(item.id) || body,
        body,
        authorName: parseString(item.authorName, 'Owner'),
        createdAt: parseFirestoreDate(item.createdAt) ?? new Date(0),
      }
    })
    .filter((row): row is InterestNote => row !== null)
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
  const legacy = parseString(data.notes)
  if (legacy && notes.length === 0) {
    notes.push({ id: 'legacy', body: legacy, authorName: 'Owner', createdAt: new Date(0) })
  }
  return {
    id,
    firstName: parseString(data.firstName),
    lastName: parseString(data.lastName),
    company: parseString(data.company),
    email: parseString(data.email).toLowerCase(),
    phone: parseString(data.phone),
    role: parseString(data.role),
    teamSize: parseString(data.teamSize),
    sectors: Array.isArray(data.sectors) ? data.sectors.filter((row): row is string => typeof row === 'string') : [],
    currentTools: parseString(data.currentTools),
    message: parseString(data.message),
    status: statusOf(parseString(data.status, 'new')),
    source: parseString(data.source, 'direct'),
    campaign: parseString(data.campaign),
    referrer: parseString(data.referrer),
    pagePath: parseString(data.pagePath),
    userAgent: parseString(data.userAgent),
    notes,
    createdAt: parseFirestoreDate(data.createdAt) ?? null,
    updatedAt: parseFirestoreDate(data.updatedAt) ?? null,
  }
}

export function noteEntry(body: string, authorName: string): Record<string, unknown> {
  return {
    id: crypto.randomUUID(),
    body: body.trim().slice(0, 2000),
    authorName: authorName.trim().slice(0, 120) || 'Owner',
    createdAt: Timestamp.now(),
  }
}
