import { NextRequest } from 'next/server'

import { handlePasswordChange } from '@/lib/auth/authActions'
import { authResultToResponse } from '@/lib/auth/authResultResponse'
import { clientIp, readJsonBody } from '@/lib/security/apiGuard'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const body = await readJsonBody<{ currentPassword?: unknown; nextPassword?: unknown }>(request)
  if (!body.ok) return body.response
  const header = request.headers.get('authorization') || ''
  const idToken = header.startsWith('Bearer ') ? header.slice(7).trim() : ''
  const result = await handlePasswordChange({
    idToken,
    currentPassword: typeof body.value.currentPassword === 'string' ? body.value.currentPassword : '',
    nextPassword: typeof body.value.nextPassword === 'string' ? body.value.nextPassword : '',
    ip: clientIp(request),
  })
  return authResultToResponse(result)
}
