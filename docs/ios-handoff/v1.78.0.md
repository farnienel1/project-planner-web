# iOS follow-on — rulebook 1.78.0

Generated 2026-11-23 by `npm run rulebook:handoff` in project-planner-web. Paste this whole file into the iOS agent.
The web repo copy of `docs/RULEBOOK.md` is canonical. iOS mirrors it exactly; never edit the iOS mirror by hand.

```
╔══════════════════════════════════════════════════════════════════╗
║ FOLLOW-ON — paste into the iOS agent                             ║
╚══════════════════════════════════════════════════════════════════╝
Started on: web
Rulebook version: 1.76.0 → 1.78.0
Packed hash: 8ec667e0928ea3dec85c552a8a4ec5b6a0d0d3849f9cdf0bb40a82dbc0d298c2
Rulebook sha256: 281139f10b2d37e71f83227fc487db20a1d0542521723088ee35b950b4382cbe
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
Exports added: DEFAULT_LINE_MANAGER_REMINDER_DAYS, LINE_MANAGER_REMINDER_ADMIN_NOTE, LINE_MANAGER_REMINDER_DAYS_LABEL, LINE_MANAGER_REMINDER_DAYS_OPTIONS, LINE_MANAGER_REMINDER_HELP, LINE_MANAGER_REMINDER_HOUR, LINE_MANAGER_REMINDER_LABEL, LINE_MANAGER_REMINDER_MINUTE, TIMESHEET_SIGNOFF_ESCALATION_DAYS_BEFORE_PAYMENT, TIMESHEET_SIGNOFF_ESCALATION_NOTICE_TITLE, TIMESHEET_SIGNOFF_REMINDER_DAYS_BEFORE_PAYMENT, TIMESHEET_SIGNOFF_REMINDER_HOUR, TIMESHEET_SIGNOFF_REMINDER_MINUTE, TIMESHEET_SIGNOFF_REMINDER_NOTICE_TITLE, TIMESHEET_SIGNOFF_REMINDER_NOTICE_TYPE, lineManagerReminderDaysValidationError, lineManagerReminderSummary, lineManagerReminderWriteFields, parseLineManagerReminderDays, timesheetSignOffEscalationDue, timesheetSignOffEscalationNotice, timesheetSignOffEscalationNoticeId, timesheetSignOffEscalationRecipients, timesheetSignOffReminderDue, timesheetSignOffReminderNotice, timesheetSignOffReminderNoticeId, timesheetSignOffReminderRecipients, timesheetSignOffReminderRosterMember
Exports removed: none
Web files that changed the rules: docs/RULEBOOK.md, lib/canonical/bundleEntry.ts, lib/canonical/canonical.test.ts, lib/canonical/index.ts, lib/canonical/notificationPreferences.ts, lib/canonical/notificationRecipients.ts, lib/canonical/organizationSettings.ts, lib/canonical/recordsDocuments.ts, lib/canonical/timesheetSignOffReminder.test.ts, lib/canonical/timesheetSignOffReminder.ts
Done when:
- [ ] Packed hash in iOS equals 8ec667e0928ea3dec85c552a8a4ec5b6a0d0d3849f9cdf0bb40a82dbc0d298c2
- [ ] iOS docs/RULEBOOK.md is byte-identical (sha256 281139f10b2d37e71f83227fc487db20a1d0542521723088ee35b950b4382cbe)
- [ ] RulebookParityTests pass (CanonicalBusinessEngine.rulebookVersion() == 1.78.0)
- [ ] Every Swift caller of a changed rule calls CanonicalBusinessEngine
- [ ] Same Firebase fields read and written as web
- [ ] Any disagreement traced to its first divergence — no copied screen number
```

## What changed in 1.78.0

- **Sign-off reminder before payday** (§4.5, §8, §13, owner decision 23 Nov, point 4, before launch; refined the same day): an organisation setting, item 5 "Line manager sign-off reminder" on Settings → Payment runs and timesheets (note → 6, PAYE payday → 7) and in organisation setup — 1, 2 or 3 days before payday (default 2) at 08:00, `invoicing.lineManagerReminderDaysBeforePayday` (`parseLineManagerReminderDays`, `lineManagerReminderDaysValidationError`, `lineManagerReminderWriteFields`, `lineManagerReminderSummary`, `LINE_MANAGER_REMINDER_*`, `parseInvoicing` / `invoicingToFirestore` / `validateInvoicingSettings`). Admin escalation (owner decision 23 Nov, b): `timesheetSignOffEscalationDue` (08:00 the day before payday), `timesheetSignOffEscalationRecipients` (every active admin, every awaiting sheet), `timesheetSignOffEscalationNotice`, `timesheetSignOffEscalationNoticeId`, `TIMESHEET_SIGNOFF_ESCALATION_*`, the note `LINE_MANAGER_REMINDER_ADMIN_NOTE` under item 5; same notification type. New `timesheetSignOffReminderDue`, `timesheetSignOffReminderRecipients`, `timesheetSignOffReminderRosterMember`, `timesheetSignOffReminderNotice`, `timesheetSignOffReminderNoticeId`, `TIMESHEET_SIGNOFF_REMINDER_*` (`lib/canonical/timesheetSignOffReminder.ts`); new notification type `timesheet_signoff_reminder` (push, toggle `timesheetSignOff`, destination `timesheetTeamAwaiting` with the pay run's first day, `relatedId` the payday; in `KNOWN_NOTIFICATION_TYPES`, `DEVICE_PUSH_NOTIFICATION_TYPES`, `NOTIFICATION_CATALOG`, `NOTIFICATION_RELATED_ID`; not a scheduled type — written when due, so it pushes). Written by the new scheduled Cloud Function `timesheetSignOffReminders` (functions/timesheetSignOffReminder.js). Judgement calls: due until payday; admins are reminded only for people with no active line manager; names in the inbox-only detail.

## New rulebook sections

- 1.78.0 — 2026-11-23

## Workflow for the iOS agent

1. Run `scripts/sync-rulebook-from-web.sh` (or copy the files above), then run the iOS tests.
2. Produce a numbered Gap Report (Finding / Evidence / Rule / Severity / Solution / Action) for the changes above and **stop**.
3. Implement only what the user approves, in the iOS repo only.
4. Report any web-side gap back to the web agent instead of diverging on iOS.
