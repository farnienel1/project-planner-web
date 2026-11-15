# iOS follow-on — rulebook 1.53.1

Generated 2026-11-15 by `npm run rulebook:handoff` in project-planner-web. Paste this whole file into the iOS agent.
The web repo copy of `docs/RULEBOOK.md` is canonical. iOS mirrors it exactly; never edit the iOS mirror by hand.

```
╔══════════════════════════════════════════════════════════════════╗
║ FOLLOW-ON — paste into the iOS agent                             ║
╚══════════════════════════════════════════════════════════════════╝
Started on: web
Rulebook version: 1.53.1 → 1.53.1
Packed hash: d58b40217f0d01f72155939207573c4f7f3d15dec083e2d7db1974e242f4402b
Rulebook sha256: 03b2a324467a9b0e41fb6f04d115a953b2c65befe0816984ee69f1677c69e5f1
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
- [ ] Packed hash in iOS equals d58b40217f0d01f72155939207573c4f7f3d15dec083e2d7db1974e242f4402b
- [ ] iOS docs/RULEBOOK.md is byte-identical (sha256 03b2a324467a9b0e41fb6f04d115a953b2c65befe0816984ee69f1677c69e5f1)
- [ ] RulebookParityTests pass (CanonicalBusinessEngine.rulebookVersion() == 1.53.1)
- [ ] Every Swift caller of a changed rule calls CanonicalBusinessEngine
- [ ] Same Firebase fields read and written as web
- [ ] Any disagreement traced to its first divergence — no copied screen number
```

## What changed in 1.53.1

- **Security rules hardening, no app change** (§16; pre-launch follow-ups from 1.31.1). (1) An admin's update of another person's users document checks privilege values like every other users write path (`privilegeWriteTyped`: a written or changed privilege key, top level or `permissions`, is a bool or null; a written role is one the apps write); one check now serves the admin and the operatives-manager paths. (2) `members` on the organisation document: a written value is a role word; a legacy value stored on one entry can no longer be copied onto another (`membersValuesTyped` counts the non-role values). (3) Nobody switches their own Annual Leave Management or Timesheet self-sign off, non-admins included (admins since 1.31.1; the value in effect is compared, so a save writing it back passes). (4) A redundant platform-owner test in the settings read rule is removed (same decision). The Super Admin's own document (the creator, or a stored `isSuperAdmin`) keeps its exemption, so a Super Admin transfer from a legacy founder document still saves. Static compile cost 229,614 → 230,031; emulator type check 0 issues; new suite `tests/rulesHardening.rules.test.ts`.


## Workflow for the iOS agent

1. Run `scripts/sync-rulebook-from-web.sh` (or copy the files above), then run the iOS tests.
2. Produce a numbered Gap Report (Finding / Evidence / Rule / Severity / Solution / Action) for the changes above and **stop**.
3. Implement only what the user approves, in the iOS repo only.
4. Report any web-side gap back to the web agent instead of diverging on iOS.
