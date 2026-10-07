import { NextResponse } from 'next/server'

import type { AuthActionResult } from '@/lib/auth/authActions'
import { toPublicAuthBody } from '@/lib/auth/publicAuthBody'
import { WEB_SESSION_COOKIE, webSessionCookieOptions } from '@/lib/auth/webSession'

export function authResultToResponse(result: AuthActionResult) {
  const body = toPublicAuthBody(result.body)
  const headers: Record<string, string> = { 'Cache-Control': 'no-store' }
  if (typeof body.retryAfterSec === 'number') headers['Retry-After'] = String(body.retryAfterSec)
  const response = NextResponse.json(body, { status: result.status, headers })
  const secure = process.env.NODE_ENV === 'production'
  if (result.clearCookie) {
    response.cookies.set(WEB_SESSION_COOKIE, '', { ...webSessionCookieOptions(0, secure), maxAge: 0 })
  } else if (result.cookie?.value) {
    response.cookies.set(WEB_SESSION_COOKIE, result.cookie.value, webSessionCookieOptions(result.cookie.maxAgeSec, secure))
  }
  return response
}
