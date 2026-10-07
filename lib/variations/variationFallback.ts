import type { Variation } from '@/lib/variations/variationModel'

/** iOS settings log while `variations/{id}` writes are denied. */
export function variationsLogDocId(parentId: string): string {
  return `variations_${parentId}`
}

/** iOS one-document fallback. Document id is `variationItem_{variationId}`. */
export function variationItemDocId(variationId: string): string {
  return `variationItem_${variationId}`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Items may be an array or a map keyed by variation id. */
export function fallbackItemMaps(data: Record<string, unknown> | undefined): Record<string, unknown>[] {
  if (!data) return []
  const items = data.items
  if (Array.isArray(items)) return items.filter(isRecord)
  if (isRecord(items)) {
    return Object.entries(items).flatMap(([id, value]) => {
      if (!isRecord(value)) return []
      const row = { ...value }
      if (typeof row.id !== 'string' || !row.id.trim()) row.id = id
      return [row]
    })
  }
  return []
}

/**
 * Collection rows win ties. Fallback and item docs fill in rows the collection
 * rules would not store. Newer `updatedAt` wins when the same id appears twice.
 */
export function mergeVariationSources(
  collectionRows: Variation[],
  fallbackRows: Variation[],
  itemDocs: Variation[] = []
): Variation[] {
  const byId = new Map<string, Variation>()
  for (const item of [...fallbackRows, ...itemDocs, ...collectionRows]) {
    const existing = byId.get(item.id)
    if (!existing || item.updatedAt >= existing.updatedAt) byId.set(item.id, item)
  }
  return [...byId.values()]
}
