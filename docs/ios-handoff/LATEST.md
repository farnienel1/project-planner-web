# iOS follow-on — rulebook 1.2.0

Generated 2026-10-31 by `npm run rulebook:handoff` in project-planner-web. Paste this whole file into the iOS agent.
The web repo copy of `docs/RULEBOOK.md` is canonical. iOS mirrors it exactly; never edit the iOS mirror by hand.

```
╔══════════════════════════════════════════════════════════════════╗
║ FOLLOW-ON — paste into the iOS agent                             ║
╚══════════════════════════════════════════════════════════════════╝
Started on: web
Rulebook version: 1.1.0 → 1.2.0
Packed hash: 2ed0e33e535a5cd2987ff79e057490084d1dcd7119a52f8c3e6dcbbf9d84f1ed
Rulebook sha256: e6c9b7374dfa5c8b5e27b7f3f569b76baf882c5f6ef739606505f14ab15499c6
Copy (do not edit by hand) — run scripts/sync-rulebook-from-web.sh in the iOS repo, which copies:
  web lib/canonical/dist/canonical-business.js      → iOS Project Planner/Canonical/canonical-business.js
  web lib/canonical/dist/canonical-business.sha256  → iOS Project Planner/Canonical/canonical-business.js.sha256
  web lib/canonical/dist/canonical-manifest.json    → iOS Project Planner/Canonical/canonical-manifest.json
  web docs/RULEBOOK.md                              → iOS docs/RULEBOOK.md
  web lib/canonical/parity-fixture.json             → iOS ProjectPlannerTests/CanonicalParityFixture.json
Call: CanonicalBusinessEngine — no second calculator in Swift.
Exports added: LINE_MANAGER_REQUIRED_MESSAGE, OFFLINE_ACTIONS, OFFLINE_AVAILABILITIES, OFFLINE_LAST_UPDATED_PREFIX, OFFLINE_ONLINE_ONLY_MESSAGE, OFFLINE_PENDING_SYNC_LABEL, OPERATIONAL_COLLECTION_PATHS, ORGANIZATION_DOCUMENT_FIELDS, PLATFORM_OWNER_EMAIL, TIMESHEET_MANAGER_SIGN_OFF_FIELDS, approvedWarningKeys, canDecideLeave, canSelfBookAnnualLeave, invoiceLines, isClashGroupApproved, isInvoiceLine, isPlatformOwnerEmail, leaveDecisionQueue, lineManagerRequiredError, normalizeDocumentId, offlineAvailability, offlineLastUpdatedLabel, operativeClashGroups, payRateHistoryWriteFields, unbookedScanDays, usersMissingLineManager, warningLookaheadFallbackNotice
Exports removed: none
Web files that changed the rules: docs/RULEBOOK.md, firestore.rules, lib/canonical/bookingTombstones.ts, lib/canonical/bundleEntry.ts, lib/canonical/canonical.test.ts, lib/canonical/engine.ts, lib/canonical/index.ts, lib/canonical/leaveRequests.ts, lib/canonical/parity-fixture.json, lib/canonical/passwordPolicy.ts, lib/canonical/payRate.ts, lib/canonical/reportPay.ts, lib/canonical/scheduleSources.ts, lib/canonical/timesheetEntryReviews.ts, lib/canonical/userProfile.ts, lib/canonical/offlinePolicy.ts
Done when:
- [ ] Packed hash in iOS equals 2ed0e33e535a5cd2987ff79e057490084d1dcd7119a52f8c3e6dcbbf9d84f1ed
- [ ] iOS docs/RULEBOOK.md is byte-identical (sha256 e6c9b7374dfa5c8b5e27b7f3f569b76baf882c5f6ef739606505f14ab15499c6)
- [ ] RulebookParityTests pass (CanonicalBusinessEngine.rulebookVersion() == 1.2.0)
- [ ] Every Swift caller of a changed rule calls CanonicalBusinessEngine
- [ ] Same Firebase fields read and written as web
- [ ] Any disagreement traced to its first divergence — no copied screen number
```

## What changed in 1.2.0

- Booking tombstones carry only their own fields and are the one exception to write metadata (§1, §2).
- Annual leave: self-booking is the `annualLeaveSelfBook` permission outside operative mode only (`canSelfBookAnnualLeave`). Anyone who does not self-book must have a current active line manager (`lineManagerRequiredError`, `usersMissingLineManager`). Nobody decides their own request; admins decide any request (`canDecideLeave`, `leaveDecisionQueue`). Holiday deletes follow the same deciders (§8, §9, §11, §16).
- Operative clashes come from `operativeClashGroups`, one approval pair per overlapping pair; a cluster is approved only when every pair is (`isClashGroupApproved`). Managers may un-approve (§5, §16).
- Only approvals count as approved clashes (`approvedWarningKeys`); a dismissed clash is hidden but not approved (§5).
- Document ids keep their stored case and compare without case (`normalizeDocumentId`) for warning keys, clash pairs and timesheet entry reviews (§1).
- Offline: the §2 table is exported (`OFFLINE_ACTIONS`, `offlineAvailability`, the three messages). Deleting a booking is online only; a not-found edit replay is final (`bookingReplayRefusedIsFinal({ code, isCreate })`). Labour booking deletes stay admin only (§2, §16).
- `unbookedScanDays`, `warningLookaheadFallbackNotice` and `isPlatformOwnerEmail` are in the packed script (§5, §14).
- Clearing a rate writes a "rate not set" history row, and history days are organisation-zone midnight (`payRateHistoryWriteFields`) (§8).
- PAYE and leave lines never appear on any invoice (`invoiceLines`) (§8).
- `timesheetOwnerWriteFields` drops sign-off and export fields itself; owner saves and leave edits are partial updates (§1, §8, §9).
- `ORGANIZATION_DOCUMENT_FIELDS` and `OPERATIONAL_COLLECTION_PATHS` are in the packed script; `profilePhotoUpdatedAt` is a user field (§1, §12).
- Documented: the live roster is the `organizationId` query; the legacy literal `settings.currencyCode` field is left in place (§1, §4.2, §11).

## New rulebook sections

- 1.2.0 — 2026-10-31

## Workflow for the iOS agent

1. Run `scripts/sync-rulebook-from-web.sh` (or copy the files above), then run the iOS tests.
2. Produce a numbered Gap Report (Finding / Evidence / Rule / Severity / Solution / Action) for the changes above and **stop**.
3. Implement only what the user approves, in the iOS repo only.
4. Report any web-side gap back to the web agent instead of diverging on iOS.
