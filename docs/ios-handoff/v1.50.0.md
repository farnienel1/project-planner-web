# iOS follow-on — rulebook 1.50.0

Generated 2026-11-15 by `npm run rulebook:handoff` in project-planner-web. Paste this whole file into the iOS agent.
The web repo copy of `docs/RULEBOOK.md` is canonical. iOS mirrors it exactly; never edit the iOS mirror by hand.

```
╔══════════════════════════════════════════════════════════════════╗
║ FOLLOW-ON — paste into the iOS agent                             ║
╚══════════════════════════════════════════════════════════════════╝
Started on: web
Rulebook version: 1.49.0 → 1.50.0
Packed hash: 42329d4b4bdd4da77df1a1e84786ca88e02023d8fbe02b5206e64599cb3cdb4b
Rulebook sha256: fce2b099e2cb773cb6949b2ba7bdc6000bf61ab9cc823d2202e1b68ce22896b2
Copy (do not edit by hand) — run scripts/sync-rulebook-from-web.sh in the iOS repo, which copies:
  web lib/canonical/dist/canonical-business.js      → iOS Project Planner/Canonical/canonical-business.js
  web lib/canonical/dist/canonical-business.sha256  → iOS Project Planner/Canonical/canonical-business.js.sha256
  web lib/canonical/dist/canonical-manifest.json    → iOS Project Planner/Canonical/canonical-manifest.json
  web docs/RULEBOOK.md                              → iOS docs/RULEBOOK.md
  web lib/canonical/parity-fixture.json             → iOS ProjectPlannerTests/CanonicalParityFixture.json
  web lib/canonical/cross-platform-contract.json    → iOS ProjectPlannerTests/CrossPlatformContract.json
  web lib/canonical/data-parity-fixture.json        → iOS ProjectPlannerTests/DataParityFixture.json
Contract sha256: b89ca87595a18b7f0230fa13dcc81d65dcaea44e65912d499a31ce5df7670dd4
Data-parity fixture sha256: c2db4a64c22f36ddda48453c0d26da28fc802df9c8c93c0d876e8097a9eb176f
Call: CanonicalBusinessEngine — no second calculator in Swift.
Exports added: PHOTO_TOO_LARGE_TO_PREPARE_MESSAGE, PHOTO_TOO_MANY_PIXELS_MESSAGE, UPLOAD_ALLOWED_TYPES, UPLOAD_CSV_CONTENT_TYPE, UPLOAD_DEFAULT_MAX_BYTES, UPLOAD_DIMENSION_HEAD_BYTES, UPLOAD_HEAD_BYTES, UPLOAD_KINDS, UPLOAD_PDF_CONTENT_TYPE, UPLOAD_PHOTO_CONTENT_TYPES, UPLOAD_PHOTO_MAX_PIXELS, UPLOAD_PHOTO_PICK_MAX_BYTES, detectUploadContentType, imageDimensionsFromHeader, isUploadKind, normalizeUploadContentType, photoPrepareRefusal, safeExternalUrl, uploadAcceptAttribute, uploadAllowed, uploadAllowedHint, uploadFileExtension, uploadKindForStoragePath, uploadRefusalMessage
Exports removed: none
Web files that changed the rules: docs/RULEBOOK.md, lib/canonical/bundleEntry.ts, lib/canonical/canonical.test.ts, lib/canonical/index.ts, lib/canonical/uploadPolicy.ts, storage.rules
Done when:
- [ ] Packed hash in iOS equals 42329d4b4bdd4da77df1a1e84786ca88e02023d8fbe02b5206e64599cb3cdb4b
- [ ] iOS docs/RULEBOOK.md is byte-identical (sha256 fce2b099e2cb773cb6949b2ba7bdc6000bf61ab9cc823d2202e1b68ce22896b2)
- [ ] RulebookParityTests pass (CanonicalBusinessEngine.rulebookVersion() == 1.50.0)
- [ ] Every Swift caller of a changed rule calls CanonicalBusinessEngine
- [ ] Same Firebase fields read and written as web
- [ ] Any disagreement traced to its first divergence — no copied screen number
```

## What changed in 1.50.0

- **What may be uploaded** (§24, owner decisions 15 Nov; new `lib/canonical/uploadPolicy.ts`): photos (JPEG, PNG, HEIC/HEIF, WebP) and PDFs per kind, CSV for the catalogue import only; no SVG, GIF, Word, Excel (`.xlsm` included), ZIP or `application/octet-stream`. `UPLOAD_ALLOWED_TYPES`, `UPLOAD_KINDS`, `uploadAllowed` (size, claimed type, extension, then the first bytes against both), `detectUploadContentType` (magic numbers), `normalizeUploadContentType`, `uploadRefusalMessage`, `uploadAllowedHint`, `uploadAcceptAttribute`, `uploadFileExtension`, `uploadKindForStoragePath`, `UPLOAD_HEAD_BYTES`. Variation evidence caps at 10 MB (was 20 MB); certificates take every photo type (were PDF and JPEG).
- **Links** (§24): `safeExternalUrl` — only `https:` URLs become links (`http:` to localhost / 127.0.0.1 / [::1] for the emulator, and plain `http:` for a material supplier `websiteURL` only, `allowHttp`); used for every stored or typed URL web renders as a link (tasks, site audits, deadlines, variations, certificates, material websites, health & safety files).
- Review fixes: markup is checked before `%PDF-` (polyglots refused); a photo over 40 MB or 50 megapixels is refused before it is decoded (`photoPrepareRefusal`, `imageDimensionsFromHeader`, `UPLOAD_PHOTO_PICK_MAX_BYTES`, `UPLOAD_PHOTO_MAX_PIXELS`, `UPLOAD_DIMENSION_HEAD_BYTES`); JPEG re-encodes are drawn on white; logos never become JPEG; certificate photos are sent as JPEG until the 1.50.0 Storage rules are published (the live rules take PDF and JPEG only); no hard-coded content-type fallbacks (the bytes decide). Exports and downloads (weekly report PDF / XLSX / HTML, invoices, timesheet PDFs, company data export) are not uploads and are not changed.
- Web: every upload goes through one check (`assertUploadAllowed` in `uploadFile` / `uploadVariationEvidenceFile`) and is written with the detected type; photos are redrawn and scaled (2560 px, about 2.5 MB); the toolbox talk Excel only fills in the fields and is no longer stored; a photo picked as a task file is redrawn too.
- `storage.rules`: per-path photo / PDF allow-lists (`isPhoto`, `isPdf`, `isPhotoOrPdf`) replace `image/.*` and the work-file list; variation paths 10 MB.

## iOS work for 1.50.0

**Sync first.** 1.50.0 (owner decisions 15 Nov): **upload hardening**. Photos (JPEG, PNG, HEIC/HEIF, WebP) and PDFs only per kind; CSV only for the catalogue import (never stored). **No SVG, GIF, Word, Excel (`.xlsm` included), ZIP or `application/octet-stream`.** Stored or typed URLs become links only through `safeExternalUrl`.
- **Storage rules change.** The owner publishes `storage.rules` **after** `minimumIosBuild` is raised to the iOS build that ships this hand-off (platform guardrail 4). After that publish, an older iPhone's upload of any refused type, a 10–20 MB variation file, or an octet-stream retry fails.
- **Not changed:** no Firestore rules, index or Functions change; nothing migrated. Files already stored are never touched and keep opening.
- **Base:** web `origin/main` 1.49.0 + this PR. The local iOS checkout this note was written from was at `ios-1.37` (`c818203`), older than web 1.49, so **every file and line below is a pointer to check on your branch**, not a fact.

1. **Sync.** Run `WEB_REPO=<web worktree> bash scripts/sync-rulebook-from-web.sh`, then commit the mirrored files.
2. **One check before every upload.** Never fall back to a hard-coded content type; pass the file's own type (blank is fine — the bytes decide). Before each `putData` / `putFile`, call `CanonicalBusinessEngine.uploadAllowed({ kind, fileName, contentType, sizeBytes, headBytes })`:
   - `kind` = `uploadKindForStoragePath(storagePath)` (or the `StoredFileKind` you already know).
   - `headBytes` = the first `UPLOAD_HEAD_BYTES` (1024) bytes of the data **as you will upload it** (after any redraw), as an array of numbers.
   - Refused → show `message` and do not upload. Allowed → set `StorageMetadata.contentType` to the returned `contentType`. Never `application/octet-stream`, never `nil` metadata.
   - Likely call sites (from the stale checkout; grep `putData` / `putFile`): `Project Planner/FirebaseBackend.swift` (~2896, ~2977, ~3014, ~3055, ~3104, ~3150, ~3185, ~3222), `Core/FirebaseBackend+Variations.swift` (~531–562: **delete the retry with `application/octet-stream`**), `Core/FirebaseBackend+PayeClaims.swift` (~232).
3. **Delete iOS's own type lists.** `Core/StorageUploadPolicy.swift` keeps SVG / GIF as passthrough (~44–51, ~276–287), allows `xls`, `xlsx`, `xlsm`, `doc`, `docx`, `csv`, `zip` (~51, ~63, ~73) and its own size caps. Replace them with `UPLOAD_ALLOWED_TYPES[kind]` (`contentTypes`, `extensions`, `maxBytes`) and `uploadAllowed`. Remove SVG and GIF passthrough. Keep the existing PDF magic check only if it calls the engine (`detectUploadContentType`).
   - Pickers (`UIDocumentPickerViewController` / `PhotosPicker` content types) should offer only the kind's types: photos (`.jpeg`, `.png`, `.heic`, `.heif`, `.webp`) and `.pdf` where the kind allows PDF. Likely: `Views/Variations/VariationEditorSheet.swift` (~1762 returns octet-stream), `Views/Overtime/PayeClaimFormComponents.swift`, `Views/OperativeQualificationsEditorView.swift`, `Views/ProjectDetailView.swift` (tasks, H&S, deadlines), `Views/CompanyDetailsEditView.swift`, `Views/ManageUserProfileChrome.swift`.
   - Caps: profile 2 MB, logo 5 MB, **variation evidence 10 MB (was 20 MB)**, everything else 10 MB. Certificates now take every photo type and PDF (were JPEG and PDF).
3a. **Certificates until the Storage rules are published.** The live rules take PDF and JPEG only for certificates. Until the 1.50.0 rules are published, send certificate photos as JPEG (redraw HEIC / PNG / WebP to JPEG); never send PNG, HEIC or WebP there yet.
4. **Photos.** Refuse before decoding a photo over `UPLOAD_PHOTO_PICK_MAX_BYTES` (40 MB) or over `UPLOAD_PHOTO_MAX_PIXELS` (50 MP) by `imageDimensionsFromHeader` on the first `UPLOAD_DIMENSION_HEAD_BYTES`, with `photoPrepareRefusal`'s message (use `CGImageSourceCopyPropertiesAtIndex` for the size if the header reader returns null). Fill white before any JPEG encode; never turn a company logo into a JPEG. Keep redrawing to JPEG / PNG (drops EXIF / GPS) and scale to at most 2560 px on the long edge, about 2.5 MB (web: `lib/security/stripPhotoLocation.ts`). Site audit and claim photos stay 1280 px JPEG. Name the object with the redrawn type's extension (`storedFileObjectName`).
5. **Links.** Every stored or typed URL opened from the app goes through `CanonicalBusinessEngine.safeExternalUrl(url)`; null → no link / no open. `https:` only, plus `http:` to localhost / 127.0.0.1 / [::1]; pass `{ allowHttp: true }` only for a material supplier `websiteURL`. Likely: `Models/HealthSafetyModels.swift` (~125, ~146, ~158), `Views/Variations/VariationDetailView.swift` (~311), task attachment and completion files, site audit and deadline photos, certificates, material `websiteURL` (`Views/WholesalersRevampViews.swift`, `Views/ProjectDetailView.swift`, `Views/OperativesView.swift`). Grep `URL(string:` on any stored field and `openURL` / `UIApplication.shared.open`.
6. **Catalogue CSV import** keeps its 1.48.0 checks (`materialCatalogueCsvFileError`, `materialCatalogueCsvTextError`); `UPLOAD_ALLOWED_TYPES.material_catalogue_import` lists it (CSV, 2 MB) for the one table.
7. **Tests** (`ProjectPlannerTests`): call `uploadAllowed` through the engine for an SVG, an `.xlsm`, an octet-stream PDF and a 10 MB + 1 variation PDF; replace `StorageUploadPolicyTests` expectations that allowed Office / SVG / GIF / 20 MB.

## New rulebook sections

- 1.50.0 — 2026-11-15

## Workflow for the iOS agent

1. Run `scripts/sync-rulebook-from-web.sh` (or copy the files above), then run the iOS tests.
2. Produce a numbered Gap Report (Finding / Evidence / Rule / Severity / Solution / Action) for the changes above and **stop**.
3. Implement only what the user approves, in the iOS repo only.
4. Report any web-side gap back to the web agent instead of diverging on iOS.
