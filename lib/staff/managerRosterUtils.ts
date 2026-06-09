import type { Manager } from '@/types'

/** Legacy org-setup rows (e.g. "Initial manager placeholder system") — same rules as iOS OperativeStore. */
export function isPlaceholderManager(manager: Pick<Manager, 'firstName' | 'lastName' | 'email'>): boolean {
  const name = `${manager.firstName} ${manager.lastName}`.trim().toLowerCase()
  const email = manager.email.toLowerCase()
  return name.includes('placeholder') || email.includes('placeholder')
}

export function filterRealManagers(managers: Manager[]): Manager[] {
  return managers.filter((manager) => !isPlaceholderManager(manager))
}

export const PLACEHOLDER_MANAGER_EXPLANATION =
  'Early versions of Project Planner created dummy "Initial manager placeholder system" rows in Firestore during organisation setup so the app could save projects before real managers existed. iOS has always hidden these; the web app now filters them too. You can safely remove the leftover Firestore documents — they are not linked to real user accounts.'
