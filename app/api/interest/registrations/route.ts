import { NextRequest, NextResponse } from 'next/server'
import { InterestAdminUnavailable, serializeInterestRegistration } from '@/lib/interest/adminStore'
import { loadInterestRegistrations } from '@/lib/interest/repository'
import { requireOwner } from '@/lib/owner/requireOwner'
import { isFirebaseUser, jsonError } from '@/lib/security/apiGuard'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const owner = await requireOwner(request)
  if (!isFirebaseUser(owner)) return owner
  try {
    const rows = await loadInterestRegistrations()
    return NextResponse.json({
      rows: rows.map(serializeInterestRegistration),
      newCount: rows.filter((row) => row.status === 'new').length,
    })
  } catch (error) {
    if (error instanceof InterestAdminUnavailable) {
      return jsonError('Registration storage is not configured.', 503)
    }
    console.error('[interest] list failed', error)
    return jsonError('Could not load registrations.', 500)
  }
}
