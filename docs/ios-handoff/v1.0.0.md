# iOS follow-on — rulebook 1.0.0

Generated 2026-10-31 by `npm run rulebook:handoff` in project-planner-web. Paste this whole file into the iOS agent.
The web repo copy of `docs/RULEBOOK.md` is canonical. iOS mirrors it exactly; never edit the iOS mirror by hand.

```
╔══════════════════════════════════════════════════════════════════╗
║ FOLLOW-ON — paste into the iOS agent                             ║
╚══════════════════════════════════════════════════════════════════╝
Started on: web
Rulebook version: (none) → 1.0.0
Packed hash: cf875901410b87eedc0cb5bc328e9044a8ecb8bdc4956cf9b23325255fb9f99b
Rulebook sha256: f616b45a005d0d8de263ba48ed7636aeb5a29e29eaff4ee6f3df28704e6ccb26
Copy (do not edit by hand) — run scripts/sync-rulebook-from-web.sh in the iOS repo, which copies:
  web lib/canonical/dist/canonical-business.js      → iOS Project Planner/Canonical/canonical-business.js
  web lib/canonical/dist/canonical-business.sha256  → iOS Project Planner/Canonical/canonical-business.js.sha256
  web lib/canonical/dist/canonical-manifest.json    → iOS Project Planner/Canonical/canonical-manifest.json
  web docs/RULEBOOK.md                              → iOS docs/RULEBOOK.md
  web lib/canonical/parity-fixture.json             → iOS ProjectPlannerTests/CanonicalParityFixture.json
Call: CanonicalBusinessEngine — no second calculator in Swift.
Exports added: BOOKING_REPLAY_REFUSED_MESSAGE, BOOKING_TOMBSTONE_BATCH_DELETE_LIMIT, BOOKING_TOMBSTONE_COLLECTION, BOOKING_TOMBSTONE_FIELDS, CURRENCY_OPTIONS, DEFAULT_BANK_HOLIDAY_REGION_ID, DEFAULT_CURRENCY_CODE, DEVELOPER_PASSWORD_MIN_LENGTH, FALLBACK_LOOKAHEAD_DAYS, HOLIDAY_REQUEST_SUBMITTED_TYPE, HOLIDAY_STATUSES, HOLIDAY_TIME_SLOTS, OVERLAPPING_BOOKING_NOTE, PASSWORD_MIN_LENGTH, PAYMENT_RUN_1_LAST_END_DAY, PAYROLL_POLICY_LIMITS, TOMBSTONED_BOOKING_COLLECTIONS, WORKING_WEEK, WRITE_PLATFORMS, activePaymentRunSummary, bookingReplayRefusedIsFinal, bookingTombstonePath, bookingTombstoneWriteFields, clashApprovalWrites, clashResolutionKey, clashScanDays, companyDetailsValidationError, companyDetailsWriteFields, currencyOption, currencySymbol, defaultCurrencyForCountry, effectivePayrollTimePolicy, enabledScheduleLocations, exclusiveRates, formatMoney, formatPaymentRunDay, historyPayRowOnDay, historyRowBasis, holidayDecisionWriteFields, holidayRequestRanges, holidayRequestWriteFields, isClashApproved, isStandardWorkingWeekday, isTombstonedBookingCollection, leaveApproverIds, leaveRecordDayKeys, lineManagerIds, livePayRate, materialCutOffWarningRows, materialLineCountsAsOrdered, normalizeCompanyCountryCode, normalizeCurrencyCode, normalizeDocumentAbbreviation, normalizeHolidayStatus, normalizeHolidayTimeSlot, organizationCurrencyWriteFields, organizationTimeZone, overlappingBookingIds, parseCompanyDetails, parseHolidayDecisionNote, parsePayrollTimePolicyScheduled, parsePayrollTimePolicyState, passwordMinLength, passwordPolicyError, payRateOnDay, paymentRunLabel, paymentRunPayDate, paymentWeekdayAfterPeriodEnd, payrollDayKeyFromValue, payrollTimePolicyApplyNowWriteFields, payrollTimePolicyCancelScheduleWriteFields, payrollTimePolicyForDayFromState, payrollTimePolicyScheduleDateError, payrollTimePolicyScheduleWriteFields, payrollTimePolicyTimeline, readStoredRates, resolveOrganizationCurrency, rulebookStamp, scheduleOptionsWriteFields, timesheetLeaveLabel, timesheetLeaveLines, validatePayrollTimePolicy, writeMetadataFields
Exports removed: none
Web files that changed the rules: docs/RULEBOOK.md, firestore.indexes.json, firestore.rules, lib/canonical/annualLeaveBalance.ts, lib/canonical/bookingTombstones.ts, lib/canonical/bundleEntry.ts, lib/canonical/canonical.test.ts, lib/canonical/companyDetails.ts, lib/canonical/engine.ts, lib/canonical/index.ts, lib/canonical/leaveRequests.ts, lib/canonical/materialCutOffWarnings.ts, lib/canonical/money.ts, lib/canonical/notificationPreferences.ts, lib/canonical/organizationSettings.ts, lib/canonical/organizationTimeZone.ts, lib/canonical/passwordPolicy.ts, lib/canonical/payRate.ts, lib/canonical/paymentRuns.ts, lib/canonical/payrollPolicySchedule.ts, lib/canonical/rulebookStamp.ts, lib/canonical/scheduleOptions.ts, lib/canonical/scheduleSources.ts, lib/canonical/timesheetLines.ts, lib/canonical/timesheetSubmission.ts, lib/canonical/writeMetadata.ts
Done when:
- [ ] Packed hash in iOS equals cf875901410b87eedc0cb5bc328e9044a8ecb8bdc4956cf9b23325255fb9f99b
- [ ] iOS docs/RULEBOOK.md is byte-identical (sha256 f616b45a005d0d8de263ba48ed7636aeb5a29e29eaff4ee6f3df28704e6ccb26)
- [ ] RulebookParityTests pass (CanonicalBusinessEngine.rulebookVersion() == 1.0.0)
- [ ] Every Swift caller of a changed rule calls CanonicalBusinessEngine
- [ ] Same Firebase fields read and written as web
- [ ] Any disagreement traced to its first divergence — no copied screen number
```

## What changed in 1.0.0

- First versioned rulebook. Consolidates the rules previously spread across `docs/CANONICAL_ARCHITECTURE.md`, `AGENTS.md` and the iOS copies into this one file, mirrored to iOS.
- Decisions: organisation currency used for every money figure (11 currencies, country default); one business time zone per organisation from its country; fixed Monday–Sunday week; scheduled working-hours changes on every platform; recurring payment runs paid in arrears after the work period; weekend clashes checked when a weekend booking exists; overlapping bookings each paid and shown in amber; PAYE days shown at 0; annual leave shown on timesheets as information (never on invoices); one leave document per request with a decision note; weekly reports never stored; booking tombstones stop offline resurrection; password minimum 8; Variations notification toggle; write metadata `updatedBy` / `updatedFrom`.

## New rulebook sections

- 1. Data, sync and source of truth
- 2. Offline rules
- 3. The data flow (in order)
- 4. Organisation settings
- 4.1 Company details
- 4.2 Currency
- 4.3 Working hours and overtime
- 4.4 Annual leave settings
- 4.5 Payment runs (the invoicing period)
- 4.6 Warning settings
- 4.7 Material order cut-off
- 4.8 Schedule options
- 5. Warnings
- 6. Daily Overview
- 7. Weekly Report
- 8. Timesheets and employment profile
- 9. Annual leave
- 10. My Schedule
- 11. Manage Users
- 12. My Profile
- 13. Notifications
- 14. Authentication and organisations
- 15. Platform-specific (not synced)
- 16. Server-side permissions (Firestore security rules)
- How the rulebook changes
- Changelog
- 1.0.0 — 2026-10-31

## Workflow for the iOS agent

1. Run `scripts/sync-rulebook-from-web.sh` (or copy the files above), then run the iOS tests.
2. Produce a numbered Gap Report (Finding / Evidence / Rule / Severity / Solution / Action) for the changes above and **stop**.
3. Implement only what the user approves, in the iOS repo only.
4. Report any web-side gap back to the web agent instead of diverging on iOS.
