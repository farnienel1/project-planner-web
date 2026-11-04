# iOS follow-on — rulebook 1.30.3

Generated 2026-11-04 by `npm run rulebook:handoff` in project-planner-web. Paste this whole file into the iOS agent.
The web repo copy of `docs/RULEBOOK.md` is canonical. iOS mirrors it exactly; never edit the iOS mirror by hand.

```
╔══════════════════════════════════════════════════════════════════╗
║ FOLLOW-ON — paste into the iOS agent                             ║
╚══════════════════════════════════════════════════════════════════╝
Started on: web
Rulebook version: 1.30.2 → 1.30.3
Packed hash: 2b1800dc85773db1112e485f0350c8452103ae03a12a1d30751fd2f5b911213a
Rulebook sha256: cd8b2f927131f6429118c95d82a8be9960460cedff5be24f9a0b67565643fb44
Copy (do not edit by hand) — run scripts/sync-rulebook-from-web.sh in the iOS repo, which copies:
  web lib/canonical/dist/canonical-business.js      → iOS Project Planner/Canonical/canonical-business.js
  web lib/canonical/dist/canonical-business.sha256  → iOS Project Planner/Canonical/canonical-business.js.sha256
  web lib/canonical/dist/canonical-manifest.json    → iOS Project Planner/Canonical/canonical-manifest.json
  web docs/RULEBOOK.md                              → iOS docs/RULEBOOK.md
  web lib/canonical/parity-fixture.json             → iOS ProjectPlannerTests/CanonicalParityFixture.json
  web lib/canonical/cross-platform-contract.json    → iOS ProjectPlannerTests/CrossPlatformContract.json
Contract sha256: 7f70ec28920ac6114068b4e44eaf893706d5b6af1b21d77b69f946074d74e126
Call: CanonicalBusinessEngine — no second calculator in Swift.
Exports added: JOB_MANAGER_FORMER_NOTES, JOB_MANAGER_LEVEL_LABELS, JOB_MANAGER_NO_CANDIDATES_MESSAGE, jobManagerAssignments, jobManagerCandidates
Exports removed: none
Web files that changed the rules: docs/RULEBOOK.md, lib/canonical/bundleEntry.ts, lib/canonical/canonical.test.ts, lib/canonical/index.ts, lib/canonical/jobManagers.ts, lib/canonical/lineManagers.ts
Done when:
- [ ] Packed hash in iOS equals 2b1800dc85773db1112e485f0350c8452103ae03a12a1d30751fd2f5b911213a
- [ ] iOS docs/RULEBOOK.md is byte-identical (sha256 cd8b2f927131f6429118c95d82a8be9960460cedff5be24f9a0b67565643fb44)
- [ ] RulebookParityTests pass (CanonicalBusinessEngine.rulebookVersion() == 1.30.3)
- [ ] Every Swift caller of a changed rule calls CanonicalBusinessEngine
- [ ] Same Firebase fields read and written as web
- [ ] Any disagreement traced to its first divergence — no copied screen number
```

## What changed in 1.30.3

- **Job managers** (owner bug 4 Nov, §11): one picker list for projects and small works, create and edit, on every platform — `jobManagerCandidates(roster)` (active admins and managers, folded per person by the live document, never operatives, inactive, pending or deleted). A job's stored managers read through `jobManagerAssignments(job, roster, catalogue)` (current / former with `JOB_MANAGER_FORMER_NOTES` / unknown); a former manager is shown as such with a remove action and is not named as the job's manager. New module `jobManagers.ts` (`JOB_MANAGER_LEVEL_LABELS`, `JOB_MANAGER_NO_CANDIDATES_MESSAGE`). Root cause: web judged a person on the one users document the email fold kept (admin first), so a stale admin copy — an invite not accepted, an inactive duplicate — left by repeated Change user type saves hid a live manager; web Change user type passed the folded roster to `accountTypeChangeWrites`, so the duplicate never got the new level. iOS (`ProjectManagerPickerSupport`) offered any active catalogue row with an active users document on its email, whatever their level — it should adopt `jobManagerCandidates` / `jobManagerAssignments`.

## New rulebook sections

- 1.30.3 — 2026-11-04

## Workflow for the iOS agent

1. Run `scripts/sync-rulebook-from-web.sh` (or copy the files above), then run the iOS tests.
2. Produce a numbered Gap Report (Finding / Evidence / Rule / Severity / Solution / Action) for the changes above and **stop**.
3. Implement only what the user approves, in the iOS repo only.
4. Report any web-side gap back to the web agent instead of diverging on iOS.
