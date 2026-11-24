# iOS follow-on — rulebook 1.82.0

Generated 2026-11-24 by `npm run rulebook:handoff` in project-planner-web. Paste this whole file into the iOS agent.
The web repo copy of `docs/RULEBOOK.md` is canonical. iOS mirrors it exactly; never edit the iOS mirror by hand.

```
╔══════════════════════════════════════════════════════════════════╗
║ FOLLOW-ON — paste into the iOS agent                             ║
╚══════════════════════════════════════════════════════════════════╝
Started on: web
Rulebook version: 1.82.0 → 1.82.0
Packed hash: f15aa41c6f41702b03e653549af2837118282be3ff4f6048b7d48886ae3bc0c5
Rulebook sha256: 06a9fac2d84c9f5002c196aa2edd18f11311613e3ae0798d27e80faf65de742f
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
Exports added: memberNameWriterManagesOperative
Exports removed: none
Web files that changed the rules: docs/RULEBOOK.md, firestore.rules, lib/canonical/bundleEntry.ts, lib/canonical/canonical.test.ts, lib/canonical/ghostOperatives.test.ts, lib/canonical/index.ts, lib/canonical/memberNames.test.ts, lib/canonical/memberNames.ts, lib/canonical/userDelete.ts
Done when:
- [ ] Packed hash in iOS equals f15aa41c6f41702b03e653549af2837118282be3ff4f6048b7d48886ae3bc0c5
- [ ] iOS docs/RULEBOOK.md is byte-identical (sha256 06a9fac2d84c9f5002c196aa2edd18f11311613e3ae0798d27e80faf65de742f)
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
- **Review of #442 and owner correction 24 Nov** (same version): a name belongs to the organisation — `memberNameEditTarget` / `memberNameEditPlan` fail closed (an unknown or blank home writes the entry only; no open organisation writes nothing); new `memberNameWriterManagesOperative` (an Operatives manager of the organisation, any operative member of it, whatever the home companies; rules the same, visiting managers through their membership, visiting operatives through `members`); `userDeleteWrites` deletes the person's `memberNames` entry (an `optional` delete, skipped when older rules refuse it); web account self-delete removes the entries in every organisation left and of leftover invite placeholders; the subcontractor expiry write may change only `expiresOn` and a stored `documents: null` reads as none; web's material email names the sender by their name in that organisation; web keeps an invitation's name on the device when the join write could not run; the owner console's Change name uses the users document of the chosen organisation (else the anchored id) for the home test; the names backfill finds users whose organisation is stored as a path or reference.


## Workflow for the iOS agent

1. Run `scripts/sync-rulebook-from-web.sh` (or copy the files above), then run the iOS tests.
2. Produce a numbered Gap Report (Finding / Evidence / Rule / Severity / Solution / Action) for the changes above and **stop**.
3. Implement only what the user approves, in the iOS repo only.
4. Report any web-side gap back to the web agent instead of diverging on iOS.
