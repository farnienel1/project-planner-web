/**
 * Rulebook 1.85.0 §33: the "Getting started" checklist (`onboardingChecklist`). The card at the top of Home for admins
 * (`onboardingCardVisible`), and the same list on the setup wizard's last screen (`OnboardingChecklistList`).
 * Presentational, apart from the admin's Hide (`onboardingDismissWriteFields`, one partial update of the organisation).
 */

'use client'

import Link from 'next/link'
import { useState } from 'react'
import { doc, serverTimestamp, updateDoc } from 'firebase/firestore'
import { CheckCircleIcon } from '@heroicons/react/24/solid'
import { db } from '@/lib/firebase/config'
import { writeMetadataFields } from '@/lib/canonical/writeMetadata'
import {
  ONBOARDING_DISMISSED_AT_FIELD,
  ONBOARDING_DISMISS_CONFIRM,
  ONBOARDING_DISMISS_LABEL,
  ONBOARDING_OPTIONAL_LABEL,
  onboardingDismissWriteFields,
  type OnboardingChecklist,
} from '@/lib/canonical/onboardingChecklist'

export function OnboardingProgress({ checklist }: { checklist: OnboardingChecklist }) {
  const percent = Math.round(checklist.progress * 100)
  return (
    <div style={{ margin: '4px 0 12px' }}>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={checklist.total}
        aria-valuenow={checklist.doneCount}
        aria-label={checklist.progressLabel}
        style={{ height: 8, borderRadius: 999, background: 'var(--dash-track, #EEF0F4)', overflow: 'hidden' }}
      >
        <div style={{ width: `${percent}%`, height: '100%', borderRadius: 999, background: 'var(--dash-blue, #3E4FD8)' }} />
      </div>
      <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--dash-muted, #667085)' }}>{checklist.progressLabel}</p>
    </div>
  )
}

export function OnboardingChecklistList({ checklist, linkClassName = 'dash-li' }: { checklist: OnboardingChecklist; linkClassName?: string }) {
  return (
    <div className="dash-list">
      {checklist.items.map((item) => (
        <Link key={item.key} href={item.href} className={linkClassName}>
          <span className="ic" aria-hidden>
            {item.done ? (
              <CheckCircleIcon style={{ width: 20, height: 20, color: 'var(--dash-tag-teal-ink, #0E7C78)' }} />
            ) : (
              <span style={{ display: 'inline-block', width: 16, height: 16, borderRadius: 999, border: '2px solid var(--dash-muted, #667085)' }} />
            )}
          </span>
          <span className="grow">
            <span className="t" style={item.done ? { textDecoration: 'line-through', color: 'var(--dash-muted, #667085)' } : undefined}>
              {item.title}
              {item.optional ? ` · ${ONBOARDING_OPTIONAL_LABEL}` : ''}
            </span>
            <span className="s">{item.detail}</span>
          </span>
          <span className="sr-only">{item.done ? 'Done' : 'Not done yet'}</span>
        </Link>
      ))}
    </div>
  )
}

export function GettingStartedCard({ checklist, organizationId, userId }: { checklist: OnboardingChecklist; organizationId: string; userId: string }) {
  const [error, setError] = useState<string | null>(null)
  const [hidden, setHidden] = useState(false)
  if (hidden) return null

  function hide() {
    if (!organizationId) return
    if (typeof window !== 'undefined' && !window.confirm(ONBOARDING_DISMISS_CONFIRM)) return
    const fields = onboardingDismissWriteFields(userId)
    if (!fields) return
    setError(null)
    // Hidden at once; never waits for the server (offline the write is queued and sent when back online). The
    // organisation listener brings the stored value back; a refusal shows the card again with the message.
    setHidden(true)
    updateDoc(doc(db, 'organizations', organizationId), {
      ...fields,
      [ONBOARDING_DISMISSED_AT_FIELD]: serverTimestamp(),
      updatedAt: serverTimestamp(),
      ...(writeMetadataFields(userId, 'web') ?? {}),
    }).catch((e: unknown) => {
      setHidden(false)
      setError(e instanceof Error ? e.message : 'Could not hide the card. Try again.')
    })
  }

  return (
    <section className="dash-card" aria-labelledby="getting-started-title">
      <div className="dash-ch">
        <h2 id="getting-started-title">{checklist.title}</h2>
        <button type="button" className="dash-link" onClick={hide} style={{ background: 'none', border: 0, cursor: 'pointer', color: 'var(--dash-blue, #3E4FD8)', fontWeight: 600 }}>
          {ONBOARDING_DISMISS_LABEL}
        </button>
      </div>
      <p style={{ margin: '0 0 8px', color: 'var(--dash-ink-2, #344054)', fontSize: 14 }}>{checklist.subtitle}</p>
      <OnboardingProgress checklist={checklist} />
      <OnboardingChecklistList checklist={checklist} />
      {error ? (
        <p role="alert" style={{ margin: '8px 0 0', color: 'var(--dash-warn-ink, #C4242C)', fontSize: 13 }}>
          {error}
        </p>
      ) : null}
    </section>
  )
}
