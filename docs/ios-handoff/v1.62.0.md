# iOS follow-on — rulebook 1.62.0

Generated 2026-11-17 by `npm run rulebook:handoff` in project-planner-web. Paste this whole file into the iOS agent.
The web repo copy of `docs/RULEBOOK.md` is canonical. iOS mirrors it exactly; never edit the iOS mirror by hand.

```
╔══════════════════════════════════════════════════════════════════╗
║ FOLLOW-ON — paste into the iOS agent                             ║
╚══════════════════════════════════════════════════════════════════╝
Started on: web
Rulebook version: 1.58.0 → 1.62.0
Packed hash: b05aeb9fed00324a2690c6dafbf85db64fd703a986cbe1d18159338c6378ee39
Rulebook sha256: ad6dea37d1724e70296148940138b7b89b156027103deab20f269e664d895852
Copy (do not edit by hand) — run scripts/sync-rulebook-from-web.sh in the iOS repo, which copies:
  web lib/canonical/dist/canonical-business.js      → iOS Project Planner/Canonical/canonical-business.js
  web lib/canonical/dist/canonical-business.sha256  → iOS Project Planner/Canonical/canonical-business.js.sha256
  web lib/canonical/dist/canonical-manifest.json    → iOS Project Planner/Canonical/canonical-manifest.json
  web docs/RULEBOOK.md                              → iOS docs/RULEBOOK.md
  web lib/canonical/parity-fixture.json             → iOS ProjectPlannerTests/CanonicalParityFixture.json
  web lib/canonical/cross-platform-contract.json    → iOS ProjectPlannerTests/CrossPlatformContract.json
  web lib/canonical/data-parity-fixture.json        → iOS ProjectPlannerTests/DataParityFixture.json
Contract sha256: 5b2615b5540b55f716d40617dd791dbcda6290348ef18951186f47e2e5b7cd20
Data-parity fixture sha256: c2db4a64c22f36ddda48453c0d26da28fc802df9c8c93c0d876e8097a9eb176f
Call: CanonicalBusinessEngine — no second calculator in Swift.
Exports added: userTimesheetQueue, userTimesheetQueueCounts
Exports removed: none
Web files that changed the rules: docs/RULEBOOK.md, lib/canonical/bundleEntry.ts, lib/canonical/index.ts, lib/canonical/parity-fixture.json, lib/canonical/userTimesheetQueue.scenario.ts, lib/canonical/userTimesheetQueue.test.ts, lib/canonical/userTimesheetQueue.ts
Done when:
- [ ] Packed hash in iOS equals b05aeb9fed00324a2690c6dafbf85db64fd703a986cbe1d18159338c6378ee39
- [ ] iOS docs/RULEBOOK.md is byte-identical (sha256 ad6dea37d1724e70296148940138b7b89b156027103deab20f269e664d895852)
- [ ] RulebookParityTests pass (CanonicalBusinessEngine.rulebookVersion() == 1.62.0)
- [ ] Every Swift caller of a changed rule calls CanonicalBusinessEngine
- [ ] Same Firebase fields read and written as web
- [ ] Any disagreement traced to its first divergence — no copied screen number
```

## What changed in 1.62.0

- **Awaiting sign-off and Signed off list every timesheet waiting, however old** (§8, owner decision 17 Nov: both apps must agree exactly). New `userTimesheetQueue` / `userTimesheetQueueCounts` (`lib/canonical/userTimesheetQueue.ts`): one row per person per pay run from every stored sheet the viewer's people have (`userTimesheetSubjects`, people folded with `personIdSet`, sheets under any id they go by), PAYE-only runs skipped (`showsMyTimesheets`), one sheet per run (`pickTimesheetRowForPeriod`, the latest revision), bucket `timesheetListBucket` with the sheet's booking change when its run's bookings are loaded (else not changed). Shared scenario in `parity-fixture.json` (both apps run it).
- Web: User Timesheets → Awaiting / Signed off and the hub tile counts read every stored sheet (`loadTimesheetQueueSheets`) instead of the last six pay runs; `loadTimesheetQueueDrafts`, `draftsForMembers` and `timesheetQueueRows` are removed. Guardrail 3: older awaiting and signed-not-exported sheets newly appear; nothing disappears.
- iOS (hand-off): the Awaiting list and landing counts call `userTimesheetQueue` — one row per person (a person with two records was counted twice) and PAYE runs left out.

## New rulebook sections

- 1.62.0 — 2026-11-17

## Workflow for the iOS agent

1. Run `scripts/sync-rulebook-from-web.sh` (or copy the files above), then run the iOS tests.
2. Produce a numbered Gap Report (Finding / Evidence / Rule / Severity / Solution / Action) for the changes above and **stop**.
3. Implement only what the user approves, in the iOS repo only.
4. Report any web-side gap back to the web agent instead of diverging on iOS.
