import { NextRequest } from 'next/server'

import { handleEmailSignIn } from '@/lib/auth/authActions'
import { authResultToResponse } from '@/lib/auth/authResultResponse'
import { clientIp, readJsonBody } from '@/lib/security/apiGuard'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const body = await readJsonBody<{ email?: unknown; password?: unknown }>(request)
  if (!body.ok) return body.response
  const result = await handleEmailSignIn({
    email: typeof body.value.email === 'string' ? body.value.email : '',
    password: typeof body.value.password === 'string' ? body.value.password : '',
    ip: clientIp(request),
  })
  return authResultToResponse(result)
}
