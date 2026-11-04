# iOS follow-on — rulebook 1.29.0

Generated 2026-11-04 by `npm run rulebook:handoff` in project-planner-web. Paste this whole file into the iOS agent.
The web repo copy of `docs/RULEBOOK.md` is canonical. iOS mirrors it exactly; never edit the iOS mirror by hand.

```
╔══════════════════════════════════════════════════════════════════╗
║ FOLLOW-ON — paste into the iOS agent                             ║
╚══════════════════════════════════════════════════════════════════╝
Started on: web
Rulebook version: 1.28.0 → 1.29.0
Packed hash: 4c1534cf3709d755e42699e97b662372d7afe9aec5fde4701b038630f7188ce5
Rulebook sha256: e7c7678e3e6a5fd012ac4aa67ed3e1aa57e96174fc4a5043af4540ca62d3fc9e
Copy (do not edit by hand) — run scripts/sync-rulebook-from-web.sh in the iOS repo, which copies:
  web lib/canonical/dist/canonical-business.js      → iOS Project Planner/Canonical/canonical-business.js
  web lib/canonical/dist/canonical-business.sha256  → iOS Project Planner/Canonical/canonical-business.js.sha256
  web lib/canonical/dist/canonical-manifest.json    → iOS Project Planner/Canonical/canonical-manifest.json
  web docs/RULEBOOK.md                              → iOS docs/RULEBOOK.md
  web lib/canonical/parity-fixture.json             → iOS ProjectPlannerTests/CanonicalParityFixture.json
  web lib/canonical/cross-platform-contract.json    → iOS ProjectPlannerTests/CrossPlatformContract.json
Contract sha256: 7f70ec28920ac6114068b4e44eaf893706d5b6af1b21d77b69f946074d74e126
Call: CanonicalBusinessEngine — no second calculator in Swift.
Exports added: BOOKING_HOURS_CHANGED_BY_OWNER_TYPE, OVERTIME_APPROVE_REQUEST_LABEL, OVERTIME_CANCEL_NOT_ALLOWED_MESSAGE, OVERTIME_CANCEL_WARNING, OVERTIME_COMING_NEXT_MESSAGE, OVERTIME_GENERATE_REPORT_LABEL, OVERTIME_HUB_LABEL, OVERTIME_LINE_STATES, OVERTIME_LINE_STATE_LABELS, OVERTIME_MINE_LABEL, OVERTIME_MIN_MINUTES, OVERTIME_MULTIPLIER_MAX, OVERTIME_MULTIPLIER_MESSAGE, OVERTIME_MULTIPLIER_MIN, OVERTIME_MULTIPLIER_STEP, OVERTIME_MULTIPLIER_STEPS, OVERTIME_NO_LINES_MESSAGE, OVERTIME_REPORTS_COLLECTION, OVERTIME_REPORT_TOTAL_LABEL, OVERTIME_REQUESTS_COLLECTION, OVERTIME_REQUEST_NOT_PENDING_MESSAGE, OVERTIME_REQUEST_REVIEWED_TYPE, OVERTIME_REQUEST_STALE_MESSAGE, OVERTIME_REQUEST_STATUSES, OVERTIME_REQUEST_SUBMITTED_TYPE, OVERTIME_REQUEST_UNDECIDED_MESSAGE, OVERTIME_REVIEWS_COLLECTION, OVERTIME_SEND_FOR_APPROVAL_LABEL, OVERTIME_TIMES_MESSAGE, OVERTIME_USERS_LABEL, PAYE_PAYDAY_CONTROL_LABEL, PAYE_PAYDAY_HELP, PAYE_PAYDAY_INVALID_MESSAGE, PAYE_PAYDAY_MAX, PAYE_PAYDAY_MIN, PAYE_PAYDAY_NOT_SET_MESSAGE, bookingHoursChangedRecipients, canDecideOvertimeRequest, canEditOwnBookingOvertime, canGenerateOvertimeReport, formatPayePayrunDay, organizationOvertimeMultiplier, overtimeApprovalWrites, overtimeBookingAfter, overtimeBookingFingerprint, overtimeBookingSlot, overtimeBookingWriteFields, overtimeCogPreview, overtimeDirectWrites, overtimeEditValidationError, overtimeForBooking, overtimeHubAccess, overtimeLineIsStale, overtimeLinesTotal, overtimeMultiplierValid, overtimeMultiplierValidationError, overtimeMultiplierWriteFields, overtimeRateControl, overtimeReportRows, overtimeReportSnapshot, overtimeRequestFullyDecided, overtimeRequestLineFields, overtimeRequestRecipients, overtimeRequestWithdrawWriteFields, overtimeRequestWriteFields, overtimeRequestsToReplace, overtimeReviewDocId, overtimeReviewedRecipients, overtimeStrikeOutcome, overtimeUserSubjects, parseOvertimeReportDocument, parseOvertimeRequestDocument, parseOvertimeReviewDocument, payeCustomRange, payeOvertimeLines, payePastPayruns, payePayday, payePaydayHistory, payePaydayValidationError, payePaydayWriteFields, payePayrunLabel, payePayrunPeriod, payePayrunSummary, payeRangeDayKeys, weeklyReportPayeDay, weeklyReportPayeOvertime
Exports removed: none
Web files that changed the rules: docs/RULEBOOK.md, firestore.rules, lib/canonical/bookings.ts, lib/canonical/bundleEntry.ts, lib/canonical/canonical.test.ts, lib/canonical/crossPlatformContract.samples.ts, lib/canonical/index.ts, lib/canonical/liveSources.ts, lib/canonical/notificationPreferences.ts, lib/canonical/notificationRecipients.ts, lib/canonical/organizationSettings.ts, lib/canonical/parity-fixture.json, lib/canonical/recordsDocuments.ts, lib/canonical/payeOvertime.ts, lib/canonical/payePayrun.ts
Done when:
- [ ] Packed hash in iOS equals 4c1534cf3709d755e42699e97b662372d7afe9aec5fde4701b038630f7188ce5
- [ ] iOS docs/RULEBOOK.md is byte-identical (sha256 e7c7678e3e6a5fd012ac4aa67ed3e1aa57e96174fc4a5043af4540ca62d3fc9e)
- [ ] RulebookParityTests pass (CanonicalBusinessEngine.rulebookVersion() == 1.29.0)
- [ ] Every Swift caller of a changed rule calls CanonicalBusinessEngine
- [ ] Same Firebase fields read and written as web
- [ ] Any disagreement traced to its first divergence — no copied screen number
```

## What changed in 1.29.0

- **PAYE payday** (§4.5): `invoicing.payePayday` with the append-only `invoicing.payePaydayHistory`; a payrun runs from the day after last month's payday to this payday, 29–31 the last day of shorter months, never moved off weekends; a change applies from the next payrun and past payruns keep their dates. `payePayrunPeriod`, `payePayrunSummary`, `payePastPayruns`, `payePaydayHistory`, `payePayday`, `payePaydayWriteFields`, `payePaydayValidationError`, `PAYE_PAYDAY_NOT_SET_MESSAGE`.
- **PAYE overtime** (new §25): the Overtime screen, lines and states (`payeOvertimeLines`, `overtimeForBooking`, `overtimeBookingFingerprint`, `overtimeLineIsStale`), the cog (`overtimeCogPreview`), the red X (`overtimeStrikeOutcome`, `OVERTIME_CANCEL_WARNING`), booking writes (`overtimeBookingWriteFields`), who changes what (`canEditOwnBookingOvertime`), operative requests and their approval in one transaction (`overtimeRequestLineFields`, `overtimeRequestWriteFields`, `overtimeRequestsToReplace`, `overtimeRequestWithdrawWriteFields`, `overtimeRequestFullyDecided`, `overtimeApprovalWrites`, `canDecideOvertimeRequest`), direct changes (`overtimeDirectWrites`), reviews and reports (`overtimeReviewDocId`, `overtimeReportSnapshot`, `overtimeReportRows`, readers `parseOvertimeRequestDocument` / `parseOvertimeReviewDocument` / `parseOvertimeReportDocument`), the hub (`overtimeHubAccess`, `overtimeUserSubjects`).
- **The booking's overtime rate** is the existing `otMultiplierOverride` (1–3 in 0.25 steps; missing = the organisation's rate, so nothing is re-priced), now also read on manager site bookings (`parseManagerSiteBookingDocument`), with Edit Booking's control `overtimeRateControl` / `overtimeMultiplierWriteFields` (§8, §25). The spec named the field `overtimeMultiplier`; the stored field the apps already wrote and priced is kept so there is one rate per booking and older builds price it the same.
- **Weekly report** (§7): PAYE days leave the normal hours and pay rows; a live PAYE overtime section per person per job (`weeklyReportPayeOvertime`, `weeklyReportPayeDay`).
- **Notifications** (§13): `overtime_request_submitted` and `overtime_request_reviewed` (push), `booking_hours_changed_by_owner` (inbox only); recipients `overtimeRequestRecipients`, `overtimeReviewedRecipients`, `bookingHoursChangedRecipients`; a new **Overtime** toggle (`overtime`, on by default); destinations `overtimeUser` / `overtimeMine`; `relatedId` kinds `overtimeRequest` and `booking`.
- **Security rules** (§16): a person's line manager may change only the overtime fields of their bookings (and cancel them); `overtimeRequests`, `overtimeReviews`, `overtimeReports` rules; the catch-all read never re-opens them. `LIVE_COLLECTIONS` and `OPERATIONAL_COLLECTION_PATHS` list the three collections.

## New rulebook sections

- 25. PAYE overtime (1.29.0)
- 1.29.0 — 2026-11-04

## Workflow for the iOS agent

1. Run `scripts/sync-rulebook-from-web.sh` (or copy the files above), then run the iOS tests.
2. Produce a numbered Gap Report (Finding / Evidence / Rule / Severity / Solution / Action) for the changes above and **stop**.
3. Implement only what the user approves, in the iOS repo only.
4. Report any web-side gap back to the web agent instead of diverging on iOS.
