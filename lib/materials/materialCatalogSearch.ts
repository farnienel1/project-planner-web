import {
  catalogueRecordFromItem,
  materialSearchScore,
  rankMaterialRecords,
} from '@/lib/canonical'
import type { MaterialCatalogItem, ProjectMaterialLine } from '@/types'

export function normalizeMaterialText(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ')
}

export function normalizeMaterialCode(code?: string | null): string {
  return normalizeMaterialText(code || '')
}

export function duplicateKey(name: string, code?: string | null): string {
  return `${normalizeMaterialText(name)}|${normalizeMaterialCode(code)}`
}

export type MaterialSuggestion = {
  id: string
  source: 'catalogue' | 'recent'
  name: string
  brand: string
  productCode?: string
  unit: string
  category?: string
  catalogueItem?: MaterialCatalogItem
  score: number
}

const SEARCH_SUGGESTION_LIMIT = 80

export function searchMaterialCatalogue(
  query: string,
  catalogue: MaterialCatalogItem[],
  recentLines: ProjectMaterialLine[],
  limit = SEARCH_SUGGESTION_LIMIT
): MaterialSuggestion[] {
  const browsing = !String(query || '').trim()
  const merged: MaterialSuggestion[] = []
  const seen = new Set<string>()

  const push = (row: MaterialSuggestion) => {
    const key = duplicateKey(row.name, row.productCode)
    if (seen.has(key) || merged.length >= limit) return
    seen.add(key)
    merged.push(row)
  }

  if (browsing) {
    for (const line of recentLines) {
      push({
        id: `recent:${line.id}`,
        source: 'recent',
        name: line.material,
        brand: line.brand || 'Custom',
        productCode: line.productCode,
        unit: line.unit,
        category: line.category,
        score: 1,
      })
    }
    for (const item of catalogue) {
      push({
        id: `cat:${item.id}`,
        source: 'catalogue',
        name: item.name,
        brand: item.brand,
        productCode: item.productCode,
        unit: item.defaultUnit,
        category: item.category,
        catalogueItem: item,
        score: 1,
      })
    }
    return merged.slice(0, limit)
  }

  const recentRecords = recentLines.map((line) =>
    catalogueRecordFromItem({
      name: line.material,
      brand: line.brand,
      productCode: line.productCode,
      category: line.category,
      size: line.size,
      length: line.length,
    })
  )
  const catalogueRecords = catalogue.map((item) => catalogueRecordFromItem(item))
  const recentHits = rankMaterialRecords(query, recentRecords)
  const catalogueHits = rankMaterialRecords(query, catalogueRecords)

  const scored: MaterialSuggestion[] = []
  for (const hit of catalogueHits) {
    const item = catalogue[hit.index]
    scored.push({
      id: `cat:${item.id}`,
      source: 'catalogue',
      name: item.name,
      brand: item.brand,
      productCode: item.productCode,
      unit: item.defaultUnit,
      category: item.category,
      catalogueItem: item,
      score: hit.score,
    })
  }
  for (const hit of recentHits) {
    const line = recentLines[hit.index]
    scored.push({
      id: `recent:${line.id}`,
      source: 'recent',
      name: line.material,
      brand: line.brand || 'Custom',
      productCode: line.productCode,
      unit: line.unit,
      category: line.category,
      score: hit.score,
    })
  }
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    if (a.source !== b.source) return a.source === 'catalogue' ? -1 : 1
    return a.name.localeCompare(b.name)
  })
  for (const row of scored) push(row)
  return merged
}

export function filterCatalogueItems(query: string, catalogue: MaterialCatalogItem[]): MaterialCatalogItem[] {
  if (!String(query || '').trim()) return catalogue
  return rankMaterialRecords(query, catalogue.map((item) => catalogueRecordFromItem(item))).map(
    (hit) => catalogue[hit.index]
  )
}

export function lineMatchesMaterialQuery(
  query: string,
  line: { name?: string; brand?: string; productCode?: string; lengthDisplay?: string }
): boolean {
  return materialSearchScore(query, {
    name: line.name,
    brand: line.brand,
    productCode: line.productCode,
    length: line.lengthDisplay,
  }) > 0
}
