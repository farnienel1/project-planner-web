import { test } from 'node:test'
import assert from 'node:assert/strict'
import { EXPORT_RECOVER_HINT, exportSummaryMessage, runTimesheetExport } from './timesheetExportRun.ts'

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

test('review r318: after stamping, the message is a summary — never "Export failed."', () => {
  const base = { emailProblem: null, recipientEmail: 'lm@example.test', backupSkipped: [], skipped: [], stampError: null }
  assert.equal(
    exportSummaryMessage({ ...base, stamped: ['Ann', 'Cat'], notSent: [], sentCount: 2 }),
    '2 exported. Sent: 2 emailed to lm@example.test for filing.'
  )
  const partial = exportSummaryMessage({ ...base, stamped: ['Ann', 'Cat'], notSent: ['Cat (pdf build failed)'], sentCount: 1 })
  assert.match(partial, /^2 exported\. Sent: 1 emailed/)
  assert.match(partial, /Couldn't send: Cat \(pdf build failed\)\./)
  assert.ok(partial.endsWith(EXPORT_RECOVER_HINT))
  const emailDown = exportSummaryMessage({ ...base, stamped: ['Ann'], notSent: [], sentCount: 1, emailProblem: 'mail service down' })
  assert.match(emailDown, /Couldn't send: the email \(mail service down\)/)
  assert.doesNotMatch(emailDown, /Export failed/)
  assert.match(exportSummaryMessage({ ...base, stamped: [], notSent: [], sentCount: 0, skipped: ['Bob'] }), /Already exported, left as it was: Bob/)
})

test('review r318: Download PDF warns only for an exported sheet with no saved snapshot', async () => {
  const { exportedPdfIsRebuilt, exportRebuiltPdfNote, EXPORT_REBUILT_CONFIRM } = await import('./timesheetExportRun.ts')
  assert.equal(exportedPdfIsRebuilt({ weeklyReportOverride: null }), true)
  assert.equal(exportedPdfIsRebuilt({}), true)
  assert.equal(exportedPdfIsRebuilt(null), true)
  assert.equal(exportedPdfIsRebuilt({ weeklyReportOverride: { lines: [] } }), false)
  assert.equal(exportRebuiltPdfNote('14 Nov 2026'), 'Rebuilt on 14 Nov 2026 — may differ from the original export.')
  assert.match(EXPORT_REBUILT_CONFIRM, /rebuilt from today's bookings and rates/)
})
