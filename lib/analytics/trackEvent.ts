import { addDoc, collection, doc, setDoc, Timestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase/config'
import { omitUndefinedDeep } from '@/lib/ios-parity/firestoreCodec'
import type { ProductEventName } from '@/lib/analytics/events'
import { sanitizeEventMetadata } from '@/lib/analytics/sanitizeEventMetadata'
import {
  hasGrantedAnalyticsConsent,
  LOGIN_TRACKED_KEY,
  PRODUCT_SESSION_ID_KEY,
} from '@/lib/analytics/analyticsConsent'
import { isPlatformOwnerEmail, isPlatformOwnerSentinelOrg } from '@/lib/platform/owner'

export function currentSessionId(): string | undefined {
  if (typeof window === 'undefined') return undefined
  try {
    return window.sessionStorage.getItem(PRODUCT_SESSION_ID_KEY) || undefined
  } catch {
    return undefined
  }
}

export function rememberSessionId(id: string): void {
  if (!hasGrantedAnalyticsConsent()) return
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.setItem(PRODUCT_SESSION_ID_KEY, id)
  } catch {
    /* private mode */
  }
}

export function maybeTrackSignedInEvents(input: {
  userId: string
  organizationId?: string
  email?: string
}): void {
  if (!hasGrantedAnalyticsConsent()) return
  if (isPlatformOwnerEmail(input.email) || isPlatformOwnerSentinelOrg(input.organizationId)) return
  if (typeof window !== 'undefined') {
    try {
      if (window.sessionStorage.getItem(LOGIN_TRACKED_KEY) === '1') return
      window.sessionStorage.setItem(LOGIN_TRACKED_KEY, '1')
    } catch {
      /* private mode */
    }
  }
  void trackEvent('user_logged_in', { userId: input.userId, organizationId: input.organizationId })
  void trackEvent('login', { userId: input.userId, organizationId: input.organizationId, metadata: { source: 'web' } })
}

export async function trackEvent(
  eventName: ProductEventName,
  input: {
    userId?: string
    organizationId?: string
    metadata?: Record<string, string | number | boolean>
  } = {}
): Promise<void> {
  if (!hasGrantedAnalyticsConsent()) return
  if (!db || !input.userId) return
  const payload = omitUndefinedDeep({
    userId: input.userId,
    organizationId: input.organizationId || '',
    sessionId: currentSessionId() || '',
    eventName,
    source: 'web',
    appVersion: process.env.NEXT_PUBLIC_APP_VERSION || process.env.NEXT_PUBLIC_BUILD_ID || 'web',
    path: typeof window === 'undefined' ? '' : window.location.pathname,
    metadata: sanitizeEventMetadata(input.metadata),
    createdAt: Timestamp.now(),
  })
  try {
    await addDoc(collection(db, 'productEvents'), payload)
  } catch (error) {
    console.warn('trackEvent failed:', error)
  }
}

export async function startOrTouchSession(input: {
  userId: string
  organizationId?: string
  path?: string
}): Promise<string | null> {
  if (!hasGrantedAnalyticsConsent()) return null
  if (!db) return null
  const existing = currentSessionId()
  const now = Timestamp.now()
  try {
    if (existing) {
      await setDoc(
        doc(db, 'productSessions', existing),
        omitUndefinedDeep({
          lastActivityAt: now,
          exitPath: input.path || '',
        }),
        { merge: true }
      )
      return existing
    }
    const ref = doc(collection(db, 'productSessions'))
    await setDoc(
      ref,
      omitUndefinedDeep({
        userId: input.userId,
        organizationId: input.organizationId || '',
        startedAt: now,
        lastActivityAt: now,
        entryPath: input.path || '',
        exitPath: input.path || '',
      })
    )
    rememberSessionId(ref.id)
    return ref.id
  } catch (error) {
    console.warn('product session failed:', error)
    return null
  }
}

export async function endSession(): Promise<void> {
  if (!hasGrantedAnalyticsConsent()) return
  if (!db) return
  const existing = currentSessionId()
  if (!existing) return
  try {
    const now = Timestamp.now()
    await setDoc(
      doc(db, 'productSessions', existing),
      {
        endedAt: now,
        lastActivityAt: now,
      },
      { merge: true }
    )
  } catch (error) {
    console.warn('endSession failed:', error)
  }
}
