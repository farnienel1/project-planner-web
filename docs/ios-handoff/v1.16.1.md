# iOS follow-on — rulebook 1.16.1

Generated 2026-11-03 by `npm run rulebook:handoff` in project-planner-web. Paste this whole file into the iOS agent.
The web repo copy of `docs/RULEBOOK.md` is canonical. iOS mirrors it exactly; never edit the iOS mirror by hand.

```
╔══════════════════════════════════════════════════════════════════╗
║ FOLLOW-ON — paste into the iOS agent                             ║
╚══════════════════════════════════════════════════════════════════╝
Started on: web
Rulebook version: 1.16.0 → 1.16.1
Packed hash: 586f1b0ba56e789c7f34d17cc4d0bfe4fcef046ac1842c94f4479574432ae5c8
Rulebook sha256: 905d39201c0c564346a02fc462a08ebd53dcad2988c5e0fed4c9f3d7ce320f55
Copy (do not edit by hand) — run scripts/sync-rulebook-from-web.sh in the iOS repo, which copies:
  web lib/canonical/dist/canonical-business.js      → iOS Project Planner/Canonical/canonical-business.js
  web lib/canonical/dist/canonical-business.sha256  → iOS Project Planner/Canonical/canonical-business.js.sha256
  web lib/canonical/dist/canonical-manifest.json    → iOS Project Planner/Canonical/canonical-manifest.json
  web docs/RULEBOOK.md                              → iOS docs/RULEBOOK.md
  web lib/canonical/parity-fixture.json             → iOS ProjectPlannerTests/CanonicalParityFixture.json
  web lib/canonical/cross-platform-contract.json    → iOS ProjectPlannerTests/CrossPlatformContract.json
Contract sha256: d655dd7d122e53a1167569216d43cba7598670671310ca84c59ea7e46373b7e6
Call: CanonicalBusinessEngine — no second calculator in Swift.
Exports added: HEALTH_SAFETY_FILE_FIELDS, mergeHealthSafetyRowCopies
Exports removed: none
Web files that changed the rules: docs/RULEBOOK.md, lib/canonical/bundleEntry.ts, lib/canonical/canonical.test.ts, lib/canonical/index.ts, lib/canonical/recordsDocuments.ts
Done when:
- [ ] Packed hash in iOS equals 586f1b0ba56e789c7f34d17cc4d0bfe4fcef046ac1842c94f4479574432ae5c8
- [ ] iOS docs/RULEBOOK.md is byte-identical (sha256 905d39201c0c564346a02fc462a08ebd53dcad2988c5e0fed4c9f3d7ce320f55)
- [ ] RulebookParityTests pass (CanonicalBusinessEngine.rulebookVersion() == 1.16.1)
- [ ] Every Swift caller of a changed rule calls CanonicalBusinessEngine
- [ ] Same Firebase fields read and written as web
- [ ] Any disagreement traced to its first divergence — no copied screen number
```

## What changed in 1.16.1

- Health & safety file links (§1 partial writes): a blank `fileURL` / `fileName` never overwrites a stored one (`healthSafetyDocumentWriteFields`, `HEALTH_SAFETY_FILE_FIELDS`); two copies read as one keep the copy with a link (`mergeHealthSafetyRowCopies`). Web PR #227 found the web serializer wrote `fileURL: ''` over stored download URLs (RAMS lost their View link). iOS: `uploadHealthSafetyFile` must not store a `gs://` URL when `downloadURL()` fails — retry, or keep the storage path in a separate field and fail the upload visibly.
- Ships in the same merge as 1.16.0 (neither deployed before).

## New rulebook sections

- 1.16.1 — 2026-11-03

## Workflow for the iOS agent

1. Run `scripts/sync-rulebook-from-web.sh` (or copy the files above), then run the iOS tests.
2. Produce a numbered Gap Report (Finding / Evidence / Rule / Severity / Solution / Action) for the changes above and **stop**.
3. Implement only what the user approves, in the iOS repo only.
4. Report any web-side gap back to the web agent instead of diverging on iOS.
