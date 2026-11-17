# iOS follow-on — rulebook 1.62.1

Generated 2026-11-17 by `npm run rulebook:handoff` in project-planner-web. Paste this whole file into the iOS agent.
The web repo copy of `docs/RULEBOOK.md` is canonical. iOS mirrors it exactly; never edit the iOS mirror by hand.

```
╔══════════════════════════════════════════════════════════════════╗
║ FOLLOW-ON — paste into the iOS agent                             ║
╚══════════════════════════════════════════════════════════════════╝
Started on: web
Rulebook version: 1.62.0 → 1.62.1
Packed hash: 657411fa43026dfc02e81d7103b6936eb5a488a75f43db88476ad1edf89d04e6
Rulebook sha256: 41099b7b710e465dcf0ee9b42e4d51637eda35735202d8add212184243c63ff8
Copy (do not edit by hand) — run scripts/sync-rulebook-from-web.sh in the iOS repo, which copies:
  web lib/canonical/dist/canonical-business.js      → iOS Project Planner/Canonical/canonical-business.js
  web lib/canonical/dist/canonical-business.sha256  → iOS Project Planner/Canonical/canonical-business.js.sha256
  web lib/canonical/dist/canonical-manifest.json    → iOS Project Planner/Canonical/canonical-manifest.json
  web docs/RULEBOOK.md                              → iOS docs/RULEBOOK.md
  web lib/canonical/parity-fixture.json             → iOS ProjectPlannerTests/CanonicalParityFixture.json
  web lib/canonical/cross-platform-contract.json    → iOS ProjectPlannerTests/CrossPlatformContract.json
  web lib/canonical/data-parity-fixture.json        → iOS ProjectPlannerTests/DataParityFixture.json
Contract sha256: 5b2615b5540b55f716d40617dd791dbcda6290348ef18951186f47e2e5b7cd20
Data-parity fixture sha256: c2db4a64c22f36ddda48453c0d26da28fc802df9c8c93c0d876e8097a9eb176f
Call: CanonicalBusinessEngine — no second calculator in Swift.
Exports added: none
Exports removed: none
Web files that changed the rules: docs/RULEBOOK.md, lib/canonical/bookingHoursBreakdown.ts, lib/canonical/canonical.test.ts
Done when:
- [ ] Packed hash in iOS equals 657411fa43026dfc02e81d7103b6936eb5a488a75f43db88476ad1edf89d04e6
- [ ] iOS docs/RULEBOOK.md is byte-identical (sha256 41099b7b710e465dcf0ee9b42e4d51637eda35735202d8add212184243c63ff8)
- [ ] RulebookParityTests pass (CanonicalBusinessEngine.rulebookVersion() == 1.62.1)
- [ ] Every Swift caller of a changed rule calls CanonicalBusinessEngine
- [ ] Same Firebase fields read and written as web
- [ ] Any disagreement traced to its first divergence — no copied screen number
```

## What changed in 1.62.1

- **The breakdown rows always add up exactly** (§4.3, owner 17 Nov: the calculation never fails, the text only displays it): `bookingHoursBreakdownRows` shows Total as `totalPaidHours` rounded to the hundredth, Overtime as its paid hours rounded, and Normal as the shown Total less the shown Overtime (a lone row is the Total); `normalPaidHours` / `overtimePaidHours` are the shown figures. Before, Normal and Overtime were each rounded and could differ from Total by 0.01. Display only — no pay-rule value changes. Property test in `canonical.test.ts` (3,000 random working hours, breaks, set-window weekends and rates). Folded into 1.62.0's number at merge.

## New rulebook sections

- 1.62.1 — 2026-11-17

## Workflow for the iOS agent

1. Run `scripts/sync-rulebook-from-web.sh` (or copy the files above), then run the iOS tests.
2. Produce a numbered Gap Report (Finding / Evidence / Rule / Severity / Solution / Action) for the changes above and **stop**.
3. Implement only what the user approves, in the iOS repo only.
4. Report any web-side gap back to the web agent instead of diverging on iOS.
