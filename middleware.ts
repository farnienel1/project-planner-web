import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

function isFirebaseAuthActionPath(pathname: string): boolean {
  return (
    pathname === '/__/auth/action' ||
    pathname === '/__/auth/handler' ||
    pathname.startsWith('/__/auth/')
  )
}

export function middleware(request: NextRequest) {
  if (!isFirebaseAuthActionPath(request.nextUrl.pathname)) {
    return NextResponse.next()
  }
  const url = request.nextUrl.clone()
  url.pathname = '/auth/action'
  return NextResponse.redirect(url)
}

export const config = {
  // Broad matcher: Next/Netlify skip a `/__/auth/:path*` matcher for underscore paths.
  matcher: ['/((?!_next/static|_next/image|_next/data|favicon.ico|branding/).*)'],
}
