# iOS follow-on — rulebook 1.32.3

Generated 2026-11-06 by `npm run rulebook:handoff` in project-planner-web. Paste this whole file into the iOS agent.
The web repo copy of `docs/RULEBOOK.md` is canonical. iOS mirrors it exactly; never edit the iOS mirror by hand.

```
╔══════════════════════════════════════════════════════════════════╗
║ FOLLOW-ON — paste into the iOS agent                             ║
╚══════════════════════════════════════════════════════════════════╝
Started on: web
Rulebook version: 1.32.2 → 1.32.3
Packed hash: 61ceba93e3f5e3840f7972834ee560ad69aa8910715487e5ea4f2b82fa64a54c
Rulebook sha256: a4f726a1ff48fc8e245fb1ea6af4e7ea695dc0620e26e6eb1f2481e865bfd5ee
Copy (do not edit by hand) — run scripts/sync-rulebook-from-web.sh in the iOS repo, which copies:
  web lib/canonical/dist/canonical-business.js      → iOS Project Planner/Canonical/canonical-business.js
  web lib/canonical/dist/canonical-business.sha256  → iOS Project Planner/Canonical/canonical-business.js.sha256
  web lib/canonical/dist/canonical-manifest.json    → iOS Project Planner/Canonical/canonical-manifest.json
  web docs/RULEBOOK.md                              → iOS docs/RULEBOOK.md
  web lib/canonical/parity-fixture.json             → iOS ProjectPlannerTests/CanonicalParityFixture.json
  web lib/canonical/cross-platform-contract.json    → iOS ProjectPlannerTests/CrossPlatformContract.json
Contract sha256: 7f70ec28920ac6114068b4e44eaf893706d5b6af1b21d77b69f946074d74e126
Call: CanonicalBusinessEngine — no second calculator in Swift.
Exports added: none
Exports removed: none
Web files that changed the rules: docs/RULEBOOK.md, firestore.rules
Done when:
- [ ] Packed hash in iOS equals 61ceba93e3f5e3840f7972834ee560ad69aa8910715487e5ea4f2b82fa64a54c
- [ ] iOS docs/RULEBOOK.md is byte-identical (sha256 a4f726a1ff48fc8e245fb1ea6af4e7ea695dc0620e26e6eb1f2481e865bfd5ee)
- [ ] RulebookParityTests pass (CanonicalBusinessEngine.rulebookVersion() == 1.32.3)
- [ ] Every Swift caller of a changed rule calls CanonicalBusinessEngine
- [ ] Same Firebase fields read and written as web
- [ ] Any disagreement traced to its first divergence — no copied screen number
```

## What changed in 1.32.3

- Rules compile cost cut from 383,790 to 367,346 (static cost, `scripts/rules-cost/metric.py` `total2`; −16,444, −4.3%); no allow/deny change. This makes room for the 1.33 rules changes. The invitation `list`, `create`, `update` and `delete` allows are one allow with a `request.method` test, so `canAdministerInvitation` and `invitationCallerKnown` are checked in one place, and nine helpers that had no `let` are written out where they were called (`canAdministerInvitation`, `invitationCallerKnown`, `legacyMemberRead`, `isOrganizationAdminAnyBilling`, `hbRequesterUid`, `isTimesheetSettingsDoc`, `canChangePayOf`, `hbCallerSelfBooks`, `rosterRowAdmin`). `firestore.rules` 142,995 → 142,906 bytes. Details and where each helper went: `docs/firestore-rules-notes.md` "1.32.3". Rules suites 223/223; `RULES_STRICT_BUDGET=1` the same 43 limit refusals as 1.32.2, none new; emulator type check 0 issues.

## New rulebook sections

- 1.32.3 — 2026-11-06

## Workflow for the iOS agent

1. Run `scripts/sync-rulebook-from-web.sh` (or copy the files above), then run the iOS tests.
2. Produce a numbered Gap Report (Finding / Evidence / Rule / Severity / Solution / Action) for the changes above and **stop**.
3. Implement only what the user approves, in the iOS repo only.
4. Report any web-side gap back to the web agent instead of diverging on iOS.
