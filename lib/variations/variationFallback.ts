import { mergeVariationSources as canonicalMergeVariationSources } from '@/lib/canonical'
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
 * Rulebook 1.23.0 §22 `mergeVariationSources`: one row per id (without case); the newer `updatedAt` wins and the
 * collection row wins a tie, then item documents, then the settings log.
 */
export function mergeVariationSources(
  collectionRows: Variation[],
  fallbackRows: Variation[],
  itemDocs: Variation[] = []
): Variation[] {
  const withMs = (rows: Variation[]) => rows.map((row) => ({ id: row.id, updatedAtMs: row.updatedAt?.getTime?.() ?? 0, row }))
  return canonicalMergeVariationSources(withMs(collectionRows), withMs(fallbackRows), withMs(itemDocs)).map((entry) => entry.row)
}
