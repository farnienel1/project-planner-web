/**
 * iOS parity source: Views/PolicyAcceptanceView.swift, Views/PrivacyPolicyView.swift
 * Spec: docs/ios-parity/IOS_APP_BLUEPRINT.md §1.2
 */

'use client'

import { useState } from 'react'
import { doc, Timestamp, updateDoc } from 'firebase/firestore'
import { useAuthStore } from '@/lib/stores/authStore'
import { getFirebaseDb } from '@/lib/firebase/ensureFirebase'
import { PrivacyPolicyContent } from '@/components/auth/PrivacyPolicyContent'

export function PolicyGate() {
  const { user, firebaseUser } = useAuthStore()
  const [accepting, setAccepting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onAccept = async () => {
    if (!user || !firebaseUser || accepting) return
    setAccepting(true)
    setError(null)
    try {
      const db = getFirebaseDb()
      await updateDoc(doc(db, 'users', firebaseUser.uid), {
        policyAccepted: true,
        policyAcceptedAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      })
      useAuthStore.setState({
        user: { ...user, policyAccepted: true, policyAcceptedAt: new Date() },
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Please try again.')
    } finally {
      setAccepting(false)
    }
  }

  return (
    <div className="min-h-screen bg-ios-canvas">
      <PrivacyPolicyContent acceptanceRequired onAccept={onAccept} accepting={accepting} />
      {error ? (
        <p className="px-5 pb-8 text-center text-sm text-ios-icon-red">{error}</p>
      ) : null}
    </div>
  )
}
