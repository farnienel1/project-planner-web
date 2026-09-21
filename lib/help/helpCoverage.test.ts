import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { allDashboardNavHrefs } from '../navigation/dashboardNavigation.ts'

test('Help has a click-through for every dashboard menu destination', () => {
  const source = readFileSync(new URL('../../components/help/HelpSupportScreen.tsx', import.meta.url), 'utf8')
  const helpHrefs = [...source.matchAll(/href: '([^']+)'/g)].map((match) => match[1].split('?')[0])
  const missing = allDashboardNavHrefs().filter((href) => {
    const path = href.split('?')[0]
    if (path === '/dashboard/help') return false
    return !helpHrefs.some((helpHref) => {
      if (helpHref === '/dashboard') return path === '/dashboard'
      return path === helpHref || path.startsWith(`${helpHref}/`)
    })
  })
  assert.deepEqual(missing, [])
})

test('Help does not mention Firebase sync', () => {
  const source = readFileSync(new URL('../../components/help/HelpSupportScreen.tsx', import.meta.url), 'utf8')
  assert.equal(/firebase sync/i.test(source), false)
})
