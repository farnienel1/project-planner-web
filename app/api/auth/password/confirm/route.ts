import { NextRequest } from 'next/server'

import { handlePasswordConfirm } from '@/lib/auth/authActions'
import { authResultToResponse } from '@/lib/auth/authResultResponse'
import { clientIp, readJsonBody } from '@/lib/security/apiGuard'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const body = await readJsonBody<{ oobCode?: unknown; newPassword?: unknown }>(request)
  if (!body.ok) return body.response
  const result = await handlePasswordConfirm({
    oobCode: typeof body.value.oobCode === 'string' ? body.value.oobCode : '',
    newPassword: typeof body.value.newPassword === 'string' ? body.value.newPassword : '',
    ip: clientIp(request),
  })
  return authResultToResponse(result)
}
