import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase/config'

export type NotificationPreferences = {
  materialOrderCutOff: boolean
  materialCutOffHour: number
  materialCutOffMinute: number
  materialCutOffOnSaturday: boolean
  materialCutOffOnSunday: boolean
}

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  materialOrderCutOff: true,
  materialCutOffHour: 16,
  materialCutOffMinute: 0,
  materialCutOffOnSaturday: false,
  materialCutOffOnSunday: false,
}

const DEFAULTS = DEFAULT_NOTIFICATION_PREFERENCES

function storageKey(userId: string): string {
  return `pp.notificationPreferences.${userId}`
}

function loadNotificationPreferencesFromLocalStorage(userId: string): NotificationPreferences {
  if (typeof window === 'undefined') return { ...DEFAULTS }
  try {
    const raw = window.localStorage.getItem(storageKey(userId))
    if (!raw) return { ...DEFAULTS }
    return { ...DEFAULTS, ...JSON.parse(raw) }
  } catch {
    return { ...DEFAULTS }
  }
}

function cacheNotificationPreferencesLocally(userId: string, prefs: NotificationPreferences): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(storageKey(userId), JSON.stringify(prefs))
}

export function parseNotificationPreferences(raw: Record<string, unknown> | undefined): NotificationPreferences {
  if (!raw) return { ...DEFAULTS }
  return {
    materialOrderCutOff: raw.materialOrderCutOff !== false,
    materialCutOffHour: Number(raw.materialCutOffHour ?? DEFAULTS.materialCutOffHour),
    materialCutOffMinute: Number(raw.materialCutOffMinute ?? DEFAULTS.materialCutOffMinute),
    materialCutOffOnSaturday: raw.materialCutOffOnSaturday === true,
    materialCutOffOnSunday: raw.materialCutOffOnSunday === true,
  }
}

export async function loadNotificationPreferences(userId: string): Promise<NotificationPreferences> {
  const fromFirestore = await loadNotificationPreferencesFromFirestore(userId)
  if (fromFirestore) return fromFirestore
  return loadNotificationPreferencesFromLocalStorage(userId)
}

/** Returns null when the iOS user doc has no notificationPreferences map. */
export async function loadNotificationPreferencesFromFirestore(
  userId: string
): Promise<NotificationPreferences | null> {
  try {
    const snap = await getDoc(doc(db, 'users', userId))
    if (snap.exists()) {
      const raw = snap.data()?.notificationPreferences as Record<string, unknown> | undefined
      if (raw) {
        const prefs = parseNotificationPreferences(raw)
        cacheNotificationPreferencesLocally(userId, prefs)
        return prefs
      }
    }
  } catch {
    // Fall through.
  }
  return null
}

export async function saveNotificationPreferences(userId: string, prefs: NotificationPreferences): Promise<void> {
  cacheNotificationPreferencesLocally(userId, prefs)
  await setDoc(
    doc(db, 'users', userId),
    {
      notificationPreferences: prefs,
      updatedAt: Timestamp.now(),
    },
    { merge: true }
  )
}

/**
 * Org hub material cut-off: organisation settings (shared) with the current user's
 * `notificationPreferences` as the iOS-compatible dual-write / fallback.
 */
export async function loadMaterialCutOffSettings(
  organizationId: string,
  userId?: string
): Promise<NotificationPreferences> {
  const { loadOrganizationDetails } = await import('@/lib/settings/organizationSettings')
  try {
    const details = await loadOrganizationDetails(organizationId)
    if (details?.materialCutOff) return details.materialCutOff
  } catch {
    // Fall through to the iOS user-doc source.
  }
  if (userId) return loadNotificationPreferences(userId)
  return { ...DEFAULTS }
}

export async function saveMaterialCutOffSettingsForOrgAndUser(
  organizationId: string,
  userId: string | undefined,
  prefs: NotificationPreferences
): Promise<void> {
  const { saveMaterialCutOffSettings } = await import('@/lib/settings/organizationSettings')
  await saveMaterialCutOffSettings(organizationId, prefs)
  if (userId) await saveNotificationPreferences(userId, prefs)
}

export function formatCutoffTime(hour: number, minute: number): string {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

export function parseCutoffTime(value: string): { hour: number; minute: number } {
  const [h, m] = value.split(':')
  return {
    hour: Number(h ?? 16),
    minute: Number(m ?? 0),
  }
}
