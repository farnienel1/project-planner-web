# iOS follow-on — rulebook 1.49.0

Generated 2026-11-15 by `npm run rulebook:handoff` in project-planner-web. Paste this whole file into the iOS agent.
The web repo copy of `docs/RULEBOOK.md` is canonical. iOS mirrors it exactly; never edit the iOS mirror by hand.

```
╔══════════════════════════════════════════════════════════════════╗
║ FOLLOW-ON — paste into the iOS agent                             ║
╚══════════════════════════════════════════════════════════════════╝
Started on: web
Rulebook version: 1.48.0 → 1.49.0
Packed hash: 3251ec01740e7f2d928bcd510ce784c408207332faee31e9e07fca604581e362
Rulebook sha256: 3b3073233784182d69dc19219411fd2f5afd060c1a5e568051e25cfee25995b0
Copy (do not edit by hand) — run scripts/sync-rulebook-from-web.sh in the iOS repo, which copies:
  web lib/canonical/dist/canonical-business.js      → iOS Project Planner/Canonical/canonical-business.js
  web lib/canonical/dist/canonical-business.sha256  → iOS Project Planner/Canonical/canonical-business.js.sha256
  web lib/canonical/dist/canonical-manifest.json    → iOS Project Planner/Canonical/canonical-manifest.json
  web docs/RULEBOOK.md                              → iOS docs/RULEBOOK.md
  web lib/canonical/parity-fixture.json             → iOS ProjectPlannerTests/CanonicalParityFixture.json
  web lib/canonical/cross-platform-contract.json    → iOS ProjectPlannerTests/CrossPlatformContract.json
  web lib/canonical/data-parity-fixture.json        → iOS ProjectPlannerTests/DataParityFixture.json
Contract sha256: b89ca87595a18b7f0230fa13dcc81d65dcaea44e65912d499a31ce5df7670dd4
Data-parity fixture sha256: c2db4a64c22f36ddda48453c0d26da28fc802df9c8c93c0d876e8097a9eb176f
Call: CanonicalBusinessEngine — no second calculator in Swift.
Exports added: WEEKEND_COUNTS_AS_STEP_HOURS, newOrganizationPayrollPolicy, payrollDayRateHours, weekdayDayRateNote, weekendCountsAsCopy, weekendDayRateNote
Exports removed: none
Web files that changed the rules: docs/RULEBOOK.md, lib/canonical/bookingHoursExplanation.test.ts, lib/canonical/bookingHoursExplanation.ts, lib/canonical/bookingSlots.ts, lib/canonical/bundleEntry.ts, lib/canonical/canonical.test.ts, lib/canonical/index.ts, lib/canonical/organizationSettings.ts, lib/canonical/parity-fixture.json, lib/canonical/payrollHours.ts, lib/canonical/payrollPolicySchedule.ts, lib/canonical/timesheetLineEdit.ts
Done when:
- [ ] Packed hash in iOS equals 3251ec01740e7f2d928bcd510ce784c408207332faee31e9e07fca604581e362
- [ ] iOS docs/RULEBOOK.md is byte-identical (sha256 3b3073233784182d69dc19219411fd2f5afd060c1a5e568051e25cfee25995b0)
- [ ] RulebookParityTests pass (CanonicalBusinessEngine.rulebookVersion() == 1.49.0)
- [ ] Every Swift caller of a changed rule calls CanonicalBusinessEngine
- [ ] Same Firebase fields read and written as web
- [ ] Any disagreement traced to its first divergence — no copied screen number
```

## What changed in 1.49.0

- **Weekend "Counts as" follows Monday–Friday by default** (§4.3, owner answers 15 Nov, 1b, 2, 5, 6): `countsAsFollowsWeekday` on `saturday` / `sunday`; the one reader `weekendCountsAsHours(weekend, policy)` (following → `weekdayPaidHours`; else stored; else 8 — one fallback for both apps); every save writes `countsAsHours` = the derived value (`withDerivedWeekdayPaidHours`, `payrollPolicyToFirestore`); `newOrganizationPayrollPolicy` (setup wizard) starts following; nothing migrated. Cap (≤ the weekday paid day) and half-hour step in `validatePayrollTimePolicy` (`WEEKEND_COUNTS_AS_STEP_HOURS`), stored values passing until changed. Copy: `weekendCountsAsCopy` (now `{ label, sameAsWeekdayLabel, dayName }`; the 1.49.0 draft's `help` is gone), `weekdayDayRateNote`, `weekendDayRateNote`.
- **The unpaid break is allowed for in "counts as"** (§4.3, owner answer 15 Nov, 3, formula A confirmed): a full window credits exactly "counts as"; a part credits over the window minutes outside the break window when the break is unpaid and not removed. **Changed figures** (Saturday 07:30–14:00 counts as 8, unpaid 12:00–12:30): full window 7.5h → 8h; 07:30–11:00 4.31h → 4.67h (3 Nov / 1.20.4 figure superseded); own break 45 min 11:30–12:15, full window 7.25h → 8h; a stored set-window FULL DAY with an unpaid break 7.5h → 8h. `weekendBookingBreakdown`, `weekendDayPreview` ("Unpaid break … — allowed for in the counts as"), `bookingHoursExplanation` and `customHoursBreakWarning` (weekend window days: only when turning the break off changes the pay) follow. Hourly: full window = counts-as × rate.
- Review fixes: `reportDayValue` splits only when the standard part's divisor differs (weekday day units unchanged); the divisor uses the same span as pay (`weekendFullDayWindow ?? interval`).
- **A weekend full day pays one day rate** (§8, owner decision 15 Nov, option A): new `payrollDayRateHours({ policy, dayKey, timeZone })` → `{ standardDayHours, overtimeDayHours }`, and `payrollHoursResult` now returns `standardPartDayHours` / `overtimePartDayHours`. For day-rate pay the standard (window-credited) hours of a set-window Saturday / Sunday divide by that day's own "counts as" hours; hours at a multiplier and every other day divide by the weekday paid day as before; hourly pay unchanged; partial windows pro rata; each day under the policy in effect on it.
- Pricers use the part's divisor: `bookingPaySlices` (weekly report; each slice's `standardDayHours` is its divisor, so a weekend window is its own "2.00 days at £240/day" row), `revisedPayrollLineAmounts` (Edit hours; adds `standardPartDayHours`), `reportDayValue` (optional `standardHours` + `standardPartDayHours`: a full window is 1 day unit). Web: the timesheet collector (each line's `standardDayHours`), the signed-snapshot day units (`weeklyReportOverride`) and the weekly report day units follow.
- Owner's reference fortnight (Test Admin, 1–15 Nov 2026, weekday 07:00–16:00 less 30 min = 8.5h, Saturday and Sunday 07:30–14:00 counting 8h at £240/day): weekly report, timesheet totals and invoice all give £3,141.76 (£2,661.76 + £240 + £240; before 1.49.0 £3,113.53).
- **Weekend "Counts as" in Settings → Working hours** (§4.3): the "Same as Monday–Friday" toggle with the number beneath it (1h up to the weekday paid day, half-hour steps), saved through the normal working-hours write; the setup wizard has the same toggle, number and limits; the approved notes under Monday–Friday and each weekend day.
- No security rules change. Signed timesheets are never re-priced. Raise `minimumIosBuild` before merge.

## iOS work for 1.49.0

**Sync first.** 1.49.0 (owner decisions 15 Nov): **a weekend full day pays one day rate**, weekend **"Counts as" follows Monday–Friday by default**, and **the unpaid break is allowed for in "counts as"**.
- **Day-rate divisor:** for day-rate pay, the hours a Saturday or Sunday **set window** credits are divided by **that day's own "counts as" hours**, so a full window pays exactly the day rate. Overtime and every-hour-at-N× weekend days still divide by the weekday paid day.
- **Unpaid break inside the window:** a booking that covers the whole window credits exactly "counts as", whatever the break. A part of the window credits the worked-minutes share.
- **This is a pay and hours change.** The owner raises `minimumIosBuild` to the iOS build that ships this hand-off **before web 1.49.0 merges** (platform guardrail 4).
- **Not changed:** no Firestore rules, Storage rules, index or Functions change. Nothing is migrated.
- **New stored field (optional):** `countsAsFollowsWeekday: true` on `payrollTimePolicy.saturday` / `.sunday`, plus prior / scheduled / history entries. **Preserve it on every working-hours write.**
- **Base:** web `origin/w148-materials` (1.48.0, stacked on 1.47.0); sync 1.47 and 1.48 first if your branch does not have them.
- Line numbers below are from earlier hand-offs; check them on your branch.

1. **Sync.** Run `WEB_REPO=<web worktree> bash scripts/sync-rulebook-from-web.sh`, then commit the mirrored files.
   - The parity fixture now expects `standardPartDayHours` and `overtimePartDayHours` on every `payrollHoursResult`. If a Swift `Decodable` for it is strict, add both as optional `Double`.
   - Four weekend-break expected values changed. They are listed in the web PR (#327).
2. **One "counts as" reader, one fallback.**
   - Call `CanonicalBusinessEngine.weekendCountsAsHours(weekend, policy)` everywhere a weekend "counts as" is read, passing the policy **in effect that day**. With `countsAsFollowsWeekday` it returns that policy's `weekdayPaidHours`; otherwise the stored value; else **8**.
   - Delete iOS's own fallback, `resolvedCountsAsHours(fallback:)`, in `Core/WarningsComputation.swift`, `Core/PayrollTimePolicyCatalog.swift` and `Views/OrganisationWorkingHoursView.swift`. It falls back to `standardPaidHours`; the rulebook fallback is 8.
   - Decode `countsAsFollowsWeekday` (Bool, only `true` counts) on the weekend day model and encode it on every save.
3. **Writing the policy.**
   - On every working-hours save (Apply from today / Schedule / setup), run the policy through `withDerivedWeekdayPaidHours`. It now also sets a following day's `countsAsStandardHours` to the derived value.
   - Write `countsAsHours` with that value and `countsAsFollowsWeekday: true` when on. Mirror `payrollPolicyToFirestore`; omit the key when off, as web does.
   - New organisations start from `newOrganizationPayrollPolicy()`, with Saturday and Sunday on "Same as Monday–Friday".
4. **Cap and step.**
   - `validatePayrollTimePolicy(policy, previous)` now refuses a "counts as" number above the Monday–Friday paid day: "Saturday counts-as hours can't be more than the Monday–Friday paid day (8.5h)."
   - It also refuses a number off the half-hour step (`WEEKEND_COUNTS_AS_STEP_HOURS` = 0.5): "Saturday counts-as hours use half-hour steps (e.g. 7.5)."
   - Always pass the saved policy as `previous`, so a stored number left unchanged passes. Show the message and do not save.
5. **Working hours screen** (`Views/OrganisationWorkingHoursView.swift`). For a set-window Saturday and Sunday ("Standard window + overtime"):
   - Show a toggle labelled `weekendCountsAsCopy(day).sameAsWeekdayLabel` ("Same as Monday–Friday").
   - When the toggle is off, show beneath it a stepper labelled `weekendCountsAsCopy(day).label` ("Counts as"): half-hour steps, from 1h up to `weekdayPaidHours(draft)`, value `weekendCountsAsHours(day, draft)`.
   - Turning the toggle off starts the number at the weekday paid day rounded **down** to the half hour.
   - Under Monday–Friday show `weekdayDayRateNote(draft)`. Under each set-window weekend day show `weekendDayRateNote(draft, "saturday" | "sunday")`; it is null on an every-hour day.
   - Use the exact strings from the engine and remove iOS's own "Counts as" texts.
   - Save through the existing working-hours save: history, two-admin conflict check, apply / schedule.
6. **Timesheet collector** (`Core/TimesheetPayrollCollector.swift`).
   - Price the standard line with `payForHours(..., standardDayHours: result.standardPartDayHours)` and the overtime line with `result.overtimePartDayHours`.
   - Store each as that line's `standardDayHours`, so day units are `paidHours / standardDayHours` and a full Saturday window reads 1.00 day.
   - Web reference: `lib/timesheets/timesheetPayrollCollector.ts` `pushBooking`.
7. **Edit hours** (`Views/TimesheetManagerReviewSupport.swift`). `revisedPayrollLineAmounts` already uses the new divisor and returns `standardPartDayHours`. A standard part's days are `paidHours / standardPartDayHours`.
8. **Signed snapshot day units** (`Core/TimesheetWeeklyReportOverrideBuilder.swift`, `Views/InvoicingView.swift` `weeklyReportOverrideMap`).
   - A snapshot line's `days` = `paidHours / (the live line's standardDayHours)`.
   - For a `payrollLineReviewSnapshotParts` part: the standard part divides by the live standard line's divisor, an overtime part by `weekdayPaidHours`.
   - Never re-price an existing signed line.
9. **Weekly report** (`Views/WeeklyReportView.swift`).
   - `bookingPaySlices` returns each slice's divisor as `standardDayHours`. Keep it in the bucket key, so a weekend window on a different divisor is its own row (e.g. "2.00 days at £240/day"; owner confirmed).
   - Project day units: `reportDayValue({ totalPaidHours, standardPaidHours: weekdayPaidHours(policy), standardHours: result.standardHours, standardPartDayHours: result.standardPartDayHours })`. It splits only when the divisor differs.
10. **Unpaid break on weekend windows (no Swift arithmetic).**
    - `payrollHoursResult` now credits a full window at exactly "counts as" and carries no `unpaidBreakHours` on the window segment. Do not subtract the break yourself anywhere.
    - `weekendBookingBreakdown` rows now read "Saturday 07:30–14:00 = 8h (counts as a full day)".
    - The `weekendDayPreview` summary reads "Unpaid break 12:00–12:30, 30 min — allowed for in the counts as".
    - `bookingHoursExplanation` uses "full day, unpaid break allowed for" and "Booked … of the 6h window outside the unpaid break → 8h × 5 ÷ 6 = 6.67h".
    - `customHoursBreakWarning` on a set-window weekend day returns null for a booking that covers the whole window. Show only what these functions return.
11. **Tests.** Reproduce the web tests:
    - `lib/weekly-report/weekendDayRate149.test.ts`:
      - The owner's reference fortnight, with "counts as" stored at 8 and the weekend break paid. Policy 07:00–16:00, 30 min unpaid 12:00–12:30, `paidHoursDerived`, ×1.5. Saturday and Sunday 07:30–14:00 counts as 8. £250/day to 13 Nov, £240 from 14 Nov.
      - Bookings: 2, 3, 4 and 10 Nov 07:00–16:00; 5 Nov 07:00–21:00; 6 Nov 07:00–23:00; 9 Nov 07:00–22:30 at ×2; 14 and 15 Nov 07:30–14:00.
      - Expected: weekend lines £240 each, 1.00 day; Mon–Fri £2,661.76; timesheet total, invoice and weekly report **£3,141.76**; weekend row "2.00 days" £480.00.
      - The following case: Saturday on "Same as Monday–Friday" (8.5h), unpaid break, 07:30–14:00. Day rate £240 = 1 day; hourly £30 → 8.5h = £255.
    - `lib/canonical/canonical.test.ts` "1.49.0 …":
      - Full window hourly £20 = £160.
      - 07:30–15:00 hourly = £160 + £40.
      - 07:30–11:00 with an unpaid break = 4.67h (hourly £93.33, day £140).
      - Removed break 07:30–11:00 = 8 × 3.5 ÷ 6.5.
      - Cap 9 > 8.5 refused; 7.3 refused; unchanged stored values pass.
12. **Do not** add a Swift divisor, a weekend credit, a "counts as" fallback or note text of your own. Do not re-price signed sheets.

## New rulebook sections

- 1.49.0 — 2026-11-15

## Workflow for the iOS agent

1. Run `scripts/sync-rulebook-from-web.sh` (or copy the files above), then run the iOS tests.
2. Produce a numbered Gap Report (Finding / Evidence / Rule / Severity / Solution / Action) for the changes above and **stop**.
3. Implement only what the user approves, in the iOS repo only.
4. Report any web-side gap back to the web agent instead of diverging on iOS.
