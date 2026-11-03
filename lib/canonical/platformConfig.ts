/**
 * Forced app update (rulebook §18, 1.12.0). `platformConfig/app` holds the oldest build each platform may run:
 *
 *   platformConfig/app { minimumIosBuild: number, minimumWebVersion?: string }
 *
 * Anyone may read it (the security rules allow it signed out, so the gate runs before sign-in); only the platform
 * owner writes it. An app reads that one document and calls `appUpdateRequired` with its own running build; when it is
 * true the app shows only the update screen. A missing document, a missing field or a value that is not a number (iOS)
 * / not a dotted version (web) never blocks anyone.
 */

export const PLATFORM_CONFIG_APP_PATH = 'platformConfig/app'

export type AppUpdatePlatform = 'ios' | 'web' | 'android'

export type AppUpdateConfig = {
  /** iOS `CFBundleVersion` (a whole number). Builds below it must update. */
  minimumIosBuild?: unknown
  /** Web release version, dotted numbers (e.g. "1.12.0"). Versions below it must reload. */
  minimumWebVersion?: unknown
}

function finiteNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value === 'string' && /^\s*\d+(\.\d+)?\s*$/.test(value)) return Number(value)
  return null
}

function versionParts(value: unknown): number[] | null {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) return [value]
  if (typeof value !== 'string') return null
  const raw = value.trim().replace(/^v/i, '')
  if (!/^\d+(\.\d+)*$/.test(raw)) return null
  return raw.split('.').map(Number)
}

/** -1 when `a` is older than `b`, 0 when equal, 1 when newer (missing parts count as 0). */
export function compareAppVersions(a: number[], b: number[]): number {
  const length = Math.max(a.length, b.length)
  for (let i = 0; i < length; i += 1) {
    const left = a[i] ?? 0
    const right = b[i] ?? 0
    if (left !== right) return left < right ? -1 : 1
  }
  return 0
}

/**
 * True when the running build is older than the minimum `platformConfig/app` sets for its platform. iOS compares
 * `runningBuild` (its build number) with `minimumIosBuild`; web compares `runningBuild` (its version) with
 * `minimumWebVersion`. Missing config, a missing or non-number minimum, an unreadable running build, or another
 * platform → false (never blocks).
 */
export function appUpdateRequired(
  running: { platform?: unknown; runningBuild?: unknown } | null | undefined,
  config: AppUpdateConfig | Record<string, unknown> | null | undefined
): boolean {
  if (!config || typeof config !== 'object') return false
  const platform = String(running?.platform ?? '').trim().toLowerCase()
  if (platform === 'ios') {
    const minimum = finiteNumber((config as AppUpdateConfig).minimumIosBuild)
    const build = finiteNumber(running?.runningBuild)
    return minimum != null && build != null && build < minimum
  }
  if (platform === 'web') {
    const minimum = versionParts((config as AppUpdateConfig).minimumWebVersion)
    const version = versionParts(running?.runningBuild)
    return minimum != null && version != null && compareAppVersions(version, minimum) < 0
  }
  return false
}
