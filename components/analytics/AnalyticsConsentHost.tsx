'use client'

import { useEffect, useState } from 'react'
import { Modal } from '@/components/ui/overlays'
import {
  ANALYTICS_CONSENT_COPY,
  getAnalyticsConsent,
  openAnalyticsConsentSettings,
  setAnalyticsConsent,
  shouldAutoPromptAnalyticsConsent,
  subscribeAnalyticsConsent,
  subscribeAnalyticsConsentSettings,
  type AnalyticsConsentChoice,
} from '@/lib/analytics/analyticsConsent'
import { useAuthStore } from '@/lib/stores/authStore'

const equalChoiceClass =
  'h-11 min-w-30 rounded-[13px] border border-(--line) bg-(--card) px-[18px] text-[14.5px] font-semibold text-(--ink) shadow-pp'

function ConsentActions({
  onAccept,
  onReject,
}: {
  onAccept: () => void
  onReject: () => void
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <button type="button" className={equalChoiceClass} onClick={onReject}>
        Reject
      </button>
      <button type="button" className={equalChoiceClass} onClick={onAccept}>
        Accept
      </button>
    </div>
  )
}

function statusCopy(choice: AnalyticsConsentChoice | null): string {
  if (choice === 'granted') return 'Current choice: allowed.'
  if (choice === 'denied') return 'Current choice: turned off.'
  return 'Current choice: not set.'
}

export function AnalyticsConsentHost({ autoPrompt = false }: { autoPrompt?: boolean }) {
  const [choice, setChoice] = useState<AnalyticsConsentChoice | null>(() =>
    typeof window === 'undefined' ? null : getAnalyticsConsent()
  )
  const [ready, setReady] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)

  useEffect(() => {
    setChoice(getAnalyticsConsent())
    setReady(true)
    return subscribeAnalyticsConsent(setChoice)
  }, [])

  useEffect(() => subscribeAnalyticsConsentSettings(() => setDialogOpen(true)), [])

  const accept = () => {
    setAnalyticsConsent('granted')
    setChoice('granted')
    setDialogOpen(false)
    const user = useAuthStore.getState().user
    if (user?.id) {
      void import('@/lib/analytics/trackEvent').then(({ maybeTrackSignedInEvents }) => {
        maybeTrackSignedInEvents({
          userId: user.id,
          organizationId: user.organizationId,
          email: user.email,
        })
      })
    }
  }

  const reject = () => {
    setAnalyticsConsent('denied')
    setChoice('denied')
    setDialogOpen(false)
  }

  const showBar = shouldAutoPromptAnalyticsConsent({ autoPrompt, choice, ready, dialogOpen })

  return (
    <>
      {showBar ? (
        <div
          role="dialog"
          aria-label="Usage analytics"
          className="fixed inset-x-0 bottom-0 z-90 border-t border-(--line) bg-(--card) px-4 py-4 shadow-(--sh-pop)"
        >
          <div className="mx-auto flex max-w-4xl flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-2xl">
              <p className="font-(family-name:--head) text-base font-bold text-(--ink)">Usage analytics</p>
              <p className="mt-1 text-sm leading-relaxed text-(--ink2)">{ANALYTICS_CONSENT_COPY}</p>
            </div>
            <ConsentActions onAccept={accept} onReject={reject} />
          </div>
        </div>
      ) : null}
      <Modal
        open={dialogOpen}
        title="Cookie settings"
        subtitle={statusCopy(choice)}
        onClose={() => setDialogOpen(false)}
        footer={<ConsentActions onAccept={accept} onReject={reject} />}
      >
        <p className="text-sm leading-relaxed text-(--ink2)">{ANALYTICS_CONSENT_COPY}</p>
      </Modal>
    </>
  )
}

export function CookieSettingsButton({
  className,
  children = 'Cookie settings',
}: {
  className?: string
  children?: string
}) {
  return (
    <button type="button" className={className} onClick={() => openAnalyticsConsentSettings()}>
      {children}
    </button>
  )
}
