/**
 * Feedback sounds call sites (owner decisions 16 Nov). Read from the source with the TypeScript parser, so a later
 * edit that moves a sound before the save, drops the refusal sound, or calls `feedback` from a listener fails here.
 *
 * Each wired handler must:
 *  - play its success event once, after the last write it awaits, outside any catch;
 *  - play `actionRefused` inside its catch (the error then goes where it went before);
 *  - call `feedback` only as a statement of its own (it returns nothing and cannot change a payload);
 *  - where its catch was added for the sound, play the refusal and rethrow the same error, nothing else;
 *  - play success before any notice sent after the save, so a failed notice never adds the error sound.
 * No other function in `app/` or `components/` may call `feedback` — in particular no effect, listener or snapshot
 * callback, so another person's change, a page load or an autosave never plays a sound.
 */
import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { createFeedbackPlayer, FEEDBACK_EVENT_SOUNDS, type FeedbackEvent } from './feedback'

const ROOT = fileURLToPath(new URL('../../', import.meta.url))

type Site = {
  file: string
  /** The handler's name (a const arrow, a function, or a `useCallback` const). */
  fn: string
  /** The events it may play on success (string literals inside its `feedback(...)` calls). */
  success: FeedbackEvent[]
  /** The writes that must come before the success sound. */
  after: string[]
  /** Whether a catch in it plays `actionRefused`. */
  refusal: boolean
  /**
   * The catch was added for the sound (the handler had no catch before, owner decision 8): it must play the refusal and
   * then rethrow its own error, so the error reaches exactly where it went before.
   */
  rethrow?: true
  /** Notices sent after the save. The success sound comes before them, so a failed notice never plays the error. */
  notices?: string[]
}

const SITES: Site[] = [
  { file: 'components/book-labour/BookLabourFlowScreen.tsx', fn: 'savePartyBookings', success: ['bookingSaved'], after: ['createBooking', 'saveManagerSiteBooking'], refusal: true },
  { file: 'components/projects/scheduling/ScheduleOperativeForm.tsx', fn: 'confirmBooking', success: ['bookingSaved'], after: ['createBooking', 'saveManagerSiteBooking'], refusal: true },
  { file: 'components/schedule/QuickAddBookingSheet.tsx', fn: 'handleSave', success: ['bookingSaved'], after: ['onSave'], refusal: true },
  { file: 'components/schedule/MyScheduleSelfBookingScreen.tsx', fn: 'commitBooking', success: ['bookingSaved'], after: ['saveManagerSiteBooking'], refusal: true },
  { file: 'components/schedule/MyScheduleSelfBookingScreen.tsx', fn: 'removeBooking', success: ['bookingDeleted'], after: ['deleteManagerSiteBooking'], refusal: true },
  { file: 'components/projects/scheduling/ScheduleSubcontractorForm.tsx', fn: 'confirm', success: ['bookingSaved'], after: ['all'], refusal: true },
  { file: 'components/schedule/BookingEditSheet.tsx', fn: 'handleSave', success: ['bookingSaved', 'bookingEdited'], after: ['onSave'], refusal: true },
  { file: 'components/schedule/BookingEditSheet.tsx', fn: 'handleDelete', success: ['bookingDeleted'], after: ['onDelete'], refusal: true },
  { file: 'components/daily-overview/DailyOverviewBookingSheet.tsx', fn: 'saveToProject', success: ['bookingEdited'], after: ['updateBooking', 'moveManagerSiteBookingIntoBookings', 'updateManagerSiteBooking'], refusal: true },
  { file: 'components/daily-overview/DailyOverviewBookingSheet.tsx', fn: 'saveToOther', success: ['bookingEdited'], after: ['moveBookingIntoManagerSchedule', 'updateManagerSiteBooking'], refusal: true },
  { file: 'components/daily-overview/DailyOverviewBookingSheet.tsx', fn: 'saveHoursOnly', success: ['bookingEdited'], after: ['updateBooking', 'updateManagerSiteBooking'], refusal: true },
  { file: 'components/projects/scheduling/SubcontractorBookingEditSheet.tsx', fn: 'save', success: ['bookingEdited'], after: ['updateSubcontractorBooking'], refusal: true },
  { file: 'components/projects/scheduling/SubcontractorBookingEditSheet.tsx', fn: 'remove', success: ['bookingDeleted'], after: ['deleteBookingWithTombstone'], refusal: true },
  { file: 'components/warnings/WarningsScreen.tsx', fn: 'handleRemoveEntry', success: ['bookingDeleted'], after: ['onDeleteManagerBooking', 'onDeleteBooking'], refusal: true, rethrow: true },
  { file: 'app/dashboard/warnings/page.tsx', fn: 'handleAcceptClash', success: [], after: ['approveBookingClashPairs', 'approveBookingClash'], refusal: true, rethrow: true },
  { file: 'app/dashboard/warnings/page.tsx', fn: 'handleDismissQualification', success: [], after: ['dismissQualificationWarning'], refusal: true, rethrow: true },
  // Owner bug 17 Nov: the materials (and any) Dismiss writes `warningResolutions` here; the card plays nothing itself.
  { file: 'app/dashboard/warnings/page.tsx', fn: 'handleDismissWarning', success: [], after: ['dismissWarningResolution'], refusal: true, rethrow: true },
  { file: 'components/annual-leave/OperativeAnnualLeaveCalendar.tsx', fn: 'bookLeave', success: ['leaveBooked', 'leaveRequested'], after: ['createRequests'], notices: ['notifyLeaveChangedForPerson'], refusal: true, rethrow: true },
  { file: 'components/annual-leave/OperativeAnnualLeaveCalendar.tsx', fn: 'confirmChange', success: ['leaveEdited'], after: ['saveBooking'], refusal: true, rethrow: true },
  { file: 'components/annual-leave/OperativeAnnualLeaveCalendar.tsx', fn: 'approveRequest', success: ['leaveApproved'], after: ['decideBooking'], notices: ['notifyHolidayRequestDecisionToUser'], refusal: true, rethrow: true },
  { file: 'components/annual-leave/OperativeAnnualLeaveCalendar.tsx', fn: 'deleteAnnualLeave', success: ['leaveRemoved'], after: ['deleteBooking'], notices: ['notifyLeaveChangedForPerson'], refusal: true, rethrow: true },
  { file: 'components/annual-leave/OperativeAnnualLeaveCalendar.tsx', fn: 'declineRequest', success: ['leaveDeclined'], after: ['decideBooking'], notices: ['notifyHolidayRequestDecisionToUser'], refusal: true, rethrow: true },
  { file: 'components/tasks/TasksScreen.tsx', fn: 'approveHoliday', success: ['leaveApproved'], after: ['deleteBooking', 'decideBooking'], notices: ['notifyHolidayRequestDecisionToUser'], refusal: true, rethrow: true },
  { file: 'components/tasks/TasksScreen.tsx', fn: 'declineHoliday', success: ['leaveDeclined'], after: ['saveBooking', 'decideBooking'], notices: ['notifyHolidayRequestDecisionToUser'], refusal: true, rethrow: true },
  { file: 'components/annual-leave/OperativeAnnualLeaveManagement.tsx', fn: 'updateStatus', success: ['leaveApproved', 'leaveDeclined'], after: ['deleteBooking', 'saveBooking', 'decideBooking'], notices: ['notifyHolidayRequestDecisionToUser'], refusal: true, rethrow: true },
  { file: 'components/overtime/OvertimeScreen.tsx', fn: 'run', success: [], after: ['work'], refusal: true },
  { file: 'components/overtime/OvertimeScreen.tsx', fn: 'direct', success: ['timesheetSaved'], after: ['applyDirectOvertime'], refusal: false },
  { file: 'components/overtime/OvertimeScreen.tsx', fn: 'sendForApproval', success: ['overtimeSent'], after: ['sendOvertimeRequest'], refusal: false },
  { file: 'components/overtime/OvertimeScreen.tsx', fn: 'generateReport', success: ['timesheetSaved'], after: ['saveOvertimeReport', 'buildOvertimeReportPdf'], refusal: false },
  { file: 'components/overtime/OvertimeScreen.tsx', fn: 'onReturn', success: ['overtimeReturned'], after: ['returnOvertimeRequest'], refusal: false },
  { file: 'components/overtime/PayeClaimsScreen.tsx', fn: 'approve', success: [], after: ['savePayeClaimReviews'], refusal: true },
  { file: 'components/overtime/PayeClaimsScreen.tsx', fn: 'generate', success: ['timesheetSaved'], after: ['savePayeClaimReport', 'downloadClaimReport'], refusal: true },
  { file: 'components/overtime/PayeClaimsScreen.tsx', fn: 'submit', success: ['timesheetSaved'], after: ['updatePayeClaim', 'addPriceWork', 'addExpense'], refusal: true },
  { file: 'components/timesheets/TimesheetPeriodPage.tsx', fn: 'saveExtraForm', success: ['timesheetSaved'], after: ['saveLateChange', 'saveEntryChange', 'persist'], refusal: true },
  { file: 'components/users/AddUserScreen.tsx', fn: 'handleSubmit', success: ['userInvited'], after: ['createGhost', 'inviteUser'], refusal: true },
]

/** Computed events (helpers of `feedback.ts`), checked by name rather than a literal. */
const COMPUTED: Record<string, string> = {
  'app/dashboard/warnings/page.tsx#handleAcceptClash': 'resolvedFeedbackEvent',
  'app/dashboard/warnings/page.tsx#handleDismissQualification': 'resolvedFeedbackEvent',
  'app/dashboard/warnings/page.tsx#handleDismissWarning': 'resolvedFeedbackEvent',
  'components/overtime/PayeClaimsScreen.tsx#approve': 'reviewed',
}

function parse(file: string): ts.SourceFile {
  return ts.createSourceFile(file, readFileSync(path.join(ROOT, file), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
}

function walk(node: ts.Node, visit: (node: ts.Node) => void) {
  visit(node)
  node.forEachChild((child) => walk(child, visit))
}

const calleeName = (call: ts.CallExpression): string => {
  const expr = call.expression
  if (ts.isIdentifier(expr)) return expr.text
  if (ts.isPropertyAccessExpression(expr)) return expr.name.text
  return ''
}

/** The node a handler name refers to: `const fn = …`, `function fn`, a JSX attribute `fn={…}`. */
function findHandler(source: ts.SourceFile, name: string): ts.Node {
  let found: ts.Node | null = null
  walk(source, (node) => {
    if (found) return
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === name && node.initializer) found = node.initializer
    else if (ts.isFunctionDeclaration(node) && node.name?.text === name) found = node
    else if (ts.isJsxAttribute(node) && ts.isIdentifier(node.name) && node.name.text === name && node.initializer) found = node.initializer
  })
  assert.ok(found, `${source.fileName}: handler ${name} not found`)
  return found
}

function feedbackCalls(root: ts.Node): ts.CallExpression[] {
  const calls: ts.CallExpression[] = []
  walk(root, (node) => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'feedback') calls.push(node)
  })
  return calls
}

const insideCatch = (node: ts.Node, stopAt: ts.Node): boolean => {
  for (let current = node.parent; current && current !== stopAt; current = current.parent) {
    if (ts.isCatchClause(current)) return true
  }
  return false
}

const enclosingTry = (node: ts.Node, stopAt: ts.Node): ts.TryStatement | null => {
  for (let current = node.parent; current && current !== stopAt; current = current.parent) {
    if (ts.isTryStatement(current)) return current
  }
  return null
}

const isWithin = (node: ts.Node, ancestor: ts.Node): boolean => {
  for (let current: ts.Node | undefined = node; current; current = current.parent) if (current === ancestor) return true
  return false
}

const literals = (node: ts.Node): string[] => {
  const out: string[] = []
  walk(node, (child) => {
    // Event names only (a ternary's own test, e.g. `status === 'approved'`, is not an event).
    if (ts.isStringLiteral(child) && child.text in FEEDBACK_EVENT_SOUNDS) out.push(child.text)
  })
  return out
}

for (const site of SITES) {
  test(`${site.file} ${site.fn}: success after the write, refusal in the catch, nothing else`, () => {
    const source = parse(site.file)
    const handler = findHandler(source, site.fn)
    const calls = feedbackCalls(handler)
    assert.ok(calls.length > 0, 'it plays feedback')

    for (const call of calls) {
      // A statement of its own: the result is unused and nothing is passed but the event.
      assert.ok(ts.isExpressionStatement(call.parent), `${site.fn}: feedback(...) is its own statement`)
      assert.equal(call.arguments.length, 1)
    }

    const success = calls.filter((call) => !insideCatch(call, handler))
    const refusals = calls.filter((call) => insideCatch(call, handler))

    // Every literal event named outside a catch is one of the site's success events (or a refusal for a !ok result).
    const named = success.flatMap((call) => literals(call.arguments[0]))
    for (const event of named) {
      assert.ok(
        (site.success as string[]).includes(event) || event === 'actionRefused',
        `${site.fn}: unexpected event ${event}`
      )
    }
    for (const event of site.success) assert.ok(named.includes(event), `${site.fn}: plays ${event}`)
    const computed = COMPUTED[`${site.file}#${site.fn}`]
    if (computed) {
      assert.ok(
        success.some((call) => call.arguments[0].getText(source).includes(computed)),
        `${site.fn}: plays the event from ${computed}`
      )
    }

    // After the writes: every success sound comes after every awaited write in the same try (or the whole handler).
    const writes: ts.Node[] = []
    walk(handler, (node) => {
      if (ts.isAwaitExpression(node)) {
        let inner: ts.Node = node.expression
        while (ts.isParenthesizedExpression(inner)) inner = inner.expression
        if (ts.isCallExpression(inner) && site.after.includes(calleeName(inner)) && !insideCatch(node, handler)) writes.push(node)
      }
    })
    if (site.success.length > 0 || computed) {
      assert.ok(writes.length > 0, `${site.fn}: the write was found`)
      // Each sound follows a write in its try; the last sound of a try follows every write in it (an early-return
      // branch, like a cancellation decision, plays after its own write and before the other branch's).
      const scopes = new Map<ts.Node, ts.CallExpression[]>()
      for (const call of success) {
        const scope = enclosingTry(call, handler) ?? handler
        scopes.set(scope, [...(scopes.get(scope) ?? []), call])
        const before = writes.filter((write) => isWithin(write, scope) && write.getEnd() < call.getStart())
        assert.ok(before.length > 0, `${site.fn}: a write precedes the sound`)
      }
      for (const [scope, inScope] of scopes) {
        const last = inScope.reduce((a, b) => (a.getStart() > b.getStart() ? a : b))
        for (const write of writes.filter((w) => isWithin(w, scope))) {
          assert.ok(last.getStart() > write.getEnd(), `${site.fn}: the sound comes after ${write.getText(source).slice(0, 40)}`)
        }
      }
    }

    if (site.refusal) {
      assert.ok(refusals.length > 0, `${site.fn}: the catch plays actionRefused`)
      for (const call of refusals) assert.deepEqual(literals(call.arguments[0]), ['actionRefused'])
    }

    // A catch added only for the sound plays it and rethrows its own error, nothing else, so the error goes where it
    // went before (owner decision 8). Removing the `throw` would swallow the error and fails here.
    if (site.rethrow) {
      for (const call of refusals) {
        let clause: ts.CatchClause | null = null
        for (let node: ts.Node | undefined = call.parent; node && node !== handler; node = node.parent) {
          if (ts.isCatchClause(node)) {
            clause = node
            break
          }
        }
        assert.ok(clause, `${site.fn}: refusal inside a catch`)
        const variable = clause.variableDeclaration?.name
        assert.ok(variable && ts.isIdentifier(variable), `${site.fn}: the catch names its error`)
        const statements = clause.block.statements
        const last = statements[statements.length - 1]
        assert.ok(
          last && ts.isThrowStatement(last) && last.expression && ts.isIdentifier(last.expression) && last.expression.text === variable.text,
          `${site.fn}: the catch ends with throw ${variable.text}`
        )
        // Before the throw: only the refusal sound (on its own, or guarded by "nothing saved yet").
        for (const statement of statements.slice(0, -1)) {
          const sound = ts.isIfStatement(statement) && !statement.elseStatement ? statement.thenStatement : statement
          assert.ok(
            ts.isExpressionStatement(sound) && ts.isCallExpression(sound.expression) && calleeName(sound.expression) === 'feedback',
            `${site.fn}: the added catch only plays the sound before rethrowing (${statement.getText(source).slice(0, 40)})`
          )
        }
      }
    }

    // Notices sent after the save come after the success sound: a failed notice after a successful save must not be
    // the only sound (or turn it into the error).
    for (const notice of site.notices ?? []) {
      const sends: ts.Node[] = []
      walk(handler, (node) => {
        if (ts.isCallExpression(node) && calleeName(node) === notice && !insideCatch(node, handler)) sends.push(node)
      })
      assert.ok(sends.length > 0, `${site.fn}: ${notice} found`)
      for (const send of sends) {
        // Between the save just before this notice and the notice itself (so the sound of another branch never counts).
        const save = writes
          .filter((write) => write.getEnd() < send.getStart())
          .reduce<ts.Node | null>((a, b) => (!a || b.getStart() > a.getStart() ? b : a), null)
        assert.ok(save, `${site.fn}: a save precedes ${notice}`)
        const between = success.filter((call) => call.getStart() > save.getEnd() && call.getEnd() < send.getStart())
        assert.ok(between.length > 0, `${site.fn}: the success sound plays after the save and before ${notice}`)
      }
      // In the catch the refusal is guarded so a save that already played success plays nothing more.
      for (const call of refusals) {
        assert.ok(
          ts.isExpressionStatement(call.parent) && ts.isIfStatement(call.parent.parent),
          `${site.fn}: the refusal is skipped once the save succeeded`
        )
      }
    }
  })
}

/** Every `.ts` / `.tsx` file under a folder. */
function sourceFiles(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(path.join(ROOT, dir))) {
    const rel = path.join(dir, entry)
    if (statSync(path.join(ROOT, rel)).isDirectory()) out.push(...sourceFiles(rel))
    else if (/\.tsx?$/.test(entry) && !entry.endsWith('.test.ts')) out.push(rel)
  }
  return out
}

test('no other place calls feedback — never an effect, a listener, a snapshot or page load', () => {
  const allowed = new Set(SITES.map((site) => `${site.file}#${site.fn}`))
  const LISTENERS = /^(useEffect|useLayoutEffect|onSnapshot|subscribe|setInterval|setTimeout)$|^listen|^watch/
  for (const file of [...sourceFiles('app'), ...sourceFiles('components')]) {
    const text = readFileSync(path.join(ROOT, file), 'utf8')
    if (!/\bfeedback\(/.test(text)) continue
    const source = parse(file)
    for (const call of feedbackCalls(source)) {
      // The nearest named handler that contains the call.
      let owner = ''
      for (let node: ts.Node | undefined = call.parent; node; node = node.parent) {
        if (ts.isCallExpression(node) && LISTENERS.test(calleeName(node))) {
          assert.fail(`${file}: feedback inside ${calleeName(node)}(...)`)
        }
        if (!owner && ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) owner = node.name.text
        if (!owner && ts.isFunctionDeclaration(node) && node.name) owner = node.name.text
        if (!owner && ts.isJsxAttribute(node) && ts.isIdentifier(node.name)) owner = node.name.text
      }
      // `run(async () => …)` handlers are named by the const that holds them.
      assert.ok(allowed.has(`${file}#${owner}`), `${file}: feedback in ${owner || 'an unnamed function'} is not a wired handler`)
    }
  }
})

test('no wired handler loads a new page (the one way an earlier onClose / navigation could cut a sound)', () => {
  // The player is one per page (module level), not per component: closing a sheet (`onClose()`) or a client-side
  // `router.push` / `replace` unmounts the component but keeps the page and its AudioContext, so a sound played just
  // before or after them is heard either way. Only a full page load would stop it, so none is allowed in a handler.
  const FULL_LOAD = /\b(window\.)?location\.(assign|replace|reload)\(|\b(window\.)?location(\.href)?\s*=[^=]/
  for (const site of SITES) {
    const source = parse(site.file)
    const text = findHandler(source, site.fn).getText(source)
    assert.doesNotMatch(text, FULL_LOAD, `${site.file} ${site.fn}`)
  }
})

test('the settings row plays only the sample, on the person\'s own click', () => {
  const text = readFileSync(path.join(ROOT, 'components/settings/SoundsSettingRow.tsx'), 'utf8')
  assert.doesNotMatch(text, /\bfeedback\(/)
  assert.match(text, /onClick=\{\(\) => playFeedbackSample\(\)\}/)
})

test('saved data is identical with sounds on and off (feedback returns nothing and touches no payload)', async () => {
  // The same handler shape every call site uses: write, then play. With the setting on and off, the writes match.
  for (const event of Object.keys(FEEDBACK_EVENT_SOUNDS) as FeedbackEvent[]) {
    const runs: unknown[][] = []
    for (const on of [true, false]) {
      const writes: unknown[] = []
      const player = createFeedbackPlayer({
        now: () => 0,
        enabled: () => on,
        createContext: () => null,
        fetchBytes: async () => new ArrayBuffer(0),
        canPlayType: () => '',
        whenIdle: () => undefined,
      })
      const payload = { id: 'b1', date: '2026-11-16', timeSlot: 'FULL DAY', notes: '' }
      const handler = async () => {
        writes.push(structuredClone(payload))
        const result = player.play(event)
        writes.push(result)
        writes.push(structuredClone(payload))
      }
      await handler()
      runs.push(writes)
    }
    assert.deepEqual(runs[0], runs[1], event)
    assert.equal(runs[0][1], undefined)
  }
})

test('16 Nov scan: a clash approval plays the error sound only when the approval write is refused, never for a failed reload', () => {
  const source = parse('app/dashboard/warnings/page.tsx')
  const handler = findHandler(source, 'handleAcceptClash')
  const refusals = feedbackCalls(handler).filter((call) => insideCatch(call, handler))
  assert.ok(refusals.length > 0)
  for (const call of refusals) {
    const guarded = enclosingTry(call, handler)
    assert.ok(guarded, 'the refusal belongs to a try')
    const called: string[] = []
    walk(guarded.tryBlock, (node) => {
      if (ts.isCallExpression(node)) called.push(calleeName(node))
    })
    for (const load of ['loadAcceptedBookingClashes', 'loadResolvedWarningKeys', 'all']) {
      assert.ok(!called.includes(load), `the reload (${load}) is outside the try whose catch plays actionRefused`)
    }
  }
  // The success sound comes before the reload, so a reload that fails after a saved approval has already played it.
  const success = feedbackCalls(handler).filter((call) => !insideCatch(call, handler))
  let reload: ts.Node | null = null
  walk(handler, (node) => {
    if (!reload && ts.isCallExpression(node) && calleeName(node) === 'loadAcceptedBookingClashes') reload = node
  })
  assert.ok(reload)
  assert.ok(success.some((call) => call.getEnd() < (reload as ts.Node).getStart()))
})
