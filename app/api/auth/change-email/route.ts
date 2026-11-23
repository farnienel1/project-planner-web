import type { NextRequest } from 'next/server'
import { handleChangeEmailRequest } from '@/lib/auth/accountEmailRoutes'

export const runtime = 'nodejs'

/** Confirm a new login email, branded: see `handleChangeEmailRequest` (lib/auth/accountEmailRoutes.ts). */
export async function POST(request: NextRequest) {
  return handleChangeEmailRequest(request)
}
