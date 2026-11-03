# iOS follow-on — rulebook 1.13.1

Generated 2026-11-03 by `npm run rulebook:handoff` in project-planner-web. Paste this whole file into the iOS agent.
The web repo copy of `docs/RULEBOOK.md` is canonical. iOS mirrors it exactly; never edit the iOS mirror by hand.

```
╔══════════════════════════════════════════════════════════════════╗
║ FOLLOW-ON — paste into the iOS agent                             ║
╚══════════════════════════════════════════════════════════════════╝
Started on: web
Rulebook version: 1.12.1 → 1.13.1
Packed hash: 5c6ba566389557dcaef7548c2d00a4b407bdbde8a83502f34ae094b63636ef99
Rulebook sha256: 54cac357f0cd9416a20fcf0514cb1bd228f8c6d247c96369e5262100685315e1
Copy (do not edit by hand) — run scripts/sync-rulebook-from-web.sh in the iOS repo, which copies:
  web lib/canonical/dist/canonical-business.js      → iOS Project Planner/Canonical/canonical-business.js
  web lib/canonical/dist/canonical-business.sha256  → iOS Project Planner/Canonical/canonical-business.js.sha256
  web lib/canonical/dist/canonical-manifest.json    → iOS Project Planner/Canonical/canonical-manifest.json
  web docs/RULEBOOK.md                              → iOS docs/RULEBOOK.md
  web lib/canonical/parity-fixture.json             → iOS ProjectPlannerTests/CanonicalParityFixture.json
  web lib/canonical/cross-platform-contract.json    → iOS ProjectPlannerTests/CrossPlatformContract.json
Contract sha256: d655dd7d122e53a1167569216d43cba7598670671310ca84c59ea7e46373b7e6
Call: CanonicalBusinessEngine — no second calculator in Swift.
Exports added: CUSTOM_HOURS_BREAK_WARNING, LAUNCH_COUNTRY_CODES, PAY_PROFILES_COLLECTION, PAY_PROFILE_FIELDS, SELF_EMAIL_INVALID_MESSAGE, SUBSCRIPTION_LAPSED_ADMIN_NOTE, SUBSCRIPTION_LAPSED_ADMIN_WEB_NOTE, SUBSCRIPTION_LAPSED_MESSAGE, SUGGESTED_MAX_CARRY_OVER_DAYS, WEEKDAY_TIME_SLOTS, WEEKEND_TIME_SLOTS, WEEKEND_WEEKDAY_MIX_MESSAGE, allowedTimeSlotsOnDay, billingAccessFields, bookingDaysMixWeekdayAndWeekend, canViewPersonPay, customHoursBreakWarning, intervalCrossesMidnight, isWeekendDayKey, launchCountryOptions, leaveYearStartMonth, nextCalendarDayKey, overlayPayProfile, overnightCarryInterval, parseMaxCarryOverDays, parsePayProfileDocument, payProfileBackfillWrites, payProfilePath, payProfileWriteFieldsFromProfileWrite, proRataLeaveAllowance, selfEmailChangeAction, selfEmailChangeSentMessage, signInEmailSyncWrites, subscriptionAccess, timeSlotAllowedOnDay, weekendBookingNote, weekendCustomHoursDefault, weekendFullDayWindow, weekendRuleForIsoWeekday
Exports removed: none
Web files that changed the rules: docs/RULEBOOK.md, firestore.rules, lib/canonical/annualLeaveBalance.ts, lib/canonical/bankHolidayRegions.ts, lib/canonical/billingAccess.ts, lib/canonical/bookingSlots.ts, lib/canonical/bundleEntry.ts, lib/canonical/canonical.test.ts, lib/canonical/cross-platform-contract.json, lib/canonical/crossPlatformContract.samples.ts, lib/canonical/emailChange.ts, lib/canonical/engine.ts, lib/canonical/index.ts, lib/canonical/liveSources.ts, lib/canonical/organizationSettings.ts, lib/canonical/payProfile.ts, lib/canonical/payrollHours.ts, lib/canonical/peopleDocuments.ts, lib/canonical/scheduleSources.ts, lib/canonical/timesheetLines.ts, lib/canonical/userProfile.ts
Done when:
- [ ] Packed hash in iOS equals 5c6ba566389557dcaef7548c2d00a4b407bdbde8a83502f34ae094b63636ef99
- [ ] iOS docs/RULEBOOK.md is byte-identical (sha256 54cac357f0cd9416a20fcf0514cb1bd228f8c6d247c96369e5262100685315e1)
- [ ] RulebookParityTests pass (CanonicalBusinessEngine.rulebookVersion() == 1.13.1)
- [ ] Every Swift caller of a changed rule calls CanonicalBusinessEngine
- [ ] Same Firebase fields read and written as web
- [ ] Any disagreement traced to its first divergence — no copied screen number
```

## What changed in 1.13.1

- Owner decision revises Q2 before release (1.13.0 was never deployed; both ship in one merge). Weekends (Q2, §4.3, §5, §6, §8): Saturday and Sunday bookings are custom hours only on every platform (`allowedTimeSlotsOnDay`, `WEEKEND_TIME_SLOTS` = CUSTOM, `timeSlotAllowedOnDay`); the editor prefills a set-window day's window (`weekendCustomHoursDefault`); the note is `weekendBookingNote`; one request never mixes weekdays and weekend days (`bookingDaysMixWeekdayAndWeekend`, `WEEKEND_WEEKDAY_MIX_MESSAGE`, the iOS wording). Stored weekend FULL DAY / AM / PM rows are never rewritten; a stored set-window FULL DAY pays the window at its "counts as" hours (`weekendFullDayWindow`), an all-hours FULL DAY the pre-1.13.0 calculation. `weekendFullDayNote` is removed (replaced by `weekendBookingNote`); `WEEKEND_TIME_SLOTS` is CUSTOM only.

## New rulebook sections

- 19. Lapsed subscription (1.13.0)
- 1.13.1 — 2026-11-03
- 1.13.0 — 2026-11-03

## Workflow for the iOS agent

1. Run `scripts/sync-rulebook-from-web.sh` (or copy the files above), then run the iOS tests.
2. Produce a numbered Gap Report (Finding / Evidence / Rule / Severity / Solution / Action) for the changes above and **stop**.
3. Implement only what the user approves, in the iOS repo only.
4. Report any web-side gap back to the web agent instead of diverging on iOS.
