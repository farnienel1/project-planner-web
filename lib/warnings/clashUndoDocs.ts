/**
 * Rulebook 1.53.0 (final review of #331): undo of a clash approval needs the approval documents as stored, so it can
 * delete the other app's copies too (`clashDocumentsToRemove`). If either collection cannot be read, the undo stops
 * with `CLASH_UNDO_LOAD_ERROR` and deletes nothing — never "no documents", which would leave an iPhone approval behind.
 */
export const CLASH_UNDO_LOAD_ERROR = "Couldn't check existing approvals — try again."

export async function loadClashUndoDocs<A, R>(loaders: {
  acceptedClashes: () => Promise<A[]>
  resolutions: () => Promise<R[]>
}): Promise<{ acceptedClashes: A[]; resolutions: R[] }> {
  try {
    const [acceptedClashes, resolutions] = await Promise.all([loaders.acceptedClashes(), loaders.resolutions()])
    return { acceptedClashes, resolutions }
  } catch {
    throw new Error(CLASH_UNDO_LOAD_ERROR)
  }
}
