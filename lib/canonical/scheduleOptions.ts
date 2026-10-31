/**
 * My Schedule / Book labour "other locations" (`organizations/{orgId}.settings.myScheduleOptions`).
 *
 * - `enabledScheduleLocations`: the selectable built-ins (Office, Working from home, Site survey,
 *   each behind its show toggle) then every custom item whose `customItemEnabled[name]` is not false.
 * - `scheduleOptionsWriteFields`: the map a save writes. Names are trimmed, blanks dropped and
 *   duplicates removed case-insensitively (first spelling wins). The list is exactly the one given:
 *   never merged with the stored list, so a deleted item stays deleted.
 */
import type { MyScheduleOptions } from './organizationSettings'

export type ScheduleLocationType = 'office' | 'working_from_home' | 'site_survey' | 'custom'

export type ScheduleLocation = {
  id: string
  title: string
  locationType: ScheduleLocationType
  customLocationName?: string
}

function cleanItems(items: unknown): string[] {
  if (!Array.isArray(items)) return []
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of items) {
    const name = typeof raw === 'string' ? raw.trim() : ''
    if (!name) continue
    const key = name.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(name)
  }
  return out
}

function enabledFlag(map: Record<string, boolean> | undefined, name: string): boolean {
  if (!map) return true
  if (typeof map[name] === 'boolean') return map[name]
  const lower = name.toLowerCase()
  for (const [key, value] of Object.entries(map)) {
    if (key.trim().toLowerCase() === lower && typeof value === 'boolean') return value
  }
  return true
}

export function enabledScheduleLocations(options: Partial<MyScheduleOptions> | null | undefined): ScheduleLocation[] {
  const opts = options ?? {}
  const rows: ScheduleLocation[] = []
  if (opts.showOffice !== false) rows.push({ id: 'office', title: 'Office', locationType: 'office' })
  if (opts.showWorkingFromHome !== false) {
    rows.push({ id: 'wfh', title: 'Working from home', locationType: 'working_from_home' })
  }
  if (opts.showSiteSurvey !== false) rows.push({ id: 'survey', title: 'Site survey', locationType: 'site_survey' })
  for (const name of cleanItems(opts.customItems)) {
    if (!enabledFlag(opts.customItemEnabled, name)) continue
    rows.push({ id: `custom:${name}`, title: name, locationType: 'custom', customLocationName: name })
  }
  return rows
}

/** The `settings.myScheduleOptions` map to write (dotted update on the organisation document). */
export function scheduleOptionsWriteFields(options: Partial<MyScheduleOptions>): {
  showOffice: boolean
  showWorkingFromHome: boolean
  showSiteSurvey: boolean
  customItems: string[]
  customItemEnabled: Record<string, boolean>
} {
  const customItems = cleanItems(options.customItems)
  const customItemEnabled: Record<string, boolean> = {}
  for (const name of customItems) customItemEnabled[name] = enabledFlag(options.customItemEnabled, name)
  return {
    showOffice: options.showOffice !== false,
    showWorkingFromHome: options.showWorkingFromHome !== false,
    showSiteSurvey: options.showSiteSurvey !== false,
    customItems,
    customItemEnabled,
  }
}
