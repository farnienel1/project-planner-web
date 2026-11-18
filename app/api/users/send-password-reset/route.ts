import type { NextRequest } from 'next/server'
import { handleAdminPasswordReset } from '@/lib/auth/adminPasswordReset'

export const runtime = 'nodejs'

/** Manage Users / Edit User "Send password reset": see `handleAdminPasswordReset` (lib/auth/adminPasswordReset.ts). */
export async function POST(request: NextRequest) {
  return handleAdminPasswordReset(request)
}
