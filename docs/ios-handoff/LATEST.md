# iOS follow-on — rulebook 1.80.0

Generated 2026-11-24 by `npm run rulebook:handoff` in project-planner-web. Paste this whole file into the iOS agent.
The web repo copy of `docs/RULEBOOK.md` is canonical. iOS mirrors it exactly; never edit the iOS mirror by hand.

```
╔══════════════════════════════════════════════════════════════════╗
║ FOLLOW-ON — paste into the iOS agent                             ║
╚══════════════════════════════════════════════════════════════════╝
Started on: web
Rulebook version: 1.78.0 → 1.80.0
Packed hash: 446d583a3a70a9bda81236bec407dc2704a5129155c7396f514ac9a937bee914
Rulebook sha256: b57845332d7407311ff54f18ae187abb13faa6f3b59ae637a3b1548d610a4f85
Copy (do not edit by hand) — run scripts/sync-rulebook-from-web.sh in the iOS repo, which copies:
  web lib/canonical/dist/canonical-business.js      → iOS Project Planner/Canonical/canonical-business.js
  web lib/canonical/dist/canonical-business.sha256  → iOS Project Planner/Canonical/canonical-business.js.sha256
  web lib/canonical/dist/canonical-manifest.json    → iOS Project Planner/Canonical/canonical-manifest.json
  web docs/RULEBOOK.md                              → iOS docs/RULEBOOK.md
  web lib/canonical/parity-fixture.json             → iOS ProjectPlannerTests/CanonicalParityFixture.json
  web lib/canonical/cross-platform-contract.json    → iOS ProjectPlannerTests/CrossPlatformContract.json
  web lib/canonical/data-parity-fixture.json        → iOS ProjectPlannerTests/DataParityFixture.json
Contract sha256: 926b910948b674b1fa259e8f933ddd15f14bad00b8e0b050ccbd88c723bf64aa
Data-parity fixture sha256: c2db4a64c22f36ddda48453c0d26da28fc802df9c8c93c0d876e8097a9eb176f
Call: CanonicalBusinessEngine — no second calculator in Swift.
Exports added: SUBCONTRACTOR_DOCUMENTS_EMPTY_TEXT, SUBCONTRACTOR_DOCUMENTS_FULL_MESSAGE, SUBCONTRACTOR_DOCUMENTS_MAX_PER_KIND, SUBCONTRACTOR_DOCUMENT_EXPIRING_SOON_DAYS, SUBCONTRACTOR_DOCUMENT_EXPIRY_INVALID_MESSAGE, SUBCONTRACTOR_DOCUMENT_EXPIRY_LABEL, SUBCONTRACTOR_DOCUMENT_KINDS, SUBCONTRACTOR_DOCUMENT_LABELS, canManageSubcontractors, isSubcontractorDocumentKind, normalizeSubcontractorDocumentExpiry, parseSubcontractorDocuments, subcontractorDocumentAddWriteFields, subcontractorDocumentExpiryDateText, subcontractorDocumentExpiryError, subcontractorDocumentExpiryState, subcontractorDocumentExpiryWriteFields, subcontractorDocumentPathBelongsTo, subcontractorDocumentRemoveWriteFields, subcontractorDocumentStoragePath, subcontractorDocumentsFieldPath, subcontractorDocumentsFolder
Exports removed: none
Web files that changed the rules: docs/RULEBOOK.md, lib/canonical/bundleEntry.ts, lib/canonical/canonical.test.ts, lib/canonical/index.ts, lib/canonical/storedFiles.ts, lib/canonical/uploadPolicy.ts, storage.rules, lib/canonical/subcontractorDocuments.test.ts, lib/canonical/subcontractorDocuments.ts
Done when:
- [ ] Packed hash in iOS equals 446d583a3a70a9bda81236bec407dc2704a5129155c7396f514ac9a937bee914
- [ ] iOS docs/RULEBOOK.md is byte-identical (sha256 b57845332d7407311ff54f18ae187abb13faa6f3b59ae637a3b1548d610a4f85)
- [ ] RulebookParityTests pass (CanonicalBusinessEngine.rulebookVersion() == 1.80.0)
- [ ] Every Swift caller of a changed rule calls CanonicalBusinessEngine
- [ ] Same Firebase fields read and written as web
- [ ] Any disagreement traced to its first divergence — no copied screen number
```

## What changed in 1.80.0

- **Subcontractor documents** (new §30, owner decision 24 Nov, option (a)): staff upload a subcontractor's insurance and RAMS documents, each with an optional expiry date, on web and iPhone. New `lib/canonical/subcontractorDocuments.ts`: `SUBCONTRACTOR_DOCUMENT_KINDS`, `SUBCONTRACTOR_DOCUMENT_LABELS`, `canManageSubcontractors`, `subcontractorDocumentsFolder`, `subcontractorDocumentStoragePath`, `subcontractorDocumentPathBelongsTo`, `parseSubcontractorDocuments`, `subcontractorDocumentsFieldPath`, `subcontractorDocumentAddWriteFields`, `subcontractorDocumentRemoveWriteFields`, `subcontractorDocumentExpiryWriteFields`, `normalizeSubcontractorDocumentExpiry`, `subcontractorDocumentExpiryError`, `subcontractorDocumentExpiryState`, `subcontractorDocumentExpiryDateText` and their copy constants. Stored-file / upload kind `subcontractor_document` (`storedFileKind`, `UPLOAD_ALLOWED_TYPES`: photos or PDF, 10 MB). `storage.rules`: the staff-only documents path. Web `canManageSubcontractors` now calls the rulebook (same result). Version drafted as 1.80.0 (1.79.0 is built separately); renumbered at merge if needed.

## New rulebook sections

- 30. Subcontractor documents (1.80.0)
- 1.80.0 — 2026-11-24

## Workflow for the iOS agent

1. Run `scripts/sync-rulebook-from-web.sh` (or copy the files above), then run the iOS tests.
2. Produce a numbered Gap Report (Finding / Evidence / Rule / Severity / Solution / Action) for the changes above and **stop**.
3. Implement only what the user approves, in the iOS repo only.
4. Report any web-side gap back to the web agent instead of diverging on iOS.
