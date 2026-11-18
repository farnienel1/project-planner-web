# iOS follow-on — rulebook 1.67.0

Generated 2026-11-18 by `npm run rulebook:handoff` in project-planner-web. Paste this whole file into the iOS agent.
The web repo copy of `docs/RULEBOOK.md` is canonical. iOS mirrors it exactly; never edit the iOS mirror by hand.

```
╔══════════════════════════════════════════════════════════════════╗
║ FOLLOW-ON — paste into the iOS agent                             ║
╚══════════════════════════════════════════════════════════════════╝
Started on: web
Rulebook version: 1.63.0 → 1.67.0
Packed hash: 8071014294caab4981494d435a7d98cff1ba8fb79c608b63181760a623f14e1f
Rulebook sha256: 1edd8cd9956f25db038d06594d09d41f8b963cdf4e102faa2a1295d2e806abb5
Copy (do not edit by hand) — run scripts/sync-rulebook-from-web.sh in the iOS repo, which copies:
  web lib/canonical/dist/canonical-business.js      → iOS Project Planner/Canonical/canonical-business.js
  web lib/canonical/dist/canonical-business.sha256  → iOS Project Planner/Canonical/canonical-business.js.sha256
  web lib/canonical/dist/canonical-manifest.json    → iOS Project Planner/Canonical/canonical-manifest.json
  web docs/RULEBOOK.md                              → iOS docs/RULEBOOK.md
  web lib/canonical/parity-fixture.json             → iOS ProjectPlannerTests/CanonicalParityFixture.json
  web lib/canonical/cross-platform-contract.json    → iOS ProjectPlannerTests/CrossPlatformContract.json
  web lib/canonical/data-parity-fixture.json        → iOS ProjectPlannerTests/DataParityFixture.json
Contract sha256: 56f892a29d844eaaebe16028640ebdfb036324d3a229638968c34d10663159f3
Data-parity fixture sha256: c2db4a64c22f36ddda48453c0d26da28fc802df9c8c93c0d876e8097a9eb176f
Call: CanonicalBusinessEngine — no second calculator in Swift.
Exports added: DAY_RATE_OVERTIME_ROUNDED_NOTE, dayRateHourlyEquivalent, dayRateOvertimeCalcText, multipliedHoursParts, signedDayRateOvertimeText
Exports removed: none
Web files that changed the rules: docs/RULEBOOK.md, lib/canonical/bundleEntry.ts, lib/canonical/canonical.test.ts, lib/canonical/dayRateOvertimeText.test.ts, lib/canonical/dayRateOvertimeText.ts, lib/canonical/index.ts, lib/canonical/payRate.ts, lib/canonical/payrollHours.ts
Done when:
- [ ] Packed hash in iOS equals 8071014294caab4981494d435a7d98cff1ba8fb79c608b63181760a623f14e1f
- [ ] iOS docs/RULEBOOK.md is byte-identical (sha256 1edd8cd9956f25db038d06594d09d41f8b963cdf4e102faa2a1295d2e806abb5)
- [ ] RulebookParityTests pass (CanonicalBusinessEngine.rulebookVersion() == 1.67.0)
- [ ] Every Swift caller of a changed rule calls CanonicalBusinessEngine
- [ ] Same Firebase fields read and written as web
- [ ] Any disagreement traced to its first divergence — no copied screen number
```

## What changed in 1.67.0

- **A day-rate overtime line reads in hours** (§8, owner decision 17 Nov; wording only). New `dayRateOvertimeCalcText` and `DAY_RATE_OVERTIME_ROUNDED_NOTE` (`lib/canonical/dayRateOvertimeText.ts`): "6h × 1.5 = 9h · 9h × £26.47/h (rounded) = £238.24 (£225.00/day ÷ 8.5h)" instead of "0.71 days × £337.50/day = £238.24". The divisor is the part's day-rate divisor (`payrollDayRateHours`); the hours part is `multipliedHoursText`; the amount is the exact pay as priced and is never changed; the shown hourly rate is rounded to pennies and marked "(rounded)" when that changes it (owner confirmed 17 Nov). Standard lines, hourly-rate people and PAYE days are unchanged; a signed snapshot line reads in hours only when it stores the day rate and divisor at signing (`otBaseDayRate`, `otDayRateHours`) and its stored amount is exactly what `payForHours` pays for its stored hours at that rate (see the review note below). Web: `payLineDisplay` (the timesheet period and review page, the invoice HTML and PDF, the export email) calls it. `plainHoursText` is now exported from `payrollHours.ts` (module only). New `multipliedHoursParts` (`payrollMultipliedHours` uses it, same figures) and `dayRateHourlyEquivalent`; the text function now does no arithmetic of its own (a syntax-tree test) and carries `paidHours`, `pay`, `payShown`; callers fall back to the older wording when it would not show the line's own figures (owner 17 Nov: the calculation must never fail; property tests over generated bookings). Review of #378: signed lines read in hours only from the day rate and divisor stored at signing (new snapshot fields `otBaseDayRate`, `otDayRateHours`; `signedDayRateOvertimeText`) when the stored amount is exactly what they pay — never a rate worked out from the signed amount; live lines only with the person's own rate (no `rate ÷ multiplier`); iOS invoice and export rows carry the live line's multiplier, rate and divisor. Second review of #378: a live invoice row shows the hours wording only when its decided amount is exactly what `payForHours` pays for the shown hours, rate and divisor (an Edit-hours-revised amount keeps the older wording; web invoice details show the decided amount); a signed line whose details mention a break but cannot be read keeps the older wording. Merged after 1.59.0 (#370), 1.60.0 (#373), 1.60.1 (#375) and 1.63.0 (#388); drafted as 1.61.0 and renumbered.

## iOS work for 1.67.0

Wording only — no figure, total, write or permission changes.

1. Sync the rulebook from this web branch with `scripts/sync-rulebook-from-web.sh` (never hand-edit the canonical files).
2. Wherever iOS builds a day-rate timesheet or invoice **overtime** line's text ("0.71 days × £337.50/day = £238.24"), call `dayRateOvertimeCalcText` through `CanonicalBusinessEngine` with: `clockHours` (the line's clock hours at the multiplier — the collector's `otClockHours`, or `parseMultipliedHoursText` of its details when an unpaid break came off), `multiplier`, `breakHours` (only when a break is taken off the multiplied hours), `dayRate` (the person's own day rate, carried from the collector as `otBaseDayRate` — **never** worked out backwards as the multiplied rate ÷ the multiplier, or the amount ÷ days), `dayRateHours` (the line's own divisor, `standardDayHours`), `pay` (the line's amount), `currency`. Show `text` (or `lines` on two rows) only when the result shows the line's own figures: its `paidHours` equal the line's paid hours × the multiplier, **and** the line's amount (the decided amount, after any review) equals `payForHours` for those hours, that day rate and divisor — a revised (Edit hours) amount keeps the older wording. When it returns null, keep the current text.
3. Standard lines, hourly-rate people and PAYE days keep their current text. **Signed snapshot lines:** when signing, store `otBaseDayRate` (the person's own day rate) and `otDayRateHours` (the line's divisor) on each day-rate overtime line of `weeklyReportOverride`, and keep them on every re-save. Show a signed line with `signedDayRateOvertimeText(line, { currency })`: it reads in hours only from those stored values, only when the line was not edited or declined and its stored amount is exactly what they pay (`payForHours`), and returns null (the older wording) for anything else — a line signed before 1.67.0, an amount-only revision, details that mention a break but cannot be read. Never compute a day rate from the stored amount, days or multiplier.
4. Tests: the owner example (£225/day, 8.5h, 6h × 1.5 → "6h × 1.5 = 9h · 9h × £26.47/h (rounded) = £238.24 (£225.00/day ÷ 8.5h)") and a line with an unpaid break.

## Review of #378 (also in this release)

- **Signed lines (S1):** never work a rate out from the signed amount. Store `otBaseDayRate` (the person's own day rate) and `otDayRateHours` (the line's divisor, `standardDayHours`) on each day-rate overtime snapshot line when signing (`TimesheetWeeklyReportLabourLine`), keep them on every re-save, and show a signed line with `CanonicalBusinessEngine` `signedDayRateOvertimeText` (it returns null — the older wording — for a line signed before 1.67.0, an edited or declined line, or one whose stored amount is not exactly what the stored rate pays). Remove `item.baseDayRate = amount / line.days / multiplier`.
- **Live invoice and export rows (S2):** `TimesheetInvoiceRows.rows` carries the live line's `otMultiplier`, `otBaseDayRate` and `standardDayHours`, so Generate invoice and Export read in hours like web.
- **Live lines:** read in hours only with the collector's `otBaseDayRate`; never the multiplied rate ÷ the multiplier.

## Second review of #378 (also in this release)

- **Live rows, non-circular check (SF1):** `InvoiceLineItem.dayRateOvertimeText` shows the hours wording only when the row's `amount` equals `payForHours` (day rate, the row's paid hours, divisor, multiplier); comparing with the script's own `pay` is circular (it is the amount given). A row revised by Edit hours keeps the older wording. Test: a live row at £300 whose hours pay £238.24.
- **Compile fix:** read `otBaseDayRate` / `otDayRateHours` as `((row["…"] as? NSNumber)?.doubleValue).flatMap { … }`.
- **Signed lines:** details that mention a break but carry no readable multiplied text keep the older wording (in the script; nothing to do in Swift).

## New rulebook sections

- 1.67.0 — 2026-11-18

## Workflow for the iOS agent

1. Run `scripts/sync-rulebook-from-web.sh` (or copy the files above), then run the iOS tests.
2. Produce a numbered Gap Report (Finding / Evidence / Rule / Severity / Solution / Action) for the changes above and **stop**.
3. Implement only what the user approves, in the iOS repo only.
4. Report any web-side gap back to the web agent instead of diverging on iOS.
