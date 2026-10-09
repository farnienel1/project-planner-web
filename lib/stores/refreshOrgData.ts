'use client'

/**
 * The global Refresh button. Re-reads every organisation-scoped store from Firestore,
 * forcing past the TTL cache, and re-syncs the live listeners (bookings, manager bookings,
 * notifications) from the server. Pages that keep their own local reads listen for
 * ORG_DATA_REFRESHED_EVENT and reload those too.
 */

import { invalidateOrgLoad } from '@/lib/stores/orgLoadCache'
import { refreshOrgCollections } from '@/lib/firebase/subscribeOrgCollection'
import { useProjectStore } from '@/lib/stores/projectStore'
import { useOperativeStore } from '@/lib/stores/operativeStore'
import { useOrgUserStore, useSiteAuditStore } from '@/lib/stores/siteAuditStore'
import { useBookingStore } from '@/lib/stores/bookingStore'
import { useManagerScheduleStore } from '@/lib/stores/managerScheduleStore'
import { useHolidayStore } from '@/lib/stores/holidayStore'
import { useTaskStore } from '@/lib/stores/taskStore'
import { useMaterialProjectStore } from '@/lib/stores/materialProjectStore'
import { useSubcontractorStore } from '@/lib/stores/subcontractorStore'
import { useWholesalerStore } from '@/lib/stores/wholesalerStore'
import { useMaterialCatalogStore } from '@/lib/stores/materialCatalogStore'

export const ORG_DATA_REFRESHED_EVENT = 'pp:org-data-refreshed'

export type OrgDataRefreshedDetail = { organizationId: string; at: number }

const FORCE = { force: true } as const

async function settle(label: string, task: () => Promise<unknown>): Promise<void> {
  try {
    await task()
  } catch (error) {
    console.warn(`Refresh: ${label} failed`, error)
  }
}

export async function refreshAllOrgData(organizationId: string): Promise<void> {
  const orgId = String(organizationId || '').trim()
  if (!orgId) return

  // Loaders without a force option are keyed in the TTL cache; drop their entries first.
  for (const key of ['operativeStore:managers', 'taskStore:tasks', 'siteAuditStore:audits']) {
    invalidateOrgLoad(key)
  }

  const projects = useProjectStore.getState()
  const operatives = useOperativeStore.getState()
  const users = useOrgUserStore.getState()
  const bookings = useBookingStore.getState()
  const managerBookings = useManagerScheduleStore.getState()
  const holidays = useHolidayStore.getState()
  const tasks = useTaskStore.getState()
  const materials = useMaterialProjectStore.getState()
  const subcontractors = useSubcontractorStore.getState()
  const wholesalers = useWholesalerStore.getState()
  const catalog = useMaterialCatalogStore.getState()
  const audits = useSiteAuditStore.getState()

  await Promise.all([
    settle('projects', () => projects.loadProjects(orgId, true, FORCE)),
    settle('small works', () => projects.loadSmallWorks(orgId, FORCE)),
    settle('clients', () => projects.loadClients(orgId, FORCE)),
    settle('operatives', () => operatives.loadOperatives(orgId, FORCE)),
    settle('managers', () => operatives.loadManagers(orgId)),
    settle('skills', () => operatives.loadSkills(orgId)),
    settle('qualifications', () => operatives.loadQualifications(orgId)),
    settle('users', () => users.loadUsers(orgId, FORCE)),
    settle('bookings', () => bookings.loadBookings(orgId, FORCE)),
    settle('manager bookings', () => managerBookings.loadManagerSiteBookings(orgId, FORCE)),
    settle('live collections', () => refreshOrgCollections(orgId)),
    settle('annual leave', () => holidays.loadBookings(orgId)),
    settle('tasks', () => tasks.loadTasks(orgId)),
    settle('materials', () => materials.loadAllMaterials(orgId)),
    settle('material send records', () => materials.loadSendRecords(orgId)),
    settle('subcontractors', () => subcontractors.loadSubcontractors(orgId)),
    settle('wholesalers', () => wholesalers.loadWholesalers(orgId)),
    settle('material catalogue', () => catalog.loadItems(orgId)),
    settle('site audits', () => audits.loadAudits(orgId)),
  ])

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent<OrgDataRefreshedDetail>(ORG_DATA_REFRESHED_EVENT, {
        detail: { organizationId: orgId, at: Date.now() },
      })
    )
  }
}
