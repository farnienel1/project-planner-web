import type { NextRequest } from 'next/server'
import { handlePasswordResetRequest } from '@/lib/auth/passwordResetRoute'

export const runtime = 'nodejs'

/** Forgot password: see `handlePasswordResetRequest` (lib/auth/passwordResetRoute.ts). */
export async function POST(request: NextRequest) {
  return handlePasswordResetRequest(request)
}
