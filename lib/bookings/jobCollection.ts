/**
 * Rulebook 1.11.0: the job kind (`jobCollection`) every booking write carries — canonical `jobCollectionForJobId` over
 * the projects and small works the app has loaded, else read from the job documents by id.
 */
import { doc, getDoc } from 'firebase/firestore'
import { jobCollectionForJobId, type BookingJobCollection } from '@/lib/canonical/bookings'
import { getFirebaseDb } from '@/lib/firebase/ensureFirebase'

export async function resolveBookingJobCollection(
  organizationId: string,
  jobId: string | null | undefined
): Promise<BookingJobCollection | null> {
  const id = String(jobId ?? '').trim()
  if (!id || !organizationId) return null
  const { useProjectStore } = await import('@/lib/stores/projectStore')
  const { projects, smallWorks } = useProjectStore.getState()
  const loaded = jobCollectionForJobId(id, {
    projects: projects.map((row) => row.id),
    smallWorks: smallWorks.map((row) => row.id),
  })
  if (loaded) return loaded
  const db = getFirebaseDb()
  for (const kind of ['projects', 'smallWorks'] as const) {
    for (const spelling of [...new Set([id, id.toUpperCase(), id.toLowerCase()])]) {
      try {
        if ((await getDoc(doc(db, 'organizations', organizationId, kind, spelling))).exists()) return kind
      } catch {
        // Not readable by this account: try the next spelling / kind.
      }
    }
  }
  return null
}
