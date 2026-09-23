import { NextRequest, NextResponse } from 'next/server'
import { clearMfaCookies } from '@/lib/auth/mfa/mfaCookies'

export const runtime = 'nodejs'

export async function POST(_request: NextRequest) {
  const response = NextResponse.json({ ok: true })
  clearMfaCookies(response.cookies)
  return response
}
