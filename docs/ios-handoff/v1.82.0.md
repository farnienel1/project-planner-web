# iOS follow-on — rulebook 1.82.0

Generated 2026-11-24 by `npm run rulebook:handoff` in project-planner-web. Paste this whole file into the iOS agent.
The web repo copy of `docs/RULEBOOK.md` is canonical. iOS mirrors it exactly; never edit the iOS mirror by hand.

```
╔══════════════════════════════════════════════════════════════════╗
║ FOLLOW-ON — paste into the iOS agent                             ║
╚══════════════════════════════════════════════════════════════════╝
Started on: web
Rulebook version: 1.81.0 → 1.82.0
Packed hash: 48749ef314109ad27dcfd62474c6aca0b738fe523f9f708612cec6fadf1bbf64
Rulebook sha256: 2bb3f60763ae5cfbf56a5cd804d32f9050174cf0ca0622477820aedc8e20d977
Copy (do not edit by hand) — run scripts/sync-rulebook-from-web.sh in the iOS repo, which copies:
  web lib/canonical/dist/canonical-business.js      → iOS Project Planner/Canonical/canonical-business.js
  web lib/canonical/dist/canonical-business.sha256  → iOS Project Planner/Canonical/canonical-business.js.sha256
  web lib/canonical/dist/canonical-manifest.json    → iOS Project Planner/Canonical/canonical-manifest.json
  web docs/RULEBOOK.md                              → iOS docs/RULEBOOK.md
  web lib/canonical/parity-fixture.json             → iOS ProjectPlannerTests/CanonicalParityFixture.json
  web lib/canonical/cross-platform-contract.json    → iOS ProjectPlannerTests/CrossPlatformContract.json
  web lib/canonical/data-parity-fixture.json        → iOS ProjectPlannerTests/DataParityFixture.json
Contract sha256: d2d465abcf0ab7c7747385346b87d2b47226412b1014602c5a26bff8e951c0ca
Data-parity fixture sha256: c2db4a64c22f36ddda48453c0d26da28fc802df9c8c93c0d876e8097a9eb176f
Call: CanonicalBusinessEngine — no second calculator in Swift.
Exports added: healthSafetyIssueJob, memberNameBackfillEntries, memberNameEditPlan, memberNameEntryMissing, memberNameJoinEntry, siteMapLeaveSummary
Exports removed: none
Web files that changed the rules: docs/RULEBOOK.md, firestore.rules, lib/canonical/bundleEntry.ts, lib/canonical/canonical.test.ts, lib/canonical/index.ts, lib/canonical/memberNames.test.ts, lib/canonical/memberNames.ts, lib/canonical/recordsDocuments.ts, lib/canonical/siteMapLeave.test.ts, lib/canonical/siteMapLeave.ts
Done when:
- [ ] Packed hash in iOS equals 48749ef314109ad27dcfd62474c6aca0b738fe523f9f708612cec6fadf1bbf64
- [ ] iOS docs/RULEBOOK.md is byte-identical (sha256 2bb3f60763ae5cfbf56a5cd804d32f9050174cf0ca0622477820aedc8e20d977)
- [ ] RulebookParityTests pass (CanonicalBusinessEngine.rulebookVersion() == 1.82.0)
- [ ] Every Swift caller of a changed rule calls CanonicalBusinessEngine
- [ ] Same Firebase fields read and written as web
- [ ] Any disagreement traced to its first divergence — no copied screen number
```

## What changed in 1.82.0

- **Site map "On annual leave" is the whole company** (§21, owner answer 24 Nov, item 1): new `siteMapLeaveSummary` (one count per person, the Daily Overview leave days); web uses it instead of Daily Overview's scoped list, iOS instead of only the people booked on the job.
- **Subcontractor documents rule** (§16, §30, item 2): `firestore.rules` `subcontractors` — a change to `documents` only by admins and Sub Contractors managers, one list and one entry at a time in the 1.80.0 shape, paths in the firm's folder. Emulator suite `tests/subcontractorDocuments.rules.test.ts`. Compile cost paid for by equivalent rewrites (Deploy notes 1.82.0).
- **Names per organisation, separate per company** (§11, §16, item 3): new `memberNameEditPlan` (every edit writes the open organisation's entry; the home organisation also the users document; never removes an entry), `memberNameJoinEntry`, `memberNameEntryMissing`, `memberNameBackfillEntries`; `canWriteMemberName` takes `writerManagesOperative` (rules: Operatives managers name operatives of their home organisation). Web: Edit user, My profile, invite accept (new and existing accounts), the signed-in person's missing entry, the owner console (per-organisation name, level and active state; Change name one organisation at a time); owner script `scripts/backfill-member-names.mjs`. `memberNameEditTarget` is kept (it decides `writeAccount`).
- **Old toolbox notices open their job** (§13, item 4): new `healthSafetyIssueJob` (the job whose health & safety documents hold the issue id); web's notice resolver reads the jobs' documents when the id names no job.

## New rulebook sections

- 1.82.0 — 2026-11-24

## Workflow for the iOS agent

1. Run `scripts/sync-rulebook-from-web.sh` (or copy the files above), then run the iOS tests.
2. Produce a numbered Gap Report (Finding / Evidence / Rule / Severity / Solution / Action) for the changes above and **stop**.
3. Implement only what the user approves, in the iOS repo only.
4. Report any web-side gap back to the web agent instead of diverging on iOS.
