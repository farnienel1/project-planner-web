'use client'

import { doc, serverTimestamp, setDoc, Timestamp } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase/config'
import {
  CLIENT_ERRORS_COLLECTION,
  clientErrorCreateFields,
  clientErrorDocId,
  clientErrorHashInput,
  clientErrorSignature,
  clientErrorThrottle,
  currentOrganizationId,
  type ClientErrorSource,
  type ClientErrorThrottleState,
} from '@/lib/canonical'

/**
 * Web side of the error reports (rulebook §32, owner decision D7): a sampled, anonymous `clientErrors` document per
 * distinct error — at most 20 per person per day, the same error once per browser session — sent only while someone
 * is signed in. Never throws, never reports its own failures, never blocks the page.
 */

const DAY_KEY_PREFIX = 'pp.clientErrors.'
let sessionState: ClientErrorThrottleState | null = null
let reporting = false

function errorText(error: unknown): string {
  if (error instanceof Error) return error.name && error.name !== 'Error' ? `${error.name}: ${error.message}` : error.message
  if (typeof error === 'string') return error
  if (error && typeof error === 'object' && typeof (error as { message?: unknown }).message === 'string') {
    return (error as { message: string }).message
  }
  try {
    return String(error)
  } catch {
    return 'Unknown error'
  }
}

async function sha256Hex(text: string): Promise<string | null> {
  try {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
    return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
  } catch {
    return null
  }
}

function storedUsed(uid: string, dayIndex: number): number {
  try {
    const raw = window.localStorage.getItem(DAY_KEY_PREFIX + uid)
    const parsed = raw ? (JSON.parse(raw) as { dayIndex?: number; used?: number }) : null
    return parsed && parsed.dayIndex === dayIndex && Number.isInteger(parsed.used) ? Number(parsed.used) : 0
  } catch {
    return 0
  }
}

function storeUsed(uid: string, dayIndex: number, used: number): void {
  try {
    window.localStorage.setItem(DAY_KEY_PREFIX + uid, JSON.stringify({ dayIndex, used }))
  } catch {
    /* private mode: the session counter and the security rules still cap it */
  }
}

/** Reports one error. `source`: window, promise, boundary or caught. */
export async function reportClientError(source: ClientErrorSource, error: unknown): Promise<void> {
  if (typeof window === 'undefined' || reporting) return
  const user = auth?.currentUser
  if (!db || !user) return
  reporting = true
  try {
    const nowMs = Date.now()
    const fields = clientErrorCreateFields({
      platform: 'web',
      source,
      message: errorText(error),
      route: window.location.pathname,
      build: process.env.NEXT_PUBLIC_APP_VERSION || '',
      organizationId: currentOrganizationId(),
      nowMs,
    })
    if (!fields) return
    const signature = clientErrorSignature(fields)
    const base: ClientErrorThrottleState =
      sessionState && sessionState.dayIndex === fields.dayIndex
        ? { ...sessionState, used: Math.max(sessionState.used, storedUsed(user.uid, fields.dayIndex)) }
        : { dayIndex: fields.dayIndex, used: storedUsed(user.uid, fields.dayIndex), sent: sessionState?.sent ?? [] }
    const decision = clientErrorThrottle(base, { dayIndex: fields.dayIndex, signature })
    sessionState = decision.state
    if (!decision.send || decision.slot == null) return
    storeUsed(user.uid, fields.dayIndex, decision.state.used)
    const hash = await sha256Hex(clientErrorHashInput(user.uid, fields.dayIndex))
    const id = hash ? clientErrorDocId(hash, decision.slot) : null
    if (!id) return
    const { expireAtMs, ...rest } = fields
    await setDoc(doc(db, CLIENT_ERRORS_COLLECTION, id), {
      ...rest,
      createdAt: serverTimestamp(),
      expireAt: Timestamp.fromMillis(expireAtMs),
    })
  } catch {
    /* a refused or failed report is dropped: it must never cause another report */
  } finally {
    reporting = false
  }
}

/** Test hook: forget this session's state. */
export function resetClientErrorSessionForTests(): void {
  sessionState = null
  reporting = false
}
