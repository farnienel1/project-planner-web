import assert from 'node:assert/strict'
import test from 'node:test'
import {
  coordinatesFromAddressText,
  formatUkPostcode,
  lookupPostcodes,
  parsePostcodesIoBulk,
  siteMapJobShown,
  siteMapPlacement,
  siteMapPlacementUnplaced,
  siteMapPostcode,
  siteMapUnplacedReason,
  siteMapUnplacedText,
  type LatLng,
} from './siteMapPlacement'

const none = new Map<string, LatLng | null>()

test('a stored pin always wins, even over an address with a postcode', () => {
  const placement = siteMapPlacement(
    { latitude: 51.5, longitude: -0.1, postcode: 'W1F 9QY', addressLine1: '71 Broadwick Street' },
    new Map([['W1F 9QY', { latitude: 1, longitude: 1 }]])
  )
  assert.deepEqual(placement, { kind: 'stored', coordinates: { latitude: 51.5, longitude: -0.1 } })
})

test('a 0,0 or missing stored pin is not a pin', () => {
  assert.equal(siteMapPlacement({ latitude: 0, longitude: 0 }, none).kind, 'noAddress')
})

test('an address saved as "lat, lng" text is used as the pin (owner: 71 Broadwick Street)', () => {
  assert.deepEqual(coordinatesFromAddressText('51.51278, -0.13805'), { latitude: 51.51278, longitude: -0.13805 })
  assert.deepEqual(coordinatesFromAddressText(' (51.5,-0.1) '), { latitude: 51.5, longitude: -0.1 })
  assert.equal(coordinatesFromAddressText('12 14'), null)
  assert.equal(coordinatesFromAddressText('95.1, 2.2'), null)
  assert.equal(coordinatesFromAddressText('71 Broadwick Street'), null)
  assert.deepEqual(siteMapPlacement({ siteAddress: '51.51278, -0.13805' }, none), {
    kind: 'addressCoordinates',
    coordinates: { latitude: 51.51278, longitude: -0.13805 },
  })
})

test('postcodes in any case or spacing are found and written the standard way', () => {
  assert.equal(siteMapPostcode({ postcode: 'Sw1x 9Hr' }), 'SW1X 9HR')
  assert.equal(siteMapPostcode({ postcode: 'sw1x9hr' }), 'SW1X 9HR')
  assert.equal(siteMapPostcode({ postcode: 'SW1 X9HR' }), 'SW1X 9HR')
  assert.equal(siteMapPostcode({ addressLine1: '30 Artillery Lane', townCity: 'London', postcode: 'e1 7ls' }), 'E1 7LS')
  assert.equal(siteMapPostcode({ siteAddress: '45 Ludgate Hill, EC4M 7JU, Da, DAS' }), 'EC4M 7JU')
  assert.equal(siteMapPostcode({ addressLine1: 'Unit 5 Odhams Lane', townCity: 'Watford', postcode: 'WD24 7RY' }), 'WD24 7RY')
  assert.equal(formatUkPostcode('ec4m7ju'), 'EC4M 7JU')
})

test('junk or empty addresses are not placed and are listed for a manual pin', () => {
  const junk = siteMapPlacement({ addressLine1: '1', addressLine2: 'ccx', townCity: 'vvv', postcode: 'CCC' }, none)
  assert.equal(junk.kind, 'noPostcode')
  assert.ok(siteMapPlacementUnplaced(junk))
  assert.equal(siteMapUnplacedReason(junk), 'No postcode in the address')
  const empty = siteMapPlacement({}, none)
  assert.equal(empty.kind, 'noAddress')
  assert.equal(siteMapUnplacedReason(empty), 'No address')
})

test('a postcode is pending until looked up, then placed or listed as not found', () => {
  const site = { postcode: 'Sw1x 9Hr' }
  assert.deepEqual(siteMapPlacement(site, none), { kind: 'pending', postcode: 'SW1X 9HR' })
  assert.ok(!siteMapPlacementUnplaced(siteMapPlacement(site, none)))
  assert.deepEqual(siteMapPlacement(site, new Map([['SW1X 9HR', { latitude: 51.49, longitude: -0.16 }]])), {
    kind: 'postcode',
    coordinates: { latitude: 51.49, longitude: -0.16 },
    postcode: 'SW1X 9HR',
  })
  const notFound = siteMapPlacement(site, new Map([['SW1X 9HR', null]]))
  assert.equal(notFound.kind, 'postcodeNotFound')
  assert.equal(siteMapUnplacedReason(notFound), 'Postcode SW1X 9HR not found')
})

test('the map shows Active and Upcoming, Completed only with the toggle, never inactive (rulebook job status)', () => {
  const tz = 'Europe/London'
  const day = '2026-11-24'
  const active = { id: 'a', startDayKey: '2026-11-01', endDayKey: '2026-12-01' }
  const upcoming = { id: 'u', startDayKey: '2026-12-10', endDayKey: '2026-12-20' }
  const completed = { id: 'c', startDayKey: '2026-10-01', endDayKey: '2026-11-01' }
  const inactive = { id: 'i', isLive: false, startDayKey: '2026-11-01', endDayKey: '2026-12-01' }
  const off = { includeCompleted: false, dayKey: day, timeZone: tz }
  const on = { includeCompleted: true, dayKey: day, timeZone: tz }
  assert.deepEqual(
    [active, upcoming, completed, inactive].map((job) => siteMapJobShown(job, off)),
    [true, true, false, false]
  )
  assert.deepEqual(
    [active, upcoming, completed, inactive].map((job) => siteMapJobShown(job, on)),
    [true, true, true, false]
  )
  // The status is read on the day the map shows, not today.
  assert.equal(siteMapJobShown(completed, { ...off, dayKey: '2026-10-15' }), true)
})

test('the Home card line counts the jobs that could not be placed', () => {
  assert.equal(siteMapUnplacedText(0), null)
  assert.equal(siteMapUnplacedText(1), '1 job could not be placed on the map.')
  assert.equal(siteMapUnplacedText(9), '9 jobs could not be placed on the map.')
})

test('postcodes.io bulk answers are read per query; unknown postcodes are null', () => {
  const parsed = parsePostcodesIoBulk({
    status: 200,
    result: [
      { query: 'sw1x 9hr', result: { latitude: 51.49, longitude: -0.16 } },
      { query: 'ZZ1 1ZZ', result: null },
      { query: 7 },
    ],
  })
  assert.deepEqual([...parsed], [
    ['SW1X 9HR', { latitude: 51.49, longitude: -0.16 }],
    ['ZZ1 1ZZ', null],
  ])
  assert.equal(parsePostcodesIoBulk(null).size, 0)
})

test('lookups send only the postcodes, 100 at a time, hand over each batch, and report unreachable batches', async () => {
  const sent: Array<{ url: string; body: unknown }> = []
  const fakeFetch = (async (url: string, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body)) as { postcodes: string[] }
    sent.push({ url, body })
    if (sent.length === 2) throw new TypeError('Failed to fetch')
    return new Response(
      JSON.stringify({ result: body.postcodes.map((query) => ({ query, result: { latitude: 51, longitude: 0 } })) }),
      { status: 200 }
    )
  }) as unknown as typeof fetch
  const postcodes = Array.from({ length: 150 }, (_, i) => `E${(i % 9) + 1} ${i % 10}A${String.fromCharCode(65 + (i % 26))}`)
  const batches: number[] = []
  const { found, failed } = await lookupPostcodes(['sw1x9hr', 'SW1X 9HR', ...postcodes], {
    fetchImpl: fakeFetch,
    onBatch: (answers) => batches.push(answers.size),
  })
  assert.equal(found.get('SW1X 9HR')?.latitude, 51)
  assert.ok(sent.every((call) => call.url === 'https://api.postcodes.io/postcodes'))
  assert.ok(sent.every((call) => Object.keys(call.body as object).join() === 'postcodes'))
  assert.ok(sent.every((call) => (call.body as { postcodes: string[] }).postcodes.length <= 100))
  assert.equal(batches.length, 1)
  assert.equal(batches[0], 100)
  assert.ok(failed.length > 0)
  assert.ok(failed.every((postcode) => !found.has(postcode)))
  const failing = (async () => new Response('', { status: 503 })) as unknown as typeof fetch
  const down = await lookupPostcodes(['W1F 9QY'], { fetchImpl: failing })
  assert.deepEqual(down.failed, ['W1F 9QY'])
  assert.equal(down.found.size, 0)
})

test('an unreachable lookup is its own kind, never "not found"', () => {
  const placement = siteMapPlacement({ postcode: 'W1F 9QY' }, none, new Set(['W1F 9QY']))
  assert.deepEqual(placement, { kind: 'lookupFailed', postcode: 'W1F 9QY' })
  assert.ok(siteMapPlacementUnplaced(placement))
  assert.equal(siteMapUnplacedReason(placement), 'Couldn’t reach the postcode lookup — retry')
  // An answer that did arrive wins over a stale failure.
  assert.equal(
    siteMapPlacement({ postcode: 'W1F 9QY' }, new Map([['W1F 9QY', null]]), new Set(['W1F 9QY'])).kind,
    'postcodeNotFound'
  )
  assert.equal(siteMapUnplacedText(0, 2), '2 jobs are waiting for the postcode lookup — retry.')
  assert.equal(
    siteMapUnplacedText(1, 1),
    '1 job could not be placed on the map. 1 job is waiting for the postcode lookup — retry.'
  )
})

test('a job past its end date with people booked that day is shown with the toggle off', () => {
  const completed = { id: 'c', startDayKey: '2026-10-01', endDayKey: '2026-11-01' }
  const options = { includeCompleted: false, dayKey: '2026-11-24', timeZone: 'Europe/London' }
  assert.equal(siteMapJobShown(completed, options), false)
  assert.equal(siteMapJobShown(completed, { ...options, bookedThatDay: true }), true)
  assert.equal(siteMapJobShown({ ...completed, isLive: false }, { ...options, bookedThatDay: true }), false)
})

test('every Leaflet map sits in its own stacking context, under app menus and dialogs (owner bug 24 Nov)', async () => {
  const { readFileSync } = await import('node:fs')
  const css = readFileSync(new URL('../../app/brand-shell.css', import.meta.url), 'utf8')
  const rule = /\.sitemap-canvas\s*\{([^}]*)\}/.exec(css)?.[1] ?? ''
  assert.match(rule, /isolation:\s*isolate/)
  assert.match(rule, /z-index:\s*0/)
  assert.match(rule, /position:\s*relative/)
  for (const file of ['../../components/projects/SiteLocationMap.tsx', '../../components/site-map/SitePinPickerSheet.tsx']) {
    const source = readFileSync(new URL(file, import.meta.url), 'utf8')
    assert.match(source, /ref=\{(?:containerRef|mapContainerRef)\} className="relative isolate z-0/)
  }
})
