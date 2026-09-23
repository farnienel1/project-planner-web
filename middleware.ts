import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { MFA_OK_COOKIE, mfaVerifyHref, safePostMfaPath } from '@/lib/auth/mfa/mfaConstants'

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

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  if (isFirebaseAuthActionPath(pathname)) {
    const url = request.nextUrl.clone()
    url.pathname = '/auth/action'
    return NextResponse.redirect(url)
  }

  if (requiresMfaCookie(pathname) && !request.cookies.get(MFA_OK_COOKIE)?.value) {
    const url = request.nextUrl.clone()
    const next = safePostMfaPath(pathname, pathname.startsWith('/developer') ? '/developer' : '/dashboard')
    const [path, search] = mfaVerifyHref(next).split('?')
    url.pathname = path
    url.search = search ? `?${search}` : ''
    const response = NextResponse.redirect(url)
    response.headers.set('Cache-Control', 'no-store')
    return response
  }

  return NextResponse.next()
}

export const config = {
  // Broad matcher: Next/Netlify skip a `/__/auth/:path*` matcher for underscore paths.
  matcher: ['/((?!_next/static|_next/image|_next/data|favicon.ico|branding/).*)'],
}
