import { NextRequest } from 'next/server'
import { isFirebaseUser, jsonError } from '@/lib/security/apiGuard'
import { isValidDocumentId } from '@/lib/security/validation'
import { bearerToken } from '@/lib/owner/firestoreRest'
import { OWNER_READ_FAILED_MESSAGE, ownerJson, ownerReadGuard, refreshParam } from '@/lib/owner/ownerReadRoute'
import { OwnerPersonNotFoundError, loadOwnerPerson, readOwnerPersonOrganisations } from '@/lib/owner/personServer'
import { ownerPersonIds } from '@/lib/owner/person360'

export const runtime = 'nodejs'

/**
 * GET /api/owner/people/[uid]/organisations?refresh= — what the People list shows when a person's row is opened: each
 * organisation they belong to, with their name there (rulebook 1.82.0 `memberNames`), their level there
 * (`organizationLevelFor`), whether they are active there and their line manager there (`lineManagerSummary`).
 * Read-only, owner only; the same reader as the person page (`readOwnerPersonOrganisations`). No email, pay, tax id or
 * token leaves the server, and no audit entry is written (nothing is revealed: the person page's reveal stays the
 * logged way to see an email).
 */
export async function GET(request: NextRequest, context: { params: Promise<{ uid: string }> }) {
  const owner = await ownerReadGuard(request, 'owner-person-organisations', 120)
  if (!isFirebaseUser(owner)) return owner
  const { uid } = await context.params
  if (!isValidDocumentId(uid)) return jsonError('That person id is not valid.', 400)
  const token = bearerToken(request)
  try {
    const person = await loadOwnerPerson(token, uid, { refresh: refreshParam(request) })
    const read = await readOwnerPersonOrganisations(token, person, ownerPersonIds(person.row, person.userDocs))
    return ownerJson({ personId: person.row.id, ...read })
  } catch (error) {
    if (error instanceof OwnerPersonNotFoundError) return jsonError(error.message, 404)
    console.error('[owner/people/organisations]', error)
    return jsonError(OWNER_READ_FAILED_MESSAGE, 502)
  }
}
