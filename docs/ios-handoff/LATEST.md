# iOS follow-on — rulebook 1.26.0

Generated 2026-11-03 by `npm run rulebook:handoff` in project-planner-web. Paste this whole file into the iOS agent.
The web repo copy of `docs/RULEBOOK.md` is canonical. iOS mirrors it exactly; never edit the iOS mirror by hand.

```
╔══════════════════════════════════════════════════════════════════╗
║ FOLLOW-ON — paste into the iOS agent                             ║
╚══════════════════════════════════════════════════════════════════╝
Started on: web
Rulebook version: 1.25.0 → 1.26.0
Packed hash: 7dcb97cc74e3f4d5666a9050bb35359a58eafd69407fe52fb15030b78a5c0158
Rulebook sha256: 86e32226ea6aab36e45d9b87be556522636bf54e8fecc98541bf44c7691339ec
Copy (do not edit by hand) — run scripts/sync-rulebook-from-web.sh in the iOS repo, which copies:
  web lib/canonical/dist/canonical-business.js      → iOS Project Planner/Canonical/canonical-business.js
  web lib/canonical/dist/canonical-business.sha256  → iOS Project Planner/Canonical/canonical-business.js.sha256
  web lib/canonical/dist/canonical-manifest.json    → iOS Project Planner/Canonical/canonical-manifest.json
  web docs/RULEBOOK.md                              → iOS docs/RULEBOOK.md
  web lib/canonical/parity-fixture.json             → iOS ProjectPlannerTests/CanonicalParityFixture.json
  web lib/canonical/cross-platform-contract.json    → iOS ProjectPlannerTests/CrossPlatformContract.json
Contract sha256: c9e307b0604e78284baf3a4f217f0fb3ecc4b227aec957c901bdd93e4e31a306
Call: CanonicalBusinessEngine — no second calculator in Swift.
Exports added: SECURITY_SWITCHES, SECURITY_SWITCH_ORGANIZATION_FIELDS, payProfileReadPlan, rateHistoryQueryPlan, securitySwitchOn, securitySwitches, sharedDocumentPayWrite
Exports removed: none
Web files that changed the rules: docs/RULEBOOK.md, firestore.rules, lib/canonical/bundleEntry.ts, lib/canonical/canonical.test.ts, lib/canonical/index.ts, lib/canonical/payProfile.ts, lib/canonical/platformConfig.ts, lib/canonical/staffAccess.ts
Done when:
- [ ] Packed hash in iOS equals 7dcb97cc74e3f4d5666a9050bb35359a58eafd69407fe52fb15030b78a5c0158
- [ ] iOS docs/RULEBOOK.md is byte-identical (sha256 86e32226ea6aab36e45d9b87be556522636bf54e8fecc98541bf44c7691339ec)
- [ ] RulebookParityTests pass (CanonicalBusinessEngine.rulebookVersion() == 1.26.0)
- [ ] Every Swift caller of a changed rule calls CanonicalBusinessEngine
- [ ] Same Firebase fields read and written as web
- [ ] Any disagreement traced to its first divergence — no copied screen number
```

## What changed in 1.26.0

- Security switches per organisation (§16, §17, §18): `platformConfig/app` takes `enforcedReadsOrganizationIds` and `privatePayOrganizationIds` beside the platform-wide `enforcedReads` / `privatePay`, so the owner can switch one company on first. The rules read them as `enforcedReadsOn(orgId)` / `privatePayOn(orgId)`; the shared test is `securitySwitchOn` / `securitySwitches` (`SECURITY_SWITCHES`, `SECURITY_SWITCH_ORGANIZATION_FIELDS`).
- The apps follow the switches (§17): job and booking plans take `enforced: securitySwitchOn(...)` instead of waiting for a release that flips `ENFORCED_READS_ACTIVE` (now only the default). Web re-plans its listeners live when the switch changes.
- Private pay in the apps (§8): `sharedDocumentPayWrite` keeps pay off `users` / `operatives` / `managers` writes while `privatePay` is on (before 1.26.0 a web pay save, Add User with a rate and an invite acceptance were refused as a whole once it was on); `rateHistoryQueryPlan` reads rate history per person for non-admins (the whole-collection read was refused); `payProfileReadPlan` + `overlayPayProfile` lay pay profiles over the roster so pay still shows after the strip.
- Owner guide `docs/SECURITY_SWITCHES.md` (order: backfill → rules → iOS build → `minimumIosBuild` → own company → test → everyone; rollback).

## New rulebook sections

- 1.26.0 — 2026-11-04

## Workflow for the iOS agent

1. Run `scripts/sync-rulebook-from-web.sh` (or copy the files above), then run the iOS tests.
2. Produce a numbered Gap Report (Finding / Evidence / Rule / Severity / Solution / Action) for the changes above and **stop**.
3. Implement only what the user approves, in the iOS repo only.
4. Report any web-side gap back to the web agent instead of diverging on iOS.
