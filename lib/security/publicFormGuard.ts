import type { NextRequest, NextResponse } from 'next/server'
import type { z } from 'zod'
import { enforceRateLimit, jsonError, readJsonBody } from '@/lib/security/apiGuard'
import { firstZodError, honeypotFilled } from '@/lib/security/publicFormSchemas'
import { enforceAppCheck } from '@/lib/security/verifyAppCheckToken'

export async function guardPublicForm<T>(
  request: NextRequest,
  schema: z.ZodType<T>,
  options: { scope: string; limit: number; windowMs: number }
): Promise<
  | { ok: false; response: NextResponse }
  | { ok: true; silent: true }
  | { ok: true; silent: false; value: T }
> {
  const limited = enforceRateLimit(request, options.scope, options.limit, options.windowMs)
  if (limited) return { ok: false, response: limited }

  const checked = await enforceAppCheck(request)
  if (checked) return { ok: false, response: checked }

  const body = await readJsonBody<unknown>(request)
  if (!body.ok) return { ok: false, response: body.response }

  const parsed = schema.safeParse(body.value)
  if (!parsed.success) return { ok: false, response: jsonError(firstZodError(parsed.error), 400) }

  const website =
    parsed.data && typeof parsed.data === 'object' && parsed.data !== null && 'website' in parsed.data
      ? (parsed.data as { website?: unknown }).website
      : ''
  if (honeypotFilled(website)) return { ok: true, silent: true }

  return { ok: true, silent: false, value: parsed.data }
}
