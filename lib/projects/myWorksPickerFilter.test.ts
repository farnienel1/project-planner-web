import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { Project } from '../../types/index.ts'
import { myWorksPicksAfterToggle } from '../canonical/index.ts'
import {
  MY_WORKS_PICKER_DEFAULT_TAB,
  MY_WORKS_PICKER_TABS,
  myWorksPickerCounts,
  myWorksPickerShownJobs,
} from './myWorksPickerFilter.ts'

// Owner request 10 Nov: the My Projects / My Small works ⚙ picker filter. Tabs are rulebook §21 (`worksInTab`,
// `worksTabCounts`) on the organisation day; an inactive job is under Completed.
const TZ = 'Europe/London'
const TODAY = '2026-11-03'

function job(id: string, fields: Partial<Project> & { startDayKey: string; endDayKey: string }): Project {
  return { id, jobNumber: id, siteName: '', isLive: true, ...fields } as unknown as Project
}

const jobs: Project[] = [
  job('P-OFF', { siteName: 'Old Mill', isLive: false, startDayKey: '2026-11-01', endDayKey: '2026-11-30' }),
  job('P-LIVE', { siteName: 'High Street', startDayKey: '2026-11-01', endDayKey: '2026-11-30' }),
  job('P-LATER', { siteName: 'High Barn', startDayKey: '2026-12-01', endDayKey: '2026-12-05' }),
  job('P-DONE', { siteName: 'Quay', startDayKey: '2026-10-01', endDayKey: '2026-10-20' }),
]

const shown = (tab: (typeof MY_WORKS_PICKER_TABS)[number]['tab'], search = '') =>
  myWorksPickerShownJobs(jobs, tab, search, TODAY, TZ).map((j) => j.id)

test('chips are All, Active, Upcoming, Completed and All is the default', () => {
  assert.deepEqual(
    MY_WORKS_PICKER_TABS.map((t) => t.label),
    ['All', 'Active', 'Upcoming', 'Completed']
  )
  assert.equal(MY_WORKS_PICKER_DEFAULT_TAB, 'all')
})

test('each chip shows the rulebook tab, in list order', () => {
  assert.deepEqual(shown('all'), ['P-OFF', 'P-LIVE', 'P-LATER', 'P-DONE'])
  assert.deepEqual(shown('active'), ['P-LIVE'])
  assert.deepEqual(shown('upcoming'), ['P-LATER'])
  assert.deepEqual(shown('completed'), ['P-OFF', 'P-DONE'])
})

test('search narrows within the chip', () => {
  assert.deepEqual(shown('all', 'high'), ['P-LIVE', 'P-LATER'])
  assert.deepEqual(shown('upcoming', '  HIGH '), ['P-LATER'])
  assert.deepEqual(shown('completed', 'high'), [])
  assert.deepEqual(shown('completed', 'p-done'), ['P-DONE'])
})

test('counts are worksTabCounts over every listed job', () => {
  assert.deepEqual(myWorksPickerCounts(jobs, TODAY, TZ), { all: 4, active: 1, upcoming: 1, completed: 2 })
})

test('ticks survive a chip change: the chip only narrows what is shown', () => {
  let ids: string[] = []
  ids = myWorksPicksAfterToggle(ids, 'P-LIVE', true)
  ids = myWorksPicksAfterToggle(ids, 'P-DONE', true)
  assert.equal(shown('upcoming').includes('P-LIVE'), false)
  assert.deepEqual(ids, ['P-LIVE', 'P-DONE'])
})
