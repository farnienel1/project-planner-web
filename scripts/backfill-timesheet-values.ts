/**
 * Dry-run by default. Prints how many fully signed timesheets would be valued.
 * A live write needs the Admin SDK and FIREBASE_SERVICE_ACCOUNT_JSON.
 *
 *   npx tsx scripts/backfill-timesheet-values.ts
 *   npx tsx scripts/backfill-timesheet-values.ts --write
 */
import { computeTimesheetValue } from '../lib/timesheets/timesheetValue'

const write = process.argv.includes('--write')

function main() {
  const sample = computeTimesheetValue({
    currentDayRatePence: 18000,
    days: [{ date: '2026-09-14', kind: 'full' }],
  })
  console.log(
    JSON.stringify(
      {
        mode: write ? 'write' : 'dry-run',
        note: 'Live enumeration of organizations/*/settings timesheet docs needs the Admin SDK. This dry run confirms the formula only.',
        samplePence: sample.valuePence,
        sampleMissingRate: sample.valueMissingRate,
      },
      null,
      2
    )
  )
  if (write) {
    console.error('Refusing to write without FIREBASE_SERVICE_ACCOUNT_JSON. Re-run after that is configured.')
    process.exitCode = 1
  }
}

main()
