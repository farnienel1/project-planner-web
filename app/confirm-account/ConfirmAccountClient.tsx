'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { doc, getDoc, Timestamp, updateDoc } from 'firebase/firestore'
import { withTimeout } from '@/lib/client/withTimeout'
import { getFirebaseAuth, getFirebaseDb } from '@/lib/firebase/ensureFirebase'
import { isValidUuid } from '@/lib/security/validation'

export default function ConfirmAccountClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token')?.trim() || ''
  const [message, setMessage] = useState('Confirming your account…')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!token || !isValidUuid(token)) {
      setError('This confirmation link is missing or invalid. Open the link from your setup email.')
      return
    }

    let cancelled = false
    async function confirm() {
      try {
        const db = getFirebaseDb()
        const ref = doc(db, 'accountConfirmations', token)
        const snap = await withTimeout(
          getDoc(ref),
          8000,
          'Confirming your account is taking too long. Refresh this page and open the email link again.'
        )
        if (!snap.exists()) {
          throw new Error('This confirmation link was not found. Ask support if you were expecting an email.')
        }
        const data = snap.data()
        if (data.isUsed !== true) {
          await withTimeout(
            updateDoc(ref, { isUsed: true, usedAt: Timestamp.now() }),
            8000,
            'Confirming your account is taking too long. Refresh this page and open the email link again.'
          )
        }
        const userId = typeof data.userId === 'string' ? data.userId : ''
        const signedInUid = getFirebaseAuth().currentUser?.uid
        if (userId && signedInUid === userId) {
          try {
            await withTimeout(
              updateDoc(doc(db, 'users', userId), {
                accountConfirmed: true,
                accountConfirmedAt: Timestamp.now(),
                updatedAt: Timestamp.now(),
              }),
              8000,
              'Confirming your account is taking too long. Refresh this page and open the email link again.'
            )
          } catch (profileError) {
            console.warn('Could not mark the user profile confirmed yet:', profileError)
          }
        }
        if (!cancelled) {
          setMessage('Account confirmed. Redirecting to login…')
          window.setTimeout(() => router.replace('/login?confirmed=1'), 800)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Could not confirm your account')
        }
      }
    }
    void confirm()
    return () => {
      cancelled = true
    }
  }, [token, router])

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f4f6f9] px-5 py-10">
      <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-[0_2px_30px_rgba(15,23,42,0.08)]">
        {error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : (
          <>
            <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600" />
            <h1 className="text-2xl font-extrabold text-slate-900">Opening your account</h1>
            <p className="mt-3 text-sm text-slate-600">{message}</p>
          </>
        )}
      </div>
    </div>
  )
}
