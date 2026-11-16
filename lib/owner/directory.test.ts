import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  DIRECTORY_PAGE_DEFAULT,
  DIRECTORY_PAGE_MAX,
  decodeDirectoryCursor,
  directoryLimit,
  encodeDirectoryCursor,
  oneOf,
  ownerOrgRow,
  ownerPeopleRows,
  ownerSearch,
  pageRows,
  selectOwnerOrgs,
  OWNER_ORG_FILTERS,
} from './directory.ts'

test('paging walks every row once, and a bad cursor is the first page', () => {
  const rows = Array.from({ length: 125 }, (_, i) => i)
  const seen: number[] = []
  let cursor: string | null = null
  do {
    const page = pageRows(rows, cursor, 50)
    seen.push(...page.rows)
    cursor = page.nextCursor
  } while (cursor)
  assert.deepEqual(seen, rows)
  assert.equal(decodeDirectoryCursor('not-a-cursor'), 0)
  assert.equal(decodeDirectoryCursor(encodeDirectoryCursor(-4)), 0)
  assert.deepEqual(pageRows([], null).rows, [])
  assert.equal(pageRows([], null).nextCursor, null)
})

test('limits and allowed values are clamped, never trusted', () => {
  assert.equal(directoryLimit('abc'), DIRECTORY_PAGE_DEFAULT)
  assert.equal(directoryLimit(0), DIRECTORY_PAGE_DEFAULT)
  assert.equal(directoryLimit(1e9), DIRECTORY_PAGE_MAX)
  assert.equal(oneOf('lapsed', OWNER_ORG_FILTERS, 'all'), 'lapsed')
  assert.equal(oneOf('drop table', OWNER_ORG_FILTERS, 'all'), 'all')
})

test('an organisation row: missing billing is open (never lapsed), past_due inside grace is open', () => {
  const now = Date.parse('2026-11-16T12:00:00Z')
  assert.equal(ownerOrgRow({ id: 'a', data: { name: 'A' } }, now)?.lapsed, false)
  assert.equal(ownerOrgRow({ id: 'b', data: { name: 'B', billing: { status: 'past_due', lastPaymentFailedAt: new Date(now - 86400000) } } }, now)?.lapsed, false)
  assert.equal(ownerOrgRow({ id: 'c', data: { name: 'C', billing: { status: 'canceled' } } }, now)?.lapsed, true)
  assert.equal(ownerOrgRow({ id: 'platform-owner', data: {} }, now), null)
  const unnamed = ownerOrgRow({ id: 'd', data: {} }, now)
  assert.equal(unnamed?.name, 'Unnamed organisation')
  assert.equal(unnamed?.unfinished, true)
})

test('long names, huge member maps and zero values survive', () => {
  const members = Object.fromEntries(Array.from({ length: 5000 }, (_, i) => [`u${i}`, 'operative']))
  const row = ownerOrgRow({ id: 'big', data: { name: 'N'.repeat(400), members } })
  assert.equal(row?.memberCount, 5000)
  assert.equal(row?.name.length, 400)
  assert.equal(selectOwnerOrgs(row ? [row] : [], { q: 'nnn' }).total, 1)
})

test('people: blank emails never fold two people together', () => {
  const rows = ownerPeopleRows(
    [
      { id: 'g1', data: { firstName: 'Gus', email: '', organizationId: 'o1', ghost: true } },
      { id: 'g2', data: { firstName: 'Gil', email: '', organizationId: 'o1', ghost: true } },
    ],
    [{ id: 'o1', name: 'One', isTest: false }]
  )
  assert.equal(rows.length, 2)
  assert.equal(rows[0].emailMasked, '')
})

test('search needs two characters and never matches on the masked text alone', () => {
  const orgs = [ownerOrgRow({ id: 'o1', data: { name: 'Acme' } })!]
  assert.deepEqual(ownerSearch(orgs, [], 'a', true).organisations, [])
  assert.equal(ownerSearch(orgs, [], 'acm', true).organisations.length, 1)
  assert.equal(ownerSearch(orgs, [], 'o1', true).organisations.length, 1)
})
