# iOS follow-on — rulebook 1.54.2

Generated 2026-11-16 by `npm run rulebook:handoff` in project-planner-web. Paste this whole file into the iOS agent.
The web repo copy of `docs/RULEBOOK.md` is canonical. iOS mirrors it exactly; never edit the iOS mirror by hand.

```
╔══════════════════════════════════════════════════════════════════╗
║ FOLLOW-ON — paste into the iOS agent                             ║
╚══════════════════════════════════════════════════════════════════╝
Started on: web
Rulebook version: 1.54.1 → 1.54.2
Packed hash: a32fb9ccef1e2fad891fc66bdd192db24133443bcec0c02f706f46eb185ba969
Rulebook sha256: 6664e93690300aa0a7b14ef76dd10fbc36146fcfdf859bf8b29d202cb43793b3
Copy (do not edit by hand) — run scripts/sync-rulebook-from-web.sh in the iOS repo, which copies:
  web lib/canonical/dist/canonical-business.js      → iOS Project Planner/Canonical/canonical-business.js
  web lib/canonical/dist/canonical-business.sha256  → iOS Project Planner/Canonical/canonical-business.js.sha256
  web lib/canonical/dist/canonical-manifest.json    → iOS Project Planner/Canonical/canonical-manifest.json
  web docs/RULEBOOK.md                              → iOS docs/RULEBOOK.md
  web lib/canonical/parity-fixture.json             → iOS ProjectPlannerTests/CanonicalParityFixture.json
  web lib/canonical/cross-platform-contract.json    → iOS ProjectPlannerTests/CrossPlatformContract.json
  web lib/canonical/data-parity-fixture.json        → iOS ProjectPlannerTests/DataParityFixture.json
Contract sha256: 5a8a7e4e6f56b91cb18f71e79207782b8840fccf0b63b695826c47e18e59a32e
Data-parity fixture sha256: c2db4a64c22f36ddda48453c0d26da28fc802df9c8c93c0d876e8097a9eb176f
Call: CanonicalBusinessEngine — no second calculator in Swift.
Exports added: none
Exports removed: none
Web files that changed the rules: docs/RULEBOOK.md, firestore.rules
Done when:
- [ ] Packed hash in iOS equals a32fb9ccef1e2fad891fc66bdd192db24133443bcec0c02f706f46eb185ba969
- [ ] iOS docs/RULEBOOK.md is byte-identical (sha256 6664e93690300aa0a7b14ef76dd10fbc36146fcfdf859bf8b29d202cb43793b3)
- [ ] RulebookParityTests pass (CanonicalBusinessEngine.rulebookVersion() == 1.54.2)
- [ ] Every Swift caller of a changed rule calls CanonicalBusinessEngine
- [ ] Same Firebase fields read and written as web
- [ ] Any disagreement traced to its first divergence — no copied screen number
```

## What changed in 1.54.2

- **A missing timesheet is decided by its id** (§16, hotfix; `privatePay` is on for every company): `timesheetSubjectUid` on a read of a document that does not exist takes the person from the id (`timesheet_{uid}_{period}`), and the settings read rule decides a missing `timesheet_*` id on its own branch — `!privatePayOn` (every member, as before), the id's own person, admins, the platform owner, the person's line managers (`timesheetReviewerOfOthers`) and pay viewers (`canViewPayOfAsMember`). Before, the read dereferenced the missing document (`request.resource`), so with `privatePay` on a line manager's read of a report's not-yet-created sheet was refused. Web `loadTimesheetDraftByCandidates` reads several candidate ids in parallel and throws on any refusal, so line managers could not open any report's timesheet on web (and Export stopped); iOS `loadTimesheetState` reads one id, so a report's period with no sheet yet showed "Couldn't load this timesheet". Admins and the person themselves were never affected. Nothing else is opened: an existing sheet keeps its rule, and a missing sheet of someone the caller does not line-manage (or an id naming no users document) stays refused.
- **Measurements:** static compile cost 231,835 → **234,997** (CI budget 245,000); `firestore.rules` 147,533 → 147,978 bytes (budget 148,480, unchanged); emulator type check 0 issues; suites all pass on a fresh emulator per suite (new suite 10/10); `RULES_STRICT_BUDGET=1` 5 limit refusals against main's 6 (1.13.0 Q1's privatePay timesheet read is now a logical denial), none new.

## New rulebook sections

- 1.54.2 — 2026-11-16

## Workflow for the iOS agent

1. Run `scripts/sync-rulebook-from-web.sh` (or copy the files above), then run the iOS tests.
2. Produce a numbered Gap Report (Finding / Evidence / Rule / Severity / Solution / Action) for the changes above and **stop**.
3. Implement only what the user approves, in the iOS repo only.
4. Report any web-side gap back to the web agent instead of diverging on iOS.
