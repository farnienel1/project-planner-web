/**
 * Rulebook 1.10.0: the cross-platform contract (`cross-platform-contract.json`), mirrored to iOS as
 * `ProjectPlannerTests/CrossPlatformContract.json` and run there by `CrossPlatformContractTests`.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { createContext, runInContext } from 'node:vm'
import { readCrossPlatformSample, crossPlatformContractReaderNames } from './crossPlatformContract.ts'
import {
  buildContractSample,
  CONTRACT_NO_READER,
  CONTRACT_READER_FOR,
  buildCrossPlatformContract,
  contractJson,
  webWrittenSamples,
} from './crossPlatformContract.samples.ts'
import { LIVE_COLLECTIONS } from './liveSources.ts'

type Contract = ReturnType<typeof buildCrossPlatformContract>
const onDisk: Contract = JSON.parse(readFileSync(new URL('./cross-platform-contract.json', import.meta.url), 'utf8'))

test('the contract on disk is the one the web writers and readers build (regenerate with --write)', () => {
  assert.equal(readFileSync(new URL('./cross-platform-contract.json', import.meta.url), 'utf8'), contractJson())
})

test('every live collection with a reader has a web-written and an iOS-written sample', () => {
  for (const row of LIVE_COLLECTIONS) {
    const listed = row.id in CONTRACT_READER_FOR || row.id in CONTRACT_NO_READER
    assert.ok(listed, `${row.id} is neither in the contract nor in CONTRACT_NO_READER`)
    if (!(row.id in CONTRACT_READER_FOR)) continue
    const entry = onDisk.collections.find((c) => c.id === row.id)
    assert.ok(entry, `${row.id} missing from the contract`)
    assert.ok(entry!.samples.some((s) => s.platform === 'web'), `${row.id}: no webWritten sample`)
    assert.ok(entry!.samples.some((s) => s.platform === 'ios'), `${row.id}: no iosWritten sample`)
    assert.ok(crossPlatformContractReaderNames().includes(entry!.reader), `${row.id}: unknown reader ${entry!.reader}`)
  }
})

test('every sample read through the rulebook equals expected, and no sample is refused', () => {
  for (const entry of onDisk.collections) {
    for (const sample of entry.samples) {
      const got = readCrossPlatformSample(entry.reader, sample.docId, sample.data, {
        timeZone: onDisk.timeZone,
        ...(entry.readerOptions ?? {}),
      })
      assert.deepEqual(got, sample.expected, `${entry.id} ${sample.platform}`)
      const refused = got == null || (typeof got === 'object' && ((got as { ok?: boolean }).ok === false || 'error' in (got as object)))
      assert.equal(refused, false, `${entry.id} ${sample.platform} sample is refused by its reader`)
    }
  }
})

test('the web writers still produce the webWritten samples', () => {
  const web = webWrittenSamples()
  for (const [id, sample] of Object.entries(web)) {
    const entry = onDisk.collections.find((c) => c.id === id)
    assert.ok(entry, id)
    const stored = entry!.samples.find((s) => s.platform === 'web')!
    assert.equal(stored.docId, sample.docId, id)
    assert.deepEqual(stored.data, JSON.parse(JSON.stringify(sample.data)), id)
  }
})

test('the packed script reads every sample the same way (what iOS runs)', () => {
  const source = readFileSync(new URL('./dist/canonical-business.js', import.meta.url), 'utf8')
  const sandbox: { ProjectPlannerCanonical?: { readCrossPlatformSample: typeof readCrossPlatformSample } } = {}
  runInContext(source, createContext(sandbox))
  const bundle = sandbox.ProjectPlannerCanonical
  assert.ok(bundle?.readCrossPlatformSample, 'readCrossPlatformSample is packed')
  for (const entry of onDisk.collections) {
    for (const sample of entry.samples) {
      const got = bundle!.readCrossPlatformSample(entry.reader, sample.docId, sample.data, { timeZone: onDisk.timeZone, ...(entry.readerOptions ?? {}) })
      assert.deepEqual(JSON.parse(JSON.stringify(got)), sample.expected, `${entry.id} ${sample.platform}`)
    }
  }
})

test('1.11.0: every iOS sample with a builder is exactly what its rulebook writer produces from the input', () => {
  let built = 0
  for (const entry of onDisk.collections) {
    for (const sample of entry.samples) {
      if (!sample.builder) continue
      built += 1
      assert.equal(sample.platform, 'ios', `${entry.id}: only iOS samples carry a builder`)
      assert.deepEqual(JSON.parse(JSON.stringify(buildContractSample(sample.builder))), sample.data, `${entry.id} builder`)
    }
  }
  assert.ok(built >= 8, 'the builder samples are in the contract')
  // The 1.11.0 fixes: nested membership (the legacy flat shape is a read-only case), full iOS job samples, task owner.
  const byId = (id: string) => onDisk.collections.find((c) => c.id === id)!
  const membership = byId('orgMemberships').samples.find((s) => s.platform === 'ios')!
  assert.equal(typeof membership.data.permissions, 'object')
  assert.equal('manager' in membership.data, false)
  assert.ok(byId('orgMemberships').samples.some((s) => s.platform === 'ios-legacy'))
  const sw = byId('smallWorks').samples.find((s) => s.platform === 'ios')!.data
  for (const key of ['addressLine2', 'siteAddress', 'manager', 'description', 'hiddenManagerUserIds', 'hiddenOperativeUserIds', 'usesMapPinForLocation', 'managerUserIds']) {
    assert.ok(key in sw, `smallWorks iOS sample has ${key}`)
  }
  assert.ok('managerUserIds' in byId('projects').samples.find((s) => s.platform === 'ios')!.data)
  for (const sample of byId('tasks').samples) assert.ok('createdByUserId' in sample.data, `tasks ${sample.platform}`)
  for (const id of ['bookings', 'subcontractorBookings']) {
    for (const sample of byId(id).samples) assert.equal(sample.data.jobCollection, 'projects', `${id} ${sample.platform} jobCollection`)
  }
})

test('1.11.0: the packed script\'s writers reproduce every builder sample (what iOS runs)', () => {
  const source = readFileSync(new URL('./dist/canonical-business.js', import.meta.url), 'utf8')
  const sandbox: { ProjectPlannerCanonical?: Record<string, (...args: unknown[]) => unknown> } = {}
  runInContext(source, createContext(sandbox))
  const bundle = sandbox.ProjectPlannerCanonical!
  for (const entry of onDisk.collections) {
    for (const sample of entry.samples) {
      if (!sample.builder) continue
      assert.equal(typeof bundle[sample.builder.writer], 'function', `${sample.builder.writer} is packed`)
    }
  }
})
