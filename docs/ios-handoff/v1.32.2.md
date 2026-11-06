# iOS follow-on — rulebook 1.32.2

Generated 2026-11-06 by `npm run rulebook:handoff` in project-planner-web. Paste this whole file into the iOS agent.
The web repo copy of `docs/RULEBOOK.md` is canonical. iOS mirrors it exactly; never edit the iOS mirror by hand.

```
╔══════════════════════════════════════════════════════════════════╗
║ FOLLOW-ON — paste into the iOS agent                             ║
╚══════════════════════════════════════════════════════════════════╝
Started on: web
Rulebook version: 1.32.1 → 1.32.2
Packed hash: 09c199fc6b818d612c415fce6d24dace0bae61480d3beb0c39c6768ba90c1d43
Rulebook sha256: ec4561256d6a94dfaeb2e2b19a672dd6b3f237357c454513875ed98de4d10742
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
- [ ] Packed hash in iOS equals 09c199fc6b818d612c415fce6d24dace0bae61480d3beb0c39c6768ba90c1d43
- [ ] iOS docs/RULEBOOK.md is byte-identical (sha256 ec4561256d6a94dfaeb2e2b19a672dd6b3f237357c454513875ed98de4d10742)
- [ ] RulebookParityTests pass (CanonicalBusinessEngine.rulebookVersion() == 1.32.2)
- [ ] Every Swift caller of a changed rule calls CanonicalBusinessEngine
- [ ] Same Firebase fields read and written as web
- [ ] Any disagreement traced to its first divergence — no copied screen number
```

## What changed in 1.32.2

- Compile-cost cut, no behaviour change. Google refused to publish 1.32.1 (console "unknown error", CLI 409 then 503) although 1.31.3 published at a slightly higher static cost, so the margin had gone. Static compile cost (`scripts/rules-cost/metric.py` `total2`) 429,072 → **383,790** (−10.6%; 1.30.2 live 525,898); in-process compile on the emulator's compiler 1.79 s → 1.66 s (min of 7). Every allow/deny decision is unchanged: lazy `let`s for repeated document paths and the caller's users document, `orgIdsMatch` computed once in `userDocOrganizationMatches`, `membersMapAdminAnyBilling` folded into `orgAdminEither`, a redundant `adminLikeUser` removed from `callerOrgRoleAnyBilling`, allows with the same condition merged (clients, tasks, subcontractors, siteAudits) and write allows sharing `canAccessOrganization` merged with a `request.method` ternary (holidayBookings, settings, notifications, overtimeRequests). Details: `docs/firestore-rules-notes.md` "Compile cost". Rules suites 223/223; `RULES_STRICT_BUDGET=1` the same 43 limit refusals as 1.32.1, none new; emulator type check 0 issues.
- CI: `scripts/check-rules-budget.mjs` fails when the static compile cost is above `firestoreRulesMaxCompileCost` (395,000, `scripts/rules-budget.json`); the new `rules-typecheck` job (`scripts/check-rules-typecheck.mjs`) fails on any emulator type-check error ("Invalid type" included).

## New rulebook sections

- 1.32.2 — 2026-11-06

## Workflow for the iOS agent

1. Run `scripts/sync-rulebook-from-web.sh` (or copy the files above), then run the iOS tests.
2. Produce a numbered Gap Report (Finding / Evidence / Rule / Severity / Solution / Action) for the changes above and **stop**.
3. Implement only what the user approves, in the iOS repo only.
4. Report any web-side gap back to the web agent instead of diverging on iOS.
