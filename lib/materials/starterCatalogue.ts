import { collection, doc, getDocs, limit, query, Timestamp, writeBatch } from 'firebase/firestore'
import { getFirebaseDb } from '@/lib/firebase/ensureFirebase'
import {
  MATERIAL_ORDER_UNIT_DETAILS,
  materialCatalogueItemFields,
  parseMaterialCatalogueCsv,
  starterCollectionShouldSeed,
} from '@/lib/canonical'
import { STARTER_MATERIAL_CATALOGUE_CSV } from '@/lib/materials/starter/starterCatalogueCsv'
import type { MaterialCatalogItem, MaterialUnit } from '@/types'

export const STARTER_CATALOGUE_FILENAME = 'material_catalogue_starter.csv'
/** 2: rulebook 1.48.0 order units, cleaned starter list (scripts/materials/build-starter-catalogue.ts). */
export const STARTER_CATALOGUE_VERSION = 2
const SEED_BATCH_SIZE = 400

/** The built-in starter list as the CSV people download (1.48.0 columns). */
export function starterCatalogueCsv(): string {
  return STARTER_MATERIAL_CATALOGUE_CSV
}

/** The starter list as catalogue items, read with the rulebook CSV reader (`parseMaterialCatalogueCsv`). */
export function starterCatalogueItems(
  createdByUserId: string,
  createdByName: string,
  createdAt = new Date()
): MaterialCatalogItem[] {
  return parseMaterialCatalogueCsv(STARTER_MATERIAL_CATALOGUE_CSV).rows.map((row) => ({
    id: row.id,
    name: row.name,
    brand: row.brand,
    productCode: row.productCode || undefined,
    // The old unit with the nearest old meaning (the writer derives it again from the order unit).
    defaultUnit: MATERIAL_ORDER_UNIT_DETAILS[row.orderUnit].legacyUnit as MaterialUnit,
    orderUnit: row.orderUnit,
    contentAmount: row.contentAmount ?? undefined,
    contentMeasure: row.contentMeasure ?? undefined,
    size: row.size || undefined,
    category: row.category || 'Other',
    createdAt,
    createdByUserId,
    createdByName,
  }))
}

/** The stored shape of one starter item (`materialCatalogueItemFields`, the same writer as every catalogue save). */
export function starterCataloguePayload(item: MaterialCatalogItem): Record<string, unknown> {
  return materialCatalogueItemFields({
    id: item.id,
    name: item.name,
    brand: item.brand,
    productCode: item.productCode ?? null,
    orderUnit: item.orderUnit,
    contentAmount: item.contentAmount ?? null,
    contentMeasure: item.contentMeasure ?? null,
    size: item.size ?? null,
    category: item.category,
    createdAt: Timestamp.fromDate(item.createdAt),
    createdByUserId: item.createdByUserId,
    createdByName: item.createdByName,
  })
}

/**
 * Writes the starter catalogue into organizations/{orgId}/materialCatalogue for a new organisation.
 * Rulebook §1 (`starterCollectionShouldSeed`): only when the collection is empty — it never overwrites or adds to a
 * catalogue that has a row. Failures must not block org create.
 */
export async function seedStarterMaterialCatalogue(input: {
  organizationId: string
  createdByUserId: string
  createdByName: string
}): Promise<{ seeded: number; skipped: boolean }> {
  const db = getFirebaseDb()
  const ref = collection(db, 'organizations', input.organizationId, 'materialCatalogue')
  const existing = await getDocs(query(ref, limit(1)))
  if (!starterCollectionShouldSeed(existing.size)) return { seeded: 0, skipped: true }

  const items = starterCatalogueItems(input.createdByUserId, input.createdByName)
  for (let i = 0; i < items.length; i += SEED_BATCH_SIZE) {
    const batch = writeBatch(db)
    for (const item of items.slice(i, i + SEED_BATCH_SIZE)) {
      batch.set(doc(db, 'organizations', input.organizationId, 'materialCatalogue', item.id), starterCataloguePayload(item))
    }
    await batch.commit()
  }
  return { seeded: items.length, skipped: false }
}
