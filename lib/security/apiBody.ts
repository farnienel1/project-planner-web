import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { jsonError } from '@/lib/security/apiGuard'
import type { NextResponse } from 'next/server'

/**
 * API route bodies are read only through a schema (mass-assignment audit 17 Nov, owner approved).
 *
 * `request.json()` hands back whatever the caller sent. A route that spreads it, or a field of it, into a Firestore
 * write lets a caller add `role`, `isAdmin`, `isSuperAdmin`, `organizationId` or any other key the route never meant
 * to accept. These helpers parse the body against a zod object schema and return only the keys the schema lists:
 *
 * - `strip` (default): unknown keys are dropped silently, so an older client that still sends a key the route no
 *   longer reads keeps working, and nothing it adds reaches the route.
 * - `strict`: unknown keys refuse the request (400), for routes with no older clients.
 *
 * The schema is always an object schema; nested objects in it strip (or refuse) their own unknown keys the same way
 * when they are declared with `apiObject` / `z.object`.
 */
export type ApiBodyMode = 'strip' | 'strict'

/** A body field object: unknown keys stripped (zod's default), named so a reader knows it is deliberate. */
export function apiObject<Shape extends z.ZodRawShape>(shape: Shape) {
  return z.object(shape)
}

/** Parse an already-read value against `schema`. Unknown keys are dropped (`strip`) or refused (`strict`). */
export function parseApiBody<Shape extends z.ZodRawShape>(
  value: unknown,
  schema: z.ZodObject<Shape>,
  mode: ApiBodyMode = 'strip'
): { ok: true; value: z.infer<z.ZodObject<Shape>> } | { ok: false; error: string } {
  const shaped = mode === 'strict' ? schema.strict() : schema.strip()
  const result = shaped.safeParse(value ?? {})
  if (result.success) return { ok: true, value: result.data as z.infer<z.ZodObject<Shape>> }
  const issue = result.error.issues[0]
  if (issue?.code === 'unrecognized_keys') return { ok: false, error: 'Request has fields this route does not accept' }
  const where = issue?.path?.length ? `${issue.path.join('.')}: ` : ''
  return { ok: false, error: `Invalid request body (${where}${issue?.message || 'invalid'})` }
}

/**
 * Read the request's JSON body (size-capped, like `readJsonBody`) and parse it with `schema`. The route only ever
 * sees the schema's keys. A body that is missing (no content) is read as `{}` so optional-only schemas still work.
 */
export async function readApiBody<Shape extends z.ZodRawShape>(
  request: NextRequest,
  schema: z.ZodObject<Shape>,
  options: { maxBytes?: number; mode?: ApiBodyMode } = {}
): Promise<{ ok: true; value: z.infer<z.ZodObject<Shape>> } | { ok: false; response: NextResponse }> {
  const maxBytes = options.maxBytes ?? 32_768
  const lengthHeader = request.headers.get('content-length')
  const length = lengthHeader ? Number(lengthHeader) : 0
  if (Number.isFinite(length) && length > maxBytes) return { ok: false, response: jsonError('Request too large', 413) }
  let raw: unknown
  try {
    const text = await request.text()
    if (text.length > maxBytes) return { ok: false, response: jsonError('Request too large', 413) }
    raw = text.trim() ? JSON.parse(text) : {}
  } catch {
    return { ok: false, response: jsonError('Invalid JSON body', 400) }
  }
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, response: jsonError('Invalid JSON body', 400) }
  }
  const parsed = parseApiBody(raw, schema, options.mode ?? 'strip')
  if (!parsed.ok) return { ok: false, response: jsonError(parsed.error, 400) }
  return { ok: true, value: parsed.value }
}

/** Optional text, trimmed, at most `max` characters, `''` when missing or not text (never refuses for a non-string). */
export function apiText(max: number) {
  return z
    .unknown()
    .optional()
    .transform((value) => (typeof value === 'string' ? value.trim().slice(0, max) : ''))
}

/** Optional finite number, `undefined` when missing or not a finite number. */
export function apiNumber() {
  return z.unknown().optional().transform((value) => (typeof value === 'number' && Number.isFinite(value) ? value : undefined))
}

/** Optional boolean, `false` unless exactly `true`. */
export function apiFlag() {
  return z.unknown().optional().transform((value) => value === true)
}
