import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase/config'
import {
  DEFAULT_MATERIAL_CUT_OFF,
  DEFAULT_USER_NOTIFICATION_PREFERENCES,
  formatMaterialCutOffClock,
  parseMaterialCutOff,
  parseUserNotificationPreferences,
  resolveMaterialCutOffClock,
  userNotificationPreferenceFieldPatch,
  type MaterialCutOffSettings,
  type UserNotificationPreferences,
} from '@/lib/canonical'

export type NotificationPreferences = MaterialCutOffSettings

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = { ...DEFAULT_MATERIAL_CUT_OFF }

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
  return parseMaterialCutOff(raw)
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

/**
 * Dotted updates. Firestore merge of a whole `notificationPreferences` map would wipe
 * bookingConflicts, projectDeadlines, and the other iOS keys.
 */
export function notificationPreferenceFieldPatch(prefs: NotificationPreferences): Record<string, unknown> {
  return {
    'notificationPreferences.materialOrderCutOff': prefs.materialOrderCutOff,
    'notificationPreferences.materialCutOffHour': prefs.materialCutOffHour,
    'notificationPreferences.materialCutOffMinute': prefs.materialCutOffMinute,
    'notificationPreferences.materialCutOffOnSaturday': prefs.materialCutOffOnSaturday,
    'notificationPreferences.materialCutOffOnSunday': prefs.materialCutOffOnSunday,
  }
}

export async function saveNotificationPreferences(userId: string, prefs: NotificationPreferences): Promise<void> {
  cacheNotificationPreferencesLocally(userId, prefs)
  const ref = doc(db, 'users', userId)
  const patch = {
    ...notificationPreferenceFieldPatch(prefs),
    updatedAt: Timestamp.now(),
  }
  try {
    const { updateDoc } = await import('firebase/firestore')
    await updateDoc(ref, patch)
  } catch {
    await setDoc(ref, patch, { merge: true })
  }
}

const USER_TOGGLE_STORAGE_KEY = (userId: string) => `pp.userNotificationPreferences.${userId}`

function cacheUserNotificationPreferences(userId: string, prefs: UserNotificationPreferences): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(USER_TOGGLE_STORAGE_KEY(userId), JSON.stringify(prefs))
}

function loadUserNotificationPreferencesFromLocalStorage(userId: string): UserNotificationPreferences {
  if (typeof window === 'undefined') return { ...DEFAULT_USER_NOTIFICATION_PREFERENCES }
  try {
    const raw = window.localStorage.getItem(USER_TOGGLE_STORAGE_KEY(userId))
    if (!raw) return { ...DEFAULT_USER_NOTIFICATION_PREFERENCES }
    return parseUserNotificationPreferences(JSON.parse(raw) as Record<string, unknown>)
  } catch {
    return { ...DEFAULT_USER_NOTIFICATION_PREFERENCES }
  }
}

export async function loadUserNotificationPreferences(userId: string): Promise<UserNotificationPreferences> {
  try {
    const snap = await getDoc(doc(db, 'users', userId))
    if (snap.exists()) {
      const raw = snap.data()?.notificationPreferences as Record<string, unknown> | undefined
      if (raw) {
        const prefs = parseUserNotificationPreferences(raw)
        cacheUserNotificationPreferences(userId, prefs)
        return prefs
      }
    }
  } catch {
    // Fall through.
  }
  return loadUserNotificationPreferencesFromLocalStorage(userId)
}

/** Dotted user-toggle writes. Does not replace the map or drop cut-off clock keys. */
export async function saveUserNotificationPreferences(
  userId: string,
  prefs: UserNotificationPreferences
): Promise<void> {
  cacheUserNotificationPreferences(userId, prefs)
  const ref = doc(db, 'users', userId)
  const patch = {
    ...userNotificationPreferenceFieldPatch(prefs),
    updatedAt: Timestamp.now(),
  }
  try {
    const { updateDoc } = await import('firebase/firestore')
    await updateDoc(ref, patch)
  } catch {
    await setDoc(ref, patch, { merge: true })
  }
}

export function formatCutoffTime(hour: number, minute: number): string {
  return formatMaterialCutOffClock(parseMaterialCutOff({ materialCutOffHour: hour, materialCutOffMinute: minute }))
}

export function parseCutoffTime(value: string): { hour: number; minute: number } {
  const [h, m] = value.split(':')
  return {
    hour: Number(h ?? 16),
    minute: Number(m ?? 0),
  }
}
