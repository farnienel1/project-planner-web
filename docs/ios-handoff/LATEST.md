# iOS follow-on — rulebook 1.18.0

Generated 2026-11-03 by `npm run rulebook:handoff` in project-planner-web. Paste this whole file into the iOS agent.
The web repo copy of `docs/RULEBOOK.md` is canonical. iOS mirrors it exactly; never edit the iOS mirror by hand.

```
╔══════════════════════════════════════════════════════════════════╗
║ FOLLOW-ON — paste into the iOS agent                             ║
╚══════════════════════════════════════════════════════════════════╝
Started on: web
Rulebook version: 1.17.0 → 1.18.0
Packed hash: 68b96e0f017cf6dcfa2efda88f1427285d7ea08def6d5718bb4e704be83a38a8
Rulebook sha256: 80ba8d122471b2ef904448a8e6d5e05886e34f5d1848710988800e904e2c43ae
Copy (do not edit by hand) — run scripts/sync-rulebook-from-web.sh in the iOS repo, which copies:
  web lib/canonical/dist/canonical-business.js      → iOS Project Planner/Canonical/canonical-business.js
  web lib/canonical/dist/canonical-business.sha256  → iOS Project Planner/Canonical/canonical-business.js.sha256
  web lib/canonical/dist/canonical-manifest.json    → iOS Project Planner/Canonical/canonical-manifest.json
  web docs/RULEBOOK.md                              → iOS docs/RULEBOOK.md
  web lib/canonical/parity-fixture.json             → iOS ProjectPlannerTests/CanonicalParityFixture.json
  web lib/canonical/cross-platform-contract.json    → iOS ProjectPlannerTests/CrossPlatformContract.json
Contract sha256: d655dd7d122e53a1167569216d43cba7598670671310ca84c59ea7e46373b7e6
Call: CanonicalBusinessEngine — no second calculator in Swift.
Exports added: customHoursPrefillForDays, weekendBookingBreakdown
Exports removed: none
Web files that changed the rules: docs/RULEBOOK.md, lib/canonical/bookingSlots.ts, lib/canonical/bundleEntry.ts, lib/canonical/canonical.test.ts, lib/canonical/index.ts
Done when:
- [ ] Packed hash in iOS equals 68b96e0f017cf6dcfa2efda88f1427285d7ea08def6d5718bb4e704be83a38a8
- [ ] iOS docs/RULEBOOK.md is byte-identical (sha256 80ba8d122471b2ef904448a8e6d5e05886e34f5d1848710988800e904e2c43ae)
- [ ] RulebookParityTests pass (CanonicalBusinessEngine.rulebookVersion() == 1.18.0)
- [ ] Every Swift caller of a changed rule calls CanonicalBusinessEngine
- [ ] Same Firebase fields read and written as web
- [ ] Any disagreement traced to its first divergence — no copied screen number
```

## What changed in 1.18.0

- Custom hours follow the selection kind (§4.3, owner bug): `customHoursPrefillForDays(policyOrState, dayKeys, timeZone)` → `{ start, end, kind: 'weekday' | 'weekend' | 'none' } | null`. A multi-day picker that pre-filled weekend times (`weekendCustomHoursDefault`) kept them after the weekend days were unticked and weekdays picked. Now, when the selection changes kind, start and finish reset to that kind's default straight away: weekend → the first selected weekend day with a set window, Saturdays first (Sunday's when Saturday pays every hour at N×), else the editor's usual times; weekday → the standard day (`halfDayWindows`) in effect on the first selected day (`effectivePayrollTimePolicy` when given the policy state). Within the same kind the times are left alone, so a manual edit survives adding a day. iOS: call `customHoursPrefillForDays` (through `CanonicalBusinessEngine`, passing the policy state) in every multi-day booking picker and reset start/finish whenever the returned `kind` changes (ignore `none` and null).
- Per-day hours for weekend bookings (§4.3, owner decision): `weekendBookingBreakdown(policyOrState, dayKeys, start, end, isBreakRemoved, timeZone)` returns one row per selected day (`dayKey`, `weekdayLabel`, `start`, `end`, `workedHours`, `countsAsHours`, `standardHours`, `overtimeHours`, `multiplier`, `paidHoursEquivalent`, `line`), each from `payrollHoursResult` for that day under the rules in effect on it (no second calculator; weekends take no unpaid break off, as pay). Owner's example: Saturday window 07:30–14:00 counts as 8h, Sunday every hour at 2× → "Saturday 07:30–14:00 = 8h (counts as a full day)", "Sunday 07:30–14:00 = 6.5h × 2 = 13h". Saturday and Sunday stay bookable together whatever their rules. Web shows these rows in place of the standard-day summary in the custom-hours picker, Quick Add, booking edit, Daily Overview booking sheet and the Schedule wizard review. iOS: call `weekendBookingBreakdown` (through `CanonicalBusinessEngine`, passing the policy state) for every weekend booking confirm / hours breakdown and render its rows; never compute weekend hours in Swift.
- Clash rows (§5, owner decision, no rule change): every booking flow shows a double booking as an orange row in the same list and style as the purple annual-leave rows (✓ keep, ✕ drop, under `BOOKING_CONFLICTS_HEADING`) — never a separate alert, banner or confirm. iOS: route every booking flow's clash prompt through the same conflict rows.

## New rulebook sections

- 1.18.0 — 2026-11-03

## Workflow for the iOS agent

1. Run `scripts/sync-rulebook-from-web.sh` (or copy the files above), then run the iOS tests.
2. Produce a numbered Gap Report (Finding / Evidence / Rule / Severity / Solution / Action) for the changes above and **stop**.
3. Implement only what the user approves, in the iOS repo only.
4. Report any web-side gap back to the web agent instead of diverging on iOS.
