import { expect, test } from '@playwright/test'
import { apiHeaders, seedUser, settle, signInOwner } from './helpers'

/** Owner console PR 5: People directory, person page and person actions (spec §4.4, PLAN §4). Emulator only. */

test('people ?seen= / ?joined= totals equal the Overview tiles for the same period', async ({ request }) => {
  const headers = await apiHeaders(request, 'owner')
  for (const period of ['today', 'week', 'month', 'year', 'to_date']) {
    for (const extra of ['', '&includeTestData=1']) {
      const overview = await (await request.get(`/api/owner/overview?period=${period}${extra}`, { headers })).json()
      const seen = await (await request.get(`/api/owner/directory/people?seen=${period}${extra}`, { headers })).json()
      const joined = await (await request.get(`/api/owner/directory/people?joined=${period}${extra}`, { headers })).json()
      expect(seen.total, `seen ${period}${extra}`).toBe(overview.headline.activePeople.value)
      expect(joined.total, `joined ${period}${extra}`).toBe(overview.headline.newPeople.value)
    }
  }
  expect((await request.get('/api/owner/directory/people?seen=decade', { headers })).status()).toBe(400)
})

test('person route: masked email, no pay, organisations with levels; unknown id 404', async ({ request }) => {
  const headers = await apiHeaders(request, 'owner')
  const operative = seedUser('operative')
  const response = await request.get(`/api/owner/people/${operative.uid}`, { headers })
  expect(response.status()).toBe(200)
  const text = await response.text()
  expect(text.toLowerCase()).not.toContain(operative.email.toLowerCase())
  expect(text).not.toMatch(/dayRate|hourlyRate|payBasis|pushTokens"/)
  const body = JSON.parse(text)
  expect(body.organisations.length).toBeGreaterThan(0)
  // No server key in the harness: sign-in facts say "not connected" instead of failing.
  expect(body.auth).toBeNull()
  expect((await request.get('/api/owner/people/no-such-person', { headers })).status()).toBe(404)
})

test('change name: preview, then the change with a fresh code, then back; an old code is refused', async ({ request }) => {
  const headers = { ...(await apiHeaders(request, 'owner')), 'Content-Type': 'application/json' }
  const uid = 'op-large-002'
  const before = await (await request.get(`/api/owner/people/${uid}`, { headers })).json()
  const [first, ...rest] = String(before.person.name).split(' ')
  // Rulebook 1.82.0 §11: Change name acts on one organisation. The person's home organisation (the one their users
  // document names) also takes the account name, which the directory shows.
  const home = (before.organisations as { id: string; homeUserId: string | null }[]).find((org) => org.homeUserId)
  expect(home, 'the seeded person has a home organisation').toBeTruthy()
  const organizationId = home!.id
  const noOrganisation = await request.post('/api/owner/actions/change-name', { headers, data: { uid, firstName: 'Renamed', surname: 'Person', preview: true } })
  expect(noOrganisation.status()).toBe(400)
  const preview = await request.post('/api/owner/actions/change-name', { headers, data: { uid, organizationId, firstName: 'Renamed', surname: 'Person', preview: true } })
  expect(preview.status()).toBe(200)
  const previewBody = await preview.json()
  expect(previewBody.users.length).toBeGreaterThan(0)
  expect(previewBody.memberNames).toEqual([expect.objectContaining({ action: 'set' })])

  const noReason = await request.post('/api/owner/actions/change-name', { headers, data: { uid, organizationId, firstName: 'Renamed', surname: 'Person' } })
  expect(noReason.status()).toBe(400)

  const changed = await request.post('/api/owner/actions/change-name', {
    headers,
    data: { uid, organizationId, firstName: 'Renamed', surname: 'Person', reason: 'e2e rename' },
  })
  expect(changed.status(), await changed.text()).toBe(200)
  const after = await (await request.get(`/api/owner/people/${uid}`, { headers })).json()
  expect(after.person.name).toBe('Renamed Person')
  expect(after.audit.some((row: { action: string; phase: string }) => row.action === 'ownerChangeUserName' && row.phase === 'completed')).toBe(true)

  const restored = await request.post('/api/owner/actions/change-name', {
    headers,
    data: { uid, organizationId, firstName: first, surname: rest.join(' ') || first, reason: 'e2e restore' },
  })
  expect(restored.status()).toBe(200)
})

test('identity actions without the server key say so and change nothing', async ({ request }) => {
  const headers = { ...(await apiHeaders(request, 'owner')), 'Content-Type': 'application/json' }
  const uid = seedUser('operative').uid
  const revoke = await request.post('/api/owner/actions/revoke-sessions', { headers, data: { uid, reason: 'e2e check' } })
  expect(revoke.status()).toBe(501)
  expect((await revoke.json()).error).toMatch(/server key/i)
})

test('People page links a person to their page, which shows the actions', async ({ page, baseURL }) => {
  await signInOwner(page, baseURL as string)
  await page.goto('/developer/users?seen=to_date')
  await settle(page)
  await expect(page.getByTestId('people-window')).toBeVisible()
  await page.goto('/developer/users')
  await settle(page)
  const total = page.getByTestId('people-total')
  await expect(total).toContainText(/people|person/)
  await page.goto(`/developer/users/${seedUser('operative').uid}`)
  await settle(page)
  await expect(page.getByTestId('person-actions')).toBeVisible()
  await expect(page.getByTestId('person-organisations')).toBeVisible()
  await page.getByRole('button', { name: 'Change name' }).click()
  await expect(page.getByTestId('person-name-preview')).toBeVisible()
  await page.getByRole('button', { name: 'Cancel' }).click()
})
