import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase/config'
import { sanitizeHeroMetrics } from '@/lib/dashboard/heroMetrics'
import { PLATFORM_DEFAULT_DASHBOARD } from '@/lib/dashboard/platformDashboardDefault'
import type { DashboardLayoutConfig, TileId } from '@/lib/stores/dashboardStore'

export type SaveDashboardLayoutOptions = {
  /** When true, updates the org template for users who have not customised yet. */
  updateOrgDefault?: boolean
  /** When true, updates the global template used when new organisations are created. */
  updatePlatformDefault?: boolean
}

function storageKey(userId: string, orgId: string): string {
  return `pp.webDashboardLayout.${userId}.${orgId}`
}

function parseConfig(raw: unknown): DashboardLayoutConfig | null {
  if (!raw || typeof raw !== 'object') return null
  const data = raw as Record<string, unknown>
  const layout = data.layout
  if (!Array.isArray(layout) || layout.length === 0) return null
  return {
    layout: layout as TileId[],
    heroMetrics: sanitizeHeroMetrics(data.heroMetrics),
  }
}

function normalizeConfig(config: DashboardLayoutConfig): DashboardLayoutConfig {
  return {
    layout: config.layout,
    heroMetrics: sanitizeHeroMetrics(config.heroMetrics),
  }
}

function cacheLocally(userId: string, orgId: string, config: DashboardLayoutConfig): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(storageKey(userId, orgId), JSON.stringify(config))
  } catch {
    // Ignore quota / private mode errors.
  }
}

function loadFromLocal(userId: string, orgId: string): DashboardLayoutConfig | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(storageKey(userId, orgId))
    if (!raw) return null
    return parseConfig(JSON.parse(raw))
  } catch {
    return null
  }
}

function readUserOrgLayout(
  userData: Record<string, unknown> | undefined,
  orgId: string
): DashboardLayoutConfig | null {
  if (!userData) return null

  const perOrg = userData.webDashboardLayouts as Record<string, unknown> | undefined
  const orgEntry = perOrg?.[orgId]
  if (orgEntry) {
    return parseConfig(orgEntry)
  }

  // Legacy single-layout field — use when scoped to this org, or unscoped (pre-migration saves).
  const legacy = userData.webDashboardLayout as Record<string, unknown> | undefined
  if (legacy) {
    const legacyOrgId = legacy.organizationId as string | undefined
    if (!legacyOrgId || legacyOrgId === orgId) {
      const parsed = parseConfig(legacy)
      if (parsed) return parsed
    }
  }

  return null
}

async function loadLegacyOrgUserLayout(userId: string, orgId: string): Promise<DashboardLayoutConfig | null> {
  try {
    const snap = await getDoc(doc(db, 'organizations', orgId, 'dashboardLayouts', userId))
    if (!snap.exists()) return null
    return parseConfig(snap.data())
  } catch {
    return null
  }
}

async function loadOrgDefaultDashboard(orgId: string): Promise<DashboardLayoutConfig | null> {
  try {
    const snap = await getDoc(doc(db, 'organizations', orgId))
    if (!snap.exists()) return null
    return parseConfig(snap.data()?.defaultWebDashboard)
  } catch {
    return null
  }
}

export async function loadPlatformDefaultDashboard(): Promise<DashboardLayoutConfig> {
  try {
    const snap = await getDoc(doc(db, 'platformConfig', 'webDashboard'))
    if (snap.exists()) {
      const parsed = parseConfig(snap.data())
      if (parsed) return parsed
    }
  } catch {
    // Fall through to code default.
  }
  return { ...PLATFORM_DEFAULT_DASHBOARD, layout: [...PLATFORM_DEFAULT_DASHBOARD.layout], heroMetrics: [...PLATFORM_DEFAULT_DASHBOARD.heroMetrics] }
}

export async function seedOrgDefaultDashboard(orgId: string): Promise<DashboardLayoutConfig> {
  const platformDefault = await loadPlatformDefaultDashboard()
  await setDoc(
    doc(db, 'organizations', orgId),
    {
      defaultWebDashboard: {
        layout: platformDefault.layout,
        heroMetrics: platformDefault.heroMetrics,
        updatedAt: Timestamp.now(),
      },
      updatedAt: Timestamp.now(),
    },
    { merge: true }
  )
  return platformDefault
}

export async function loadDashboardLayout(userId: string, orgId: string): Promise<DashboardLayoutConfig> {
  try {
    const snap = await getDoc(doc(db, 'users', userId))
    if (snap.exists()) {
      const parsed = readUserOrgLayout(snap.data(), orgId)
      if (parsed) {
        cacheLocally(userId, orgId, parsed)
        return parsed
      }
    }
  } catch {
    // Fall through.
  }

  const legacy = await loadLegacyOrgUserLayout(userId, orgId)
  if (legacy) {
    cacheLocally(userId, orgId, legacy)
    return legacy
  }

  const orgDefault = await loadOrgDefaultDashboard(orgId)
  if (orgDefault) {
    return orgDefault
  }

  const local = loadFromLocal(userId, orgId)
  if (local) return local

  return loadPlatformDefaultDashboard()
}

export async function saveDashboardLayout(
  userId: string,
  orgId: string,
  config: DashboardLayoutConfig,
  options: SaveDashboardLayoutOptions = {}
): Promise<void> {
  const normalized = normalizeConfig(config)
  cacheLocally(userId, orgId, normalized)

  const payload = {
    layout: normalized.layout,
    heroMetrics: normalized.heroMetrics,
    updatedAt: Timestamp.now(),
  }

  await setDoc(
    doc(db, 'users', userId),
    {
      webDashboardLayouts: {
        [orgId]: payload,
      },
      // Clear legacy unscoped field once user saves per-org layout.
      webDashboardLayout: null,
      updatedAt: Timestamp.now(),
    },
    { merge: true }
  )

  if (options.updateOrgDefault) {
    await setDoc(
      doc(db, 'organizations', orgId),
      {
        defaultWebDashboard: payload,
        updatedAt: Timestamp.now(),
      },
      { merge: true }
    )
  }

  if (options.updatePlatformDefault) {
    await setDoc(
      doc(db, 'platformConfig', 'webDashboard'),
      {
        ...payload,
        updatedAt: Timestamp.now(),
      },
      { merge: true }
    )
  }
}
