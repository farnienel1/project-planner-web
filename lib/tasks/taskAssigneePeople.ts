import type { Manager, Operative } from '@/types'
import { dedupeOperativesByEmail } from '@/lib/operatives/operativeRosterUtils'

function emailKey(value: string | undefined): string {
  return (value || '').trim().toLowerCase()
}

function dedupeManagersByEmail(managers: Manager[]): Manager[] {
  const byEmail = new Map<string, Manager>()
  for (const manager of managers) {
    const email = emailKey(manager.email)
    if (!email) {
      byEmail.set(manager.id, manager)
      continue
    }
    if (!byEmail.has(email)) byEmail.set(email, manager)
  }
  return Array.from(byEmail.values())
}

/**
 * One row per person in the new-task people picker.
 * Dual-role admin/manager roster profiles are not repeated as operatives.
 */
export function peopleForTaskPicker(
  managers: Manager[],
  operatives: Operative[],
  route: 'managers' | 'operatives' | 'combined'
): { managers: Manager[]; operatives: Operative[] } {
  const uniqueManagers = dedupeManagersByEmail(managers)
  const uniqueOperatives = dedupeOperativesByEmail(operatives)
  const managerEmails = new Set(uniqueManagers.map((row) => emailKey(row.email)).filter(Boolean))
  const operativesWithoutManagers = uniqueOperatives.filter((row) => !managerEmails.has(emailKey(row.email)))
  if (route === 'managers') return { managers: uniqueManagers, operatives: [] }
  if (route === 'operatives') return { managers: [], operatives: uniqueOperatives }
  return { managers: uniqueManagers, operatives: operativesWithoutManagers }
}
