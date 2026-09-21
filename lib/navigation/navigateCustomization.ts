/**
 * iOS parity source: ContentView.swift bottomBarMovableTabOrder, QuickMenuSheet customise
 * Spec: docs/ios-parity/02-navigation-map.md, Blueprint §3.1
 *
 * Web sidebar Navigate list, per signed-in user. Saved to localStorage (iOS device
 * key pattern) and merged onto users/{uid}.webNavigateSidebar so it follows login.
 */

import type { DashboardNavItem } from '@/lib/navigation/dashboardNavigation'

export const NAVIGATE_CONFIG_VERSION = 1 as const

export type NavigateEntry =
  | { type: 'item'; id: string }
  | { type: 'project'; id: string; label: string; jobNumber?: string }
  | { type: 'smallWorks'; id: string; label: string; jobNumber?: string }

export type NavigateConfig = {
  version: typeof NAVIGATE_CONFIG_VERSION
  entries: NavigateEntry[]
}

export type ResolvedNavigateRow = {
  key: string
  href: string
  label: string
  subtitle?: string
  entry: NavigateEntry
  navItem?: DashboardNavItem
}

const LOCAL_PREFIX = 'webNavigateSidebar.v1.'

export function navigateConfigStorageKey(userId: string): string {
  return `${LOCAL_PREFIX}${userId}`
}

export function defaultNavigateConfig(navigateItems: DashboardNavItem[]): NavigateConfig {
  return {
    version: NAVIGATE_CONFIG_VERSION,
    entries: navigateItems.map((item) => ({ type: 'item' as const, id: item.id })),
  }
}

export function parseNavigateConfig(raw: unknown): NavigateConfig | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const rec = raw as Record<string, unknown>
  if (!Array.isArray(rec.entries)) return null
  const entries: NavigateEntry[] = []
  for (const row of rec.entries) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) continue
    const item = row as Record<string, unknown>
    const type = item.type
    const id = typeof item.id === 'string' ? item.id.trim() : ''
    if (!id) continue
    if (type === 'item') {
      entries.push({ type: 'item', id })
      continue
    }
    if (type === 'project' || type === 'smallWorks') {
      const label = typeof item.label === 'string' && item.label.trim() ? item.label.trim() : id
      const jobNumber = typeof item.jobNumber === 'string' ? item.jobNumber : undefined
      entries.push({ type, id, label, jobNumber })
    }
  }
  return { version: NAVIGATE_CONFIG_VERSION, entries }
}

export function readLocalNavigateConfig(userId: string): NavigateConfig | null {
  if (typeof window === 'undefined' || !userId) return null
  try {
    const raw = window.localStorage.getItem(navigateConfigStorageKey(userId))
    if (!raw) return null
    return parseNavigateConfig(JSON.parse(raw))
  } catch {
    return null
  }
}

export function writeLocalNavigateConfig(userId: string, config: NavigateConfig): void {
  if (typeof window === 'undefined' || !userId) return
  try {
    window.localStorage.setItem(navigateConfigStorageKey(userId), JSON.stringify(config))
  } catch {
    /* quota / private mode */
  }
}

export function entryKey(entry: NavigateEntry): string {
  return `${entry.type}:${entry.id}`
}

export function hasEntry(config: NavigateConfig, entry: NavigateEntry): boolean {
  const key = entryKey(entry)
  return config.entries.some((row) => entryKey(row) === key)
}

export function removeEntry(config: NavigateConfig, key: string): NavigateConfig {
  return {
    version: NAVIGATE_CONFIG_VERSION,
    entries: config.entries.filter((row) => entryKey(row) !== key),
  }
}

export function addEntry(config: NavigateConfig, entry: NavigateEntry): NavigateConfig {
  if (hasEntry(config, entry)) return config
  return { version: NAVIGATE_CONFIG_VERSION, entries: [...config.entries, entry] }
}

export function moveEntry(config: NavigateConfig, fromIndex: number, toIndex: number): NavigateConfig {
  if (fromIndex === toIndex) return config
  if (fromIndex < 0 || toIndex < 0) return config
  if (fromIndex >= config.entries.length || toIndex >= config.entries.length) return config
  const entries = [...config.entries]
  const [row] = entries.splice(fromIndex, 1)
  entries.splice(toIndex, 0, row)
  return { version: NAVIGATE_CONFIG_VERSION, entries }
}

export function resolveNavigateRows(
  config: NavigateConfig | null,
  navigateItems: DashboardNavItem[],
  catalog: DashboardNavItem[]
): ResolvedNavigateRow[] {
  const byId = new Map(catalog.map((item) => [item.id, item]))
  const source = config && config.entries.length > 0 ? config : defaultNavigateConfig(navigateItems)
  const rows: ResolvedNavigateRow[] = []
  const seen = new Set<string>()
  for (const entry of source.entries) {
    const key = entryKey(entry)
    if (seen.has(key)) continue
    seen.add(key)
    if (entry.type === 'item') {
      const navItem = byId.get(entry.id)
      if (!navItem) continue
      rows.push({
        key,
        href: navItem.href,
        label: navItem.label,
        subtitle: navItem.subtitle,
        entry,
        navItem,
      })
      continue
    }
    const href =
      entry.type === 'smallWorks' ? `/dashboard/small-works/${entry.id}` : `/dashboard/projects/${entry.id}`
    const prefix = entry.jobNumber ? `${entry.jobNumber} · ` : ''
    rows.push({
      key,
      href,
      label: `${prefix}${entry.label}`,
      subtitle: entry.type === 'smallWorks' ? 'Small work' : 'Project',
      entry,
    })
  }
  return rows
}

export function availableCatalogItems(
  config: NavigateConfig,
  catalog: DashboardNavItem[]
): DashboardNavItem[] {
  const present = new Set(
    config.entries.filter((entry) => entry.type === 'item').map((entry) => entry.id)
  )
  return catalog.filter((item) => item.id !== 'dashboard_home' && !present.has(item.id))
}
