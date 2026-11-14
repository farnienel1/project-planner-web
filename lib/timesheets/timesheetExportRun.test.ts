import { test } from 'node:test'
import assert from 'node:assert/strict'
import { runTimesheetExport } from './timesheetExportRun.ts'

type Member = { id: string; name: string; exported?: boolean }
const members: Member[] = [
  { id: 'a', name: 'Ann' },
  { id: 'b', name: 'Bob', exported: true },
  { id: 'c', name: 'Cat' },
]

function harness(options: { gateClosesAfter?: number; stampFailsOn?: string } = {}) {
  const log: string[] = []
  let gateChecks = 0
  return {
    log,
    input: {
      members,
      memberId: (m: Member) => m.id,
      memberName: (m: Member) => m.name,
      gateReady: () => {
        gateChecks += 1
        return options.gateClosesAfter == null || gateChecks <= options.gateClosesAfter
      },
      prepare: async (m: Member) => (m.exported ? { skip: 'exported' as const } : `sheet-${m.id}`),
      stamp: async (row: { memberId: string }) => {
        if (row.memberId === options.stampFailsOn) throw new Error('write refused')
        log.push(`stamp:${row.memberId}`)
      },
      deliver: async (rows: ReadonlyArray<{ memberId: string; sheet: string }>) => {
        log.push(`deliver:${rows.map((row) => row.sheet).join(',')}`)
      },
      forgetHistory: () => log.push('forget'),
    },
  }
}

test('export: every sheet prepared, then stamped, then delivered; already-exported sheets left alone', async () => {
  const { log, input } = harness()
  const result = await runTimesheetExport(input)
  assert.deepEqual(log, ['stamp:a', 'stamp:c', 'forget', 'deliver:sheet-a,sheet-c'])
  assert.deepEqual(result.skipped, ['Bob'])
  assert.equal(result.stopped, null)
})

test('review r318: a gate that closes while preparing stops the export before anyone is stamped', async () => {
  const { log, input } = harness({ gateClosesAfter: 2 })
  const result = await runTimesheetExport(input)
  assert.deepEqual(log, [])
  assert.deepEqual(result.stamped, [])
  assert.equal(result.stopped?.reason, 'gate')
})

test('review r318: a stamp that fails part-way still delivers and forgets history for the sheets already stamped', async () => {
  const { log, input } = harness({ stampFailsOn: 'c' })
  const result = await runTimesheetExport(input)
  assert.deepEqual(log, ['stamp:a', 'forget', 'deliver:sheet-a'])
  assert.deepEqual(result.stamped.map((row) => row.memberId), ['a'])
  assert.equal(result.stopped?.reason, 'stamp')
})
