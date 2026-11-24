# iOS follow-on — rulebook 1.80.0

Generated 2026-11-24 by `npm run rulebook:handoff` in project-planner-web. Paste this whole file into the iOS agent.
The web repo copy of `docs/RULEBOOK.md` is canonical. iOS mirrors it exactly; never edit the iOS mirror by hand.

```
╔══════════════════════════════════════════════════════════════════╗
║ FOLLOW-ON — paste into the iOS agent                             ║
╚══════════════════════════════════════════════════════════════════╝
Started on: web
Rulebook version: 1.80.0 → 1.80.0
Packed hash: 81c079409e6e9369e2027f4d84243aa01fb32a526821fa72efa9b71d14572751
Rulebook sha256: 3b4df12ec0a177b9d9cefca5e83592568a488a9358589bc63179b376e4ddd903
Copy (do not edit by hand) — run scripts/sync-rulebook-from-web.sh in the iOS repo, which copies:
  web lib/canonical/dist/canonical-business.js      → iOS Project Planner/Canonical/canonical-business.js
  web lib/canonical/dist/canonical-business.sha256  → iOS Project Planner/Canonical/canonical-business.js.sha256
  web lib/canonical/dist/canonical-manifest.json    → iOS Project Planner/Canonical/canonical-manifest.json
  web docs/RULEBOOK.md                              → iOS docs/RULEBOOK.md
  web lib/canonical/parity-fixture.json             → iOS ProjectPlannerTests/CanonicalParityFixture.json
  web lib/canonical/cross-platform-contract.json    → iOS ProjectPlannerTests/CrossPlatformContract.json
  web lib/canonical/data-parity-fixture.json        → iOS ProjectPlannerTests/DataParityFixture.json
Contract sha256: d2d465abcf0ab7c7747385346b87d2b47226412b1014602c5a26bff8e951c0ca
Data-parity fixture sha256: c2db4a64c22f36ddda48453c0d26da28fc802df9c8c93c0d876e8097a9eb176f
Call: CanonicalBusinessEngine — no second calculator in Swift.
Exports added: none
Exports removed: none
Web files that changed the rules: docs/RULEBOOK.md, lib/canonical/cross-platform-contract.json, lib/canonical/crossPlatformContract.samples.ts, lib/canonical/crossPlatformContract.ts
Done when:
- [ ] Packed hash in iOS equals 81c079409e6e9369e2027f4d84243aa01fb32a526821fa72efa9b71d14572751
- [ ] iOS docs/RULEBOOK.md is byte-identical (sha256 3b4df12ec0a177b9d9cefca5e83592568a488a9358589bc63179b376e4ddd903)
- [ ] RulebookParityTests pass (CanonicalBusinessEngine.rulebookVersion() == 1.80.0)
- [ ] Every Swift caller of a changed rule calls CanonicalBusinessEngine
- [ ] Same Firebase fields read and written as web
- [ ] Any disagreement traced to its first divergence — no copied screen number
```

## What changed in 1.80.0

- **Subcontractor documents** (new §30, owner decision 24 Nov, option (a)): staff upload a subcontractor's insurance and RAMS documents, each with an optional expiry date, on web and iPhone. New `lib/canonical/subcontractorDocuments.ts`: `SUBCONTRACTOR_DOCUMENT_KINDS`, `SUBCONTRACTOR_DOCUMENT_LABELS`, `canManageSubcontractors`, `subcontractorDocumentsFolder`, `subcontractorDocumentStoragePath`, `subcontractorDocumentPathBelongsTo`, `parseSubcontractorDocuments`, `subcontractorDocumentsFieldPath`, `subcontractorDocumentAddWriteFields`, `subcontractorDocumentRemoveWriteFields`, `subcontractorDocumentExpiryWriteFields`, `normalizeSubcontractorDocumentExpiry`, `subcontractorDocumentExpiryError`, `subcontractorDocumentExpiryState`, `subcontractorDocumentExpiryDateText` and their copy constants. Stored-file / upload kind `subcontractor_document` (`storedFileKind`, `UPLOAD_ALLOWED_TYPES`: photos or PDF, 10 MB). `storage.rules`: the staff-only documents path. Web `canManageSubcontractors` now calls the rulebook (same result). Cross-platform contract: the `subcontractors` samples (web and iOS) carry one insurance entry each, read by the new contract reader `subcontractorDocument` (`parseSubcontractorDocument` and `parseSubcontractorDocuments` together). Web stores the content type the bytes were checked as (`assertUploadAllowed`), never the browser's guess.


## Workflow for the iOS agent

1. Run `scripts/sync-rulebook-from-web.sh` (or copy the files above), then run the iOS tests.
2. Produce a numbered Gap Report (Finding / Evidence / Rule / Severity / Solution / Action) for the changes above and **stop**.
3. Implement only what the user approves, in the iOS repo only.
4. Report any web-side gap back to the web agent instead of diverging on iOS.
