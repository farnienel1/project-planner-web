# iOS follow-on — rulebook 1.36.0

Generated 2026-11-07 by `npm run rulebook:handoff` in project-planner-web. Paste this whole file into the iOS agent.
The web repo copy of `docs/RULEBOOK.md` is canonical. iOS mirrors it exactly; never edit the iOS mirror by hand.

```
╔══════════════════════════════════════════════════════════════════╗
║ FOLLOW-ON — paste into the iOS agent                             ║
╚══════════════════════════════════════════════════════════════════╝
Started on: web
Rulebook version: 1.35.0 → 1.36.0
Packed hash: 726eb1f86f9ddbdf7255f6663365b2a81598baa203037919604af1bad09364fd
Rulebook sha256: 78a4d274ede3d0eb803735fdb26e1f38fb5b0489e2e34dd158ee181204f0b307
Copy (do not edit by hand) — run scripts/sync-rulebook-from-web.sh in the iOS repo, which copies:
  web lib/canonical/dist/canonical-business.js      → iOS Project Planner/Canonical/canonical-business.js
  web lib/canonical/dist/canonical-business.sha256  → iOS Project Planner/Canonical/canonical-business.js.sha256
  web lib/canonical/dist/canonical-manifest.json    → iOS Project Planner/Canonical/canonical-manifest.json
  web docs/RULEBOOK.md                              → iOS docs/RULEBOOK.md
  web lib/canonical/parity-fixture.json             → iOS ProjectPlannerTests/CanonicalParityFixture.json
  web lib/canonical/cross-platform-contract.json    → iOS ProjectPlannerTests/CrossPlatformContract.json
Contract sha256: 59d6bc6123f250e1f57599240eb3190ab48f5cd2532f8281a99360d9e187d86b
Call: CanonicalBusinessEngine — no second calculator in Swift.
Exports added: none
Exports removed: none
Web files that changed the rules: docs/RULEBOOK.md, lib/canonical/ghostOperatives.test.ts, lib/canonical/ghostOperatives.ts, lib/canonical/managerCoverage.ts, lib/canonical/myProfileSummary.test.ts, lib/canonical/payrollHours.ts
Done when:
- [ ] Packed hash in iOS equals 726eb1f86f9ddbdf7255f6663365b2a81598baa203037919604af1bad09364fd
- [ ] iOS docs/RULEBOOK.md is byte-identical (sha256 78a4d274ede3d0eb803735fdb26e1f38fb5b0489e2e34dd158ee181204f0b307)
- [ ] RulebookParityTests pass (CanonicalBusinessEngine.rulebookVersion() == 1.36.0)
- [ ] Every Swift caller of a changed rule calls CanonicalBusinessEngine
- [ ] Same Firebase fields read and written as web
- [ ] Any disagreement traced to its first divergence — no copied screen number
```

## What changed in 1.36.0

- Fixes only (owner 7 Nov "do all"); nobody sees or is paid differently except where a figure was wrong (below).
- **Person ids (sweep FU-5, guardrail 1).** Web never picks one `operatives` row on the email to match a person's rate history or bookings: new web composer `personRateHistoryIds` (`personIdSet` + `bookingIdsForAccount`). Edit User's previous rates and its "history loaded and empty?" test (no duplicate seed row when the history sits under a former invite id or a second row), the timesheet invoice rate-change notes (former ids, every row on the email, without case; a person with no email no longer picks up every row with an empty email), and the weekly report and timesheet pay rate (`resolvePayrollRate` / `resolveForTimesheetDay` `operativeIds`: a history row filed only under a second `operatives` row of the person now counts) — the live-rate fallback row is unchanged. The schedule's "is this my own booking" (`shouldScopeScheduleToOperative`) is `bookingIdsForAccount` without case. Web's rate-history merge (`mergedDayRateEntries`) matches ids without case.
- **Organisation week (sweep FU-4, guardrail 2).** Web week grids, week navigation, the leave calendar, the materials and H&S weeks, calendar export and Schedule quick-select use the organisation's Monday–Sunday week (`organizationWeekDayKeys`, `isWeekendDayKey`) and the organisation's today, not the browser's; a stored toolbox-talk week commencing is organisation-zone midnight of its Monday. Same result for a browser in the organisation's zone.
- **My tasks** (web): `isTaskAssignedToUser` is `tasksAssignedToViewer` (1.35.0) — tasks under the person's users id, a second `managers` row or another letter case now show; never fewer than before (test against the old helper).
- **Wording**: §6 says `managerCoverageHours.paidHours` is hours worked, capped at the weekday paid day, not pay and not the Daily Overview figure (field name kept); Daily Overview's hours are the pay rule's (`totalPaidHours`) since 1.20.2 (web comments said `workedHours`).
- **Ghost conversion** (§11): `ghostConversionCandidates` takes `memberIds` and reads a stored organisation reference with `documentOrganizationId`, so a person with a login — a member from another company, or a users document storing `organizations/{id}` — is never converted into a second (ghost) person; the script reads those users documents and writes no write metadata.
- Verified fixed earlier (no change): booking clash letter case (#266 / 1.33.0), `preferFinishedAccount` inactive accounts and `userActiveWrites` / `setUserActive` (1.33.0).
- No rules, index, Storage or Functions change.

## iOS work for 1.36.0

**Sync first.** 1.36.0 is a fixes-only release. No Firestore field, rules or `minimumIosBuild` change; no new export.

1. **Sync** — `WEB_REPO=<web worktree> bash scripts/sync-rulebook-from-web.sh`. The packed script changes only in `ghostConversionCandidates` (new optional `memberIds`; a stored organisation reference read with `documentOrganizationId`), comments and the stamp. iOS does not call `ghostConversionCandidates` (the conversion is a web script), so nothing else is needed for it.
2. **Wording** — `managerCoverageHours.paidHours` is hours worked capped at the weekday paid day, not pay (rulebook §6). If any Swift screen shows it as "paid" hours, relabel it or use `bookedWorkedHours` for a person's real hours; Book labour decides on `covered` only.
3. **Same bugs, iOS side (check and report, do not diverge)** — web fixed these in 1.36.0; the iOS equivalents to check:
   - Week grids and "this week" from `Calendar.current` (Scheduling, My Schedule, materials and H&S weeks): use `organizationWeekDayKeys` / `isWeekendDayKey` on the organisation day (`OrganizationRulebookContext`), the organisation's today, not the device's.
   - A person's rate history read under one `operatives` row on the email (Edit user previous rates, timesheet pay, weekly report pay): match every row of the person (`bookingIdsForAccount`) and every users id (`personIdSet`), without case — as `payRateOnDay` with `person` / `roster` / `operativeIds`.
   - "My tasks" matched by one manager or operative row: use `tasksAssignedToViewer` (1.35.0), the rule Home and My Profile already use.

## New rulebook sections

- 1.36.0 — 2026-11-07

## Workflow for the iOS agent

1. Run `scripts/sync-rulebook-from-web.sh` (or copy the files above), then run the iOS tests.
2. Produce a numbered Gap Report (Finding / Evidence / Rule / Severity / Solution / Action) for the changes above and **stop**.
3. Implement only what the user approves, in the iOS repo only.
4. Report any web-side gap back to the web agent instead of diverging on iOS.
