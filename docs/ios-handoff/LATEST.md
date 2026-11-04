# iOS follow-on — rulebook 1.30.0

Generated 2026-11-04 by `npm run rulebook:handoff` in project-planner-web. Paste this whole file into the iOS agent.
The web repo copy of `docs/RULEBOOK.md` is canonical. iOS mirrors it exactly; never edit the iOS mirror by hand.

```
╔══════════════════════════════════════════════════════════════════╗
║ FOLLOW-ON — paste into the iOS agent                             ║
╚══════════════════════════════════════════════════════════════════╝
Started on: web
Rulebook version: 1.29.0 → 1.30.0
Packed hash: c6b191fdde45c4bb540d842a0aa562bba569dc49642a89dd74edb99b2b2eade9
Rulebook sha256: 85c030c6ec07dd53d0155b9fbbc2ced7a18ee33a1a6c008ff01e6e6bd0ae1e8b
Copy (do not edit by hand) — run scripts/sync-rulebook-from-web.sh in the iOS repo, which copies:
  web lib/canonical/dist/canonical-business.js      → iOS Project Planner/Canonical/canonical-business.js
  web lib/canonical/dist/canonical-business.sha256  → iOS Project Planner/Canonical/canonical-business.js.sha256
  web lib/canonical/dist/canonical-manifest.json    → iOS Project Planner/Canonical/canonical-manifest.json
  web docs/RULEBOOK.md                              → iOS docs/RULEBOOK.md
  web lib/canonical/parity-fixture.json             → iOS ProjectPlannerTests/CanonicalParityFixture.json
  web lib/canonical/cross-platform-contract.json    → iOS ProjectPlannerTests/CrossPlatformContract.json
Contract sha256: 7f70ec28920ac6114068b4e44eaf893706d5b6af1b21d77b69f946074d74e126
Call: CanonicalBusinessEngine — no second calculator in Swift.
Exports added: EXPENSES_EMPTY_MESSAGE, EXPENSES_GENERATE_REPORT_LABEL, EXPENSES_REPORT_TITLE, EXPENSES_TOTAL_LABEL, EXPENSE_ADD_LABEL, EXPENSE_EVIDENCE_REQUIRED_MESSAGE, EXPENSE_ITEMS_COLLECTION, PAYE_CLAIM_AMOUNT_MAX, PAYE_CLAIM_AMOUNT_MESSAGE, PAYE_CLAIM_APPROVER_NOT_NOTIFIED_NOTE, PAYE_CLAIM_DATE_MESSAGE, PAYE_CLAIM_DETAILS_MAX, PAYE_CLAIM_EVIDENCE_FOLDER, PAYE_CLAIM_EVIDENCE_INVALID_MESSAGE, PAYE_CLAIM_EVIDENCE_KINDS, PAYE_CLAIM_EVIDENCE_LIMIT_MESSAGE, PAYE_CLAIM_EVIDENCE_MAX, PAYE_CLAIM_EVIDENCE_NOT_DRAWN_NOTE, PAYE_CLAIM_EVIDENCE_UNREADABLE_NOTE, PAYE_CLAIM_KINDS, PAYE_CLAIM_REPORTS_COLLECTION, PAYE_CLAIM_TITLE_MAX, PAYE_CLAIM_TITLE_MESSAGE, PERSONAL_SITE_AUDITS_COLLECTION, PERSONAL_SITE_AUDIT_CREATE_LABEL, PERSONAL_SITE_AUDIT_DATE_MESSAGE, PERSONAL_SITE_AUDIT_ITEMS_MAX, PERSONAL_SITE_AUDIT_ITEMS_MESSAGE, PERSONAL_SITE_AUDIT_ITEM_TITLE_MESSAGE, PERSONAL_SITE_AUDIT_JOB_NAME_MESSAGE, PERSONAL_SITE_AUDIT_PRIVACY_NOTICE, PERSONAL_SITE_AUDIT_PRIVATE_NOTE, PERSONAL_SITE_AUDIT_SECTION_LABEL, PRICE_WORK_ADD_LABEL, PRICE_WORK_APPROVER_INVALID_MESSAGE, PRICE_WORK_APPROVER_REQUIRED_MESSAGE, PRICE_WORK_DATES_MESSAGE, PRICE_WORK_EMPTY_MESSAGE, PRICE_WORK_GENERATE_REPORT_LABEL, PRICE_WORK_ITEMS_COLLECTION, PRICE_WORK_REPORT_TITLE, PRICE_WORK_TOTAL_LABEL, canViewPayeClaims, canViewPersonalSiteAudit, canWritePayeClaim, expenseValidationError, expenseWriteFields, parseExpenseDocument, parsePayeClaimEvidence, parsePayeClaimReportDocument, parsePersonalSiteAuditDocument, parsePriceWorkDocument, payeClaimDayKey, payeClaimEvidenceDrawAs, payeClaimEvidencePages, payeClaimEvidencePath, payeClaimEvidencePathBelongsTo, payeClaimEvidenceToDelete, payeClaimEvidenceWriteFields, payeClaimListRow, payeClaimReportReady, payeClaimReportRows, payeClaimReportSnapshot, payeClaimReportsOfKind, payeClaimsInRange, payeClaimsTotal, personalSiteAuditEvidence, personalSiteAuditImagePath, personalSiteAuditPdfRows, personalSiteAuditTitle, personalSiteAuditValidationError, personalSiteAuditWriteFields, personalSiteAuditsFor, priceWorkApproverCandidates, priceWorkValidationError, priceWorkWriteFields, timesheetClaimRows
Exports removed: none
Web files that changed the rules: docs/RULEBOOK.md, firestore.rules, lib/canonical/bundleEntry.ts, lib/canonical/canonical.test.ts, lib/canonical/crossPlatformContract.samples.ts, lib/canonical/index.ts, lib/canonical/liveSources.ts, lib/canonical/organizationSettings.ts, lib/canonical/parity-fixture.json, lib/canonical/payeClaims.ts, lib/canonical/personalSiteAudits.ts, lib/canonical/storedFiles.ts, storage.rules
Done when:
- [ ] Packed hash in iOS equals c6b191fdde45c4bb540d842a0aa562bba569dc49642a89dd74edb99b2b2eade9
- [ ] iOS docs/RULEBOOK.md is byte-identical (sha256 85c030c6ec07dd53d0155b9fbbc2ced7a18ee33a1a6c008ff01e6e6bd0ae1e8b)
- [ ] RulebookParityTests pass (CanonicalBusinessEngine.rulebookVersion() == 1.30.0)
- [ ] Every Swift caller of a changed rule calls CanonicalBusinessEngine
- [ ] Same Firebase fields read and written as web
- [ ] Any disagreement traced to its first divergence — no copied screen number
```

## What changed in 1.30.0

- **PAYE price work and expenses** (new §26, owner decisions 4 Nov): the same three range buttons as Overtime plus Add; Add Price Work (name, description, from–to, a required approver from `priceWorkApproverCandidates` — active admins and managers, never operatives or the person, no free text, not notified — the figure, optional evidence) and Add Expense (the timesheet expense fields, at least one piece of evidence). `priceWorkWriteFields`, `expenseWriteFields`, `priceWorkValidationError`, `expenseValidationError`, readers `parsePriceWorkDocument` / `parseExpenseDocument`, `payeClaimsInRange`, `payeClaimsTotal`, `payeClaimListRow`, evidence `payeClaimEvidencePath` / `parsePayeClaimEvidence` / `payeClaimEvidenceWriteFields` / `payeClaimEvidenceDrawAs`.
- **Reports**: Generate price work / expenses report (green after the first item) saves a frozen copy `payeClaimReports/{id}` (`payeClaimReportSnapshot`, `parsePayeClaimReportDocument`, `payeClaimReportsOfKind`) and builds the PDF from it — a summary page, then one page per piece of evidence (images full size, PDF attachments appended; other files listed with a note) — `payeClaimReportRows`, `payeClaimEvidencePages`.
- **Who sees what**: the person, their line managers and admins, read-only for all but the person (`canViewPayeClaims`, `canWritePayeClaim`); a self-employed person's items under Users' are their timesheet entries, read-only (`timesheetClaimRows`).
- **Personal site audits**: Site audits → Personal → Create Personal Site Audit, free-text job number and name, owner only (`personalSiteAuditWriteFields`, `personalSiteAuditValidationError`, `parsePersonalSiteAuditDocument`, `canViewPersonalSiteAudit`, `personalSiteAuditsFor`, `personalSiteAuditImagePath`, `personalSiteAuditTitle`); attached as evidence as a frozen PDF copy (`personalSiteAuditPdfRows`, `personalSiteAuditEvidence`). Privacy policy sentence `PERSONAL_SITE_AUDIT_PRIVACY_NOTICE` (legal pack version unchanged).
- **Uploaded files** (§24): kinds `paye_claim_evidence` and `personal_site_audit` (`storedFileKind` with the folder's owner); `fileDeletePermission` refuses admins on a personal audit file (`owner_only`).
- Review fixes (same release): evidence readers keep only the person's own claim files (`parsePayeClaimEvidence` with the owner); a refused add deletes the files it just uploaded and removing an item deletes evidence only inside the §24 undo window (`payeClaimEvidenceToDelete`), the privacy sentence says the copy is otherwise kept; approvers must have a users document of this organisation and the admin or manager flag or role, in `priceWorkApproverCandidates` and the rules alike; the rules check the first five evidence paths and refuse SVG; Storage evidence reads need an active line manager or active admin; Firestore `callerLineManagesUser` honours `hasNoLineManager` (also for §25); personal audit edits keep the create shape; report copies hold at most 500 items.
- **Security rules** (§16): the four collections, the catch-all exclusion, and the two Storage paths, with emulator tests (`tests/payeClaims.rules.test.ts`, `tests/storage.rules.test.ts`). `LIVE_COLLECTIONS` and `OPERATIONAL_COLLECTION_PATHS` list the collections; the company export reads the first three and leaves personal audits out; the data clean-up script gains the report-only `paye-claims` check.

## New rulebook sections

- 26. PAYE price work, expenses and personal site audits (1.30.0)
- 1.30.0 — 2026-11-04

## Workflow for the iOS agent

1. Run `scripts/sync-rulebook-from-web.sh` (or copy the files above), then run the iOS tests.
2. Produce a numbered Gap Report (Finding / Evidence / Rule / Severity / Solution / Action) for the changes above and **stop**.
3. Implement only what the user approves, in the iOS repo only.
4. Report any web-side gap back to the web agent instead of diverging on iOS.
