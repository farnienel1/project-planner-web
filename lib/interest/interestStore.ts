'use client'

import { useEffect, useState } from 'react'
import { arrayUnion, collection, deleteDoc, doc, onSnapshot, query, serverTimestamp, updateDoc, where } from 'firebase/firestore'
import { db } from '@/lib/firebase/config'
import { jsonAuthHeaders } from '@/lib/security/clientAuthHeaders'
import { interestFromFirestore, noteEntry, type InterestRegistration } from '@/lib/interest/record'
import type { InterestStatus } from '@/lib/interest/registration'

let preferClient = false
const listeners = new Set<() => void>()
let pollers = 0
let pollTimer: number | null = null

function bump() {
  listeners.forEach((listener) => listener())
}

function watch(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function startPoll() {
  pollers += 1
  if (pollTimer == null && typeof window !== 'undefined') {
    pollTimer = window.setInterval(() => {
      if (!preferClient) bump()
    }, 20_000)
  }
  return () => {
    pollers -= 1
    if (pollers <= 0 && pollTimer != null) {
      window.clearInterval(pollTimer)
      pollTimer = null
      pollers = 0
    }
  }
}

function sortRows(rows: InterestRegistration[]): InterestRegistration[] {
  return [...rows].sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0))
}

async function loadFromApi(): Promise<{ rows: InterestRegistration[]; newCount: number } | 'client'> {
  const headers = await jsonAuthHeaders()
  const response = await fetch('/api/interest/registrations', { headers, cache: 'no-store' })
  if (response.status === 503) return 'client'
  if (!response.ok) throw new Error('Could not load registrations.')
  const body = (await response.json()) as { rows?: Record<string, unknown>[]; newCount?: number }
  const rows = sortRows((body.rows || []).map((row) => interestFromFirestore(String(row.id || ''), row)))
  return { rows, newCount: typeof body.newCount === 'number' ? body.newCount : rows.filter((row) => row.status === 'new').length }
}

export function useInterestRegistrations(): {
  rows: InterestRegistration[]
  loading: boolean
  error: string | null
} {
  const [rows, setRows] = useState<InterestRegistration[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => watch(() => setTick((value) => value + 1)), [])
  useEffect(() => startPoll(), [])

  useEffect(() => {
    let stop = false
    let unsubscribe = () => {}
    async function load() {
      if (!preferClient) {
        try {
          const result = await loadFromApi()
          if (stop) return
          if (result !== 'client') {
            setRows(result.rows)
            setError(null)
            setLoading(false)
            return
          }
          preferClient = true
        } catch (err) {
          if (stop) return
          setLoading(false)
          setError(err instanceof Error ? err.message : 'Could not load registrations.')
          return
        }
      }
      if (!db) {
        setLoading(false)
        setError('Registrations are not available.')
        return
      }
      unsubscribe = onSnapshot(
        collection(db, 'interestRegistrations'),
        (snap) => {
          if (stop) return
          setRows(sortRows(snap.docs.map((entry) => interestFromFirestore(entry.id, entry.data() as Record<string, unknown>))))
          setLoading(false)
          setError(null)
        },
        () => {
          if (stop) return
          setLoading(false)
          setError('Could not load registrations.')
        }
      )
    }
    void load()
    return () => {
      stop = true
      unsubscribe()
    }
  }, [tick])

  return { rows, loading, error }
}

export function useNewInterestCount(): number {
  const [count, setCount] = useState(0)
  const [tick, setTick] = useState(0)

  useEffect(() => watch(() => setTick((value) => value + 1)), [])
  useEffect(() => startPoll(), [])

  useEffect(() => {
    let stop = false
    let unsubscribe = () => {}
    async function load() {
      if (!preferClient) {
        try {
          const result = await loadFromApi()
          if (stop) return
          if (result !== 'client') {
            setCount(result.newCount)
            return
          }
          preferClient = true
        } catch {
          if (!stop) setCount(0)
          return
        }
      }
      if (!db) return
      unsubscribe = onSnapshot(
        query(collection(db, 'interestRegistrations'), where('status', '==', 'new')),
        (snap) => {
          if (!stop) setCount(snap.size)
        },
        () => {
          if (!stop) setCount(0)
        }
      )
    }
    void load()
    return () => {
      stop = true
      unsubscribe()
    }
  }, [tick])

  return count
}

async function patchInterest(id: string, body: Record<string, unknown>): Promise<'api' | 'client'> {
  const headers = await jsonAuthHeaders()
  const response = await fetch(`/api/interest/registrations/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(body),
  })
  if (response.status === 503) return 'client'
  if (!response.ok) throw new Error('Could not update that registration.')
  return 'api'
}

export async function setInterestStatus(id: string, status: InterestStatus): Promise<void> {
  if (!preferClient) {
    const mode = await patchInterest(id, { status })
    if (mode === 'api') {
      bump()
      return
    }
    preferClient = true
  }
  await updateDoc(doc(db, 'interestRegistrations', id), {
    status,
    updatedAt: serverTimestamp(),
  })
}

export async function addInterestNote(id: string, body: string, authorName: string): Promise<void> {
  const text = body.trim()
  if (!text) return
  if (!preferClient) {
    const mode = await patchInterest(id, { note: text, authorName })
    if (mode === 'api') {
      bump()
      return
    }
    preferClient = true
  }
  await updateDoc(doc(db, 'interestRegistrations', id), {
    noteEntries: arrayUnion(noteEntry(text, authorName)),
    updatedAt: serverTimestamp(),
  })
}

export async function deleteInterestRegistration(id: string): Promise<void> {
  if (!preferClient) {
    const headers = await jsonAuthHeaders()
    const response = await fetch(`/api/interest/registrations/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers,
    })
    if (response.status !== 503) {
      if (!response.ok) throw new Error('Could not delete that registration.')
      bump()
      return
    }
    preferClient = true
  }
  await deleteDoc(doc(db, 'interestRegistrations', id))
}
