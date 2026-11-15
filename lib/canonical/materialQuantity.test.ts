import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  MATERIAL_ORDER_UNITS,
  MATERIAL_QUANTITY_WHOLE_MESSAGE,
  materialContentError,
  materialLineText,
  materialQuantityError,
  materialQuantityModel,
  materialQuantityWriteFields,
  materialSendLineText,
  materialSizeText,
  parseMaterialMeasure,
} from './materialQuantity.ts'
import {
  MATERIAL_CATALOGUE_CSV_BINARY_MESSAGE,
  MATERIAL_CATALOGUE_CSV_ENCODING_MESSAGE,
  MATERIAL_CATALOGUE_CSV_HEADER,
  MATERIAL_CATALOGUE_CSV_HEADER_MESSAGE,
  MATERIAL_CATALOGUE_CSV_LEGACY_HEADER,
  MATERIAL_CATALOGUE_CSV_MAX_ROWS,
  MATERIAL_CATALOGUE_CSV_NOT_CSV_MESSAGE,
  MATERIAL_CATALOGUE_CSV_TOO_BIG_MESSAGE,
  MATERIAL_CATALOGUE_CSV_TOO_MANY_ROWS_MESSAGE,
  materialCatalogueCsvCell,
  materialCatalogueCsvExport,
  materialCatalogueCsvFileError,
  materialCatalogueCsvTextError,
  parseMaterialCatalogueCsv,
  splitCsvRecords,
} from './materialCatalogueCsv.ts'
import {
  materialCatalogueItemFields,
  materialCatalogueWrites,
  materialLineFields,
  materialSendRecordCreateFields,
  parseMaterialCatalogueDocument,
  parseMaterialLineDocument,
} from './operationsDocuments.ts'

test('1.48.0 owner decision 1: the order units', () => {
  assert.deepEqual([...MATERIAL_ORDER_UNITS], ['Each', 'Box', 'Pack', 'Drum', 'Reel', 'Coil', 'Pallet', 'Length', 'Metre'])
})

test('1.48.0: old fields read as the new model without rewriting anything (owner decision 2)', () => {
  const cases: Array<[Record<string, unknown>, string, number | null, string | null]> = [
    [{ unit: 'Number' }, 'Each', null, null],
    [{ unit: 'Number', length: '3', lengthUnit: 'M' }, 'Each', 3, 'm'],
    [{ unit: 'Box' }, 'Box', null, null],
    [{ unit: 'Box', length: '100', lengthUnit: 'M' }, 'Box', 100, 'm'],
    [{ unit: 'Drum', length: '50', lengthUnit: 'M' }, 'Drum', 50, 'm'],
    [{ unit: 'Pallet' }, 'Pallet', null, null],
    [{ unit: 'Length', length: '1', lengthUnit: 'M' }, 'Metre', null, null],
    [{ unit: 'Length', length: '3', lengthUnit: 'M' }, 'Length', 3, 'm'],
    [{ unit: 'Length', length: '150', lengthUnit: 'MM' }, 'Length', 150, 'mm'],
    [{ unit: 'Length' }, 'Length', null, null],
    [{ unit: 'length', sizeOrLength: '2.4000000000000004', lengthUnit: 'M' }, 'Length', 2.4, 'm'],
    [{ unit: 'Length', length: '3m' }, 'Length', 3, 'm'],
    [{ unit: 'Length', length: '100m' }, 'Length', 100, 'm'],
    [{ defaultUnit: 'Drum', length: '100', lengthUnit: 'M' }, 'Drum', 100, 'm'],
    [{ unit: 'm' }, 'Metre', null, null],
    [{ unit: 'kg' }, 'Each', null, null],
    [{}, 'Each', null, null],
  ]
  for (const [row, unit, amount, measure] of cases) {
    const model = materialQuantityModel(row)
    assert.equal(model.orderUnit, unit, JSON.stringify(row))
    assert.equal(model.contentAmount, amount, JSON.stringify(row))
    assert.equal(model.contentMeasure, measure, JSON.stringify(row))
    assert.equal(model.fromLegacy, true)
  }
})

test('1.48.0: a stored orderUnit wins over the old fields', () => {
  const model = materialQuantityModel({ orderUnit: 'Reel', contentAmount: 50, contentMeasure: 'm', unit: 'Drum', length: '25' })
  assert.deepEqual(model, { orderUnit: 'Reel', contentAmount: 50, contentMeasure: 'm', fromLegacy: false })
  assert.equal(materialQuantityModel({ orderUnit: 'Metre', contentAmount: 5, contentMeasure: 'm' }).contentAmount, null)
})

test('1.48.0: a save writes the new fields and the nearest old meaning for older builds', () => {
  assert.deepEqual(materialQuantityWriteFields({ orderUnit: 'Metre' }), {
    orderUnit: 'Metre', contentAmount: null, contentMeasure: null, unit: 'Length', length: '1', sizeOrLength: '1', lengthUnit: 'M',
  })
  assert.deepEqual(materialQuantityWriteFields({ orderUnit: 'Reel', contentAmount: 50, contentMeasure: 'm' }), {
    orderUnit: 'Reel', contentAmount: 50, contentMeasure: 'm', unit: 'Drum', length: '50', sizeOrLength: '50', lengthUnit: 'M',
  })
  assert.deepEqual(materialQuantityWriteFields({ orderUnit: 'Pack', contentAmount: 10, contentMeasure: 'pcs' }, { unitField: 'defaultUnit' }), {
    orderUnit: 'Pack', contentAmount: 10, contentMeasure: 'pcs', defaultUnit: 'Box', length: null, sizeOrLength: null, lengthUnit: null,
  })
  assert.equal(materialQuantityWriteFields({ orderUnit: 'Coil' }).unit, 'Drum')
  assert.equal(materialQuantityWriteFields({ orderUnit: 'Each', contentAmount: 150, contentMeasure: 'mm' }).lengthUnit, 'MM')
  // Every write reads back as itself.
  for (const unit of MATERIAL_ORDER_UNITS) {
    const fields = materialQuantityWriteFields({ orderUnit: unit, contentAmount: unit === 'Metre' ? null : 3, contentMeasure: 'm' })
    assert.equal(materialQuantityModel(fields).orderUnit, unit)
  }
})

test('1.48.0 materialLineText: UK trade style, no pack totals (owner decision 5)', () => {
  assert.equal(materialLineText({ quantity: 2, orderUnit: 'Drum', contentAmount: 50, contentMeasure: 'm' }), '2no 50m drums')
  assert.equal(materialLineText({ quantity: 1, orderUnit: 'Drum', contentAmount: 50, contentMeasure: 'm' }), '1no 50m drum')
  assert.equal(materialLineText({ quantity: 10, orderUnit: 'Length', contentAmount: 3, contentMeasure: 'm' }), '10no 3m lengths')
  assert.equal(materialLineText({ quantity: 2, orderUnit: 'Box', contentAmount: 100, contentMeasure: 'm' }), '2no 100m boxes')
  assert.equal(materialLineText({ quantity: 2, orderUnit: 'Box', contentAmount: 100, contentMeasure: 'pcs' }), '2no boxes of 100')
  assert.equal(materialLineText({ quantity: 4, orderUnit: 'Each' }), '4no')
  assert.equal(materialLineText({ quantity: 100, orderUnit: 'Metre' }), '100m')
  assert.equal(materialLineText({ quantity: 12.5, orderUnit: 'Metre' }), '12.5m')
  assert.equal(materialLineText({ quantity: 1, orderUnit: 'Pallet' }), '1no pallet')
  assert.equal(materialLineText({ quantity: 3, orderUnit: 'Pack' }), '3no packs')
  assert.equal(materialLineText({ quantity: 6, orderUnit: 'Length', contentAmount: 150, contentMeasure: 'mm' }), '6no 150mm lengths')
  // The plan's examples on older data.
  assert.equal(materialLineText({ quantity: 100, unit: 'Length', length: '1', lengthUnit: 'M' }), '100m')
  assert.equal(materialLineText({ quantity: 6, unit: 'Length', length: '2.4000000000000004', lengthUnit: 'M' }), '6no 2.4m lengths')
  assert.equal(materialLineText({ quantity: 4, unit: 'Number' }), '4no')
  assert.equal(materialLineText({ quantity: 1, unit: 'Drum', lengthDisplay: '50 m' }), '1no 50m drum')
  // A typed length that is not a length is kept.
  assert.equal(materialLineText({ quantity: 2, unit: 'Length', lengthDisplay: '3m x 2' }), '2no lengths (3m x 2)')
})

test('1.48.0: past send records keep their own wording; new records store the line text', () => {
  assert.equal(materialSendLineText({ quantity: 2, unit: 'Drum', lengthDisplay: '50 m' }), '2 Drums · Length: 50 m')
  assert.equal(materialSendLineText({ quantity: 1, unit: 'Number' }), '1 Number')
  assert.equal(materialSendLineText({ quantityText: '2no 50m drums', quantity: 2, unit: 'Drum' }), '2no 50m drums')
  const record = materialSendRecordCreateFields({
    id: 'R', projectId: 'P', requestType: 'order', sentAt: 1, sentBy: 'S', recipients: [],
    lines: [{ materialId: 'M', name: 'Flex', quantity: 100, unit: 'Length', orderUnit: 'Metre' }],
  })
  assert.equal((record.lines as Array<Record<string, unknown>>)[0].quantityText, '100m')
})

test('1.48.0 owner decision 3: whole numbers except Metre', () => {
  assert.equal(materialQuantityError(2, 'Drum'), null)
  assert.equal(materialQuantityError(2.5, 'Drum'), MATERIAL_QUANTITY_WHOLE_MESSAGE)
  assert.equal(materialQuantityError(12.5, 'Metre'), null)
  assert.equal(materialQuantityError(0, 'Metre'), 'Enter a quantity above 0.')
  assert.equal(materialQuantityError(null, 'Each'), 'Enter a quantity above 0.')
  assert.equal(materialContentError('', 'm', 'Drum'), null)
  assert.equal(materialContentError('50', 'pcs', 'Drum'), 'Choose m for Drum.')
  assert.equal(materialContentError('100', 'pcs', 'Box'), null)
  assert.equal(materialContentError('-1', 'm', 'Length'), 'Enter what is in one as a number above 0, or leave it blank.')
})

test('1.48.0 owner decision 4: Size "1.0" is hidden on display only', () => {
  assert.equal(materialSizeText('1.0'), '')
  assert.equal(materialSizeText('1'), '')
  assert.equal(materialSizeText('25KG'), '25KG')
  assert.deepEqual(parseMaterialMeasure('2.4000000000000004', 'M'), { amount: 2.4, measure: 'm' })
  assert.equal(parseMaterialMeasure('25KG', null), null)
})

test('1.48.0: the line and catalogue readers return the model; writers keep both shapes', () => {
  const line = parseMaterialLineDocument('L1', { projectId: 'P', material: 'Flex', quantity: 100, unit: 'Length', length: '1', lengthUnit: 'M' })
  assert.equal(line?.orderUnit, 'Metre')
  assert.equal(line?.quantityText, '100m')
  assert.equal(line?.unit, 'Length')
  const fields = materialLineFields({ id: 'L', projectId: 'P', quantity: 2, orderUnit: 'Reel', contentAmount: 50, contentMeasure: 'm', material: 'Cable', dayKey: '2026-11-15' }, 'Europe/London')
  assert.equal(fields.unit, 'Drum')
  assert.equal(fields.orderUnit, 'Reel')
  assert.equal(fields.length, '50')
  // An older caller that passes only the old fields still writes both.
  const legacy = materialLineFields({ id: 'L', projectId: 'P', quantity: 2, unit: 'Length', length: '3m x 2', material: 'Bar', dayKey: '2026-11-15' }, 'Europe/London')
  assert.equal(legacy.orderUnit, 'Length')
  assert.equal(legacy.length, '3m x 2')
  const cat = parseMaterialCatalogueDocument('C', { name: 'Arctic Flex', defaultUnit: 'Drum', length: '50', lengthUnit: 'M' })
  assert.equal(cat?.orderUnit, 'Drum')
  assert.equal(cat?.contentAmount, 50)
})

test('1.48.0: an import never rewrites an older item that says the same thing', () => {
  const stored = [{ id: 'C1', data: { id: 'C1', name: 'Timber', brand: 'Custom', defaultUnit: 'Length', length: '2.4000000000000004', sizeOrLength: '2.4000000000000004', lengthUnit: 'M', category: 'Timber', productCode: null, size: null } }]
  const plan = materialCatalogueWrites({
    stored,
    next: [{ id: 'C1', name: 'Timber', brand: 'Custom', orderUnit: 'Length', contentAmount: 2.4, contentMeasure: 'm', category: 'Timber' }],
    loaded: true,
  })
  assert.deepEqual(plan.write, [])
  const changed = materialCatalogueWrites({
    stored,
    next: [{ id: 'C1', name: 'Timber', brand: 'Custom', orderUnit: 'Length', contentAmount: 4.8, contentMeasure: 'm', category: 'Timber' }],
    loaded: true,
  })
  assert.equal(changed.write[0].set.orderUnit, 'Length')
  assert.equal(changed.write[0].set.length, '4.8')
  assert.equal(materialCatalogueItemFields({ id: 'X', name: 'Y', orderUnit: 'Metre' }).defaultUnit, 'Length')
})

test('1.48.0 CSV upload safety: .csv only, 2 MB, UTF-8, no binary', () => {
  assert.equal(materialCatalogueCsvFileError({ fileName: 'list.xlsx', byteLength: 10 }), MATERIAL_CATALOGUE_CSV_NOT_CSV_MESSAGE)
  assert.equal(materialCatalogueCsvFileError({ fileName: 'list.CSV', byteLength: 10 }), null)
  assert.equal(materialCatalogueCsvFileError({ fileName: 'list.csv', byteLength: 3 * 1024 * 1024 }), MATERIAL_CATALOGUE_CSV_TOO_BIG_MESSAGE)
  assert.equal(materialCatalogueCsvTextError('Name,Category\u0000'), MATERIAL_CATALOGUE_CSV_BINARY_MESSAGE)
  assert.equal(materialCatalogueCsvTextError('Name,Category\nA�,B'), MATERIAL_CATALOGUE_CSV_ENCODING_MESSAGE)
  assert.deepEqual(parseMaterialCatalogueCsv('Foo,Bar\n1,2').errors, [MATERIAL_CATALOGUE_CSV_HEADER_MESSAGE])
  const many = `${MATERIAL_CATALOGUE_CSV_HEADER}\n${Array.from({ length: MATERIAL_CATALOGUE_CSV_MAX_ROWS + 1 }, (_, i) => `,Item ${i},Cat,,,Each,,,`).join('\n')}`
  assert.deepEqual(parseMaterialCatalogueCsv(many).errors, [MATERIAL_CATALOGUE_CSV_TOO_MANY_ROWS_MESSAGE])
})

test('1.48.0 CSV: field caps, plain text, quoted line breaks and formula neutralising', () => {
  const long = 'x'.repeat(201)
  const parsed = parseMaterialCatalogueCsv(
    `${MATERIAL_CATALOGUE_CSV_HEADER}\n,${long},Cat,,,Each,,,\n,"Multi\nline, name",Cat,,,Reel,50,m,\n,Bad unit,Cat,,,Bucket,,,\n`
  )
  assert.deepEqual(parsed.errors, ['Row 2: name is longer than 200 characters.', 'Row 4: Order unit "Bucket" is not one of Each, Box, Pack, Drum, Reel, Coil, Pallet, Length, Metre.'])
  assert.equal(parsed.rows.length, 1)
  assert.equal(parsed.rows[0].name, 'Multi line, name')
  assert.equal(parsed.rows[0].orderUnit, 'Reel')
  for (const lead of ['=', '+', '-', '@', '\t', '\r']) assert.equal(materialCatalogueCsvCell(`${lead}1`).replace(/^"/, '')[0], "'")
  assert.equal(materialCatalogueCsvCell('a,b'), '"a,b"')
  assert.deepEqual(splitCsvRecords('a,"b ""q"""\r\nc,d'), [['a', 'b "q"'], ['c', 'd']])
})

test('1.48.0 CSV: the old layout imports and exports in the new layout', () => {
  const parsed = parseMaterialCatalogueCsv(
    `${MATERIAL_CATALOGUE_CSV_LEGACY_HEADER}\nID1,Flex,Cable,Unknown,,Length,,1,M\nID2,Arctic (50m Drum),Cable,,,Drum,,50,M\n`
  )
  assert.equal(parsed.rows[0].orderUnit, 'Metre')
  assert.equal(parsed.rows[0].brand, 'Unknown')
  const out = materialCatalogueCsvExport(parsed.rows)
  assert.equal(out.split('\n')[0], MATERIAL_CATALOGUE_CSV_HEADER)
  assert.match(out, /ID2,Arctic \(50m Drum\),Cable,,,Drum,50,m,/)
})
