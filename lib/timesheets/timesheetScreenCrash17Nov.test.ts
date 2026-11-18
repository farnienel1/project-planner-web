/**
 * 17 Nov live bug: User Timesheets went into "Something went wrong on this screen" as soon as one sheet was listed.
 * `useSnapshotAutoRepair` calls its `payStatusOf` while rendering (`payKey`), and TimesheetsScreen passed a closure over
 * `payStatusFor`, a `const` declared further down the component — "Cannot access 'payStatusFor' before initialization"
 * on the first render with a listed sheet (reproduced with the real component in a DOM harness; see the PR).
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const read = (relative: string) => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8')

test('17 Nov: TimesheetsScreen declares payStatusFor before useSnapshotAutoRepair reads it while rendering', () => {
  const source = read('../../components/timesheets/TimesheetsScreen.tsx')
  const declared = source.indexOf('const payStatusFor =')
  const hook = source.indexOf('useSnapshotAutoRepair({')
  assert.ok(declared > 0, 'payStatusFor is declared')
  assert.ok(hook > 0, 'useSnapshotAutoRepair is called')
  assert.ok(declared < hook, 'payStatusFor must be declared before useSnapshotAutoRepair (it is called during render)')
})

test('17 Nov: useSnapshotAutoRepair still reads payStatusOf during render (the reason the order matters)', () => {
  const source = read('./useSnapshotAutoRepair.ts')
  assert.match(source, /const payKey = sheets\.map\(\(sheet\) => `\$\{sheet\.member\.id\}:\$\{input\.payStatusOf\(sheet\.member\)\}`\)/)
})

test('17 Nov: every timesheet screen in the hub is inside TimesheetScreenBoundary (a fault never takes the page down)', () => {
  const source = read('../../components/timesheets/TimesheetsHub.tsx')
  const opened = source.match(/<TimesheetScreenBoundary\b/g)?.length ?? 0
  const screens = (source.match(/<TimesheetPeriodPage\b/g)?.length ?? 0) + (source.match(/<TimesheetsScreen\b/g)?.length ?? 0)
  assert.equal(screens, 3)
  assert.equal(opened, screens)
})
