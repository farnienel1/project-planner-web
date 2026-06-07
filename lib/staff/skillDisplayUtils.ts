import type { Operative, Skill } from '@/types'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function resolveSkillLabel(skill: Skill | string, skillsCatalog: Skill[]): string | null {
  if (typeof skill === 'object' && skill.name?.trim()) return skill.name.trim()

  const raw = typeof skill === 'string' ? skill.trim() : skill.id?.trim()
  if (!raw) return null

  const fromCatalog = skillsCatalog.find((entry) => entry.id === raw)
  if (fromCatalog?.name) return fromCatalog.name

  if (UUID_PATTERN.test(raw)) return null

  return raw
}

export function resolveOperativeSkillLabels(operative: Operative, skillsCatalog: Skill[]): string[] {
  const labels = (operative.skills || [])
    .map((skill) => resolveSkillLabel(skill, skillsCatalog))
    .filter((label): label is string => Boolean(label))

  return [...new Set(labels)]
}
