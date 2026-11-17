# iOS follow-on — rulebook 1.63.0

Generated 2026-11-17 by `npm run rulebook:handoff` in project-planner-web. Paste this whole file into the iOS agent.
The web repo copy of `docs/RULEBOOK.md` is canonical. iOS mirrors it exactly; never edit the iOS mirror by hand.

```
╔══════════════════════════════════════════════════════════════════╗
║ FOLLOW-ON — paste into the iOS agent                             ║
╚══════════════════════════════════════════════════════════════════╝
Started on: web
Rulebook version: 1.60.1 → 1.63.0
Packed hash: 38b7e85ddbfb2ecef1416908f3e5cde2db5b700e82b70974a12d383240055025
Rulebook sha256: 2ba38c72c6aec8008b93bf561d18bf0dba4270e842c25caffc7ab626bf780f5a
Copy (do not edit by hand) — run scripts/sync-rulebook-from-web.sh in the iOS repo, which copies:
  web lib/canonical/dist/canonical-business.js      → iOS Project Planner/Canonical/canonical-business.js
  web lib/canonical/dist/canonical-business.sha256  → iOS Project Planner/Canonical/canonical-business.js.sha256
  web lib/canonical/dist/canonical-manifest.json    → iOS Project Planner/Canonical/canonical-manifest.json
  web docs/RULEBOOK.md                              → iOS docs/RULEBOOK.md
  web lib/canonical/parity-fixture.json             → iOS ProjectPlannerTests/CanonicalParityFixture.json
  web lib/canonical/cross-platform-contract.json    → iOS ProjectPlannerTests/CrossPlatformContract.json
  web lib/canonical/data-parity-fixture.json        → iOS ProjectPlannerTests/DataParityFixture.json
Contract sha256: 56f892a29d844eaaebe16028640ebdfb036324d3a229638968c34d10663159f3
Data-parity fixture sha256: c2db4a64c22f36ddda48453c0d26da28fc802df9c8c93c0d876e8097a9eb176f
Call: CanonicalBusinessEngine — no second calculator in Swift.
Exports added: variationStaleNumberLocks, variationStatusWriteFields
Exports removed: none
Web files that changed the rules: docs/RULEBOOK.md, lib/canonical/canonical.test.ts, lib/canonical/cross-platform-contract.json, lib/canonical/recordsDocuments.ts, lib/canonical/variations.ts
Done when:
- [ ] Packed hash in iOS equals 38b7e85ddbfb2ecef1416908f3e5cde2db5b700e82b70974a12d383240055025
- [ ] iOS docs/RULEBOOK.md is byte-identical (sha256 2ba38c72c6aec8008b93bf561d18bf0dba4270e842c25caffc7ab626bf780f5a)
- [ ] RulebookParityTests pass (CanonicalBusinessEngine.rulebookVersion() == 1.63.0)
- [ ] Every Swift caller of a changed rule calls CanonicalBusinessEngine
- [ ] Same Firebase fields read and written as web
- [ ] Any disagreement traced to its first divergence — no copied screen number
```

## What changed in 1.63.0

- **Reopening a variation unpins it** (§22, owner decision 17 Nov, B; bug C): new `variationStatusWriteFields(stored, status)` → `{ status, voNumberLocked }` (Submitted / Closed lock, Open unlocks, one write); `variationIsPinned` is the status only (a stored `voNumberLocked` no longer pins on its own); `variationRenumberWriteFields` keeps a pinned status's number, not a stale lock; new `variationStaleNumberLocks(rows)` — Open rows still storing the lock, unlocked by the renumber before its transaction. Root cause: web `setVariationStatus` kept `voNumberLocked: true` on reopen, so the row kept its pin and the rules (which read the stored lock) refused its renumber with "Missing or insufficient permissions". Also fixed: the web renumber transaction read missing `variations/{id}` documents (settings-only rows), which the read rule refuses — it now reads only existing documents.
- **The VO tracker is on by default** (§22, owner decision 17 Nov, A): `parseVariationTrackerDocument` reads a missing document, or one without `enabled`, as on; `variationTrackerWriteFields` `disable` creates `{ parentId, parentType, enabled: false }` when no document exists. Cross-platform contract regenerated (the tracker samples store no `enabled`, so they now read on).
- **Status buttons** (owner request 17 Nov, UI only): Open / Submitted / Closed buttons replace the dropdown on web (variation detail, tracker rows) and iOS (variation editor / detail); same handler, same write.

## New rulebook sections

- 1.63.0 — 2026-11-17

## Workflow for the iOS agent

1. Run `scripts/sync-rulebook-from-web.sh` (or copy the files above), then run the iOS tests.
2. Produce a numbered Gap Report (Finding / Evidence / Rule / Severity / Solution / Action) for the changes above and **stop**.
3. Implement only what the user approves, in the iOS repo only.
4. Report any web-side gap back to the web agent instead of diverging on iOS.
