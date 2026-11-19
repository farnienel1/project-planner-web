import type { NextRequest } from 'next/server'
import { handleVerifyEmailRequest } from '@/lib/auth/accountEmailRoutes'

export const runtime = 'nodejs'

/** Resend the email verification link, branded: see `handleVerifyEmailRequest` (lib/auth/accountEmailRoutes.ts). */
export async function POST(request: NextRequest) {
  return handleVerifyEmailRequest(request)
}
