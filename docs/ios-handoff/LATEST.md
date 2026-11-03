# iOS follow-on — rulebook 1.20.4

Generated 2026-11-03 by `npm run rulebook:handoff` in project-planner-web. Paste this whole file into the iOS agent.
The web repo copy of `docs/RULEBOOK.md` is canonical. iOS mirrors it exactly; never edit the iOS mirror by hand.

```
╔══════════════════════════════════════════════════════════════════╗
║ FOLLOW-ON — paste into the iOS agent                             ║
╚══════════════════════════════════════════════════════════════════╝
Started on: web
Rulebook version: 1.20.3 → 1.20.4
Packed hash: 32bd3d12411fbc4105b6aaeff9298ffa27b32bd83a418ad574804cedb24068d2
Rulebook sha256: 78cb14121b5b68dfa40116c2b501ea5814e22ec28dc62cb1e5141bd601856722
Copy (do not edit by hand) — run scripts/sync-rulebook-from-web.sh in the iOS repo, which copies:
  web lib/canonical/dist/canonical-business.js      → iOS Project Planner/Canonical/canonical-business.js
  web lib/canonical/dist/canonical-business.sha256  → iOS Project Planner/Canonical/canonical-business.js.sha256
  web lib/canonical/dist/canonical-manifest.json    → iOS Project Planner/Canonical/canonical-manifest.json
  web docs/RULEBOOK.md                              → iOS docs/RULEBOOK.md
  web lib/canonical/parity-fixture.json             → iOS ProjectPlannerTests/CanonicalParityFixture.json
  web lib/canonical/cross-platform-contract.json    → iOS ProjectPlannerTests/CrossPlatformContract.json
Contract sha256: c9e307b0604e78284baf3a4f217f0fb3ecc4b227aec957c901bdd93e4e31a306
Call: CanonicalBusinessEngine — no second calculator in Swift.
Exports added: multipliedHoursText, parseMultipliedHoursText, payrollMultipliedHours
Exports removed: none
Web files that changed the rules: docs/RULEBOOK.md, lib/canonical/bundleEntry.ts, lib/canonical/canonical.test.ts, lib/canonical/index.ts, lib/canonical/parity-fixture.json, lib/canonical/payrollHours.ts
Done when:
- [ ] Packed hash in iOS equals 32bd3d12411fbc4105b6aaeff9298ffa27b32bd83a418ad574804cedb24068d2
- [ ] iOS docs/RULEBOOK.md is byte-identical (sha256 78cb14121b5b68dfa40116c2b501ea5814e22ec28dc62cb1e5141bd601856722)
- [ ] RulebookParityTests pass (CanonicalBusinessEngine.rulebookVersion() == 1.20.4)
- [ ] Every Swift caller of a changed rule calls CanonicalBusinessEngine
- [ ] Same Firebase fields read and written as web
- [ ] Any disagreement traced to its first divergence — no copied screen number
```

## What changed in 1.20.4

- Pay screens show hours at a multiplier as clock hours with the break as its own deduction — one text, `multipliedHoursText` ("6.5h × 2 − 0.5h break = 12.5h"), from `payrollMultipliedHours(result)` — on timesheet lines, invoices, the weekly report (screen, PDF, XLSX, HTML) and Daily Overview; never the back-calculated base ("6.25h × 2"). A signed line keeps its stored text and amount (`parseMultipliedHoursText` reads it back). Pay totals are unchanged (§8).

## New rulebook sections

- 1.20.4 — 2026-11-03

## Workflow for the iOS agent

1. Run `scripts/sync-rulebook-from-web.sh` (or copy the files above), then run the iOS tests.
2. Produce a numbered Gap Report (Finding / Evidence / Rule / Severity / Solution / Action) for the changes above and **stop**.
3. Implement only what the user approves, in the iOS repo only.
4. Report any web-side gap back to the web agent instead of diverging on iOS.
