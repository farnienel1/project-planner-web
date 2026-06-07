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
}

export function searchMaterialCatalogue(
  query: string,
  catalogue: MaterialCatalogItem[],
  recentLines: ProjectMaterialLine[],
  limit = 10
): MaterialSuggestion[] {
  const q = normalizeMaterialText(query)
  if (!q) return []

  const merged: MaterialSuggestion[] = []
  const seen = new Set<string>()

  for (const item of searchMaterialCatalogueItems(q, catalogue, 8)) {
    const key = duplicateKey(item.name, item.productCode)
    if (!seen.has(key)) {
      seen.add(key)
      merged.push({
        id: `cat:${item.id}`,
        source: 'catalogue',
        name: item.name,
        brand: item.brand,
        productCode: item.productCode,
        unit: item.defaultUnit,
        category: item.category,
        catalogueItem: item,
      })
    }
  }

  for (const line of recentLines) {
    const name = line.material
    const brand = line.brand || 'Custom'
    const code = line.productCode
    if (
      !normalizeMaterialText(name).includes(q) &&
      !normalizeMaterialText(brand).includes(q) &&
      !normalizeMaterialCode(code).includes(q)
    ) {
      continue
    }
    const key = duplicateKey(name, code)
    if (seen.has(key) || merged.length >= limit) continue
    seen.add(key)
    merged.push({
      id: `recent:${line.id}`,
      source: 'recent',
      name,
      brand,
      productCode: code,
      unit: line.unit,
      category: line.category,
    })
  }

  return merged.slice(0, limit)
}

function searchMaterialCatalogueItems(q: string, catalogue: MaterialCatalogItem[], limit: number) {
  return catalogue
    .filter((item) => {
      return (
        normalizeMaterialText(item.name).includes(q) ||
        normalizeMaterialText(item.brand).includes(q) ||
        normalizeMaterialCode(item.productCode).includes(q) ||
        normalizeMaterialText(item.length || item.size || '').includes(q)
      )
    })
    .slice(0, limit)
}
