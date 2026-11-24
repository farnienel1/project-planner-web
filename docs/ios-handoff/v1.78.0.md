# iOS follow-on — rulebook 1.78.0

Generated 2026-11-24 by `npm run rulebook:handoff` in project-planner-web. Paste this whole file into the iOS agent.
The web repo copy of `docs/RULEBOOK.md` is canonical. iOS mirrors it exactly; never edit the iOS mirror by hand.

```
╔══════════════════════════════════════════════════════════════════╗
║ FOLLOW-ON — paste into the iOS agent                             ║
╚══════════════════════════════════════════════════════════════════╝
Started on: web
Rulebook version: 1.78.0 → 1.78.0
Packed hash: c75fdba2eeb4f170d099c14a84bad67ddcf721d6fb922212dd3922c7e9fa9a44
Rulebook sha256: fe36f5ad4d10bd10d2a87eedc9067fc870ed4d2b7588fb14f4548b337b0558e9
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
Exports added: TIMESHEET_CHANGE_DETAILS_COLLAPSED_ROWS, TIMESHEET_CHANGE_DETAILS_HEADING, TIMESHEET_CHANGE_DETAILS_REVIEWER_HEADING, TIMESHEET_CHANGE_NOT_IN_SIGNED_COPY_LABEL, TIMESHEET_CORRECTION_LABEL, TIMESHEET_CORRECTION_REVISION_BOOKINGS_HELP, TIMESHEET_GENERATE_INVOICE_PROMPT, TIMESHEET_NEXT_STEP_ADMIN_SIGNER, TIMESHEET_NEXT_STEP_EXPORTED_TEXT, TIMESHEET_NEXT_STEP_INVOICE_TEXT, TIMESHEET_REPORT_AWAITING_APPROVAL_LABEL, TIMESHEET_REPORT_AWAITING_RESIGN_LABEL, TIMESHEET_SIGNED_NOTICE_INVOICE_NEXT, TIMESHEET_SNAPSHOT_AWAITING_APPROVAL_LABEL, parseTimesheetBookingFingerprint, qualificationsMissingOwnExpiry, signedTimesheetChangeDetails, timesheetChangeDayLabel, timesheetCorrectionOption, timesheetNextStep, timesheetReportKeepsSignedFigures, timesheetReportWaiting, timesheetSignedEntryChanges
Exports removed: none
Web files that changed the rules: docs/RULEBOOK.md, firestore.rules, lib/canonical/bundleEntry.ts, lib/canonical/canonical.test.ts, lib/canonical/index.ts, lib/canonical/operativeQualifications.ts, lib/canonical/payrunSnapshot.ts, lib/canonical/staffAccess.ts, lib/canonical/timesheetBookingChanges.ts, lib/canonical/timesheetClarity.ts, lib/canonical/timesheetLateExtras.ts, lib/canonical/weeklyReportPay.ts
Done when:
- [ ] Packed hash in iOS equals c75fdba2eeb4f170d099c14a84bad67ddcf721d6fb922212dd3922c7e9fa9a44
- [ ] iOS docs/RULEBOOK.md is byte-identical (sha256 fe36f5ad4d10bd10d2a87eedc9067fc870ed4d2b7588fb14f4548b337b0558e9)
- [ ] RulebookParityTests pass (CanonicalBusinessEngine.rulebookVersion() == 1.78.0)
- [ ] Every Swift caller of a changed rule calls CanonicalBusinessEngine
- [ ] Same Firebase fields read and written as web
- [ ] Any disagreement traced to its first divergence — no copied screen number
```

## What changed in 1.78.0

- **Sign-off reminder before payday** (§4.5, §8, §13, owner decision 23 Nov, point 4, before launch; refined the same day): an organisation setting, item 5 "Line manager sign-off reminder" on Settings → Payment runs and timesheets (note → 6, PAYE payday → 7) and in organisation setup — 1, 2 or 3 days before payday (default 2) at 08:00, `invoicing.lineManagerReminderDaysBeforePayday` (`parseLineManagerReminderDays`, `lineManagerReminderDaysValidationError`, `lineManagerReminderWriteFields`, `lineManagerReminderSummary`, `LINE_MANAGER_REMINDER_*`, `parseInvoicing` / `invoicingToFirestore` / `validateInvoicingSettings`). Admin escalation (owner decision 23 Nov, b): `timesheetSignOffEscalationDue` (08:00 the day before payday), `timesheetSignOffEscalationRecipients` (every active admin, every awaiting sheet), `timesheetSignOffEscalationNotice`, `timesheetSignOffEscalationNoticeId`, `TIMESHEET_SIGNOFF_ESCALATION_*`, the note `LINE_MANAGER_REMINDER_ADMIN_NOTE` under item 5; same notification type. New `timesheetSignOffReminderDue`, `timesheetSignOffReminderRecipients`, `timesheetSignOffReminderRosterMember`, `timesheetSignOffReminderNotice`, `timesheetSignOffReminderNoticeId`, `TIMESHEET_SIGNOFF_REMINDER_*` (`lib/canonical/timesheetSignOffReminder.ts`); new notification type `timesheet_signoff_reminder` (push, toggle `timesheetSignOff`, destination `timesheetTeamAwaiting` with the pay run's first day, `relatedId` the payday; in `KNOWN_NOTIFICATION_TYPES`, `DEVICE_PUSH_NOTIFICATION_TYPES`, `NOTIFICATION_CATALOG`, `NOTIFICATION_RELATED_ID`; not a scheduled type — written when due, so it pushes). Written by the new scheduled Cloud Function `timesheetSignOffReminders` (functions/timesheetSignOffReminder.js). Judgement calls: due until payday; admins are reminded only for people with no active line manager; names in the inbox-only detail.
- **Review of #429 (same version; owner 23 Nov answered judgement calls 2 and 4 "fix"):** 08:00 is the wall-clock time on the day in the organisation zone (new `wallTimeInZone`), never midnight + 8 hours, which a clock change that night moved to 07:00 or 09:00 — the same fix in the timesheet submission reminder's notify time (`dueTimesheetSubmissionNotices`, 08:00 on clock-change days only). A sheet a booking change sent back to the person is not counted: the function reads the run's bookings and the rule judges each sheet with `signedTimesheetBookingChanges` over lines from the new `timesheetLiveLinesFromBookings` (the booking-on-the-sheet test `timesheetBookingSheetTest` is now shared with `timesheetBookingChangeNotice`, same behaviour); new `TimesheetSignOffReminderRecipientsInput` fields `bookings`, `bookingsLoaded`, `tombstonedBookingIds`, `operatives`, and `endExclusiveMs` on each run. Members through the `members` map (and the creator) are read by id and take their level and self-manage toggles here (`timesheetSignOffReminderRosterMember` takes `membersRole` / `membership`; `organizationLevelFor`, `organizationSelfManageFlags`; organisation read with `documentOrganizationId`). The notice ids drop the payday (moving the payday never re-sends). The function processes four organisations at a time, logs when a limit is reached, and also finds sheets whose `weekStart` is stored as text.

## New rulebook sections

- 1.77.0 — 2026-11-23
- 1.75.0 — 2026-11-23
- 1.73.2 — 2026-11-23

## Workflow for the iOS agent

1. Run `scripts/sync-rulebook-from-web.sh` (or copy the files above), then run the iOS tests.
2. Produce a numbered Gap Report (Finding / Evidence / Rule / Severity / Solution / Action) for the changes above and **stop**.
3. Implement only what the user approves, in the iOS repo only.
4. Report any web-side gap back to the web agent instead of diverging on iOS.
