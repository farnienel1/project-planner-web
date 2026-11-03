import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { appVersionLabel } from './appVersion.ts'

test('appVersionLabel shows the package.json version', () => {
  const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')) as { version: string }
  assert.equal(appVersionLabel(pkg.version), `Project Planner · v${pkg.version}`)
  assert.equal(appVersionLabel(undefined), 'Project Planner')
  assert.equal(appVersionLabel('  '), 'Project Planner')
})
