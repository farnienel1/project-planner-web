# iOS follow-on — rulebook 1.69.0

Generated 2026-11-19 by `npm run rulebook:handoff` in project-planner-web. Paste this whole file into the iOS agent.
The web repo copy of `docs/RULEBOOK.md` is canonical. iOS mirrors it exactly; never edit the iOS mirror by hand.

```
╔══════════════════════════════════════════════════════════════════╗
║ FOLLOW-ON — paste into the iOS agent                             ║
╚══════════════════════════════════════════════════════════════════╝
Started on: web
Rulebook version: 1.68.0 → 1.69.0
Packed hash: 107d8df52b9357ae55ce7ccdf8e47d935d9efd7a7392af369c26033f102b9cf9
Rulebook sha256: 2fce853e759b853496ba8ae78e58d2aea3727027edf7858d56f33b67cb406026
Copy (do not edit by hand) — run scripts/sync-rulebook-from-web.sh in the iOS repo, which copies:
  web lib/canonical/dist/canonical-business.js      → iOS Project Planner/Canonical/canonical-business.js
  web lib/canonical/dist/canonical-business.sha256  → iOS Project Planner/Canonical/canonical-business.js.sha256
  web lib/canonical/dist/canonical-manifest.json    → iOS Project Planner/Canonical/canonical-manifest.json
  web docs/RULEBOOK.md                              → iOS docs/RULEBOOK.md
  web lib/canonical/parity-fixture.json             → iOS ProjectPlannerTests/CanonicalParityFixture.json
  web lib/canonical/cross-platform-contract.json    → iOS ProjectPlannerTests/CrossPlatformContract.json
  web lib/canonical/data-parity-fixture.json        → iOS ProjectPlannerTests/DataParityFixture.json
Contract sha256: 926b910948b674b1fa259e8f933ddd15f14bad00b8e0b050ccbd88c723bf64aa
Data-parity fixture sha256: c2db4a64c22f36ddda48453c0d26da28fc802df9c8c93c0d876e8097a9eb176f
Call: CanonicalBusinessEngine — no second calculator in Swift.
Exports added: bookingHoursBreakdownDays, bookingHoursBreakdownRows
Exports removed: none
Web files that changed the rules: docs/RULEBOOK.md, lib/canonical/bookingHoursBreakdown.test.ts, lib/canonical/bookingHoursBreakdown.ts, lib/canonical/bundleEntry.ts, lib/canonical/canonical.test.ts, lib/canonical/index.ts
Done when:
- [ ] Packed hash in iOS equals 107d8df52b9357ae55ce7ccdf8e47d935d9efd7a7392af369c26033f102b9cf9
- [ ] iOS docs/RULEBOOK.md is byte-identical (sha256 2fce853e759b853496ba8ae78e58d2aea3727027edf7858d56f33b67cb406026)
- [ ] RulebookParityTests pass (CanonicalBusinessEngine.rulebookVersion() == 1.69.0)
- [ ] Every Swift caller of a changed rule calls CanonicalBusinessEngine
- [ ] Same Firebase fields read and written as web
- [ ] Any disagreement traced to its first divergence — no copied screen number
```

## What changed in 1.69.0

- **The simple hours breakdown** (§4.3, owner request 17 Nov): new `bookingHoursBreakdownRows` / `bookingHoursBreakdownDays` — one summary line ("06:00–17:30 · 12.25 paid hours") and Normal hours / Overtime / Total paid hours rows with a header "{Day}, {day type}", read only from `payrollHoursResult` (`payrollMultipliedHours`, `payrollLineClockRanges`), so Normal + Overtime = Total = the Save button. The shown rows always add up exactly (Normal = shown Total − shown Overtime, in hundredths). Replaces the long `bookingHoursExplanation` text and the 1.18.0 per-day weekend rows on every booking screen on web (the "Change this booking" sheet, Edit booking, Quick Add, Book labour, My Schedule, the Schedule wizard and its review, the subcontractor booking sheet, Edit hours on a timesheet) and iOS; `bookingHoursExplanation` and `weekendBookingBreakdown` stay for older builds and the Working hours preview. Wording only: no figure, rule or write changes. Renumbered at merge after 1.59.0–1.61.0.
- **The breakdown rows always add up exactly** (§4.3, owner 17 Nov: the calculation never fails, the text only displays it): `bookingHoursBreakdownRows` shows Total as `totalPaidHours` rounded to the hundredth, Overtime as its paid hours rounded, and Normal as the shown Total less the shown Overtime (a lone row is the Total); `normalPaidHours` / `overtimePaidHours` are the shown figures. Before, Normal and Overtime were each rounded and could differ from Total by 0.01. Display only — no pay-rule value changes. Property test in `canonical.test.ts` (3,000 random working hours, breaks, set-window weekends and rates).

## New rulebook sections

- 1.69.0 — 2026-11-19

## Workflow for the iOS agent

1. Run `scripts/sync-rulebook-from-web.sh` (or copy the files above), then run the iOS tests.
2. Produce a numbered Gap Report (Finding / Evidence / Rule / Severity / Solution / Action) for the changes above and **stop**.
3. Implement only what the user approves, in the iOS repo only.
4. Report any web-side gap back to the web agent instead of diverging on iOS.
