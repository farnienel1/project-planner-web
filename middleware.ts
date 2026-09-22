import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  if (pathname === '/__/auth/action' || pathname === '/__/auth/handler' || pathname.startsWith('/__/auth/')) {
    const url = request.nextUrl.clone()
    url.pathname = '/auth/action'
    return NextResponse.redirect(url)
  }
  return NextResponse.next()
}

export const config = {
  matcher: ['/__/auth/:path*'],
}
