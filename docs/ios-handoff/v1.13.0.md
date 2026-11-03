# iOS follow-on — rulebook 1.13.0

Generated 2026-11-03 by `npm run rulebook:handoff` in project-planner-web. Paste this whole file into the iOS agent.
The web repo copy of `docs/RULEBOOK.md` is canonical. iOS mirrors it exactly; never edit the iOS mirror by hand.

```
╔══════════════════════════════════════════════════════════════════╗
║ FOLLOW-ON — paste into the iOS agent                             ║
╚══════════════════════════════════════════════════════════════════╝
Started on: web
Rulebook version: 1.12.1 → 1.13.0
Packed hash: 60bb35f86c738c776de2ddf139c90ae84aa30cd05ac4c3883b110442135a835e
Rulebook sha256: 530fd58f90f445773209736b8442fda0290fb80264c42f3b38b2bc762ca4e535
Copy (do not edit by hand) — run scripts/sync-rulebook-from-web.sh in the iOS repo, which copies:
  web lib/canonical/dist/canonical-business.js      → iOS Project Planner/Canonical/canonical-business.js
  web lib/canonical/dist/canonical-business.sha256  → iOS Project Planner/Canonical/canonical-business.js.sha256
  web lib/canonical/dist/canonical-manifest.json    → iOS Project Planner/Canonical/canonical-manifest.json
  web docs/RULEBOOK.md                              → iOS docs/RULEBOOK.md
  web lib/canonical/parity-fixture.json             → iOS ProjectPlannerTests/CanonicalParityFixture.json
  web lib/canonical/cross-platform-contract.json    → iOS ProjectPlannerTests/CrossPlatformContract.json
Contract sha256: d655dd7d122e53a1167569216d43cba7598670671310ca84c59ea7e46373b7e6
Call: CanonicalBusinessEngine — no second calculator in Swift.
Exports added: CUSTOM_HOURS_BREAK_WARNING, LAUNCH_COUNTRY_CODES, PAY_PROFILES_COLLECTION, PAY_PROFILE_FIELDS, SELF_EMAIL_INVALID_MESSAGE, SUBSCRIPTION_LAPSED_ADMIN_NOTE, SUBSCRIPTION_LAPSED_ADMIN_WEB_NOTE, SUBSCRIPTION_LAPSED_MESSAGE, SUGGESTED_MAX_CARRY_OVER_DAYS, WEEKDAY_TIME_SLOTS, WEEKEND_TIME_SLOTS, allowedTimeSlotsOnDay, billingAccessFields, canViewPersonPay, customHoursBreakWarning, intervalCrossesMidnight, isWeekendDayKey, launchCountryOptions, leaveYearStartMonth, nextCalendarDayKey, overlayPayProfile, overnightCarryInterval, parseMaxCarryOverDays, parsePayProfileDocument, payProfileBackfillWrites, payProfilePath, payProfileWriteFieldsFromProfileWrite, proRataLeaveAllowance, selfEmailChangeAction, selfEmailChangeSentMessage, signInEmailSyncWrites, subscriptionAccess, timeSlotAllowedOnDay, weekendFullDayNote, weekendFullDayWindow, weekendRuleForIsoWeekday
Exports removed: none
Web files that changed the rules: docs/RULEBOOK.md, firestore.rules, lib/canonical/annualLeaveBalance.ts, lib/canonical/bankHolidayRegions.ts, lib/canonical/billingAccess.ts, lib/canonical/bundleEntry.ts, lib/canonical/canonical.test.ts, lib/canonical/cross-platform-contract.json, lib/canonical/crossPlatformContract.samples.ts, lib/canonical/engine.ts, lib/canonical/index.ts, lib/canonical/liveSources.ts, lib/canonical/organizationSettings.ts, lib/canonical/payrollHours.ts, lib/canonical/peopleDocuments.ts, lib/canonical/scheduleSources.ts, lib/canonical/timesheetLines.ts, lib/canonical/userProfile.ts, lib/canonical/bookingSlots.ts, lib/canonical/emailChange.ts, lib/canonical/payProfile.ts
Done when:
- [ ] Packed hash in iOS equals 60bb35f86c738c776de2ddf139c90ae84aa30cd05ac4c3883b110442135a835e
- [ ] iOS docs/RULEBOOK.md is byte-identical (sha256 530fd58f90f445773209736b8442fda0290fb80264c42f3b38b2bc762ca4e535)
- [ ] RulebookParityTests pass (CanonicalBusinessEngine.rulebookVersion() == 1.13.0)
- [ ] Every Swift caller of a changed rule calls CanonicalBusinessEngine
- [ ] Same Firebase fields read and written as web
- [ ] Any disagreement traced to its first divergence — no copied screen number
```

## What changed in 1.13.0

- Owner decisions round 4. Pay visibility (Q1, §8, §16): `canViewPersonPay` — the person, their active line managers, admins and super admins, managers with the Operatives toggle for operatives. Pay moves to the private `organizations/{orgId}/payProfiles/{subjectId}` (`PAY_PROFILE_FIELDS`, `payProfilePath`, `parsePayProfileDocument`, `overlayPayProfile`, `payProfileWriteFieldsFromProfileWrite`, `payProfileBackfillWrites`, `scripts/backfill-pay-profiles.mjs`); rules `canViewPayOf`; behind `platformConfig/app.privatePay` (`privatePayOn`) rate history, `operativeProfiles` and timesheets are limited to pay viewers and no pay value goes back on `users` / `operatives` / `managers` (`payStaysPrivate`). The catch-all read no longer re-opens `payProfiles`, `operativeDayRateHistory`, `operativeProfiles` or `settings`.
- Weekends (Q2, §4.3): no AM / PM on Saturday or Sunday (`allowedTimeSlotsOnDay`, `timeSlotAllowedOnDay`); a weekend FULL DAY is that day's set window at its "counts as" hours (`weekendFullDayWindow`; it was the weekday standard day plus weekend overtime); the picker note is `weekendFullDayNote`. Existing weekend AM / PM keep their pay.
- Lapsed subscription (Q3, new §19, §16): both apps blocked with `SUBSCRIPTION_LAPSED_MESSAGE` (`subscriptionAccess`); admins reach billing only; nothing deleted; the webhook writes `billing.accessOpen` / `accessClosesAt` (`billingAccessFields`) and the rules close organisation data (`orgBillingOpen`).
- Carry-over (Q4, §4.4): pro rata in the year joined from `users/{uid}.employmentStartDate` (`proRataLeaveAllowance`; `annualLeaveBalance` `employmentStartDayKey`, `yearEntitlement`, `proRata`); optional cap `annualLeaveDefaults.maxCarryOverDays` (`parseMaxCarryOverDays`, null = no cap, suggested 5). `leaveYearStartMonth`.
- Overnight bookings (Q5, §5, §8): `slotInterval` runs past 24:00; clashes and timesheet overlaps carry an overnight booking into the next morning (`overnightCarryInterval`, `intervalCrossesMidnight`, `nextCalendarDayKey`); paid at the start day's rules (it was plain hours at 1×).
- Countries (Q6, §4.1): pickers offer `LAUNCH_COUNTRY_CODES` (GB, IE) via `launchCountryOptions`; a stored other country is kept and shown.
- Lunch warning (§8): `customHoursBreakWarning` / `CUSTOM_HOURS_BREAK_WARNING` confirm step before saving custom hours that cover the unpaid break with Unpaid break on. Pay unchanged.
- Self email change (§14, §16): `selfEmailChangeAction`, `selfEmailChangeSentMessage`, `signInEmailSyncWrites`; the rules let a person delete their own old email claim once their verified token email is another.

## New rulebook sections

- 19. Lapsed subscription (1.13.0)
- 1.13.0 — 2026-11-03

## Workflow for the iOS agent

1. Run `scripts/sync-rulebook-from-web.sh` (or copy the files above), then run the iOS tests.
2. Produce a numbered Gap Report (Finding / Evidence / Rule / Severity / Solution / Action) for the changes above and **stop**.
3. Implement only what the user approves, in the iOS repo only.
4. Report any web-side gap back to the web agent instead of diverging on iOS.
