/**
 * Prevent catalogue overwrite from wiping live org data.
 * iOS job types / qualifications can persist an empty in-memory list after a failed
 * parse, then overwrite Firestore. Web never writes an empty list over a non-empty one.
 */

export function refuseEmptyOverwrite<T>(existing: T[], next: T[], label: string): T[] {
  if (next.length === 0 && existing.length > 0) {
    throw new Error(`Refusing to overwrite ${label} with an empty list`)
  }
  return next
}

export function unionUniqueStrings(existing: string[], recovered: string[]): string[] {
  const names = new Set<string>()
  for (const value of [...existing, ...recovered]) {
    const trimmed = value.trim()
    if (trimmed) names.add(trimmed)
  }
  return Array.from(names).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
}
