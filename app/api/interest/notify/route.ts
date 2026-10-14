import { NextRequest } from 'next/server'
import { jsonError } from '@/lib/security/apiGuard'

export const runtime = 'nodejs'

/** Public mail from this path is closed. The interest form saves and emails through /api/interest/register. */
export async function POST(_request: NextRequest) {
  return jsonError('Use /api/interest/register', 410)
}
