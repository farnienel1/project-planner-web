# iOS follow-on — rulebook 1.61.0

Generated 2026-11-17 by `npm run rulebook:handoff` in project-planner-web. Paste this whole file into the iOS agent.
The web repo copy of `docs/RULEBOOK.md` is canonical. iOS mirrors it exactly; never edit the iOS mirror by hand.

```
╔══════════════════════════════════════════════════════════════════╗
║ FOLLOW-ON — paste into the iOS agent                             ║
╚══════════════════════════════════════════════════════════════════╝
Started on: web
Rulebook version: 1.61.0 → 1.61.0
Packed hash: 86b904b96b272ee8c30bf4aad148dcca627f14a35403eb8e7a58660170e03dad
Rulebook sha256: 11b938defe2b41c0973c813070e7bc9579b55e6a61791bfbfa8a49fd99242723
Copy (do not edit by hand) — run scripts/sync-rulebook-from-web.sh in the iOS repo, which copies:
  web lib/canonical/dist/canonical-business.js      → iOS Project Planner/Canonical/canonical-business.js
  web lib/canonical/dist/canonical-business.sha256  → iOS Project Planner/Canonical/canonical-business.js.sha256
  web lib/canonical/dist/canonical-manifest.json    → iOS Project Planner/Canonical/canonical-manifest.json
  web docs/RULEBOOK.md                              → iOS docs/RULEBOOK.md
  web lib/canonical/parity-fixture.json             → iOS ProjectPlannerTests/CanonicalParityFixture.json
  web lib/canonical/cross-platform-contract.json    → iOS ProjectPlannerTests/CrossPlatformContract.json
  web lib/canonical/data-parity-fixture.json        → iOS ProjectPlannerTests/DataParityFixture.json
Contract sha256: 5b2615b5540b55f716d40617dd791dbcda6290348ef18951186f47e2e5b7cd20
Data-parity fixture sha256: c2db4a64c22f36ddda48453c0d26da28fc802df9c8c93c0d876e8097a9eb176f
Call: CanonicalBusinessEngine — no second calculator in Swift.
Exports added: DELETED_PEOPLE_COLLECTION, FORMER_PERSON_ANONYMOUS_NAME, FORMER_PERSON_CHIP, FORMER_PERSON_EMAIL_MAX, FORMER_PERSON_FIELDS, FORMER_PERSON_IDS_MAX, FORMER_PERSON_LINK_ACTION, FORMER_PERSON_LINK_ADMIN_ONLY_NOTE, FORMER_PERSON_LINK_SKIP, FORMER_PERSON_LINK_TITLE, FORMER_PERSON_NAME_MAX, FORMER_PERSON_RECORD_SKIPPED_MESSAGE, MANAGER_ROW_NOT_LINKED_LABEL, MATERIAL_CONTACTS_COLLECTION, MATERIAL_REQUEST_SAFE_SENDER_NOTICE, MULTI_PERSON_ALREADY_BOOKED_MESSAGE, MULTI_PERSON_ALREADY_BOOKED_REMOVE_LABEL, formerPeopleForEmail, formerPersonDataHealthLabel, formerPersonForId, formerPersonLabel, formerPersonLinkOfferMessage, formerPersonLinkWriteFields, formerPersonPath, formerPersonRecordFields, formerPersonRecordNeeded, isTaskPersonSelected, leaveCoverBookingWindow, lineManagerPeerNoticeKey, materialContactCreateFields, materialContactKey, materialContactPath, materialRequestIsFirstContact, materialRequestSafeSenderNotice, materialSendRecordRecipientEmails, multiPersonBookingBlocks, parseFormerPersonDocument, signedDayRateOvertimeText, taskCompletionFields, taskPersonIndex, taskPersonKeys, toggleTaskPerson
Exports removed: none
Web files that changed the rules: docs/RULEBOOK.md, firestore.rules, lib/canonical/bookingPerson.ts, lib/canonical/bundleEntry.ts, lib/canonical/canonical.test.ts, lib/canonical/crossPlatformContract.samples.ts, lib/canonical/dayRateOvertimeText.test.ts, lib/canonical/dayRateOvertimeText.ts, lib/canonical/formerPeople.ts, lib/canonical/index.ts, lib/canonical/inviteAccept.ts, lib/canonical/leaveCoverage.ts, lib/canonical/liveSources.ts, lib/canonical/materialSafeSender.ts, lib/canonical/multiPersonBooking.ts, lib/canonical/notificationRecipients.ts, lib/canonical/operationsDocuments.ts, lib/canonical/organizationSettings.ts, lib/canonical/taskPeople.ts, lib/canonical/unresolvedBookingPeople.ts, lib/canonical/userDelete.ts
Done when:
- [ ] Packed hash in iOS equals 86b904b96b272ee8c30bf4aad148dcca627f14a35403eb8e7a58660170e03dad
- [ ] iOS docs/RULEBOOK.md is byte-identical (sha256 11b938defe2b41c0973c813070e7bc9579b55e6a61791bfbfa8a49fd99242723)
- [ ] RulebookParityTests pass (CanonicalBusinessEngine.rulebookVersion() == 1.61.0)
- [ ] Every Swift caller of a changed rule calls CanonicalBusinessEngine
- [ ] Same Firebase fields read and written as web
- [ ] Any disagreement traced to its first divergence — no copied screen number
```

## What changed in 1.61.0

- **A day-rate overtime line reads in hours** (§8, owner decision 17 Nov; wording only). New `dayRateOvertimeCalcText` and `DAY_RATE_OVERTIME_ROUNDED_NOTE` (`lib/canonical/dayRateOvertimeText.ts`): "6h × 1.5 = 9h · 9h × £26.47/h (rounded) = £238.24 (£225.00/day ÷ 8.5h)" instead of "0.71 days × £337.50/day = £238.24". The divisor is the part's day-rate divisor (`payrollDayRateHours`); the hours part is `multipliedHoursText`; the amount is the exact pay as priced and is never changed; the shown hourly rate is rounded to pennies and marked "(rounded)" when that changes it (owner confirmed 17 Nov). Standard lines, hourly-rate people and PAYE days are unchanged; a signed snapshot line uses it from its stored values when its multiplier is known. Web: `payLineDisplay` (the timesheet period and review page, the invoice HTML and PDF, the export email) calls it. `plainHoursText` is now exported from `payrollHours.ts` (module only). New `multipliedHoursParts` (`payrollMultipliedHours` uses it, same figures) and `dayRateHourlyEquivalent`; the text function now does no arithmetic of its own (a syntax-tree test) and carries `paidHours`, `pay`, `payShown`; callers fall back to the older wording when it would not show the line's own figures (owner 17 Nov: the calculation must never fail; property tests over generated bookings). Review of #378: signed lines read in hours only from the day rate and divisor stored at signing (new snapshot fields `otBaseDayRate`, `otDayRateHours`; `signedDayRateOvertimeText`) when the stored amount is exactly what they pay — never a rate worked out from the signed amount; live lines only with the person's own rate (no `rate ÷ multiplier`); iOS invoice and export rows carry the live line's multiplier, rate and divisor. Merged after 1.59.0 (#370), 1.60.0 (#373) and 1.60.1 (#375).

## iOS work for 1.61.0

Wording only — no figure, total, write or permission changes.

1. Sync the rulebook from this web branch with `scripts/sync-rulebook-from-web.sh` (never hand-edit the canonical files).
2. Wherever iOS builds a day-rate timesheet or invoice **overtime** line's text ("0.71 days × £337.50/day = £238.24"), call `dayRateOvertimeCalcText` through `CanonicalBusinessEngine` with: `clockHours` (the line's clock hours at the multiplier, or its paid hours when there is no break), `multiplier`, `breakHours` (only when a break is taken off the multiplied hours), `dayRate` (the person's day rate — the line's multiplied rate ÷ the multiplier), `dayRateHours` (the line's own divisor, `standardDayHours`), `pay` (the line's amount, shown as given), `currency`. Show `text` (or `lines` on two rows). When it returns null, keep the current text.
3. Standard lines, hourly-rate people and PAYE days keep their current text. A signed snapshot line uses it only when its multiplier is known (stored `otMultiplier`, or `parseMultipliedHoursText` of its stored details); compute the day rate from the stored amount ÷ stored days ÷ the multiplier (unrounded), never re-price.
4. Tests: the owner example (£225/day, 8.5h, 6h × 1.5 → "6h × 1.5 = 9h · 9h × £26.47/h (rounded) = £238.24 (£225.00/day ÷ 8.5h)") and a line with an unpaid break.

## Review of #378 (also in this release)

- **Signed lines (S1):** never work a rate out from the signed amount. Store `otBaseDayRate` (the person's own day rate) and `otDayRateHours` (the line's divisor, `standardDayHours`) on each day-rate overtime snapshot line when signing (`TimesheetWeeklyReportLabourLine`), keep them on every re-save, and show a signed line with `CanonicalBusinessEngine` `signedDayRateOvertimeText` (it returns null — the older wording — for a line signed before 1.61.0, an edited or declined line, or one whose stored amount is not exactly what the stored rate pays). Remove `item.baseDayRate = amount / line.days / multiplier`.
- **Live invoice and export rows (S2):** `TimesheetInvoiceRows.rows` carries the live line's `otMultiplier`, `otBaseDayRate` and `standardDayHours`, so Generate invoice and Export read in hours like web.
- **Live lines:** read in hours only with the collector's `otBaseDayRate`; never the multiplied rate ÷ the multiplier.

## New rulebook sections

- 1.60.1 — 2026-11-17
- 1.60.0 — 2026-11-17
- 1.59.0 — 2026-11-17

## Workflow for the iOS agent

1. Run `scripts/sync-rulebook-from-web.sh` (or copy the files above), then run the iOS tests.
2. Produce a numbered Gap Report (Finding / Evidence / Rule / Severity / Solution / Action) for the changes above and **stop**.
3. Implement only what the user approves, in the iOS repo only.
4. Report any web-side gap back to the web agent instead of diverging on iOS.
