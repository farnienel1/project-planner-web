import assert from 'node:assert/strict'
import test from 'node:test'
import { OFFICE_VIEW_RADIUS_MILES, officeCentreFromOrganization, radiusBounds, siteMapJobSummary } from './siteMapView'

test('the office pin comes from Company details; missing, zero or out of range is none', () => {
  assert.deepEqual(officeCentreFromOrganization({ defaultLatitude: 51.5, defaultLongitude: -0.12 }), { latitude: 51.5, longitude: -0.12 })
  assert.equal(officeCentreFromOrganization({}), null)
  assert.equal(officeCentreFromOrganization({ defaultLatitude: 0, defaultLongitude: 0 }), null)
  assert.equal(officeCentreFromOrganization({ defaultLatitude: 95, defaultLongitude: 1 }), null)
  assert.equal(officeCentreFromOrganization(null), null)
})

test('the office view is about 10 miles each way', () => {
  const [[s, w], [n, e]] = radiusBounds({ latitude: 52, longitude: -1 })
  const milesNS = ((n - s) / 2) * 111.32 / 1.609344
  const milesEW = ((e - w) / 2) * 111.32 * Math.cos((52 * Math.PI) / 180) / 1.609344
  assert.ok(Math.abs(milesNS - OFFICE_VIEW_RADIUS_MILES) < 0.01)
  assert.ok(Math.abs(milesEW - OFFICE_VIEW_RADIUS_MILES) < 0.01)
})

test('the summary reads the Daily Overview job card and the pin people count, nothing priced again', () => {
  const model = {
    projectCards: [
      {
        project: { id: 'ABC-1' },
        bookedHours: 26,
        overtimeClockHours: 4,
        overtimeMultiplier: 1.5,
      },
    ],
    holidays: [{}, {}],
  } as unknown as Parameters<typeof siteMapJobSummary>[0]['model']
  assert.deepEqual(siteMapJobSummary({ jobId: 'abc-1', peopleOnSite: 3, model }), {
    peopleOnSite: 3,
    hoursOnSite: 26,
    overtimeClockHours: 4,
    overtimeMultiplier: 1.5,
    onAnnualLeave: 2,
  })
  assert.deepEqual(siteMapJobSummary({ jobId: 'other', peopleOnSite: 0, model }), {
    peopleOnSite: 0,
    hoursOnSite: 0,
    overtimeClockHours: 0,
    overtimeMultiplier: null,
    onAnnualLeave: 2,
  })
  assert.equal(siteMapJobSummary({ jobId: 'x', peopleOnSite: 1, model: null }).onAnnualLeave, 0)
})
