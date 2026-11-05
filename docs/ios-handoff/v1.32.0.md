# iOS follow-on — rulebook 1.32.0

Generated 2026-11-05 by `npm run rulebook:handoff` in project-planner-web. Paste this whole file into the iOS agent.
The web repo copy of `docs/RULEBOOK.md` is canonical. iOS mirrors it exactly; never edit the iOS mirror by hand.

```
╔══════════════════════════════════════════════════════════════════╗
║ FOLLOW-ON — paste into the iOS agent                             ║
╚══════════════════════════════════════════════════════════════════╝
Started on: web
Rulebook version: 1.32.0 → 1.32.0
Packed hash: 6187e2cebb9d17e993b37c2c3e1c6b7c69620cfdbe78b5448815c194e7a072e0
Rulebook sha256: c268969fe86e09fe4ff2cca81e43c0725855d3bbf59958f27db2ad04b5ce99f7
Copy (do not edit by hand) — run scripts/sync-rulebook-from-web.sh in the iOS repo, which copies:
  web lib/canonical/dist/canonical-business.js      → iOS Project Planner/Canonical/canonical-business.js
  web lib/canonical/dist/canonical-business.sha256  → iOS Project Planner/Canonical/canonical-business.js.sha256
  web lib/canonical/dist/canonical-manifest.json    → iOS Project Planner/Canonical/canonical-manifest.json
  web docs/RULEBOOK.md                              → iOS docs/RULEBOOK.md
  web lib/canonical/parity-fixture.json             → iOS ProjectPlannerTests/CanonicalParityFixture.json
  web lib/canonical/cross-platform-contract.json    → iOS ProjectPlannerTests/CrossPlatformContract.json
Contract sha256: 7f70ec28920ac6114068b4e44eaf893706d5b6af1b21d77b69f946074d74e126
Call: CanonicalBusinessEngine — no second calculator in Swift.
Exports added: overtimeMultiplierMoveFields
Exports removed: none
Web files that changed the rules: docs/RULEBOOK.md, lib/canonical/canonical.test.ts, lib/canonical/payeOvertime.ts
Done when:
- [ ] Packed hash in iOS equals 6187e2cebb9d17e993b37c2c3e1c6b7c69620cfdbe78b5448815c194e7a072e0
- [ ] iOS docs/RULEBOOK.md is byte-identical (sha256 c268969fe86e09fe4ff2cca81e43c0725855d3bbf59958f27db2ad04b5ce99f7)
- [ ] RulebookParityTests pass (CanonicalBusinessEngine.rulebookVersion() == 1.32.0)
- [ ] Every Swift caller of a changed rule calls CanonicalBusinessEngine
- [ ] Same Firebase fields read and written as web
- [ ] Any disagreement traced to its first divergence — no copied screen number
```

## What changed in 1.32.0

- **Overtime multiplier at create** (owner decisions 4 Nov, decision A; §25): every custom-hours create screen shows the rate pre-filled with the organisation's rate for the day (`overtimeRateCreateControl`); `otMultiplierOverride` is stored only when changed (`overtimeMultiplierCreateFields`), so a booking left at the organisation's rate follows later (and scheduled) rate changes.
- **Weekly report multipliers** (§7): PAYE overtime rows per person, job and multiplier, "2h at ×1.5 = 3h" (`overtimeMultiplierText`), rows changed from the organisation rate marked (`changedFromOrganization`, `OVERTIME_RATE_CHANGED_MARK`). Breaking for readers of `weeklyReportPayeOvertime(...).label` (now carries the multiplier).
- **PAYE payday required** (§4.5): saved by the main Save of Payment runs and timesheets, mandatory at organisation setup (`payePaydaySetupError`, `PAYE_PAYDAY_REQUIRED_MESSAGE`), a banner while missing (`payePaydayMissing`, `payePaydayBanner`, `PAYE_PAYDAY_MISSING_BANNER`).
- **Overtime review** (§25): one Approve button (`OVERTIME_APPROVE_LABEL`, `overtimeRequestAnyDecided`); partial approval — `overtimeApprovalWrites` applies what the decider may and returns `lineOutcomes`, `waitingBookingIds`, `appliedBookingIds`, `complete` and `message` (`reviewApprovalMessage`: "Approved 2 of 5…", "Nothing was approved…"); the request stays `pending` until complete; lines under an older operatives-row record show "Needs an admin" (decision A, `OVERTIME_NEEDS_ADMIN_LABEL`, `overtimeLineOutcomeLabel`). A changed booking no longer refuses the whole approval: that line stays waiting. Breaking: the result shape and the `stale` / `needsAdmin` / `refused` / `undecided` refusals are replaced by `nothingApproved` and per-line outcomes.
- **All records for this person** (§25, §26, platform guardrail 1): `overtimePersonIds({ person, roster, operatives })` for overtime loading, sending and approving and for price work and expenses.
- **Future days within the current payrun** (owner option 2, §25): `overtimeEditableUntil` → `canEditOwnBookingOvertime({ editableUntilKey })`; later payruns stay locked.
- **Own overtime edits are requests with a line manager** (§25): `canEditOwnBookingOvertime({ person, roster })` — the Super Admin directly; anyone with an active line manager as a request; anyone without one directly where the rules allow the write.
- **Price work and expenses review** (§26, `payeClaimReviews.ts`): ✓ ✕ per item, one Approve, `canReviewPayeClaims`, `payeClaimReviewWrites`, `payeClaimReviewState`, `payeClaimFingerprint`, `parsePayeClaimReviewDocument`; new collection `payeClaimReviews` (rules §16).
- **Export notice** (§8): `timesheetExportOwnSheetNotice`, `TIMESHEET_EXPORT_OWN_SHEET_NOTICE`.
- **Rules version in Settings** for everyone (§15): `rulebookVersionLabel`.
- **Booking screens follow `canWriteBooking`** (§2, owner decision 4 Nov): `canBookOtherLocationsFor(viewer, personUserIds)` — Office / WFH / Site survey / custom items only for oneself unless admin.
- **Pay visibility narrowed** (§8, owner decisions 5 Nov): `canViewPersonPay(viewer, subject, roster, { context })` — a line manager who is not an admin or an operatives manager sees a report's pay only with `context: 'timesheetReview'`. Read plans keep loading it for the review; firestore.rules pay reads unchanged (needed by the review).
- **Small shared helpers:** `legalPackAcceptanceWriteFields` (with write metadata), `invitationListConstraints`, `invitationReadErrorIsSkippable` (a clean-up skips only permission-denied invitation reads).


## Workflow for the iOS agent

1. Run `scripts/sync-rulebook-from-web.sh` (or copy the files above), then run the iOS tests.
2. Produce a numbered Gap Report (Finding / Evidence / Rule / Severity / Solution / Action) for the changes above and **stop**.
3. Implement only what the user approves, in the iOS repo only.
4. Report any web-side gap back to the web agent instead of diverging on iOS.
