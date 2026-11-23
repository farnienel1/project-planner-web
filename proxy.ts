import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { mfaVerifyHref, safePostMfaPath } from '@/lib/auth/mfa/mfaConstants'
import { clearSessionCookie, readMfaCookie } from '@/lib/auth/mfa/mfaCookiePolicy'
import { verifySignedMfaOk } from '@/lib/auth/mfa/mfaCookieVerify'
import { mfaPageGateDecision, verifyAppSessionCookie } from '@/lib/auth/mfa/mfaSessionCookie'

/**
 * The keys that sign the session cookie could not be fetched just now. Never a sign-out: the page asks again in a
 * few seconds (the same "try again" rule as the status route's 503).
 */
function retryResponse(): NextResponse {
  const html =
    '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<meta http-equiv="refresh" content="3"><title>Checking your sign-in</title></head>' +
    '<body style="font-family:system-ui,sans-serif;padding:24px">Checking your sign-in… This page will try again in a moment.</body></html>'
  return new NextResponse(html, {
    status: 503,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Retry-After': '3' },
  })
}

function isFirebaseAuthActionPath(pathname: string): boolean {
  return (
    pathname === '/__/auth/action' ||
    pathname === '/__/auth/handler' ||
    pathname.startsWith('/__/auth/')
  )
}

function requiresMfaCookie(pathname: string): boolean {
  return (
    pathname === '/dashboard' ||
    pathname.startsWith('/dashboard/') ||
    pathname === '/developer' ||
    pathname.startsWith('/developer/')
  )
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  if (isFirebaseAuthActionPath(pathname)) {
    const url = request.nextUrl.clone()
    url.pathname = '/auth/action'
    return NextResponse.redirect(url)
  }

  if (requiresMfaCookie(pathname)) {
    // Both the MFA pass and the Firebase session cookie, for the same uid (owner decision 17 Nov).
    const ok = await verifySignedMfaOk(readMfaCookie(request, 'ok'))
    const session = ok ? await verifyAppSessionCookie(readMfaCookie(request, 'session')) : ({ status: 'missing' } as const)
    const gate = mfaPageGateDecision(ok, session)
    if (gate.action === 'retry') return retryResponse()
    if (gate.action === 'verify') {
      const url = request.nextUrl.clone()
      const next = safePostMfaPath(pathname, pathname.startsWith('/developer') ? '/developer' : '/dashboard')
      const [path, search] = mfaVerifyHref(next).split('?')
      url.pathname = path
      url.search = search ? `?${search}` : ''
      const response = NextResponse.redirect(url)
      response.headers.set('Cache-Control', 'no-store')
      if (gate.clearSession) clearSessionCookie(response.cookies, request)
      return response
    }
  }

  return NextResponse.next()
}

export const config = {
  // Broad matcher: Next/Netlify skip a `/__/auth/:path*` matcher for underscore paths.
  matcher: ['/((?!_next/static|_next/image|_next/data|favicon.ico|branding/).*)'],
}
