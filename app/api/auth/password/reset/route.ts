import { NextRequest } from 'next/server'

import { handlePasswordReset } from '@/lib/auth/authActions'
import { authResultToResponse } from '@/lib/auth/authResultResponse'
import { clientIp, readJsonBody } from '@/lib/security/apiGuard'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const body = await readJsonBody<{ email?: unknown }>(request)
  if (!body.ok) return body.response
  const result = await handlePasswordReset({
    email: typeof body.value.email === 'string' ? body.value.email : '',
    ip: clientIp(request),
  })
  return authResultToResponse(result)
}
