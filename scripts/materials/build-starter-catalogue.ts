/**
 * Builds the built-in starter material catalogue (rulebook 1.48.0 §28) from a catalogue CSV export.
 *
 *   npx tsx scripts/materials/build-starter-catalogue.ts <export.csv> [--report <report.md>]
 *
 * Reads the export with the rulebook CSV reader (`parseMaterialCatalogueCsv`, so the old Default Type / Length /
 * Length Unit columns go through `materialQuantityModel`), applies the clean-up below and writes
 *   lib/materials/starter/material_catalogue_starter.csv   (the download, 1.48.0 columns)
 *   lib/materials/starter/starterCatalogueCsv.ts           (the same text, bundled for the seed)
 * Rows whose name is already in the previous starter keep that starter's Catalogue ID, so the list keeps its ids.
 * Nothing is written to Firestore: this only changes the data new organisations are seeded with.
 *
 * Clean-up (owner request 15 Nov):
 *   - drop test / junk rows: brand NEW, NEW 2, N/A or Custom on a row added after the starter, product codes that look
 *     like tests (123-456, 12567, 4576-34), names with "test" on a row added after the starter — every dropped row is
 *     printed for the owner;
 *   - "Unknown" and "Custom" brand → blank; three real owner-added products are kept (`KEEP_NAMES`);
 *   - a name ending "- 1m" is a fixed 1 m piece → Length with 1 m in one, never Metre (`ONE_METRE_PIECE`);
 *   - float noise (2.4000000000000004 → 2.4) and glued units ("3m") — done by the reader;
 *   - Size "1" / "1.0" placeholder → blank — done by the reader.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  materialCatalogueCsvExport,
  parseMaterialCatalogueCsv,
  type MaterialCatalogueCsvRow,
} from '../../lib/canonical/materialCatalogueCsv'
import { materialLineText } from '../../lib/canonical/materialQuantity'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const starterCsvPath = path.join(root, 'lib/materials/starter/material_catalogue_starter.csv')
const starterTsPath = path.join(root, 'lib/materials/starter/starterCatalogueCsv.ts')

const JUNK_BRANDS = new Set(['new', 'new 2', 'n/a'])
const TEST_PRODUCT_CODES = new Set(['123-456', '12567', '4576-34'])
/** Owner-added rows that are real products (review of #326): kept, with the brand cleaned like every row. */
const KEEP_NAMES = new Set(['GU10 3000K Dimmable', 'M6 Penny Washers', '6mm Penny Washers'])
/**
 * A name ending "- 1m" is a fixed 1 m piece (threaded rod, DIN rail, channel drain, rigid duct, pipe insulation
 * section), not cut to length: stored as Length + 1 m, the old reader rule (owner decision 2) would read it as Metre,
 * so the starter writes it as Length with 1 m in one. Existing organisations' copies still read as Metre.
 */
const ONE_METRE_PIECE = / - 1m$/i

export type DroppedRow = { row: MaterialCatalogueCsvRow; reason: string }

export function dropReason(row: MaterialCatalogueCsvRow, inPreviousStarter: boolean): string | null {
  if (KEEP_NAMES.has(row.name)) return null
  const brand = row.brand.trim().toLowerCase()
  if (JUNK_BRANDS.has(brand)) return `brand "${row.brand}"`
  if (TEST_PRODUCT_CODES.has(row.productCode.trim())) return `test product code "${row.productCode}"`
  if (!inPreviousStarter && /\btest\b/i.test(row.name)) return 'name says test (added in one organisation)'
  if (!inPreviousStarter && brand === 'custom') return 'brand "Custom" (added in one organisation, not a standard item)'
  return null
}

function uuidFromName(name: string): string {
  const hex = createHash('sha1').update(`project-planner-starter-material:${name}`).digest('hex')
  const variant = ((parseInt(hex[16], 16) & 0x3) | 0x8).toString(16)
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-${variant}${hex.slice(17, 20)}-${hex.slice(20, 32)}`.toUpperCase()
}

function main() {
  const [input, ...rest] = process.argv.slice(2)
  if (!input) {
    console.error('Usage: npx tsx scripts/materials/build-starter-catalogue.ts <export.csv> [--report <file.md>]')
    process.exit(1)
  }
  const reportIndex = rest.indexOf('--report')
  const reportPath = reportIndex >= 0 ? rest[reportIndex + 1] : null

  const previous = parseMaterialCatalogueCsv(readFileSync(starterCsvPath, 'utf8'))
  const previousIdByName = new Map(previous.rows.map((row) => [row.name, row.id]))
  const parsed = parseMaterialCatalogueCsv(readFileSync(input, 'utf8'))
  if (parsed.errors.length) {
    console.error(parsed.errors.join('\n'))
    process.exit(1)
  }

  const kept: MaterialCatalogueCsvRow[] = []
  const dropped: DroppedRow[] = []
  const onePieceNames: string[] = []
  for (const row of parsed.rows) {
    const inPrevious = previousIdByName.has(row.name)
    const reason = dropReason(row, inPrevious)
    if (reason) {
      dropped.push({ row, reason })
      continue
    }
    const onePiece = row.orderUnit === 'Metre' && ONE_METRE_PIECE.test(row.name)
    if (onePiece) onePieceNames.push(row.name)
    kept.push({
      ...row,
      id: previousIdByName.get(row.name) || uuidFromName(row.name),
      brand: /^(unknown|custom)$/i.test(row.brand.trim()) ? '' : row.brand,
      ...(onePiece ? { orderUnit: 'Length' as const, contentAmount: 1, contentMeasure: 'm' as const } : {}),
    })
  }

  const csv = materialCatalogueCsvExport(kept)
  writeFileSync(starterCsvPath, csv)
  writeFileSync(
    starterTsPath,
    `/** Auto-generated by scripts/materials/build-starter-catalogue.ts. Do not edit by hand. */\nexport const STARTER_MATERIAL_CATALOGUE_CSV = ${JSON.stringify(csv)} as const\n`
  )

  const counts = new Map<string, number>()
  for (const row of kept) counts.set(row.orderUnit, (counts.get(row.orderUnit) ?? 0) + 1)
  const lines = [
    `Input rows: ${parsed.rows.length} (in-file duplicates skipped: ${parsed.duplicateRows.length})`,
    `Kept: ${kept.length} · Dropped: ${dropped.length}`,
    `Order units: ${[...counts.entries()].sort().map(([unit, n]) => `${unit} ${n}`).join(', ')}`,
    '',
    '| Dropped row | Category | Brand | Product code | Reason |',
    '|---|---|---|---|---|',
    ...dropped.map(
      ({ row, reason }) => `| ${row.name} | ${row.category} | ${row.brand || '—'} | ${row.productCode || '—'} | ${reason} |`
    ),
    '',
    `Fixed 1 m pieces written as Length + 1 m (not Metre): ${onePieceNames.length}`,
    ...onePieceNames.map((name) => `- ${name}`),
    '',
    '| Kept row not in the previous starter | Reads as |',
    '|---|---|',
    ...kept
      .filter((row) => !previousIdByName.has(row.name))
      .map((row) => `| ${row.name} | ${materialLineText({ quantity: 1, ...row })} |`),
  ]
  console.log(lines.join('\n'))
  if (reportPath) writeFileSync(reportPath, `${lines.join('\n')}\n`)
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) main()
