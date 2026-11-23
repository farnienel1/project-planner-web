# iOS follow-on — rulebook 1.73.0

Generated 2026-11-23 by `npm run rulebook:handoff` in project-planner-web. Paste this whole file into the iOS agent.
The web repo copy of `docs/RULEBOOK.md` is canonical. iOS mirrors it exactly; never edit the iOS mirror by hand.

```
╔══════════════════════════════════════════════════════════════════╗
║ FOLLOW-ON — paste into the iOS agent                             ║
╚══════════════════════════════════════════════════════════════════╝
Started on: web
Rulebook version: 1.72.0 → 1.73.0
Packed hash: b3a89c6a09ed185a06b156c926a4744c954425d7785da58f52808643f3d7389f
Rulebook sha256: 834aa9fc370e44ba5d9e0a52c228cce52f2ceafb14b5c54a37080429227df6a5
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
Exports added: DAILY_OVERVIEW_STANDARD_HOURS_LABEL, DAILY_OVERVIEW_WEEKEND_WINDOW_HOURS_LABEL, LEAVE_CLASH_WARNING_TITLE, LEAVE_COVER_WARNING_TITLE, assignedQualificationExpiries, dailyOverviewStandardHoursLabel, personQualifications, qualificationExpiryDate, withQualificationExpiry
Exports removed: none
Web files that changed the rules: docs/RULEBOOK.md, lib/canonical/bookingSlots.ts, lib/canonical/bundleEntry.ts, lib/canonical/canonical.test.ts, lib/canonical/index.ts, lib/canonical/leaveCoverage.ts, lib/canonical/operativeQualifications.ts, lib/canonical/parity-fixture.json
Done when:
- [ ] Packed hash in iOS equals b3a89c6a09ed185a06b156c926a4744c954425d7785da58f52808643f3d7389f
- [ ] iOS docs/RULEBOOK.md is byte-identical (sha256 834aa9fc370e44ba5d9e0a52c228cce52f2ceafb14b5c54a37080429227df6a5)
- [ ] RulebookParityTests pass (CanonicalBusinessEngine.rulebookVersion() == 1.73.0)
- [ ] Every Swift caller of a changed rule calls CanonicalBusinessEngine
- [ ] Same Firebase fields read and written as web
- [ ] Any disagreement traced to its first divergence — no copied screen number
```

## What changed in 1.73.0

- **One qualification expiry rule** (§5, owner 23 Nov, gap 1): new `qualificationExpiryDate`, `withQualificationExpiry`, `assignedQualificationExpiries`, `personQualifications` (types `QualificationOperativeRow`, `PersonQualification`) in `lib/canonical/operativeQualifications.ts`, moved from web `lib/qualifications/personQualifications.ts` (web #415). Same results on web (the expiry also reads ISO text and epoch ms, so iOS can pass its stored values through the packed script). Web's profile page, qualifications editor and expiry warnings (`qualificationExpiryOperatives`) call them; the web copies are deleted. iOS `PersonQualifications.expiryDate` to call them (hand-off).
- **"Half-day leave not covered" is "Half-day unbooked"** (§5, owner 23 Nov, batch 3 item 3): new `LEAVE_COVER_WARNING_TITLE` and `LEAVE_CLASH_WARNING_TITLE`; `leaveCoverageRows` `leave_cover` rows carry the new title (parity fixture updated). Web Daily Overview's card uses the constant; Warnings shows the row's title. Button words unchanged.
- **Daily Overview weekend label shared** (§6, owner 23 Nov, item 31 option 1): new `dailyOverviewStandardHoursLabel`, `DAILY_OVERVIEW_STANDARD_HOURS_LABEL`, `DAILY_OVERVIEW_WEEKEND_WINDOW_HOURS_LABEL` in `bookingSlots.ts` (takes the policy or the policy state), moved from web `lib/daily-overview/standardHoursLabel.ts` (web #417, deleted). Same text; iOS `DailyOverviewView` to call it.

## iOS work for 1.73.0

1. **Qualification expiry (gap 1).** Replace `PersonQualifications.expiryDate` (and any other Swift read of `qualificationExpiryDates[...]`) with `qualificationExpiryDate(dates, qualificationId)` through `CanonicalBusinessEngine` (pass the stored map as ISO text or epoch ms; the exact key first, else the id in another letter case). When the editor sets or clears a date, build the map with `withQualificationExpiry(dates, qualificationId, date)` (every other spelling of the id removed). The profile's qualification list is `personQualifications({ rows, preferredRowId })` over every `operatives` row of the person (the person fold `taskPersonIndex`; placeholder rows left out): active rows first, then the row the editor saves to, then the fullest. The qualification-expiry warnings' per-row input is `assignedQualificationExpiries(row)`. Delete the Swift copies.
2. **"Half-day unbooked" (batch 3 item 3).** The half-day card on Warnings and Daily Overview shows `LEAVE_COVER_WARNING_TITLE` ("Half-day unbooked"; was "Half-day leave not covered"), or the row's own `title` from `leaveCoverageRows`. Never a hard-coded title in Swift. Buttons unchanged ("Book the AM / PM", "Open daily overview", "Annual leave").
3. **Weekend label (item 31).** `DailyOverviewView.swift` (~652, the "Standard hrs" figure) shows `dailyOverviewStandardHoursLabel({ policyOrState, dayKey, timeZone, loaded })` → `label` and, when not null, `hint` under it ("Weekend window hrs" · "07:30–14:00 counts as a full day"); pass `loaded: false` until the organisation's settings have loaded. Figures unchanged.
4. **Gap 3 (no rulebook change, listed here so it is not lost).** `HomeQuickActionRegistry`, `ProjectDetailView` and `MyScheduleView` decide whether Book labour is offered with `canScheduleOperatives` through `CanonicalBusinessEngine`, not their own role checks (web already does).
5. **Release order:** no `minimumIosBuild` raise needed; iOS 1.73 syncs whenever ready (web 1.73.0 is hosting only).

## New rulebook sections

- 1.73.0 — 2026-11-23

## Workflow for the iOS agent

1. Run `scripts/sync-rulebook-from-web.sh` (or copy the files above), then run the iOS tests.
2. Produce a numbered Gap Report (Finding / Evidence / Rule / Severity / Solution / Action) for the changes above and **stop**.
3. Implement only what the user approves, in the iOS repo only.
4. Report any web-side gap back to the web agent instead of diverging on iOS.
