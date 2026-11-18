# iOS follow-on — rulebook 1.66.0

Generated 2026-11-18 by `npm run rulebook:handoff` in project-planner-web. Paste this whole file into the iOS agent.
The web repo copy of `docs/RULEBOOK.md` is canonical. iOS mirrors it exactly; never edit the iOS mirror by hand.

```
╔══════════════════════════════════════════════════════════════════╗
║ FOLLOW-ON — paste into the iOS agent                             ║
╚══════════════════════════════════════════════════════════════════╝
Started on: web
Rulebook version: 1.63.0 → 1.66.0
Packed hash: 6f6f010c2662440c3f24013b1304f2f485d1c9799602fd5b825918965edbc691
Rulebook sha256: 3a9cd61cd9eded80957ebc391f7b01fc1aea90600657fc115023d2f8be230990
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
Exports added: timesheetSheetHasActivity, userTimesheetQueue, userTimesheetQueueCounts
Exports removed: none
Web files that changed the rules: docs/RULEBOOK.md, lib/canonical/bundleEntry.ts, lib/canonical/index.ts, lib/canonical/parity-fixture.json, lib/canonical/userTimesheetQueue.scenario.ts, lib/canonical/userTimesheetQueue.test.ts, lib/canonical/userTimesheetQueue.ts
Done when:
- [ ] Packed hash in iOS equals 6f6f010c2662440c3f24013b1304f2f485d1c9799602fd5b825918965edbc691
- [ ] iOS docs/RULEBOOK.md is byte-identical (sha256 3a9cd61cd9eded80957ebc391f7b01fc1aea90600657fc115023d2f8be230990)
- [ ] RulebookParityTests pass (CanonicalBusinessEngine.rulebookVersion() == 1.66.0)
- [ ] Every Swift caller of a changed rule calls CanonicalBusinessEngine
- [ ] Same Firebase fields read and written as web
- [ ] Any disagreement traced to its first divergence — no copied screen number
```

## What changed in 1.66.0

- **Awaiting sign-off and Signed off list every timesheet waiting, however old** (§8, owner decision 17 Nov: both apps must agree exactly). New `userTimesheetQueue` / `userTimesheetQueueCounts` (`lib/canonical/userTimesheetQueue.ts`): one row per person per pay run from every stored sheet the viewer's people have (`userTimesheetSubjects`, people folded with `personIdSet`, sheets under any id they go by, without case), PAYE-only runs skipped (`showsMyTimesheets`), one sheet per run (`pickTimesheetRowForPeriod`, the latest revision), bucket `timesheetListBucket` with the sheet's booking change when its run's bookings are loaded, else its late extras alone (`timesheetChangesWithLateExtras(null, timesheetLateExtrasSummary(data))`: a late extra waiting on an old run is Awaiting). New `timesheetSheetHasActivity` (one rule for both apps: signatures, export, entries, late extras, signed snapshot, note). Shared scenario in `parity-fixture.json`.
- Web: User Timesheets → Awaiting / Signed off and the hub tile counts read every stored sheet (`loadTimesheetQueueSheets`, with the upper / lower-case spellings of UUID-shaped ids) instead of the last six pay runs; `loadTimesheetQueueDrafts`, `draftsForMembers`, `timesheetQueueRows`, `currentPeriodTimesheetMembers`, `currentPeriodTimesheetBucketCounts`, `timesheetReviewerHubStats` and `pickTimesheetGroupDraft` are removed. Guardrail 3: older awaiting and signed-not-exported sheets newly appear. What may drop out of view: a sheet stored with no `userId`, or under a mixed-case id in another spelling, is not loaded by the `userId in` query; admins keep it for the last six pay runs (a `weekStartKey` pass, on both apps), line managers and older runs do not (known limit). A failed load is shown, never 0 / 0 / 0. The list and the hub tile check booking changes over the same last six pay runs.
- iOS (hand-off): the Awaiting and Signed off lists and the landing counts call `userTimesheetQueue` — one row per person (a person with two records was counted twice), PAYE runs left out, Signed off every age (Email and export one email per pay run); person ids from `personIdSet`, activity from `timesheetSheetHasActivity`, booking changes over the last six pay runs only (as web); a failed sheet load is shown, never an empty list.

## New rulebook sections

- 1.66.0 — 2026-11-18

## Workflow for the iOS agent

1. Run `scripts/sync-rulebook-from-web.sh` (or copy the files above), then run the iOS tests.
2. Produce a numbered Gap Report (Finding / Evidence / Rule / Severity / Solution / Action) for the changes above and **stop**.
3. Implement only what the user approves, in the iOS repo only.
4. Report any web-side gap back to the web agent instead of diverging on iOS.
