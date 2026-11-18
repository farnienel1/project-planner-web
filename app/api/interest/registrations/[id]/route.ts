import { NextRequest, NextResponse } from 'next/server'
import { InterestAdminUnavailable } from '@/lib/interest/adminStore'
import { removeInterestRegistration, updateInterestNote, updateInterestStatus } from '@/lib/interest/repository'
import { INTEREST_STATUSES, type InterestStatus } from '@/lib/interest/registration'
import { requireOwner } from '@/lib/owner/requireOwner'
import { enforceRateLimit, isFirebaseUser, jsonError } from '@/lib/security/apiGuard'
import { apiObject, apiText, readApiBody } from '@/lib/security/apiBody'
import { z } from 'zod'

export const runtime = 'nodejs'

function cleanId(id: string): string | null {
  return /^[A-Za-z0-9]{1,128}$/.test(id) ? id : null
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const limited = enforceRateLimit(request, 'owner-interest-update', 40, 10 * 60 * 1000)
  if (limited) return limited
  const owner = await requireOwner(request)
  if (!isFirebaseUser(owner)) return owner
  const id = cleanId((await context.params).id)
  if (!id) return jsonError('That registration is not on the list.', 404)
  // The note's author is the verified caller, never a name in the body (mass-assignment review of #391).
  const body = await readApiBody(
    request,
    apiObject({
      status: z.unknown().optional().transform((value) => (typeof value === 'string' ? value : undefined)),
      note: apiText(4000),
    })
  )
  if (!body.ok) return body.response
  try {
    if (typeof body.value.status === 'string') {
      if (!(INTEREST_STATUSES as readonly string[]).includes(body.value.status)) {
        return jsonError('Unknown registration status.', 400)
      }
      await updateInterestStatus(id, body.value.status as InterestStatus)
    }
    if (typeof body.value.note === 'string' && body.value.note.trim()) {
      await updateInterestNote(id, body.value.note, owner.email || 'Owner')
    }
    return NextResponse.json({ ok: true })
  } catch (error) {
    if (error instanceof InterestAdminUnavailable) {
      return jsonError('Registration storage is not configured.', 503)
    }
    console.error('[interest] update failed', error)
    return jsonError('Could not update that registration.', 500)
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const limited = enforceRateLimit(request, 'owner-interest-delete', 20, 10 * 60 * 1000)
  if (limited) return limited
  const owner = await requireOwner(request)
  if (!isFirebaseUser(owner)) return owner
  const id = cleanId((await context.params).id)
  if (!id) return jsonError('That registration is not on the list.', 404)
  try {
    await removeInterestRegistration(id)
    return NextResponse.json({ ok: true })
  } catch (error) {
    if (error instanceof InterestAdminUnavailable) {
      return jsonError('Registration storage is not configured.', 503)
    }
    console.error('[interest] delete failed', error)
    return jsonError('Could not delete that registration.', 500)
  }
}
