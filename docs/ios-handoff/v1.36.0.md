# iOS follow-on — rulebook 1.36.0

Generated 2026-11-10 by `npm run rulebook:handoff` in project-planner-web. Paste this whole file into the iOS agent.
The web repo copy of `docs/RULEBOOK.md` is canonical. iOS mirrors it exactly; never edit the iOS mirror by hand.

```
╔══════════════════════════════════════════════════════════════════╗
║ FOLLOW-ON — paste into the iOS agent                             ║
╚══════════════════════════════════════════════════════════════════╝
Started on: web
Rulebook version: 1.36.0 → 1.36.0
Packed hash: 3983e6f1584301aadcc4cbbe9cce5a34de61101f2e7c402ddc2d09be4ad12214
Rulebook sha256: 2922f666e37a6e71b34588ff0d0da1909d6a00bd45ae8ca7675e6a2ae7a8978b
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
Web files that changed the rules: none recorded
Done when:
- [ ] Packed hash in iOS equals 3983e6f1584301aadcc4cbbe9cce5a34de61101f2e7c402ddc2d09be4ad12214
- [ ] iOS docs/RULEBOOK.md is byte-identical (sha256 2922f666e37a6e71b34588ff0d0da1909d6a00bd45ae8ca7675e6a2ae7a8978b)
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
- **Duplicate-name warning** (§11, owner decision 10 Nov; owner-requested addition to this release): `usersWithSameName`, `normalizePersonNamePart`, `DUPLICATE_NAME_WARNING_TITLE`, `DUPLICATE_NAME_WARNING_MESSAGE`, `DUPLICATE_NAME_CONFIRM_LABEL`, `DUPLICATE_NAME_CANCEL_LABEL` (new `duplicateUserNames.ts`). Add User asks before saving when the first and last name match an existing person; Add anyway saves as before. Warning only.
- **Rate history across duplicate `operatives` rows** (owner decision 10 Nov, option (a)): every record on the person's email counts (§8 `payRateOnDay` / `personIdSet`), as built above; no rule change.
- No rules, index, Storage or Functions change.

## iOS work for 1.36.0

**Sync first.** 1.36.0 is a fixes-only release plus one owner-requested warning (10 Nov). No Firestore field, rules or `minimumIosBuild` change; new exports `usersWithSameName` and the `DUPLICATE_NAME_*` copy only.

1. **Sync** — `WEB_REPO=<web worktree> bash scripts/sync-rulebook-from-web.sh`. The packed script changes in `usersWithSameName` (new, step 4) and in `ghostConversionCandidates` (new optional `memberIds`; a stored organisation reference read with `documentOrganizationId`), comments and the stamp. iOS does not call `ghostConversionCandidates` (the conversion is a web script), so nothing else is needed for it.
2. **Wording** — `managerCoverageHours.paidHours` is hours worked capped at the weekday paid day, not pay (rulebook §6). If any Swift screen shows it as "paid" hours, relabel it or use `bookedWorkedHours` for a person's real hours; Book labour decides on `covered` only.
3. **Same bugs, iOS side (check and report, do not diverge)** — web fixed these in 1.36.0; the iOS equivalents to check:
   - Week grids and "this week" from `Calendar.current` (Scheduling, My Schedule, materials and H&S weeks): use `organizationWeekDayKeys` / `isWeekendDayKey` on the organisation day (`OrganizationRulebookContext`), the organisation's today, not the device's.
   - A person's rate history read under one `operatives` row on the email (Edit user previous rates, timesheet pay, weekly report pay): match every row of the person (`bookingIdsForAccount`) and every users id (`personIdSet`), without case — as `payRateOnDay` with `person` / `roster` / `operativeIds`.
   - "My tasks" matched by one manager or operative row: use `tasksAssignedToViewer` (1.35.0), the rule Home and My Profile already use.
4. **Duplicate-name warning on Add User** (owner decision 10 Nov, rulebook §11) — `Views/AddUserView.swift`: on Create / Add (the Ghost account path too), after the form's own checks, call `usersWithSameName(roster, { firstName, lastName }, { claimedEmails })` through `CanonicalBusinessEngine` with the full organisation roster. When it returns anyone, show a confirmation with `DUPLICATE_NAME_WARNING_TITLE` / `DUPLICATE_NAME_WARNING_MESSAGE`, list each match with their email or "No app login" (`GHOST_BADGE_LABEL`), and offer `DUPLICATE_NAME_CONFIRM_LABEL` (save as before) and `DUPLICATE_NAME_CANCEL_LABEL` (back to the form). A warning only — but when `usersWithSameName` does not answer (the script is unavailable), refuse the save, invite and ghost alike, with "Couldn't check this user — try again." and save nothing (owner decision 10 Nov; Add anyway never bypasses it). Do not compare names in Swift.


## Workflow for the iOS agent

1. Run `scripts/sync-rulebook-from-web.sh` (or copy the files above), then run the iOS tests.
2. Produce a numbered Gap Report (Finding / Evidence / Rule / Severity / Solution / Action) for the changes above and **stop**.
3. Implement only what the user approves, in the iOS repo only.
4. Report any web-side gap back to the web agent instead of diverging on iOS.
