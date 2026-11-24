/** Owner console Status page (owner request 24 Nov): the pure parts. */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildInfo,
  compareLiveRules,
  emailLogSummary,
  firestoreConsoleDocUrl,
  functionErrorsFilter,
  functionErrorsSummary,
  platformConfigStatus,
} from './platformStatus.ts'
import { CONSOLE_NAV, visibleConsoleNav } from './consoleNav.ts'
import { liveRulesForTarget } from './statusServer.ts'

const sha = 'a'.repeat(40)

test('build: runtime Netlify commit first, then the value baked in at build; a bad commit is not shown', () => {
  const fromRuntime = buildInfo({ COMMIT_REF: sha, DEPLOY_ID: 'd1', CONTEXT: 'production' }, { OWNER_BUILD_COMMIT: 'b'.repeat(40), OWNER_BUILD_TIME: '2026-11-24T10:00:00.000Z' })
  assert.equal(fromRuntime.commit, sha)
  assert.equal(fromRuntime.source, 'runtime')
  assert.equal(fromRuntime.commitShort, 'aaaaaaa')
  assert.match(fromRuntime.commitUrl || '', /\/commit\/a{40}$/)
  assert.equal(fromRuntime.deployId, 'd1')
  assert.equal(fromRuntime.builtAt, '2026-11-24T10:00:00.000Z')
  const baked = buildInfo({}, { OWNER_BUILD_COMMIT: 'b'.repeat(40), OWNER_BUILD_DEPLOY_ID: 'd2' })
  assert.equal(baked.source, 'build')
  assert.equal(baked.deployId, 'd2')
  const none = buildInfo({}, { OWNER_BUILD_COMMIT: 'not a sha; rm -rf' })
  assert.equal(none.commit, null)
  assert.equal(none.commitUrl, null)
  assert.equal(none.source, null)
})

test('rules: matches, differs, more than one file, no release, no build hash', () => {
  const release = { rulesetName: 'projects/p/rulesets/abc', updateTime: '2026-11-20T00:00:00Z' }
  const base = { label: 'Firestore' as const, releaseId: 'cloud.firestore', release, liveFileCount: 1 }
  assert.equal(compareLiveRules({ ...base, liveContentSha: 'x', buildSha: 'x' }).matches, true)
  assert.equal(compareLiveRules({ ...base, liveContentSha: 'x', buildSha: 'y' }).matches, false)
  assert.equal(compareLiveRules({ ...base, liveContentSha: null, liveFileCount: 2, buildSha: 'y' }).matches, false)
  assert.equal(compareLiveRules({ ...base, release: null, liveContentSha: null, buildSha: 'y' }).matches, null)
  const noBuild = compareLiveRules({ ...base, liveContentSha: 'x', buildSha: null })
  assert.equal(noBuild.matches, null)
  assert.equal(noBuild.rulesetId, 'abc')
  assert.equal(noBuild.releasedAt, '2026-11-20T00:00:00Z')
})

test('platformConfig/app: minimum builds and switches read like securitySwitchOn (exactly true, or listed ids)', () => {
  const status = platformConfigStatus({
    minimumIosBuild: 10,
    minimumWebVersion: '1.80.0',
    enforcedReads: true,
    privatePay: 'yes',
    privatePayOrganizationIds: ['o1', 'o2', ''],
    ghostAccountsOrganizationIds: ['o3'],
    organizationErasureEnabled: false,
  })
  assert.equal(status.minimumIosBuild, 10)
  assert.equal(status.minimumWebVersion, '1.80.0')
  const byField = Object.fromEntries(status.switches.map((row) => [row.field, row.state]))
  assert.equal(byField.enforcedReads, 'On everywhere')
  assert.equal(byField.privatePay, 'On for 2 organisations')
  assert.equal(byField.ghostAccounts, 'On for 1 organisation')
  assert.equal(byField.operativeOwnLeave, 'Off')
  assert.equal(byField.organizationErasureEnabled, 'Off')
  const empty = platformConfigStatus(null)
  assert.equal(empty.minimumIosBuild, null)
  assert.ok(empty.switches.every((row) => row.on === 'off'))
})

test('email log: failures counted by type, last failure; sent rows only counted in the total', () => {
  const summary = emailLogSummary([
    { type: 'invite', status: 'sent', at: new Date('2026-11-23T10:00:00Z') },
    { type: 'invite', status: 'failed', at: new Date('2026-11-23T11:00:00Z') },
    { type: 'material_request', status: 'failed', at: new Date('2026-11-24T09:00:00Z') },
    { type: 'invite', status: 'failed', at: new Date('2026-11-22T09:00:00Z') },
    { status: 'deduped' },
  ])
  assert.equal(summary.total, 5)
  assert.equal(summary.failed, 3)
  assert.deepEqual(summary.failedByType, [
    { type: 'invite', count: 2 },
    { type: 'material_request', count: 1 },
  ])
  assert.equal(summary.lastFailedAt, '2026-11-24T09:00:00.000Z')
})

test('function errors: grouped by function (1st and 2nd gen), no message kept', () => {
  const summary = functionErrorsSummary([
    { timestamp: '2026-11-24T10:00:00Z', resource: { labels: { function_name: 'sendEmail' } }, textPayload: 'jane@x.com failed' },
    { timestamp: '2026-11-24T11:00:00Z', resource: { labels: { function_name: 'sendEmail' } } },
    { timestamp: '2026-11-23T11:00:00Z', resource: { labels: { service_name: 'authclaimsonuserwrite' } } },
  ])
  assert.equal(summary.total, 3)
  assert.deepEqual(summary.byFunction, [
    { name: 'sendEmail', count: 2, lastAt: '2026-11-24T11:00:00.000Z' },
    { name: 'authclaimsonuserwrite', count: 1, lastAt: '2026-11-23T11:00:00.000Z' },
  ])
  assert.equal(JSON.stringify(summary).includes('jane@'), false)
  assert.match(functionErrorsFilter(new Date('2026-11-17T00:00:00Z')), /severity>=ERROR AND timestamp>="2026-11-17T00:00:00.000Z"/)
})

test('console links and the Status menu item', () => {
  assert.equal(
    firestoreConsoleDocUrl('p1', 'platformConfig/app'),
    'https://console.firebase.google.com/project/p1/firestore/databases/-default-/data/~2FplatformConfig~2Fapp'
  )
  const platform = visibleConsoleNav(CONSOLE_NAV).find((group) => group.id === 'platform')
  assert.ok(platform?.items.some((item) => item.label === 'Status' && item.href === '/developer/status'))
})

test('live rules: only 200 or 404 are answers; 429, 5xx, network and refusals are Not connected (review of #445, 3)', async () => {
  const target = { label: 'Firestore' as const, releaseId: 'cloud.firestore', buildSha: 'x' }
  const answer = (map: Record<string, { status: number; body: Record<string, unknown> | null }>) => async (url: string) =>
    map[url.includes('/rulesets/') ? 'ruleset' : 'release']
  const ok = { status: 200, body: { rulesetName: 'projects/p/rulesets/r1', updateTime: '2026-11-24T00:00:00Z' } }
  for (const status of [0, 429, 500, 503]) {
    const viaRelease = await liveRulesForTarget(answer({ release: { status, body: null }, ruleset: { status: 200, body: {} } }), 'p', target)
    assert.deepEqual('connected' in viaRelease && viaRelease.connected, false, `release ${status}`)
    const viaRuleset = await liveRulesForTarget(answer({ release: ok, ruleset: { status, body: null } }), 'p', target)
    assert.deepEqual('connected' in viaRuleset && viaRuleset.connected, false, `ruleset ${status}`)
  }
  const refused = await liveRulesForTarget(answer({ release: { status: 403, body: null }, ruleset: ok }), 'p', target)
  assert.match('reason' in refused ? refused.reason : '', /Rules Viewer/)
  const none = await liveRulesForTarget(answer({ release: { status: 404, body: null }, ruleset: ok }), 'p', target)
  assert.ok(!('connected' in none) && none.matches === null && /No live release/.test(none.note || ''))
  const content = 'rules_version = "2";'
  const { createHash } = await import('node:crypto')
  const match = await liveRulesForTarget(
    answer({ release: ok, ruleset: { status: 200, body: { source: { files: [{ content }] } } } }),
    'p',
    { ...target, buildSha: createHash('sha256').update(content, 'utf8').digest('hex') }
  )
  assert.ok(!('connected' in match) && match.matches === true)
})
