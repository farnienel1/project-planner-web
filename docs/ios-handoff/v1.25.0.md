# iOS follow-on — rulebook 1.25.0

Generated 2026-11-03 by `npm run rulebook:handoff` in project-planner-web. Paste this whole file into the iOS agent.
The web repo copy of `docs/RULEBOOK.md` is canonical. iOS mirrors it exactly; never edit the iOS mirror by hand.

```
╔══════════════════════════════════════════════════════════════════╗
║ FOLLOW-ON — paste into the iOS agent                             ║
╚══════════════════════════════════════════════════════════════════╝
Started on: web
Rulebook version: 1.24.0 → 1.25.0
Packed hash: c1491ca3604e15b7dd7ce8047493a79367d3deb3ef6f31a9734e0e61530bfc55
Rulebook sha256: 90e025b9f37c015aebaaf659f5c6570037f1c7edffbb7a663a583bf43497eec6
Copy (do not edit by hand) — run scripts/sync-rulebook-from-web.sh in the iOS repo, which copies:
  web lib/canonical/dist/canonical-business.js      → iOS Project Planner/Canonical/canonical-business.js
  web lib/canonical/dist/canonical-business.sha256  → iOS Project Planner/Canonical/canonical-business.js.sha256
  web lib/canonical/dist/canonical-manifest.json    → iOS Project Planner/Canonical/canonical-manifest.json
  web docs/RULEBOOK.md                              → iOS docs/RULEBOOK.md
  web lib/canonical/parity-fixture.json             → iOS ProjectPlannerTests/CanonicalParityFixture.json
  web lib/canonical/cross-platform-contract.json    → iOS ProjectPlannerTests/CrossPlatformContract.json
Contract sha256: c9e307b0604e78284baf3a4f217f0fb3ecc4b227aec957c901bdd93e4e31a306
Call: CanonicalBusinessEngine — no second calculator in Swift.
Exports added: FILE_KEPT_ON_REMOVE_COPY, FILE_UNDO_WINDOW_MINUTES, FILE_UNDO_WINDOW_MS, STORED_FILE_KINDS, fileDeletePermission, storedFileKind, storedFileObjectName, storedFileUploader
Exports removed: none
Web files that changed the rules: docs/RULEBOOK.md, lib/canonical/bundleEntry.ts, lib/canonical/canonical.test.ts, lib/canonical/index.ts, lib/canonical/parity-fixture.json, lib/canonical/storedFiles.ts, storage.rules
Done when:
- [ ] Packed hash in iOS equals c1491ca3604e15b7dd7ce8047493a79367d3deb3ef6f31a9734e0e61530bfc55
- [ ] iOS docs/RULEBOOK.md is byte-identical (sha256 90e025b9f37c015aebaaf659f5c6570037f1c7edffbb7a663a583bf43497eec6)
- [ ] RulebookParityTests pass (CanonicalBusinessEngine.rulebookVersion() == 1.25.0)
- [ ] Every Swift caller of a changed rule calls CanonicalBusinessEngine
- [ ] Same Firebase fields read and written as web
- [ ] Any disagreement traced to its first divergence — no copied screen number
```

## What changed in 1.25.0

- Uploaded files are never deleted outright or lost (§24, launch checklist 2.2): `fileDeletePermission`, `storedFileKind`, `storedFileUploader`, `storedFileObjectName`, `FILE_UNDO_WINDOW_MINUTES`, `FILE_KEPT_ON_REMOVE_COPY`. `storage.rules`: any member could delete or overwrite any certificate, variation evidence, site audit photo, task file and health & safety file of the organisation, and any staff member any timesheet export; now a delete is the uploader within 15 minutes of the upload or an admin of that organisation outside operative mode, an overwrite only the uploader within 15 minutes, logos and timesheet exports admin only; profile photos stay the person or an admin. Creating files is unchanged.
- Every upload is a new `{uid}_{unixMs}.{ext}` object (`storedFileObjectName`; web `generatedStorageFileName` and iOS `StorageUploadPolicy.generatedObjectName` already wrote this shape), so replacing a file keeps the old one and its links.
- Web variation evidence removal deletes the Storage object only when `fileDeletePermission` allows it; otherwise it removes the link and keeps the file.
- Recovery is Google Cloud Storage soft delete, set up by the platform owner (Deploy notes 1.25.0).
- iOS hand-off: `Project Planner/Views/Variations/VariationEditorSheet.swift` `removeEvidence` (~1548) calls `fileDeletePermission` before `FirebaseBackend.deleteVariationEvidenceFile` and shows `FILE_KEPT_ON_REMOVE_COPY` when it is not allowed; `StorageUploadPolicy.generatedObjectName` may call `storedFileObjectName`. `uploadHealthSafetyFile`'s clean-up delete (uploader, seconds after upload) keeps working.
- Web docs: the iOS booking recalibrator references (`docs/ios-parity/04-business-logic.md`, `IOS_APP_BLUEPRINT.md`, a note on the 1.19.0 hand-off) now say it is retired.

## New rulebook sections

- 24. Uploaded files (1.25.0)
- 1.25.0 — 2026-11-04

## Workflow for the iOS agent

1. Run `scripts/sync-rulebook-from-web.sh` (or copy the files above), then run the iOS tests.
2. Produce a numbered Gap Report (Finding / Evidence / Rule / Severity / Solution / Action) for the changes above and **stop**.
3. Implement only what the user approves, in the iOS repo only.
4. Report any web-side gap back to the web agent instead of diverging on iOS.
