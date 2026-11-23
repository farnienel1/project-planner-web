import { expect, test, type APIRequestContext, type Page } from '@playwright/test'
import { SEED_PASSWORD, SEED_PROJECT_ID } from '../../scripts/owner-console-seed/seedConstants.mjs'
import { toRestFields } from '../../scripts/owner-console-seed/restValues.mjs'
import { addMfaCookie, seedUser } from './helpers'

/**
 * Rulebook 1.41.0 §21: a person-day with two bookings on a job's scheduling week is one tile ("… · 2 bookings").
 * Opening it lists both bookings, and each opens its own edit sheet (owner report 23 Nov: "it just shows the one").
 * The project and the two bookings are written straight to the Firestore emulator (never production).
 */
const firestoreHost = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080'
const ORG = 'org-large'
const PROJECT = 'proj-e2e-two-bookings'
const SMALL_WORK = 'sw-e2e-two-bookings'
/** The person with two bookings is near the bottom of a tall grid (rows sort by name), so a chooser that is not
 * centred on the screen would open out of sight. */
const OPERATIVE = 'op-large-030'
const OTHER_OPERATIVES = Array.from({ length: 29 }, (_, i) => `op-large-${String(i + 1).padStart(3, '0')}`)

/** Wednesday of the current Monday–Sunday week, as organisation-zone (London) midnight in November = UTC midnight. */
function wednesdayThisWeek(): Date {
  const now = new Date()
  const day = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const isoWeekday = day.getUTCDay() === 0 ? 7 : day.getUTCDay()
  day.setUTCDate(day.getUTCDate() - (isoWeekday - 1) + 2)
  return day
}

/** Writes one document (or, with `merge`, only the given fields) straight to the emulator, bypassing the rules. */
async function put(request: APIRequestContext, path: string, data: Record<string, unknown>, merge = false) {
  const name = `projects/${SEED_PROJECT_ID}/databases/(default)/documents/${path}`
  const write: Record<string, unknown> = { update: { name, fields: toRestFields(data) } }
  if (merge) write.updateMask = { fieldPaths: Object.keys(data) }
  const response = await request.post(`http://${firestoreHost}/v1/projects/${SEED_PROJECT_ID}/databases/(default)/documents:commit`, {
    headers: { Authorization: 'Bearer owner' },
    data: { writes: [write] },
  })
  expect(response.ok(), await response.text()).toBeTruthy()
}

async function seedAndSignIn(page: Page, request: APIRequestContext, baseURL: string) {
  const date = wednesdayThisWeek()
  const created = new Date(date.getTime() - 7 * 24 * 3600_000)
  await put(request, `organizations/${ORG}/projects/${PROJECT}`, {
    jobNumber: 'J-2B',
    siteName: 'Two Bookings Site',
    jobType: 'CAT A',
    startDate: created,
    endDate: new Date(date.getTime() + 30 * 24 * 3600_000),
    managerIds: ['su-large'],
    managerUserIds: ['su-large'],
    managerId: 'su-large',
    isLive: true,
    organizationId: ORG,
    createdAt: created,
  })
  const booking = (start: string, end: string, operativeId = OPERATIVE) => ({
    operativeId,
    projectId: PROJECT,
    jobCollection: 'projects',
    date,
    timeSlot: 'CUSTOM',
    workStartTime: start,
    workEndTime: end,
    status: 'Confirmed',
    bookedBy: 'Sam Super',
    createdAt: created,
    updatedAt: created,
  })
  await put(request, `organizations/${ORG}/bookings/bk-e2e-two-a`, booking('07:00', '15:00'))
  await put(request, `organizations/${ORG}/bookings/bk-e2e-two-b`, booking('15:00', '20:00'))
  // A manager or admin booked twice on the job: once as labour, once from their own schedule (a manager site booking).
  await put(request, `organizations/${ORG}/bookings/bk-e2e-admin-labour`, booking('06:00', '12:00', 'su-large'))
  await put(request, `organizations/${ORG}/managerSiteBookings/msb-e2e-admin-site`, {
    userId: 'su-large',
    date,
    timeSlot: 'CUSTOM',
    workStartTime: '13:00',
    workEndTime: '18:00',
    locationType: 'project',
    locationId: PROJECT,
    createdAt: created,
    updatedAt: created,
  })
  // The same two-booking day on a small works job (its own collection and page).
  await put(request, `organizations/${ORG}/smallWorks/${SMALL_WORK}`, {
    jobNumber: 'SW-2B',
    siteName: 'Two Bookings Small Works',
    jobType: 'Small Works',
    startDate: created,
    endDate: new Date(date.getTime() + 30 * 24 * 3600_000),
    managerIds: ['su-large'],
    managerUserIds: ['su-large'],
    managerId: 'su-large',
    isLive: true,
    organizationId: ORG,
    createdAt: created,
  })
  for (const [id, start, end] of [['bk-e2e-sw-a', '07:00', '15:00'], ['bk-e2e-sw-b', '15:00', '20:00']] as const) {
    await put(request, `organizations/${ORG}/bookings/${id}`, { ...booking(start, end), projectId: SMALL_WORK, jobCollection: 'smallWorks' })
  }
  for (const other of OTHER_OPERATIVES) {
    await put(request, `organizations/${ORG}/bookings/bk-e2e-one-${other}`, booking('07:00', '16:00', other))
  }
  // The Super Admin has accepted the current customer terms (lib/legal/customerLegalPack.ts LEGAL_ENTITY.version),
  // so the legal pack gate lets the dashboard through.
  await put(request, `users/${seedUser('superAdmin').uid}`, { policyAccepted: true, policyAcceptedAt: created, legalPackVersion: '1.1', legalPackAcceptedAt: created }, true)

  await page.goto('/login')
  await page.locator('input[type="email"]').first().fill(seedUser('superAdmin').email)
  await page.locator('input[type="password"]').first().fill(SEED_PASSWORD)
  await page.getByRole('button', { name: /^sign in$/i }).click()
  await page.waitForURL(/\/auth\/mfa/)
  await addMfaCookie(page.context(), baseURL, seedUser('superAdmin').uid)
  await page.goto('/auth/mfa?next=%2Fdashboard')
  await page.waitForURL(/\/dashboard/)
  // The first-visit usage analytics banner sits over the bottom of the screen; answer it like a person would.
  const consent = page.getByRole('dialog', { name: 'Usage analytics' })
  await consent.getByRole('button', { name: 'Reject' }).click({ timeout: 10_000 }).catch(() => undefined)
}

/** Opens the chooser of `name`'s two-booking tile (on a project two people have one on this day). */
async function openChooser(page: Page, name: RegExp) {
  const tiles = page.locator('button[data-booking-count="2"]')
  await expect(tiles.first()).toBeVisible()
  const chooser = page.getByRole('dialog', { name })
  for (let i = 0; i < (await tiles.count()); i += 1) {
    await expect(tiles.nth(i)).toContainText('2 bookings')
    await tiles.nth(i).click()
    const opened = page.getByRole('dialog').filter({ has: page.getByTestId('schedule-day-chooser-row') })
    await expect(opened).toBeVisible()
    if (await chooser.isVisible()) return chooser
    await opened.getByRole('button', { name: 'Close' }).click()
    await expect(opened).toBeHidden()
  }
  throw new Error(`no two-booking tile opens a chooser for ${name}`)
}

/** Every booking of the person-day is listed, on screen, and opens its own edit sheet. */
async function expectEveryBookingReachable(page: Page, name: RegExp, times: readonly [string, string]) {
  for (const [index, range] of times.entries()) {
    const chooser = await openChooser(page, name)
    const rows = chooser.getByTestId('schedule-day-chooser-row')
    await expect(rows).toHaveCount(2)
    // On screen where the person tapped, without scrolling: the chooser covers the viewport, not its card.
    await expect(rows.nth(0)).toBeInViewport()
    await expect(rows.nth(1)).toBeInViewport()
    // A real click that must land on the row (Playwright refuses when something covers it).
    await rows.nth(index).click()
    await expect(chooser).toBeHidden()
    await expect(page.getByText('Edit booking', { exact: true })).toBeVisible()
    await expect(page.getByText(new RegExp(`^${range} ·`))).toBeVisible()
    await page.getByRole('button', { name: 'Close' }).first().click()
    await expect(page.getByText('Edit booking', { exact: true })).toBeHidden()
  }
}

const OPERATIVE_DAY = [/Olly Operative 030/, ['07:00–15:00', '15:00–20:00']] as const
const ADMIN_DAY = [/Sam Super/, ['06:00–12:00', '13:00–18:00']] as const

test('scheduling page: a person-day with two bookings lists both, each opening its own booking', async ({ page, request, baseURL }) => {
  await seedAndSignIn(page, request, baseURL as string)
  await page.goto(`/dashboard/projects/${PROJECT}/schedule`)
  await expectEveryBookingReachable(page, ...OPERATIVE_DAY)
})

test('project Overview "This week on site": a person-day with two bookings lists both', async ({ page, request, baseURL }) => {
  await seedAndSignIn(page, request, baseURL as string)
  await page.goto(`/dashboard/projects/${PROJECT}`)
  await expectEveryBookingReachable(page, ...OPERATIVE_DAY)
})

test('phone width: the scheduling page chooser lists both bookings', async ({ page, request, baseURL }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await seedAndSignIn(page, request, baseURL as string)
  await page.goto(`/dashboard/projects/${PROJECT}/schedule`)
  await expectEveryBookingReachable(page, ...OPERATIVE_DAY)
})

test('a labour booking and a manager site booking on one day are one tile listing both', async ({ page, request, baseURL }) => {
  await seedAndSignIn(page, request, baseURL as string)
  await page.goto(`/dashboard/projects/${PROJECT}/schedule`)
  await expectEveryBookingReachable(page, ...ADMIN_DAY)
})

test('small works scheduling page: a person-day with two bookings lists both', async ({ page, request, baseURL }) => {
  await seedAndSignIn(page, request, baseURL as string)
  await page.goto(`/dashboard/small-works/${SMALL_WORK}/schedule`)
  await expectEveryBookingReachable(page, ...OPERATIVE_DAY)
})
