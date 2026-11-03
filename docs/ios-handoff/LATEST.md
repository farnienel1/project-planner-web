# iOS follow-on — rulebook 1.20.3

Generated 2026-11-03 by `npm run rulebook:handoff` in project-planner-web. Paste this whole file into the iOS agent.
The web repo copy of `docs/RULEBOOK.md` is canonical. iOS mirrors it exactly; never edit the iOS mirror by hand.

```
╔══════════════════════════════════════════════════════════════════╗
║ FOLLOW-ON — paste into the iOS agent                             ║
╚══════════════════════════════════════════════════════════════════╝
Started on: web
Rulebook version: 1.20.2 → 1.20.3
Packed hash: 832e0915cb34cfa1a81a4d92b2c905c3c38f05709ca4c3457b6ecef89d78b331
Rulebook sha256: 7d761fb0fe1058ae6bc977dcf5697ca87ab4774316e92fb181c3f305cf7ff4be
Copy (do not edit by hand) — run scripts/sync-rulebook-from-web.sh in the iOS repo, which copies:
  web lib/canonical/dist/canonical-business.js      → iOS Project Planner/Canonical/canonical-business.js
  web lib/canonical/dist/canonical-business.sha256  → iOS Project Planner/Canonical/canonical-business.js.sha256
  web lib/canonical/dist/canonical-manifest.json    → iOS Project Planner/Canonical/canonical-manifest.json
  web docs/RULEBOOK.md                              → iOS docs/RULEBOOK.md
  web lib/canonical/parity-fixture.json             → iOS ProjectPlannerTests/CanonicalParityFixture.json
  web lib/canonical/cross-platform-contract.json    → iOS ProjectPlannerTests/CrossPlatformContract.json
Contract sha256: c9e307b0604e78284baf3a4f217f0fb3ecc4b227aec957c901bdd93e4e31a306
Call: CanonicalBusinessEngine — no second calculator in Swift.
Exports added: PAYROLL_BREAK_TIME_STEP_MESSAGE, PAYROLL_BREAK_TIME_STEP_MINUTES, WEEKEND_PREVIEW_DAY_KEYS, payrollBreakMinutesOnStep, payrollBreakTimeOnStep, payrollOutsideClockHours, weekendDayPreview
Exports removed: none
Web files that changed the rules: docs/RULEBOOK.md, lib/canonical/bookingSlots.ts, lib/canonical/bundleEntry.ts, lib/canonical/canonical.test.ts, lib/canonical/index.ts, lib/canonical/parity-fixture.json, lib/canonical/payrollHours.ts, lib/canonical/payrollPolicySchedule.ts
Done when:
- [ ] Packed hash in iOS equals 832e0915cb34cfa1a81a4d92b2c905c3c38f05709ca4c3457b6ecef89d78b331
- [ ] iOS docs/RULEBOOK.md is byte-identical (sha256 7d761fb0fe1058ae6bc977dcf5697ca87ab4774316e92fb181c3f305cf7ff4be)
- [ ] RulebookParityTests pass (CanonicalBusinessEngine.rulebookVersion() == 1.20.3)
- [ ] Every Swift caller of a changed rule calls CanonicalBusinessEngine
- [ ] Same Firebase fields read and written as web
- [ ] Any disagreement traced to its first divergence — no copied screen number
```

## What changed in 1.20.3

- Time steps (owner, final): day start and finish (weekday and each weekend window) stay on 30 minutes; lunch break start, end and length are on 15 minutes (`PAYROLL_BREAK_TIME_STEP_MINUTES`, `payrollBreakTimeOnStep`, `payrollBreakMinutesOnStep`, `validatePayrollTimePolicy(policy, previous)`: "Lunch break times and length use 15-minute steps (e.g. 10:45)."); e.g. 10:00–10:45, 45 min. A value stored off its step passes until changed. iOS: 30-minute day pickers, 15-minute break pickers and a 15-minute length stepper (§4.3).
- An unpaid break is plain hours, never multiplied (owner, final): every hour at N× pays clock × N − break (Sunday 07:30–14:00 × 2, 30 min unpaid: 12.5h, was 12h); a break in a set window's outside hours comes off after the multiplier (Saturday 07:30–11:00 counts 4h, ×2, booked 07:30–14:00: 9.5h, was 9h); inside the window and Monday–Friday unchanged. `payrollHoursResult`, `weekendBookingBreakdown` ("6.5h × 2 = 13h − 0.5h unpaid break = 12.5h"), `bookingHoursLabel` ("12.5h (6.5h × 2 − 0.5h break)"), new `payrollOutsideClockHours` (§4.3, §8).
- Working hours weekend preview: `weekendDayPreview(draft, weekday)` gives the example hours, a summary with the break minutes taken off and the paid hours, and the rows — from the draft, so Paid / Unpaid, length and times change it at once; `unpaidBreakAppliesOnDay` judges a weekend day on its own break length, not the weekday length (§4.3).

## New rulebook sections

- 1.20.3 — 2026-11-03

## Workflow for the iOS agent

1. Run `scripts/sync-rulebook-from-web.sh` (or copy the files above), then run the iOS tests.
2. Produce a numbered Gap Report (Finding / Evidence / Rule / Severity / Solution / Action) for the changes above and **stop**.
3. Implement only what the user approves, in the iOS repo only.
4. Report any web-side gap back to the web agent instead of diverging on iOS.
