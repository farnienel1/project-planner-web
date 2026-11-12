# iOS follow-on — rulebook 1.40.0

Generated 2026-11-12 by `npm run rulebook:handoff` in project-planner-web. Paste this whole file into the iOS agent.
The web repo copy of `docs/RULEBOOK.md` is canonical. iOS mirrors it exactly; never edit the iOS mirror by hand.

```
╔══════════════════════════════════════════════════════════════════╗
║ FOLLOW-ON — paste into the iOS agent                             ║
╚══════════════════════════════════════════════════════════════════╝
Started on: web
Rulebook version: 1.40.0 → 1.40.0
Packed hash: b4cd67b6388fc7c140f589997fd37efa8eafccbe9fb35d6e056065ddd9ef0b3e
Rulebook sha256: 11fa7bf379600e816c62d1cad58819e7201c29aeaeddc71ee0506b19ecb39d57
Copy (do not edit by hand) — run scripts/sync-rulebook-from-web.sh in the iOS repo, which copies:
  web lib/canonical/dist/canonical-business.js      → iOS Project Planner/Canonical/canonical-business.js
  web lib/canonical/dist/canonical-business.sha256  → iOS Project Planner/Canonical/canonical-business.js.sha256
  web lib/canonical/dist/canonical-manifest.json    → iOS Project Planner/Canonical/canonical-manifest.json
  web docs/RULEBOOK.md                              → iOS docs/RULEBOOK.md
  web lib/canonical/parity-fixture.json             → iOS ProjectPlannerTests/CanonicalParityFixture.json
  web lib/canonical/cross-platform-contract.json    → iOS ProjectPlannerTests/CrossPlatformContract.json
Contract sha256: 920a4a7cc0c1c4f5f95045a8713d7d52cff84f1d91be1559fe83f7a964f45045
Call: CanonicalBusinessEngine — no second calculator in Swift.
Exports added: USER_MISSING_EMPLOYMENT_TYPE_MESSAGE, annualLeaveAdjustmentAuthorName, annualLeaveBalanceNotes, annualLeaveEmploymentInput, employmentTypeTransition, usersMissingEmploymentType
Exports removed: none
Web files that changed the rules: docs/RULEBOOK.md, firestore.rules, lib/canonical/annualLeave140.test.ts, lib/canonical/annualLeaveAdjustments.ts, lib/canonical/annualLeaveBalance.ts, lib/canonical/bundleEntry.ts, lib/canonical/createDocuments.ts, lib/canonical/cross-platform-contract.json, lib/canonical/crossPlatformContract.samples.ts, lib/canonical/index.ts, lib/canonical/inviteAccept.ts, lib/canonical/myProfileSummary.ts, lib/canonical/payRate.ts, lib/canonical/recordsDocuments.ts, lib/canonical/userProfile.ts
Done when:
- [ ] Packed hash in iOS equals b4cd67b6388fc7c140f589997fd37efa8eafccbe9fb35d6e056065ddd9ef0b3e
- [ ] iOS docs/RULEBOOK.md is byte-identical (sha256 11fa7bf379600e816c62d1cad58819e7201c29aeaeddc71ee0506b19ecb39d57)
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
- **Review r306 fixes** (same release): the allowance reads the employment type from the pay record (`annualLeaveEmploymentInput`; the pay profile while `privatePay` is on; unreadable → the whole year counts) and its notes name the type only for viewers who may see pay (`annualLeaveBalanceNotes`, `canViewPersonPay`); `normalizeEmploymentType` reads without case or spaces ("PAYE" was self-employed there; `createDocuments` and `inviteAcceptWrites` use it too) and Data health lists people with none stored (`usersMissingEmploymentType`); the balance returns the shown sums (`shownTaken`, `shownPending`, `notCountedTaken`, `notCountedPending`); the PAYE window comes from the stored change (`employmentTypeTransition`), never a walk over every day; screens show no balance until the pay record and adjustments have loaded, and a refused adjustments read is an error; adjustments store no author name (`annualLeaveAdjustmentAuthorName` from the roster), are never for the writer and only for the current leave year (`allowedYearKeys`); the adjustment push carries no reason (inbox `detail`, new optional notification field). Rules: `createdAt` the request time, a year within a year of today, a reason with a non-space character, no `createdByName`, an admin never adjusts their own operatives row, a deactivated person reads none; the holiday update computes its diff's person keys once (`hbPersonSame`). Static compile cost 236,705 → 240,656 (240,265 before the review: the cuts — no `hasAll`, one year computation, the cheaper active check — paid for most of the new checks).


## Workflow for the iOS agent

1. Run `scripts/sync-rulebook-from-web.sh` (or copy the files above), then run the iOS tests.
2. Produce a numbered Gap Report (Finding / Evidence / Rule / Severity / Solution / Action) for the changes above and **stop**.
3. Implement only what the user approves, in the iOS repo only.
4. Report any web-side gap back to the web agent instead of diverging on iOS.
