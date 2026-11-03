# iOS follow-on — rulebook 1.21.1

Generated 2026-11-03 by `npm run rulebook:handoff` in project-planner-web. Paste this whole file into the iOS agent.
The web repo copy of `docs/RULEBOOK.md` is canonical. iOS mirrors it exactly; never edit the iOS mirror by hand.

```
╔══════════════════════════════════════════════════════════════════╗
║ FOLLOW-ON — paste into the iOS agent                             ║
╚══════════════════════════════════════════════════════════════════╝
Started on: web
Rulebook version: 1.21.0 → 1.21.1
Packed hash: 4230d8e490c2b022eb2b8ffe90b6fc0eaf81588583e1e2e3b9231b906306f666
Rulebook sha256: b23451b35ff37099077ab5c7ab6363434b18a6f88a5e17051eff61df01a3163d
Copy (do not edit by hand) — run scripts/sync-rulebook-from-web.sh in the iOS repo, which copies:
  web lib/canonical/dist/canonical-business.js      → iOS Project Planner/Canonical/canonical-business.js
  web lib/canonical/dist/canonical-business.sha256  → iOS Project Planner/Canonical/canonical-business.js.sha256
  web lib/canonical/dist/canonical-manifest.json    → iOS Project Planner/Canonical/canonical-manifest.json
  web docs/RULEBOOK.md                              → iOS docs/RULEBOOK.md
  web lib/canonical/parity-fixture.json             → iOS ProjectPlannerTests/CanonicalParityFixture.json
  web lib/canonical/cross-platform-contract.json    → iOS ProjectPlannerTests/CrossPlatformContract.json
Contract sha256: c9e307b0604e78284baf3a4f217f0fb3ecc4b227aec957c901bdd93e4e31a306
Call: CanonicalBusinessEngine — no second calculator in Swift.
Exports added: none
Exports removed: none
Web files that changed the rules: docs/RULEBOOK.md, lib/canonical/canonical.test.ts, lib/canonical/parity-fixture.json, lib/canonical/worksLists.ts
Done when:
- [ ] Packed hash in iOS equals 4230d8e490c2b022eb2b8ffe90b6fc0eaf81588583e1e2e3b9231b906306f666
- [ ] iOS docs/RULEBOOK.md is byte-identical (sha256 b23451b35ff37099077ab5c7ab6363434b18a6f88a5e17051eff61df01a3163d)
- [ ] RulebookParityTests pass (CanonicalBusinessEngine.rulebookVersion() == 1.21.1)
- [ ] Every Swift caller of a changed rule calls CanonicalBusinessEngine
- [ ] Same Firebase fields read and written as web
- [ ] Any disagreement traced to its first divergence — no copied screen number
```

## What changed in 1.21.1

- Bookable jobs never check the job's dates (owner decision on 1.21.0): `bookableJobs(jobs, viewer, context)` is visible + not inactive + `canWriteBooking`; trailing `dayKeys` / `timeZone` are accepted and ignored. A job past its end date and a job with no end date are bookable on any day. Book labour, My Schedule self-booking, the Daily Overview booking sheet, Quick Add and the Schedule wizard no longer filter or block on the job's dates (§21). iOS: `Views/BookLabourFlowView.swift` and `Views/MyScheduleView.swift` call `bookableJobs` and never filter on the job's dates.

## New rulebook sections

- 21. Job lists (1.21.0, 1.21.1)
- 1.21.1 — 2026-11-03

## Workflow for the iOS agent

1. Run `scripts/sync-rulebook-from-web.sh` (or copy the files above), then run the iOS tests.
2. Produce a numbered Gap Report (Finding / Evidence / Rule / Severity / Solution / Action) for the changes above and **stop**.
3. Implement only what the user approves, in the iOS repo only.
4. Report any web-side gap back to the web agent instead of diverging on iOS.
