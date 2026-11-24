'use client'

import { doc, serverTimestamp, setDoc, Timestamp } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase/config'
import {
  CLIENT_ERRORS_COLLECTION,
  clientErrorCreateFields,
  clientErrorDocId,
  clientErrorHashInput,
  clientErrorNextSlot,
  clientErrorSignature,
  clientErrorThrottle,
  currentOrganizationId,
  type ClientErrorSource,
  type ClientErrorThrottleState,
} from '@/lib/canonical'

/**
 * Web side of the error reports (rulebook §32, owner decision D7): a sampled, pseudonymous `clientErrors` document
 * per distinct error — the error class and code, the top app frame, the route pattern, the build, a known-message key
 * and a hash of the message, never its text — at most 20 per person per day, the same error once per browser
 * session, only while someone is signed in. Never throws, never reports its own failures, never blocks the page.
 */

const DAY_KEY_PREFIX = 'pp.clientErrors.'
/** A write the server has not answered by then (offline) is left in Firestore's queue; nothing waits on it. */
export const CLIENT_ERROR_WRITE_TIMEOUT_MS = 10_000
let sessionState: ClientErrorThrottleState | null = null
let preparing = false

function errorParts(error: unknown): { name: unknown; code: unknown; message: string; stack: unknown } {
  if (error && typeof error === 'object') {
    const e = error as { name?: unknown; code?: unknown; message?: unknown; stack?: unknown }
    return { name: e.name, code: e.code, message: typeof e.message === 'string' ? e.message : '', stack: e.stack }
  }
  return { name: 'Error', code: undefined, message: typeof error === 'string' ? error : '', stack: undefined }
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

/** 'refused' (the slot exists or the rules said no), 'sent', or 'pending' (no answer in time; left queued). */
async function writeWithTimeout(write: Promise<void>): Promise<'sent' | 'refused' | 'pending'> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<'pending'>((resolve) => {
    timer = setTimeout(() => resolve('pending'), CLIENT_ERROR_WRITE_TIMEOUT_MS)
  })
  try {
    return await Promise.race([write.then(() => 'sent' as const, () => 'refused' as const), timeout])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

/** Reports one error. `source`: window, promise, boundary or caught. */
export async function reportClientError(source: ClientErrorSource, error: unknown): Promise<void> {
  if (typeof window === 'undefined' || preparing) return
  const user = auth?.currentUser
  const firestore = db
  if (!firestore || !user) return
  let id: string | null = null
  let hash = ''
  let slot = 0
  let data: Record<string, unknown> | null = null
  // The guard covers only the synchronous / local part (no recursion from our own code); it is released before any
  // network wait, so an offline write can never leave it stuck.
  preparing = true
  try {
    const parts = errorParts(error)
    const nowMs = Date.now()
    const messageHash = await sha256Hex(parts.message)
    if (!messageHash) return
    const fields = clientErrorCreateFields({
      platform: 'web',
      source,
      name: parts.name,
      code: parts.code,
      message: parts.message,
      messageHash,
      stack: parts.stack,
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
    hash = (await sha256Hex(clientErrorHashInput(user.uid, fields.dayIndex))) || ''
    slot = decision.slot
    id = clientErrorDocId(hash, slot)
    const { expireAtMs, ...rest } = fields
    data = { ...rest, createdAt: serverTimestamp(), expireAt: Timestamp.fromMillis(expireAtMs) }
  } catch {
    return
  } finally {
    preparing = false
  }
  // A slot already used (the counter on this device was lost) is refused by the rules: try the next one.
  try {
    while (id && data) {
      const result = await writeWithTimeout(setDoc(doc(firestore, CLIENT_ERRORS_COLLECTION, id), data))
      if (result !== 'refused') return
      const next = clientErrorNextSlot(slot)
      if (next == null) return
      slot = next
      id = clientErrorDocId(hash, slot)
      if (sessionState) {
        sessionState = { ...sessionState, used: Math.max(sessionState.used, slot + 1) }
        storeUsed(user.uid, sessionState.dayIndex, sessionState.used)
      }
    }
  } catch {
    /* a refused or failed report is dropped: it must never cause another report */
  }
}

/** Test hook: forget this session's state. */
export function resetClientErrorSessionForTests(): void {
  sessionState = null
  preparing = false
}
