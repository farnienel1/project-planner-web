import { randomUUID } from 'node:crypto'
import type { NextRequest } from 'next/server'
import { maskEmail } from '@/lib/auth/maskEmail'
import { bearerToken } from '@/lib/owner/firestoreRest'
import { firestoreDocumentsBase } from '@/lib/owner/googleApis'
import { clientIp } from '@/lib/security/apiGuard'

/**
 * Owner console PLAN A4: every owner action is audited by the server, and the audit is never optional.
 * - `requested` (with a `requestId`) is written **before** the action; if it cannot be stored the action is refused.
 * - `completed` or `failed` follows with the same `requestId`.
 * - `before` / `after` hold changed fields only, emails masked, and never a pay rate, tax id, password or token.
 * Nothing edits or deletes an entry (the security rules refuse update and delete).
 */

export const OWNER_AUDIT_PHASES = ['requested', 'completed', 'failed'] as const
export type OwnerAuditPhase = (typeof OWNER_AUDIT_PHASES)[number]

/** Every field an `adminAuditLog` entry may hold (the rules' shape check lists the same). */
export const OWNER_AUDIT_FIELDS = [
  'requestId',
  'action',
  'phase',
  'actorUid',
  'targetOrgId',
  'targetUserId',
  'reason',
  'before',
  'after',
  'ip',
  'userAgent',
  'at',
] as const

export const OWNER_AUDIT_LIMITS = {
  action: 80,
  id: 128,
  reason: 500,
  detail: 1500,
  ip: 64,
  userAgent: 300,
} as const

export const OWNER_AUDIT_UNAVAILABLE_MESSAGE = 'Could not write the audit log entry, so nothing was changed. Try again.'

export type OwnerAuditInput = {
  action: string
  targetOrgId?: string
  targetUserId?: string
  reason?: string
  before?: Record<string, unknown>
  after?: Record<string, unknown>
}

export type OwnerAuditEntry = OwnerAuditInput & {
  requestId: string
  phase: OwnerAuditPhase
  actorUid: string
  ip?: string
  userAgent?: string
  atIso: string
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
/** Keys never written into an audit entry, at any depth (compared without case). */
const HIDDEN_KEYS = new Set([
  'rate',
  'pay',
  'paybasis',
  'payprofile',
  'taxid',
  'taxids',
  'utr',
  'vat',
  'vatnumber',
  'nino',
  'password',
  'token',
  'idtoken',
  'secret',
  'privatekey',
  'apikey',
])

function hiddenKey(key: string): boolean {
  // `dayRate`, `hourlyRate`, `otRate`: any camel-case "…Rate".
  return HIDDEN_KEYS.has(key.toLowerCase()) || /Rate$/.test(key)
}

/** Masks every email-looking string and drops pay, tax and secret keys, recursively. */
export function sanitizeAuditDetail(value: unknown, depth = 0): unknown {
  if (depth > 6) return '[deep]'
  if (typeof value === 'string') return EMAIL_RE.test(value.trim()) ? maskEmail(value) : value
  if (Array.isArray(value)) return value.slice(0, 50).map((item) => sanitizeAuditDetail(item, depth + 1))
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    const out: Record<string, unknown> = {}
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      if (hiddenKey(key)) continue
      if (item === undefined) continue
      out[key] = sanitizeAuditDetail(item, depth + 1)
    }
    return out
  }
  if (value instanceof Date) return value.toISOString()
  return value
}

function clip(value: string, max: number): string {
  return value.length > max ? value.slice(0, max) : value
}

function cleanId(value: string | undefined): string {
  return clip((value || '').trim(), OWNER_AUDIT_LIMITS.id)
}

/** The Firestore REST `fields` for one entry. Pure; the shape the rules check. */
export function ownerAuditDocumentFields(entry: OwnerAuditEntry): Record<string, unknown> {
  const fields: Record<string, unknown> = {
    requestId: { stringValue: cleanId(entry.requestId) },
    action: { stringValue: clip(entry.action.trim(), OWNER_AUDIT_LIMITS.action) },
    phase: { stringValue: entry.phase },
    actorUid: { stringValue: cleanId(entry.actorUid) },
    at: { timestampValue: entry.atIso },
  }
  const orgId = cleanId(entry.targetOrgId)
  const userId = cleanId(entry.targetUserId)
  if (orgId) fields.targetOrgId = { stringValue: orgId }
  if (userId) fields.targetUserId = { stringValue: userId }
  const reason = (entry.reason || '').trim()
  if (reason) fields.reason = { stringValue: clip(reason, OWNER_AUDIT_LIMITS.reason) }
  if (entry.before && Object.keys(entry.before).length) {
    fields.before = { stringValue: clip(JSON.stringify(sanitizeAuditDetail(entry.before)), OWNER_AUDIT_LIMITS.detail) }
  }
  if (entry.after && Object.keys(entry.after).length) {
    fields.after = { stringValue: clip(JSON.stringify(sanitizeAuditDetail(entry.after)), OWNER_AUDIT_LIMITS.detail) }
  }
  if (entry.ip) fields.ip = { stringValue: clip(entry.ip, OWNER_AUDIT_LIMITS.ip) }
  if (entry.userAgent) fields.userAgent = { stringValue: clip(entry.userAgent, OWNER_AUDIT_LIMITS.userAgent) }
  return fields
}

/** Writes one entry with the owner's own token; throws when it was not stored. */
export async function writeOwnerAuditEntry(request: NextRequest, entry: OwnerAuditEntry): Promise<void> {
  const token = bearerToken(request)
  if (!token || !process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID) throw new Error('Audit log unavailable')
  const response = await fetch(`${firestoreDocumentsBase()}/adminAuditLog`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: ownerAuditDocumentFields(entry) }),
  })
  if (!response.ok) throw new Error(`Audit log write refused (${response.status})`)
}

export type OwnerAuditRun = {
  requestId: string
  /** Writes `completed`. Returns false (and logs) when it could not be stored: the action already happened. */
  complete: (after?: Record<string, unknown>) => Promise<boolean>
  /** Writes `failed` with what went wrong. Same storage rule as `complete`. */
  fail: (error: unknown, after?: Record<string, unknown>) => Promise<boolean>
}

export class OwnerAuditUnavailableError extends Error {
  constructor(cause?: unknown) {
    super(OWNER_AUDIT_UNAVAILABLE_MESSAGE)
    this.name = 'OwnerAuditUnavailableError'
    if (cause) (this as { cause?: unknown }).cause = cause
  }
}

function requestContext(request: NextRequest) {
  return {
    ip: clientIp(request),
    userAgent: (request.headers.get('user-agent') || '').trim(),
  }
}

function errorText(error: unknown): string {
  const text = error instanceof Error ? error.message : typeof error === 'string' ? error : 'failed'
  return clip(text, 300)
}

/**
 * Writes `requested` and returns the run. Throws OwnerAuditUnavailableError when the entry was not stored —
 * the caller must then refuse the action (answer 502 with OWNER_AUDIT_UNAVAILABLE_MESSAGE).
 */
export async function beginOwnerAudit(
  request: NextRequest,
  actorUid: string,
  input: OwnerAuditInput,
  options: { requestId?: string; now?: () => Date } = {}
): Promise<OwnerAuditRun> {
  const requestId = options.requestId || randomUUID()
  const now = options.now || (() => new Date())
  const context = requestContext(request)
  const base = { ...input, requestId, actorUid, ...context }
  try {
    await writeOwnerAuditEntry(request, { ...base, phase: 'requested', atIso: now().toISOString() })
  } catch (error) {
    console.error('[adminAuditLog] requested', error)
    throw new OwnerAuditUnavailableError(error)
  }
  const finish = async (phase: OwnerAuditPhase, after?: Record<string, unknown>) => {
    try {
      await writeOwnerAuditEntry(request, { ...base, phase, after: after ?? input.after, atIso: now().toISOString() })
      return true
    } catch (error) {
      console.error(`[adminAuditLog] ${phase}`, requestId, error)
      return false
    }
  }
  return {
    requestId,
    complete: (after) => finish('completed', after),
    fail: (error, after) => finish('failed', { ...(after || {}), error: errorText(error) }),
  }
}

/** A one-entry record for something that is not a change (a masked field revealed). Throws when not stored. */
export async function recordOwnerEvent(
  request: NextRequest,
  actorUid: string,
  input: OwnerAuditInput,
  options: { requestId?: string; now?: () => Date } = {}
): Promise<string> {
  const requestId = options.requestId || randomUUID()
  const at = (options.now || (() => new Date()))().toISOString()
  try {
    await writeOwnerAuditEntry(request, { ...input, requestId, actorUid, ...requestContext(request), phase: 'completed', atIso: at })
  } catch (error) {
    throw new OwnerAuditUnavailableError(error)
  }
  return requestId
}
