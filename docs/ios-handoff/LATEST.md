# iOS follow-on — rulebook 1.8.0

Generated 2026-11-02 by `npm run rulebook:handoff` in project-planner-web. Paste this whole file into the iOS agent.
The web repo copy of `docs/RULEBOOK.md` is canonical. iOS mirrors it exactly; never edit the iOS mirror by hand.

```
╔══════════════════════════════════════════════════════════════════╗
║ FOLLOW-ON — paste into the iOS agent                             ║
╚══════════════════════════════════════════════════════════════════╝
Started on: web
Rulebook version: 1.7.0 → 1.8.0
Packed hash: 964ca86bd8eb5cd406525c0c286962b0868bcd2ff58f9dd84f75f032f603706a
Rulebook sha256: f78834b7f2636a2f5653877cc3248a0d4766a1641bd67c8f50c686d8b306ed58
Copy (do not edit by hand) — run scripts/sync-rulebook-from-web.sh in the iOS repo, which copies:
  web lib/canonical/dist/canonical-business.js      → iOS Project Planner/Canonical/canonical-business.js
  web lib/canonical/dist/canonical-business.sha256  → iOS Project Planner/Canonical/canonical-business.js.sha256
  web lib/canonical/dist/canonical-manifest.json    → iOS Project Planner/Canonical/canonical-manifest.json
  web docs/RULEBOOK.md                              → iOS docs/RULEBOOK.md
  web lib/canonical/parity-fixture.json             → iOS ProjectPlannerTests/CanonicalParityFixture.json
Call: CanonicalBusinessEngine — no second calculator in Swift.
Exports added: DEFAULT_JOB_TYPE_NAMES, HEALTH_SAFETY_ARRAY_FIELDS, HS_ISSUE_STATUSES, HS_ISSUE_STATUS_STORED, HS_SIGNATURE_RECORDS_FIELD, HS_SIGNATURE_STATUSES, JOB_TYPES_DOCUMENT_ID, KNOWN_NOTIFICATION_TYPES, LEGACY_NOTIFICATION_TYPES, MATERIAL_DAY_WRITE_GROUP, MATERIAL_LENGTH_UNITS, MATERIAL_LENGTH_WRITE_GROUP, MATERIAL_NAME_WRITE_GROUP, MATERIAL_STATUS_SYNONYMS, MATERIAL_UNITS, MATERIAL_WORKFLOW_STATUSES, PROJECT_TASK_PRIORITIES, PROJECT_TASK_STATUSES, RESTORED_JOB_TYPE_NAMES, TASK_COMPLETION_WRITE_GROUP, TASK_ITEMS_WRITE_GROUP, TASK_MANAGER_WRITE_GROUP, TASK_OPERATIVE_WRITE_GROUP, TRADE_TYPE_INVENTORY_DOCUMENT_ID, VARIATION_EVIDENCE_WRITE_GROUP, VARIATION_LABOUR_WRITE_GROUP, VARIATION_MATERIALS_WRITE_GROUP, VARIATION_NUMBER_WRITE_GROUP, VARIATION_STATUS_TOKENS, VARIATION_STATUS_WRITE_GROUP, WHOLESALER_CONTACTS_WRITE_GROUP, canonicalJobTypeName, coerceJobTypeList, derivedDocumentId, derivedRowId, documentOrganizationId, foldHealthSafetySignatures, healthSafetyDocumentId, healthSafetyDocumentIds, healthSafetyDocumentWriteFields, healthSafetyIssueStatus, healthSafetySignatureKey, healthSafetySignatureWriteFields, isKnownNotificationType, jobClientId, jobTypesWriteFields, materialCatalogueItemFields, materialCatalogueItemWriteFields, materialCatalogueWrites, materialLineFields, materialLineWriteFields, materialSendRecordCreateFields, materialSendStatusWriteFields, mergeJobTypeCatalogues, mergeStoredRows, normalizeHSIssueStatus, normalizeHSSignatureStatus, normalizeMaterialLengthUnit, normalizeMaterialRequestType, normalizeMaterialUnit, normalizeMaterialWorkflowStatus, normalizeProjectTaskPriority, normalizeProjectTaskStatus, normalizeVariationStatus, notificationReadWriteFields, operativeProfileWriteFields, organizationDayStartMs, parseHealthSafetyDocument, parseJobTypesDocument, parseMaterialCatalogueDocument, parseMaterialLineDocument, parseMaterialListDocuments, parseMaterialSendRecordDocument, parseNotificationDocument, parseOperativeProfileDocument, parseSiteAuditDocument, parseTaskDocument, parseTradeTypeInventory, parseVariationDocument, parseVariationTrackerDocument, parseWarningResolutionDocument, parseWholesalerDocument, sharedWarningResolutionKey, siteAuditWriteFields, storedJobIdForKey, stringFromJobTypeField, subcontractorContactId, taskFields, taskWriteFields, tradeTypeInventoryWriteFields, variationLineId, variationRenumberWriteFields, variationWriteFields, warningResolutionMigrationWrites, warningResolutionRecords, wholesalerContactId, wholesalerWriteFields
Exports removed: none
Web files that changed the rules: docs/RULEBOOK.md, lib/canonical/bundleEntry.ts, lib/canonical/canonical.test.ts, lib/canonical/index.ts, lib/canonical/materialCutOffWarnings.ts, lib/canonical/notificationRecipients.ts, lib/canonical/peopleDocuments.ts, lib/canonical/workDocumentReaders.ts, lib/canonical/derivedIds.ts, lib/canonical/operationsDocuments.ts, lib/canonical/recordsDocuments.ts
Done when:
- [ ] Packed hash in iOS equals 964ca86bd8eb5cd406525c0c286962b0868bcd2ff58f9dd84f75f032f603706a
- [ ] iOS docs/RULEBOOK.md is byte-identical (sha256 f78834b7f2636a2f5653877cc3248a0d4766a1641bd67c8f50c686d8b306ed58)
- [ ] RulebookParityTests pass (CanonicalBusinessEngine.rulebookVersion() == 1.8.0)
- [ ] Every Swift caller of a changed rule calls CanonicalBusinessEngine
- [ ] Same Firebase fields read and written as web
- [ ] Any disagreement traced to its first divergence — no copied screen number
```

## What changed in 1.8.0

- One reader per operations and record collection (§1): `parseMaterialLineDocument` / `parseMaterialListDocuments`, `parseMaterialCatalogueDocument`, `parseMaterialSendRecordDocument`, `parseWholesalerDocument`, `parseSiteAuditDocument`, `parseTaskDocument`, `parseJobTypesDocument` (with `coerceJobTypeList` / `canonicalJobTypeName` moved into the rulebook), `parseTradeTypeInventory`, `parseOperativeProfileDocument`, `parseHealthSafetyDocument`, `parseVariationDocument`, `parseVariationTrackerDocument`, `parseNotificationDocument`, `parseWarningResolutionDocument`. iOS dropped material lines, send records, wholesalers, site audits, tasks and inbox rows whose ids were not UUIDs or whose unit, type or status it did not know; both apps minted random ids for task items and variation lines stored without one. The §1 known-gaps list is empty.
- Partial writes for every one of them (§1): material lines (organisation-zone `date` plus `dayKey`; iOS used device midnight), the material catalogue (`materialCatalogueWrites`; web deleted and rewrote the whole catalogue), tasks (both apps did a whole-task `setData`), wholesalers, site audits (web re-stamped `createdAt` and dropped `imageCapturedAt`), variations and renumbering, the `operativeProfiles` mirror, `settings/jobTypes`, `settings/tradeTypeInventory`.
- Health & safety: one issue-status vocabulary (web wrote `complete`, iOS read only `completed`; finished web issues showed as awaiting on iOS) — issues are stored `completed`. Signatures are per-signer map entries (`signatureRecords`, `healthSafetySignatureWriteFields`) so concurrent signatures are never lost; whole-list saves keep the other app's fields and never replace a list with an empty one.
- Notifications (§13): every app reads inbox rows with `parseNotificationDocument` and accepts every `KNOWN_NOTIFICATION_TYPES` type; the iOS enum lacks `variation` and `variation_renumbered`, and iOS read `relatedId` only as a UUID.
- Warning resolutions (§5): live listener on web; legacy iOS keys read in their shared form (`sharedWarningResolutionKey`) and the D3 migration is the shared `warningResolutionMigrationWrites`.
- Job keys (§1): job-scoped records store the job's document id as stored; settings documents use the upper-cased key (`healthSafetyDocumentId`, like `deadlinesDocumentId`); keys map back with `storedJobIdForKey`; a job with a client name but no client id gets `jobClientId`. Contacts and rows stored without an id get `derivedRowId` ids (`subcontractorContactId`, `wholesalerContactId`, `variationLineId`). Organisation references stored as a path or DocumentReference read as the id (`documentOrganizationId`); `parseUserDocument` marks `annualLeaveDefaultsPending` before the organisation loads.
- `subcontractorBookingCreateFields` writes clock times whenever given (comment corrected; code unchanged).

## New rulebook sections

- 1.8.0 — 2026-11-02

## Workflow for the iOS agent

1. Run `scripts/sync-rulebook-from-web.sh` (or copy the files above), then run the iOS tests.
2. Produce a numbered Gap Report (Finding / Evidence / Rule / Severity / Solution / Action) for the changes above and **stop**.
3. Implement only what the user approves, in the iOS repo only.
4. Report any web-side gap back to the web agent instead of diverging on iOS.
