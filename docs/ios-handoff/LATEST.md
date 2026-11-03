# iOS follow-on — rulebook 1.14.0

Generated 2026-11-03 by `npm run rulebook:handoff` in project-planner-web. Paste this whole file into the iOS agent.
The web repo copy of `docs/RULEBOOK.md` is canonical. iOS mirrors it exactly; never edit the iOS mirror by hand.

```
╔══════════════════════════════════════════════════════════════════╗
║ FOLLOW-ON — paste into the iOS agent                             ║
╚══════════════════════════════════════════════════════════════════╝
Started on: web
Rulebook version: 1.13.2 → 1.14.0
Packed hash: da6f1afc5c6d39ce73f74bbd03dfa35cb5342e4c9aa617385ece30ce1a12dedd
Rulebook sha256: 35129e242d51f66dae05857fe1d56d784f3ac7745093575f3eef4b9d77666c97
Copy (do not edit by hand) — run scripts/sync-rulebook-from-web.sh in the iOS repo, which copies:
  web lib/canonical/dist/canonical-business.js      → iOS Project Planner/Canonical/canonical-business.js
  web lib/canonical/dist/canonical-business.sha256  → iOS Project Planner/Canonical/canonical-business.js.sha256
  web lib/canonical/dist/canonical-manifest.json    → iOS Project Planner/Canonical/canonical-manifest.json
  web docs/RULEBOOK.md                              → iOS docs/RULEBOOK.md
  web lib/canonical/parity-fixture.json             → iOS ProjectPlannerTests/CanonicalParityFixture.json
  web lib/canonical/cross-platform-contract.json    → iOS ProjectPlannerTests/CrossPlatformContract.json
Contract sha256: d655dd7d122e53a1167569216d43cba7598670671310ca84c59ea7e46373b7e6
Call: CanonicalBusinessEngine — no second calculator in Swift.
Exports added: PAY_RATE_REQUIRED_MESSAGE, lineManagerSelectedIds, payRateRequiredError, usersMissingPayRate
Exports removed: none
Web files that changed the rules: docs/RULEBOOK.md, lib/canonical/bundleEntry.ts, lib/canonical/canonical.test.ts, lib/canonical/index.ts, lib/canonical/lineManagers.ts, lib/canonical/payRate.ts, lib/canonical/permissionLevels.ts
Done when:
- [ ] Packed hash in iOS equals da6f1afc5c6d39ce73f74bbd03dfa35cb5342e4c9aa617385ece30ce1a12dedd
- [ ] iOS docs/RULEBOOK.md is byte-identical (sha256 35129e242d51f66dae05857fe1d56d784f3ac7745093575f3eef4b9d77666c97)
- [ ] RulebookParityTests pass (CanonicalBusinessEngine.rulebookVersion() == 1.14.0)
- [ ] Every Swift caller of a changed rule calls CanonicalBusinessEngine
- [ ] Same Firebase fields read and written as web
- [ ] Any disagreement traced to its first divergence — no copied screen number
```

## What changed in 1.14.0

- Line manager options are one per person (§11): `lineManagerCandidates` folds roster rows by `personIdSet` (same id ignoring case, `formerUserIds`, `sameEmailUserIds`, same email ignoring case) and offers the live users document's id; `lineManagerSelectedIds` maps a stored id on the other duplicate onto that option; `lineManagerSummary` counts a person once. Owner bug: after admin → manager → admin → manager, `accountTypeChangeWrites` set every same-email users document to manager and the picker listed the person twice (the web live roster listener also re-added the folded-away document).
- A self-employed person must have a pay rate (§8, §11, §16 note): `payRateRequiredError`, `PAY_RATE_REQUIRED_MESSAGE`, `usersMissingPayRate`; Add User and Edit User refuse the save when the writer may set pay (`canChangePersonPay`). Not enforced by the security rules.
- New-user permission defaults (§11): `addUserPermissionDefaults` starts every toggle the adder can change off; locked toggles keep their value. A user type change never applies them.
- Lapsed subscription on iOS (§19, rule text only): everyone, admins included, sees only `SUBSCRIPTION_LAPSED_MESSAGE`; the admin billing notes are web only and never shown on iPhone (owner decision, App Store guideline 3.1.3).
- Email function (deploy note): the `EMAIL_SERVER_KEY` secret and the `X-Project-Planner-Server-Key` header are trimmed before they are compared, so a secret set from a file with a trailing newline no longer fails every web email with "Server key is not valid".

## New rulebook sections

- 1.14.0 — 2026-11-03

## Workflow for the iOS agent

1. Run `scripts/sync-rulebook-from-web.sh` (or copy the files above), then run the iOS tests.
2. Produce a numbered Gap Report (Finding / Evidence / Rule / Severity / Solution / Action) for the changes above and **stop**.
3. Implement only what the user approves, in the iOS repo only.
4. Report any web-side gap back to the web agent instead of diverging on iOS.
