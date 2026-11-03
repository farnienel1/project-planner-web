import { firestoreGet, restFieldsToPlain } from '@/lib/owner/firestoreRest'

/**
 * The organisation document and the caller's own users document, read with the caller's token (both stay readable
 * while an organisation is locked, rulebook §16). Null when the organisation cannot be read.
 */
export async function readOrganizationAndViewer(
  idToken: string,
  organizationId: string,
  uid: string
): Promise<{ org: Record<string, unknown>; viewer: Record<string, unknown> & { id: string } } | null> {
  const orgDoc = await firestoreGet(idToken, `organizations/${organizationId}`).catch(() => null)
  if (!orgDoc) return null
  const userDoc = await firestoreGet(idToken, `users/${uid}`).catch(() => null)
  return {
    org: { id: organizationId, ...restFieldsToPlain(orgDoc.fields) },
    viewer: { ...restFieldsToPlain(userDoc?.fields), id: uid },
  }
}
