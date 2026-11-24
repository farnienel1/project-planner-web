# iOS follow-on — rulebook 1.83.0

Generated 2026-11-24 by `npm run rulebook:handoff` in project-planner-web. Paste this whole file into the iOS agent.
The web repo copy of `docs/RULEBOOK.md` is canonical. iOS mirrors it exactly; never edit the iOS mirror by hand.

```
╔══════════════════════════════════════════════════════════════════╗
║ FOLLOW-ON — paste into the iOS agent                             ║
╚══════════════════════════════════════════════════════════════════╝
Started on: web
Rulebook version: 1.82.0 → 1.83.0
Packed hash: 44d7f2b8e0943f7badf7b92268f6062395941bd1ffbc4c8b31f507fb3402589a
Rulebook sha256: 628c13c24d92d052247d59b201d79c885510f023075d7bd431ae8093d7952c1a
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
Exports added: ORG_COMPLIANCE_AUDIT_COLLECTION, ORG_COMPLIANCE_COLLECTION, ORG_COMPLIANCE_COVER_MAX, ORG_COMPLIANCE_DOCUMENT_ID, ORG_COMPLIANCE_EXPIRING_SOON_DAYS, ORG_COMPLIANCE_FIELD_LIMITS, ORG_COMPLIANCE_HUB_GROUP, ORG_COMPLIANCE_LABELS, ORG_COMPLIANCE_MAX_PER_SECTION, ORG_COMPLIANCE_MAX_YEARS_AHEAD, ORG_COMPLIANCE_MESSAGES, ORG_COMPLIANCE_ORG_ID_PATTERN, ORG_COMPLIANCE_PAGE_SUBTITLE, ORG_COMPLIANCE_PAGE_TITLE, ORG_COMPLIANCE_SECTIONS, ORG_COMPLIANCE_SECTION_KEYS, ORG_COMPLIANCE_SHARE_LINKS_COLLECTION, ORG_COMPLIANCE_SHARE_LINK_DAYS, ORG_COMPLIANCE_SHARE_MAX_DOCUMENTS, ORG_COMPLIANCE_SHARE_MESSAGES, ORG_COMPLIANCE_SIGNED_URL_SECONDS, ORG_COMPLIANCE_STATUS_ORDER, ORG_COMPLIANCE_ZIP_MAX_BYTES, ORG_COMPLIANCE_ZIP_MAX_DOCUMENTS, ORG_COMPLIANCE_ZIP_TOO_LARGE_MESSAGE, canManageOrganizationCompliance, isOrgComplianceSectionKey, normalizeOrgComplianceCover, normalizeOrgComplianceExpiry, orgComplianceAddWriteFields, orgComplianceCounts, orgComplianceCoverText, orgComplianceDetailsError, orgComplianceDocTypeLabel, orgComplianceDocumentPath, orgComplianceDocumentRefKey, orgComplianceExpiryStatus, orgComplianceFileName, orgComplianceFolder, orgComplianceHubSubtitle, orgComplianceMergePayload, orgComplianceOrganizationId, orgCompliancePathBelongsTo, orgCompliancePathLinked, orgCompliancePublicDocuments, orgComplianceReminder, orgComplianceRemoveWriteFields, orgComplianceReplaceWriteFields, orgComplianceSection, orgComplianceShareCreatorActive, orgComplianceShareLinkCreateFields, orgComplianceShareLinkState, orgComplianceShareOpen, orgComplianceSharePath, orgComplianceShareSelection, orgComplianceSharedEntry, orgComplianceSortedEntries, orgComplianceStoragePath, orgComplianceTodayKey, orgComplianceUpdateWriteFields, orgComplianceZipEntryNames, orgComplianceZipFileName, parseOrgComplianceDocumentRef, parseOrgComplianceDocuments, parseOrgComplianceShareLink
Exports removed: none
Web files that changed the rules: docs/RULEBOOK.md, firestore.rules, lib/canonical/bundleEntry.ts, lib/canonical/canonical.test.ts, lib/canonical/crossPlatformContract.samples.ts, lib/canonical/index.ts, lib/canonical/liveSources.ts, lib/canonical/orgCompliance.test.ts, lib/canonical/orgCompliance.ts, lib/canonical/organizationSettings.ts, lib/canonical/storedFiles.ts, lib/canonical/uploadPolicy.ts, storage.rules
Done when:
- [ ] Packed hash in iOS equals 44d7f2b8e0943f7badf7b92268f6062395941bd1ffbc4c8b31f507fb3402589a
- [ ] iOS docs/RULEBOOK.md is byte-identical (sha256 628c13c24d92d052247d59b201d79c885510f023075d7bd431ae8093d7952c1a)
- [ ] RulebookParityTests pass (CanonicalBusinessEngine.rulebookVersion() == 1.83.0)
- [ ] Every Swift caller of a changed rule calls CanonicalBusinessEngine
- [ ] Same Firebase fields read and written as web
- [ ] Any disagreement traced to its first divergence — no copied screen number
```

## What changed in 1.83.0

- **Insurance & accreditations** (new §31, owner decisions 24 Nov: build now, lean; admins only; 30-day recovery): Settings › Organisation › Compliance › Insurance & accreditations on web and iPhone — three sections (PI & PL insurance, trade accreditations, quality / ISO), upload, view, edit details, replace file and remove, optional expiry with one status rule. New `lib/canonical/orgCompliance.ts`: `ORG_COMPLIANCE_SECTIONS`, `canManageOrganizationCompliance`, `orgComplianceDocumentPath`, `orgComplianceStoragePath`, `orgCompliancePathBelongsTo`, `parseOrgComplianceDocuments`, `orgComplianceDetailsError`, `orgComplianceAddWriteFields`, `orgComplianceUpdateWriteFields`, `orgComplianceReplaceWriteFields`, `orgComplianceRemoveWriteFields`, `orgComplianceMergePayload`, `orgComplianceExpiryStatus`, `orgComplianceTodayKey`, `orgComplianceSortedEntries`, `orgComplianceCounts`, `orgComplianceHubSubtitle`, `orgComplianceCoverText` and their copy. Stored-file / upload kind `org_compliance_document` (`fileDeletePermission`: admins only). `LIVE_COLLECTIONS` / `OPERATIONAL_COLLECTION_PATHS` list `orgCompliance` (`CONTRACT_NO_READER` until both apps have written it). `firestore.rules`: the admin-only `orgCompliance` match and catch-all exclusion; `storage.rules`: the admin-only `compliance/` folder.
- Owner decision 24 Nov (same version): share links, zip and reminders before launch — `orgComplianceFileName`, `orgCompliancePathLinked`, `orgComplianceReminder`, `orgComplianceZipEntryNames`, `orgComplianceZipFileName`, `ORG_COMPLIANCE_ZIP_MAX_DOCUMENTS`, `ORG_COMPLIANCE_SHARE_*`, `parseOrgComplianceDocumentRef`, `orgComplianceDocumentRefKey`, `orgComplianceShareSelection`, `parseOrgComplianceShareLink`, `orgComplianceShareLinkState`, `orgComplianceShareLinkCreateFields`, `orgComplianceSharePath`, `orgCompliancePublicDocuments`, `orgComplianceSharedEntry`, `orgComplianceShareOpen`. Web: server share routes and the public page, zip download, Home "Waiting for you" item; company export writes `insurance-and-accreditations.csv`.
- Security review of #441 (same version): `ORG_COMPLIANCE_ORG_ID_PATTERN` / `orgComplianceOrganizationId` (paths only for a `^[A-Za-z0-9_-]{1,128}$` id, segments encoded), `orgComplianceShareCreatorActive` (a link stops when its creator is no longer an active admin), `ORG_COMPLIANCE_ZIP_MAX_BYTES` / `ORG_COMPLIANCE_ZIP_TOO_LARGE_MESSAGE`. Web: the public routes check the token's shape before any rate-limit read, read the file key once, match the organisation id exactly; a refused read is told apart from an outage; `/shared/:path*` is never cached and sends no Referer.
- Review of #441 (same version): a failed save re-reads and deletes the new file only when nothing links it; the rules allow only the `documents` id and its top-level keys, refuse deletes, and treat a stray operative-mode admin alike in Firestore and Storage; a new Storage file must start with the uploader's uid; web's today recomputes on focus and day change; emulator tests for a company scheduled for deletion and a deactivated admin.

## iOS work for 1.83.0

Built in iOS PR on branch `ios-1.83-accreditations` (from `ios-1.81-org-names`). Calls through `CanonicalBusinessEngine` only:

1. `Project Planner/Core/Rulebook+OrgCompliance.swift` — wrappers for `ORG_COMPLIANCE_SECTIONS`, `ORG_COMPLIANCE_LABELS`, `canManageOrganizationCompliance`, `orgComplianceStoragePath`, `parseOrgComplianceDocuments`, `orgComplianceTodayKey`, `orgComplianceDetailsError`, `orgComplianceExpiryStatus`, `orgComplianceSortedEntries`, `orgComplianceCounts`, `orgComplianceHubSubtitle`, `orgComplianceCoverText`, the four write functions and `orgComplianceMergePayload`.
2. `Project Planner/Core/FirebaseBackend+OrgCompliance.swift` — upload (`StorageUploadPolicy.prepareFileData` family `.orgComplianceDocument`, `checkedUploadContentType`), one transaction per change that merge-sets `{ documents: { [section]: list } }` on `organizations/{orgId}/orgCompliance/documents`, old file deleted on replace / remove; `OrgComplianceStore` (live listener, org-scoped).
3. `Project Planner/Views/OrganisationSettingsHubView.swift` — Compliance group under Identity (admins only), row subtitle and amber attention count.
4. `Project Planner/Views/InsuranceAccreditationsView.swift` — the page: counts, three sections, Upload, View / Edit details / Replace file / Remove, the form.
5. `Project Planner/Core/StorageUploadPolicy.swift` — family `.orgComplianceDocument` → `org_compliance_document`.
6. `ProjectPlannerTests/OrgComplianceTests.swift`.

Phase 2 (owner decision 24 Nov, same PR):

7. Failed save: re-read `organizations/{orgId}/orgCompliance/documents` from the server and delete the uploaded file only when `orgCompliancePathLinked` says nothing names it; a failed re-read keeps the file.
8. File name: `orgComplianceFileName(pickedName, storedPath)` (same value as web).
9. Zip of ticked documents (`orgComplianceZipEntryNames`, `orgComplianceZipFileName`, at most 50), shared through the share sheet.
10. Share links: create / list / turn off through `https://projectplanner.us/api/compliance/share-links` (and `/revoke`) with the user's ID token; `orgComplianceShareSelection` before sending.
11. Home card for admins from `orgComplianceReminder(orgComplianceCounts(…))`, opening the page.

## New rulebook sections

- 31. Insurance & accreditations (1.83.0)
- 1.83.0 — 2026-11-24

## Workflow for the iOS agent

1. Run `scripts/sync-rulebook-from-web.sh` (or copy the files above), then run the iOS tests.
2. Produce a numbered Gap Report (Finding / Evidence / Rule / Severity / Solution / Action) for the changes above and **stop**.
3. Implement only what the user approves, in the iOS repo only.
4. Report any web-side gap back to the web agent instead of diverging on iOS.
