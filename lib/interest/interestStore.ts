'use client'

import { useEffect, useState } from 'react'
import { arrayUnion, collection, deleteDoc, doc, onSnapshot, query, serverTimestamp, updateDoc, where } from 'firebase/firestore'
import { db } from '@/lib/firebase/config'
import { interestFromFirestore, noteEntry, type InterestRegistration } from '@/lib/interest/record'
import type { InterestStatus } from '@/lib/interest/registration'

function collectionRef() {
  return collection(db, 'interestRegistrations')
}

export function useInterestRegistrations(): {
  rows: InterestRegistration[]
  loading: boolean
  error: string | null
} {
  const [rows, setRows] = useState<InterestRegistration[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!db) {
      setLoading(false)
      setError('Registrations are not available.')
      return
    }
    return onSnapshot(
      collectionRef(),
      (snap) => {
        const next = snap.docs
          .map((entry) => interestFromFirestore(entry.id, entry.data() as Record<string, unknown>))
          .sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0))
        setRows(next)
        setLoading(false)
        setError(null)
      },
      () => {
        setLoading(false)
        setError('Could not load registrations. Publish the latest Firestore rules, then try again.')
      }
    )
  }, [])

  return { rows, loading, error }
}

export function useNewInterestCount(): number {
  const [count, setCount] = useState(0)
  useEffect(() => {
    if (!db) return
    return onSnapshot(
      query(collectionRef(), where('status', '==', 'new')),
      (snap) => setCount(snap.size),
      () => setCount(0)
    )
  }, [])
  return count
}

export async function setInterestStatus(id: string, status: InterestStatus): Promise<void> {
  await updateDoc(doc(db, 'interestRegistrations', id), {
    status,
    updatedAt: serverTimestamp(),
  })
}

export async function addInterestNote(id: string, body: string, authorName: string): Promise<void> {
  const text = body.trim()
  if (!text) return
  await updateDoc(doc(db, 'interestRegistrations', id), {
    noteEntries: arrayUnion(noteEntry(text, authorName)),
    updatedAt: serverTimestamp(),
  })
}

export async function deleteInterestRegistration(id: string): Promise<void> {
  await deleteDoc(doc(db, 'interestRegistrations', id))
}
