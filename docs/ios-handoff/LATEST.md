# iOS follow-on — rulebook 1.40.0

Generated 2026-11-12 by `npm run rulebook:handoff` in project-planner-web. Paste this whole file into the iOS agent.
The web repo copy of `docs/RULEBOOK.md` is canonical. iOS mirrors it exactly; never edit the iOS mirror by hand.

```
╔══════════════════════════════════════════════════════════════════╗
║ FOLLOW-ON — paste into the iOS agent                             ║
╚══════════════════════════════════════════════════════════════════╝
Started on: web
Rulebook version: 1.40.0 → 1.40.0
Packed hash: 62df4b35cbca85be33dbdd7162fe0420353fcfca9842459ff93ae2080ae3d4a4
Rulebook sha256: d1cb6230b645a2d17a4d8a138b9cdd4c7e0b96cb82134ad012c1fac14c680208
Copy (do not edit by hand) — run scripts/sync-rulebook-from-web.sh in the iOS repo, which copies:
  web lib/canonical/dist/canonical-business.js      → iOS Project Planner/Canonical/canonical-business.js
  web lib/canonical/dist/canonical-business.sha256  → iOS Project Planner/Canonical/canonical-business.js.sha256
  web lib/canonical/dist/canonical-manifest.json    → iOS Project Planner/Canonical/canonical-manifest.json
  web docs/RULEBOOK.md                              → iOS docs/RULEBOOK.md
  web lib/canonical/parity-fixture.json             → iOS ProjectPlannerTests/CanonicalParityFixture.json
  web lib/canonical/cross-platform-contract.json    → iOS ProjectPlannerTests/CrossPlatformContract.json
  web lib/canonical/data-parity-fixture.json        → iOS ProjectPlannerTests/DataParityFixture.json
Contract sha256: 1e4c0f21055264d532ebc2040e480aaf3e2f594fa9c9f7e2dc809bf0255930ae
Data-parity fixture sha256: c2db4a64c22f36ddda48453c0d26da28fc802df9c8c93c0d876e8097a9eb176f
Call: CanonicalBusinessEngine — no second calculator in Swift.
Exports added: DATA_CHECK_PANEL_ORGANIZATION_IDS_FIELD, DATA_CHECK_PANEL_SWITCH_FIELD, DATA_PARITY_CHECKS, DATA_PARITY_CONFIRM_DELAY_MS, DATA_PARITY_LOG_LIMIT, DATA_PARITY_MIN_INTERVAL_MS, DATA_PARITY_SKIP_REASONS, DATA_PARITY_TRIGGERS, MY_SCHEDULE_CLASH_APPROVED_MESSAGE, MY_SCHEDULE_CLASH_APPROVED_TITLE, MY_SCHEDULE_CLASH_ASK_MANAGER, MY_SCHEDULE_CLASH_DISMISSED, MY_SCHEDULE_CLASH_NOT_IN_PERIOD, MY_SCHEDULE_CLASH_OPEN_WARNINGS, MY_SCHEDULE_CLASH_TITLE, bookedWithOvertimeText, bookingBreakDeductionText, bookingBreakText, bookingHoursCountText, bookingHoursExplanation, bookingHoursTiles, bookingShortfall, dataCheckPanelEnabled, dataCheckPanelVisible, dataParityCheck, dataParityCheckDefinition, dataParityCheckDue, dataParityConfirm, dataParityLogAppend, dataParityLogEntry, dataParitySumCounts, dataParitySummary, myScheduleClashMarkers, onSiteHoursText, overtimeIncludedText, overtimeTotalText, saveHoursLabel
Exports removed: none
Web files that changed the rules: docs/RULEBOOK.md, lib/canonical/bookingHoursExplanation.test.ts, lib/canonical/bookingHoursExplanation.ts, lib/canonical/bookingHoursText.test.ts, lib/canonical/bookingHoursText.ts, lib/canonical/bookingSlots.ts, lib/canonical/bundleEntry.ts, lib/canonical/canonical.test.ts, lib/canonical/data-parity-fixture.json, lib/canonical/dataParity.test.ts, lib/canonical/dataParity.ts, lib/canonical/index.ts, lib/canonical/myScheduleClash.ts, lib/canonical/parity-fixture.json, lib/canonical/platformConfig.ts
Done when:
- [ ] Packed hash in iOS equals 62df4b35cbca85be33dbdd7162fe0420353fcfca9842459ff93ae2080ae3d4a4
- [ ] iOS docs/RULEBOOK.md is byte-identical (sha256 d1cb6230b645a2d17a4d8a138b9cdd4c7e0b96cb82134ad012c1fac14c680208)
- [ ] RulebookParityTests pass (CanonicalBusinessEngine.rulebookVersion() == 1.40.0)
- [ ] Every Swift caller of a changed rule calls CanonicalBusinessEngine
- [ ] Same Firebase fields read and written as web
- [ ] Any disagreement traced to its first divergence — no copied screen number
```

## What changed in 1.40.0

- **Annual leave → Team** (§9, owner decisions 11 Nov F18–F23; new `annualLeaveTeam.ts`): `annualLeaveTeamPeople`, `annualLeaveTeamTabVisible`, `annualLeaveTeamPersonIsCurrent`, `annualLeaveTeamEmptyMessage` — admins every current person (self-bookers included, never themselves), anyone else the people they line-manage; never deleted, inactive or pending people; the tab for admins and anyone with a report, whatever the Operatives toggle. Both apps drop their own list builders (web `canManagePersonAnnualLeave`, `canAccessOperativeAnnualLeaveDirectory` deleted). Web matches each person's leave under every id (`leaveRecordsForAccount`); the header year is the organisation's leave year.
- **Allowance by employment type** (§4.4, G25–G27): `annualLeaveBalance` takes `employment` — the allowance applies only on PAYE days (`balanceHasAllowance`, `leaveAllowanceForWindow`); new result fields `allowanceTaken`, `allowancePending`, `allowanceBeforeAdjustments`; no carry-over out of a self-employed year. `annualLeaveBankHolidayRange` and `myProfileSummary` take it too. Guardrail 3: self-employed people (ghosts included) and anyone with no stored `employmentType` see days taken instead of a remaining balance; no record changes.
- **Manual adjustments** (§4.4, H28–H35; new `annualLeaveAdjustments.ts`, collection `annualLeaveAdjustments`): `annualLeaveAdjustmentCreateFields`, `annualLeaveAdjustmentValidationError`, `parseAnnualLeaveAdjustmentDocument`, `annualLeaveAdjustmentsForPerson`, `annualLeaveAdjustmentLabel`, `canAdjustAnnualLeave`, `canViewAnnualLeaveAdjustments`, `annualLeaveAdjustedRecipients`, `annualLeaveAdjustedNoticeText`, `annualLeaveAdjustmentDaysForYear`; `annualLeaveBalance` `adjustments` → `adjustmentDays`. New notice type `annual_leave_adjusted` (push, company activity, destination `annualLeavePerson`). The "set remaining" override is no longer offered (still read until its year ends). `LIVE_COLLECTIONS`, `OPERATIONAL_COLLECTION_PATHS` and the cross-platform contract list the collection.
- **Fixes from the 11 Nov scan**: web writes `holiday_booked_for_you` / `holiday_cancelled_by_manager`; iOS checks `canDecideLeave` before booking leave for someone; the line manager of leave filed under an `operatives` row decides it (rules); the 4 Nov "never delete leave" decision is marked done (iOS deletes are gone).
- **Security rules** (§16): `annualLeaveAdjustments` create-only rules and read scope, catch-all exclusion; `holidayBookings` line manager via an operatives row, and a line manager never moves leave to another person. Leave reads are not narrowed (follow-up; see §16).
- **Review r306 fixes** (same release): the allowance reads the employment type from the pay record (`annualLeaveEmploymentInput`; the pay profile while `privatePay` is on; unreadable → the whole year counts) and its notes name the type only for viewers who may see pay (`annualLeaveBalanceNotes`, `canViewPersonPay`); Data health lists people whose stored employment type is missing or not exactly `paye` / `self_employed` (`usersMissingEmploymentType`; `normalizeEmploymentType` is unchanged — treating "PAYE" in any case as PAYE is an owner question); the balance returns the shown sums (`shownTaken`, `shownPending`, `notCountedTaken`, `notCountedPending`); the PAYE window comes from the stored change (`employmentTypeTransition`), never a walk over every day; screens show no balance until the pay record and adjustments have loaded, and a refused adjustments read is an error; adjustments store no author name (`annualLeaveAdjustmentAuthorName` from the roster), are never for the writer and only for the current leave year (`allowedYearKeys`); the adjustment push carries no reason (inbox `detail`, new optional notification field). Rules: `createdAt` the request time, a year key in the calendar year before, of or after the request, a reason with a non-space character, no `createdByName`, an admin never adjusts their own operatives row, reads go through `overtimeViewer` (organisation access, billing and deletion first); the holiday update refuses a line manager's change of `userId` / `operativeId` with one `hasAny` and decides through `hbCanDecide`. Compile-cost cuts with no allow/deny change: single-use helpers inlined (`canViewRateRow`, `callerLineManagesUserOrRow`, `orgRootOperativesManagerRemovesMember`, `callerJobToggle`, the adjustment admin check), `hbLineManages` folded into `hbCanDecide`, `isPlatformOwner` one email expression, `lineManagerIdList` with lets, `writeMetadataKeysValid` reads written keys directly. Static compile cost 236,705 → **235,338** (below main).

## New rulebook sections

- 27. Data check (1.38.0)
- 1.39.0 — 2026-11-11
- 1.38.0 — 2026-11-11

## Workflow for the iOS agent

1. Run `scripts/sync-rulebook-from-web.sh` (or copy the files above), then run the iOS tests.
2. Produce a numbered Gap Report (Finding / Evidence / Rule / Severity / Solution / Action) for the changes above and **stop**.
3. Implement only what the user approves, in the iOS repo only.
4. Report any web-side gap back to the web agent instead of diverging on iOS.
