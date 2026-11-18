# iOS follow-on — rulebook 1.63.0

Generated 2026-11-17 by `npm run rulebook:handoff` in project-planner-web. Paste this whole file into the iOS agent.
The web repo copy of `docs/RULEBOOK.md` is canonical. iOS mirrors it exactly; never edit the iOS mirror by hand.

```
╔══════════════════════════════════════════════════════════════════╗
║ FOLLOW-ON — paste into the iOS agent                             ║
╚══════════════════════════════════════════════════════════════════╝
Started on: web
Rulebook version: 1.60.1 → 1.63.0
Packed hash: 74212b1217612cdc34c9355e9ec1ebdb025da4cd8b84e90d0faf1a37c3be54e9
Rulebook sha256: 6e11824f72e3e6a7e92a8ccfe72bf06d12f8ec26575c101e4e49305efd9c1ca0
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
Exports added: compareVariationTrackerOrder, variationStaleNumberLocks, variationStatusWriteFields, variationTrackerOrder
Exports removed: none
Web files that changed the rules: docs/RULEBOOK.md, lib/canonical/canonical.test.ts, lib/canonical/cross-platform-contract.json, lib/canonical/recordsDocuments.ts, lib/canonical/variationTrackerOrder.test.ts, lib/canonical/variations.ts
Done when:
- [ ] Packed hash in iOS equals 74212b1217612cdc34c9355e9ec1ebdb025da4cd8b84e90d0faf1a37c3be54e9
- [ ] iOS docs/RULEBOOK.md is byte-identical (sha256 6e11824f72e3e6a7e92a8ccfe72bf06d12f8ec26575c101e4e49305efd9c1ca0)
- [ ] RulebookParityTests pass (CanonicalBusinessEngine.rulebookVersion() == 1.63.0)
- [ ] Every Swift caller of a changed rule calls CanonicalBusinessEngine
- [ ] Same Firebase fields read and written as web
- [ ] Any disagreement traced to its first divergence — no copied screen number
```

## What changed in 1.63.0

- **Reopening a variation unpins it** (§22, owner decision 17 Nov, B; bug C): new `variationStatusWriteFields(status)` → `{ status, voNumberLocked }` (read with `normalizeVariationStatus`, now in `variations.ts` and re-exported unchanged; Submitted / Closed lock, Open unlocks, one write); `variationIsPinned` is the status only (a stored `voNumberLocked` no longer pins on its own); `variationRenumberWriteFields` keeps a pinned status's number, not a stale lock; new `variationStaleNumberLocks(rows)` — Open rows still storing the lock, unlocked by the renumber before its transaction. Root cause: web `setVariationStatus` kept `voNumberLocked: true` on reopen, so the row kept its pin and the rules (which read the stored lock) refused its renumber with "Missing or insufficient permissions". Also fixed: the web renumber transaction read missing `variations/{id}` documents (settings-only rows), which the read rule refuses — it now reads only existing documents.
- **The VO tracker is on by default** (§22, owner decision 17 Nov, A): `parseVariationTrackerDocument` reads a missing document, or one without `enabled`, as on; `variationTrackerWriteFields` `disable` creates `{ parentId, parentType, enabled: false }` when no document exists. Cross-platform contract regenerated (the tracker samples store no `enabled`, so they now read on).
- **One tracker order** (§22, review of #388): new `compareVariationTrackerOrder` and `variationTrackerOrder` (sequence, then VO number, then id); `variationRenumberPlan` uses it, and so do the web tracker and variations list. Opening the tracker on a job never switched on no longer plans a swap of rows with equal positions. Stale number locks are cleared in a small transaction each.
- **Status buttons** (owner request 17 Nov, UI only): Open / Submitted / Closed buttons replace the dropdown on web (variation detail, tracker rows) and iOS (variation editor / detail); same handler, same write.

## New rulebook sections

- 1.63.0 — 2026-11-17

## Workflow for the iOS agent

1. Run `scripts/sync-rulebook-from-web.sh` (or copy the files above), then run the iOS tests.
2. Produce a numbered Gap Report (Finding / Evidence / Rule / Severity / Solution / Action) for the changes above and **stop**.
3. Implement only what the user approves, in the iOS repo only.
4. Report any web-side gap back to the web agent instead of diverging on iOS.
