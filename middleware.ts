import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { mfaVerifyHref, safePostMfaPath } from '@/lib/auth/mfa/mfaConstants'
import { readMfaCookie } from '@/lib/auth/mfa/mfaCookiePolicy'
import { verifySignedMfaOk } from '@/lib/auth/mfa/mfaCookieVerify'

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

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  if (isFirebaseAuthActionPath(pathname)) {
    const url = request.nextUrl.clone()
    url.pathname = '/auth/action'
    return NextResponse.redirect(url)
  }

  if (requiresMfaCookie(pathname)) {
    const ok = await verifySignedMfaOk(readMfaCookie(request, 'ok'))
    if (!ok) {
      const url = request.nextUrl.clone()
      const next = safePostMfaPath(pathname, pathname.startsWith('/developer') ? '/developer' : '/dashboard')
      const [path, search] = mfaVerifyHref(next).split('?')
      url.pathname = path
      url.search = search ? `?${search}` : ''
      const response = NextResponse.redirect(url)
      response.headers.set('Cache-Control', 'no-store')
      return response
    }
  }

  return NextResponse.next()
}

export const config = {
  // Broad matcher: Next/Netlify skip a `/__/auth/:path*` matcher for underscore paths.
  matcher: ['/((?!_next/static|_next/image|_next/data|favicon.ico|branding/).*)'],
}
