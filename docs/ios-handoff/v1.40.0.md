# iOS follow-on — rulebook 1.40.0

Generated 2026-11-11 by `npm run rulebook:handoff` in project-planner-web. Paste this whole file into the iOS agent.
The web repo copy of `docs/RULEBOOK.md` is canonical. iOS mirrors it exactly; never edit the iOS mirror by hand.

```
╔══════════════════════════════════════════════════════════════════╗
║ FOLLOW-ON — paste into the iOS agent                             ║
╚══════════════════════════════════════════════════════════════════╝
Started on: web
Rulebook version: 1.37.0 → 1.40.0
Packed hash: df63ddd76d294eedae3a3cff20c763724da2004b86b8dc19ea364139d9b80a0d
Rulebook sha256: 8b9fd5c90bec6af28520c54d088b90f1718eb2858ed0f1a4fbbffb43e38810ac
Copy (do not edit by hand) — run scripts/sync-rulebook-from-web.sh in the iOS repo, which copies:
  web lib/canonical/dist/canonical-business.js      → iOS Project Planner/Canonical/canonical-business.js
  web lib/canonical/dist/canonical-business.sha256  → iOS Project Planner/Canonical/canonical-business.js.sha256
  web lib/canonical/dist/canonical-manifest.json    → iOS Project Planner/Canonical/canonical-manifest.json
  web docs/RULEBOOK.md                              → iOS docs/RULEBOOK.md
  web lib/canonical/parity-fixture.json             → iOS ProjectPlannerTests/CanonicalParityFixture.json
  web lib/canonical/cross-platform-contract.json    → iOS ProjectPlannerTests/CrossPlatformContract.json
Contract sha256: 9a5099b35cf530bb8aba407fe55c220b2e927c807f006510e617d9e4251b7fcb
Call: CanonicalBusinessEngine — no second calculator in Swift.
Exports added: ANNUAL_LEAVE_ADJUSTED_NOTICE_TYPE, ANNUAL_LEAVE_ADJUSTMENTS_COLLECTION, ANNUAL_LEAVE_ADJUSTMENT_DAYS_MESSAGE, ANNUAL_LEAVE_ADJUSTMENT_MAX_DAYS, ANNUAL_LEAVE_ADJUSTMENT_NOTE, ANNUAL_LEAVE_ADJUSTMENT_NOT_ALLOWED_MESSAGE, ANNUAL_LEAVE_ADJUSTMENT_REASON_MAX, ANNUAL_LEAVE_ADJUSTMENT_REASON_MESSAGE, ANNUAL_LEAVE_ADJUSTMENT_REASON_TOO_LONG_MESSAGE, ANNUAL_LEAVE_TEAM_EMPTY_ADMIN, ANNUAL_LEAVE_TEAM_EMPTY_MANAGER, annualLeaveAdjustedNoticeText, annualLeaveAdjustedRecipients, annualLeaveAdjustmentCreateFields, annualLeaveAdjustmentDaysForYear, annualLeaveAdjustmentLabel, annualLeaveAdjustmentValidationError, annualLeaveAdjustmentsForPerson, annualLeaveTeamEmptyMessage, annualLeaveTeamPeople, annualLeaveTeamPersonIsCurrent, annualLeaveTeamTabVisible, balanceHasAllowance, canAdjustAnnualLeave, canViewAnnualLeaveAdjustments, leaveAllowanceForWindow, parseAnnualLeaveAdjustmentDocument
Exports removed: none
Web files that changed the rules: docs/RULEBOOK.md, firestore.rules, lib/canonical/annualLeave140.test.ts, lib/canonical/annualLeaveAdjustments.ts, lib/canonical/annualLeaveBalance.ts, lib/canonical/annualLeaveTeam.ts, lib/canonical/bundleEntry.ts, lib/canonical/canonical.test.ts, lib/canonical/cross-platform-contract.json, lib/canonical/crossPlatformContract.samples.ts, lib/canonical/crossPlatformContract.ts, lib/canonical/index.ts, lib/canonical/liveSources.ts, lib/canonical/myProfileSummary.test.ts, lib/canonical/myProfileSummary.ts, lib/canonical/notificationPreferences.ts, lib/canonical/notificationRecipients.ts, lib/canonical/organizationSettings.ts, lib/canonical/recordsDocuments.ts
Done when:
- [ ] Packed hash in iOS equals df63ddd76d294eedae3a3cff20c763724da2004b86b8dc19ea364139d9b80a0d
- [ ] iOS docs/RULEBOOK.md is byte-identical (sha256 8b9fd5c90bec6af28520c54d088b90f1718eb2858ed0f1a4fbbffb43e38810ac)
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
- **Security rules** (§16): `annualLeaveAdjustments` create-only rules and read scope, catch-all exclusion; `holidayBookings` line manager via an operatives row, and a line manager never moves leave to another person. Leave reads are not narrowed (follow-up; see §16). Static compile cost 236,705 → 240,265.

## New rulebook sections

- 1.40.0 — 2026-11-11

## Workflow for the iOS agent

1. Run `scripts/sync-rulebook-from-web.sh` (or copy the files above), then run the iOS tests.
2. Produce a numbered Gap Report (Finding / Evidence / Rule / Severity / Solution / Action) for the changes above and **stop**.
3. Implement only what the user approves, in the iOS repo only.
4. Report any web-side gap back to the web agent instead of diverging on iOS.
