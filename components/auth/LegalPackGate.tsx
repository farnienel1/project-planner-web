'use client'

import { useMemo, useState } from 'react'
import { doc, Timestamp, updateDoc } from 'firebase/firestore'
import { useAuthStore } from '@/lib/stores/authStore'
import { getFirebaseDb } from '@/lib/firebase/ensureFirebase'
import { LEGAL_ENTITY, LEGAL_PACK_DOCUMENTS } from '@/lib/legal/customerLegalPack'
import { AcceptButton, ScrollAcceptDocument } from '@/components/legal/ScrollAcceptDocument'

export function LegalPackGate() {
  const { user, firebaseUser, organization } = useAuthStore()
  const [accepted, setAccepted] = useState<Record<string, boolean>>({
    saas: false,
    dpa: false,
    aup: false,
    privacy: false,
  })
  const [authorisedToBind, setAuthorisedToBind] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isSuperAdmin = Boolean(user?.isSuperAdmin)
  const allDocsAccepted = LEGAL_PACK_DOCUMENTS.every((doc) => accepted[doc.id])
  const canWelcome = allDocsAccepted && (!isSuperAdmin || authorisedToBind) && !saving

  const orgName = organization?.name || 'your organisation'

  const summary = useMemo(
    () =>
      `${LEGAL_ENTITY.name} · ${LEGAL_ENTITY.tradingName} · Version ${LEGAL_ENTITY.version} · Effective ${LEGAL_ENTITY.effectiveDate}`,
    []
  )

  const onWelcome = async () => {
    if (!user || !firebaseUser || !canWelcome) return
    setSaving(true)
    setError(null)
    try {
      const db = getFirebaseDb()
      const now = Timestamp.now()
      await updateDoc(doc(db, 'users', firebaseUser.uid), {
        policyAccepted: true,
        policyAcceptedAt: now,
        legalPackVersion: LEGAL_ENTITY.version,
        legalPackAcceptedAt: now,
        legalAcceptances: {
          saas: true,
          dpa: true,
          aup: true,
          privacy: true,
          authorisedToBind: isSuperAdmin ? authorisedToBind : false,
          organizationName: orgName,
          email: user.email,
          userId: firebaseUser.uid,
        },
        updatedAt: now,
      })
      useAuthStore.setState({
        user: { ...user, policyAccepted: true, policyAcceptedAt: new Date() },
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#f4f6f9] px-5 py-10">
      <div className="mx-auto max-w-3xl space-y-8">
        <header className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-widest text-blue-600">Project Planner</p>
          <h1 className="text-3xl font-extrabold text-slate-900">Welcome — please review the customer terms</h1>
          <p className="text-sm text-slate-600">
            Before you enter {orgName}, scroll through each document and accept it. Privacy is an
            acknowledgement of receipt, not a blanket consent to processing.
          </p>
          <p className="text-xs text-slate-500">{summary}</p>
        </header>

        {LEGAL_PACK_DOCUMENTS.map((document) => (
          <ScrollAcceptDocument
            key={document.id}
            document={document}
            accepted={accepted[document.id] === true}
            onAccept={() => setAccepted((prev) => ({ ...prev, [document.id]: true }))}
          />
        ))}

        {isSuperAdmin ? (
          <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={authorisedToBind}
              onChange={(e) => setAuthorisedToBind(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
            />
            <span>
              I confirm that I am authorised to accept these terms on behalf of the organisation named in
              this account ({orgName}).
            </span>
          </label>
        ) : null}

        {error ? (
          <p className="text-center text-sm text-red-600">{error}</p>
        ) : null}

        <AcceptButton enabled={canWelcome} onClick={() => void onWelcome()}>
          {saving ? 'Saving…' : 'Welcome to Project Planner'}
        </AcceptButton>
      </div>
    </div>
  )
}
