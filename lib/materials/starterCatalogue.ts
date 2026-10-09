import { collection, doc, getDocs, limit, query, Timestamp, writeBatch } from 'firebase/firestore'
import { getFirebaseDb } from '@/lib/firebase/ensureFirebase'
import { parseCatalogueCsv } from '@/lib/materials/materialCatalogCSV'
import { STARTER_MATERIAL_CATALOGUE_CSV } from '@/lib/materials/starter/starterCatalogueCsv'
import type { MaterialCatalogItem } from '@/types'

export const STARTER_CATALOGUE_FILENAME = 'material_catalogue_starter.csv'
export const STARTER_CATALOGUE_VERSION = 1
const SEED_BATCH_SIZE = 400

export function starterCatalogueCsv(): string {
  return STARTER_MATERIAL_CATALOGUE_CSV
}

export function starterCatalogueItems(
  createdByUserId: string,
  createdByName: string,
  createdAt = new Date()
): MaterialCatalogItem[] {
  return parseCatalogueCsv(STARTER_MATERIAL_CATALOGUE_CSV).rows.map((row) => ({
    id: row.id,
    name: row.name,
    brand: row.brand || 'Custom',
    productCode: row.productCode,
    defaultUnit: row.defaultUnit,
    size: row.size,
    length: row.length,
    lengthUnit: row.lengthUnit,
    category: row.category || 'Other',
    createdAt,
    createdByUserId,
    createdByName,
  }))
}

function payload(item: MaterialCatalogItem): Record<string, unknown> {
  const body: Record<string, unknown> = {
    id: item.id,
    name: item.name.trim(),
    brand: item.brand.trim() || 'Custom',
    defaultUnit: item.defaultUnit,
    category: item.category.trim() || 'Other',
    createdAt: Timestamp.fromDate(item.createdAt),
    createdByUserId: item.createdByUserId,
    createdByName: item.createdByName,
  }
  if (item.productCode?.trim()) body.productCode = item.productCode.trim()
  if (item.size?.trim()) body.size = item.size.trim()
  if (item.length?.trim()) {
    body.length = item.length.trim()
    body.sizeOrLength = item.length.trim()
  }
  if (item.lengthUnit) body.lengthUnit = item.lengthUnit
  return body
}

/**
 * Writes the starter catalogue into organizations/{orgId}/materialCatalogue.
 * Skips when the collection already has a row. Failures must not block org create.
 */
export async function seedStarterMaterialCatalogue(input: {
  organizationId: string
  createdByUserId: string
  createdByName: string
}): Promise<{ seeded: number; skipped: boolean }> {
  const db = getFirebaseDb()
  const ref = collection(db, 'organizations', input.organizationId, 'materialCatalogue')
  const existing = await getDocs(query(ref, limit(1)))
  if (!existing.empty) return { seeded: 0, skipped: true }

  const items = starterCatalogueItems(input.createdByUserId, input.createdByName)
  for (let i = 0; i < items.length; i += SEED_BATCH_SIZE) {
    const batch = writeBatch(db)
    for (const item of items.slice(i, i + SEED_BATCH_SIZE)) {
      batch.set(doc(db, 'organizations', input.organizationId, 'materialCatalogue', item.id), payload(item))
    }
    await batch.commit()
  }
  return { seeded: items.length, skipped: false }
}
