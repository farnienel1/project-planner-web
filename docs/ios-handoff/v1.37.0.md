# iOS follow-on — rulebook 1.37.0

Generated 2026-11-10 by `npm run rulebook:handoff` in project-planner-web. Paste this whole file into the iOS agent.
The web repo copy of `docs/RULEBOOK.md` is canonical. iOS mirrors it exactly; never edit the iOS mirror by hand.

```
╔══════════════════════════════════════════════════════════════════╗
║ FOLLOW-ON — paste into the iOS agent                             ║
╚══════════════════════════════════════════════════════════════════╝
Started on: web
Rulebook version: 1.36.0 → 1.37.0
Packed hash: f2b163368a252f500a6e1bb9e6f1028ed61ad7f532e76dc7cefd54ec7724a9da
Rulebook sha256: 1d54c2d23e02d11f369c27d851ec6ec0d1012d745d68dadd49275c85cced5640
Copy (do not edit by hand) — run scripts/sync-rulebook-from-web.sh in the iOS repo, which copies:
  web lib/canonical/dist/canonical-business.js      → iOS Project Planner/Canonical/canonical-business.js
  web lib/canonical/dist/canonical-business.sha256  → iOS Project Planner/Canonical/canonical-business.js.sha256
  web lib/canonical/dist/canonical-manifest.json    → iOS Project Planner/Canonical/canonical-manifest.json
  web docs/RULEBOOK.md                              → iOS docs/RULEBOOK.md
  web lib/canonical/parity-fixture.json             → iOS ProjectPlannerTests/CanonicalParityFixture.json
  web lib/canonical/cross-platform-contract.json    → iOS ProjectPlannerTests/CrossPlatformContract.json
Contract sha256: 59d6bc6123f250e1f57599240eb3190ab48f5cd2532f8281a99360d9e187d86b
Call: CanonicalBusinessEngine — no second calculator in Swift.
Exports added: JOB_SCHEDULE_LEAVE_LABEL, JOB_SCHEDULE_LEAVE_PENDING_LABEL, JOB_SCHEDULE_LEAVE_PENDING_TITLE, JOB_SCHEDULE_LEAVE_TITLE, JOB_SCHEDULE_LEGEND, jobScheduleLeaveMarks, scheduleCellHours, scheduleCellKind
Exports removed: none
Web files that changed the rules: docs/RULEBOOK.md, lib/canonical/bundleEntry.ts, lib/canonical/canonical.test.ts, lib/canonical/index.ts, lib/canonical/jobScheduleLeave.ts
Done when:
- [ ] Packed hash in iOS equals f2b163368a252f500a6e1bb9e6f1028ed61ad7f532e76dc7cefd54ec7724a9da
- [ ] iOS docs/RULEBOOK.md is byte-identical (sha256 1d54c2d23e02d11f369c27d851ec6ec0d1012d745d68dadd49275c85cced5640)
- [ ] RulebookParityTests pass (CanonicalBusinessEngine.rulebookVersion() == 1.37.0)
- [ ] Every Swift caller of a changed rule calls CanonicalBusinessEngine
- [ ] Same Firebase fields read and written as web
- [ ] Any disagreement traced to its first divergence — no copied screen number
```

## What changed in 1.37.0

- **Annual leave on project and small works scheduling** (§21, owner decisions 10 Nov): new `jobScheduleLeaveMarks`, `JOB_SCHEDULE_LEAVE_LABEL`, `JOB_SCHEDULE_LEAVE_PENDING_LABEL`, `JOB_SCHEDULE_LEAVE_TITLE`, `JOB_SCHEDULE_LEAVE_PENDING_TITLE` (new `jobScheduleLeave.ts`, on `leaveDayKind`, `leaveHalfDayLabel`, `personIdSet`, `standardDayOn`; the emails of the person's roster rows count, AM + PM on one day is a full day). Only people booked on the job are listed; for them, full-day leave is a brown "AL" cell, a half day "AL AM" / "AL PM", pending leave paler "AL?", rejected never; a booking on a leave day keeps its cell with a thin brown "AL" band across the top.
- **One booking colour scheme** (owner decision 10 Nov): `JOB_SCHEDULE_LEGEND` — Standard, Std + OT, OT only, Ann. leave, Half day — and `scheduleCellKind` / `scheduleCellHours` on both apps (iOS `SchedulingV2CellKindBuilder` now calls the rulebook; a 0h booking is a Standard 0h tile on both — iOS showed an empty dashed chip); web booking cells move from role colours to the iOS scheme (role pills unchanged). Display only: no booking figure, count, warning or write changes.
- Web week grid columns are calendar day keys; bookings and leave are both bucketed by them (a browser east of the organisation zone put bookings a column out).
- iOS now matches leave under every id without case (it matched exact ids) and shows half-day, pending and booked-day leave (it showed approved full days on unbooked days only).
- No rules, index, Storage or Functions change.

## iOS work for 1.37.0

**Sync first.** 1.37.0 is display only: annual leave on a job's scheduling week and one booking colour scheme (owner decisions 10 Nov). No Firestore field, rules or `minimumIosBuild` change; new exports `jobScheduleLeaveMarks`, `JOB_SCHEDULE_LEAVE_*`, `JOB_SCHEDULE_LEGEND` only.

1. **Sync** — `WEB_REPO=<web worktree> bash scripts/sync-rulebook-from-web.sh`.
2. **Bridge** — `Core/Rulebook+ScheduleLeave.swift`: `CanonicalBusinessEngine.jobScheduleLeaveMarks(people:holidays:dayKeys:timeZone:nonWorkingDayKeys:roster:day:)` → per person key, per day key `{ kind, onLeave, pending, slot, label, title, recordId, am, pm }` (shade each half by `am` / `pm`). Holidays come from `HolidayStore.bookings` (all statuses; the rule drops rejected), day keys on the organisation calendar (`OrganizationRulebookContext`), the roster = organisation users (id, email, `formerUserIds`) plus `operatives` rows (id, email), bank holidays from the cached region list.
3. **Scheduling grid** — `Views/ProjectDetailView.swift` (`schedulingCombinedDayCell` / `makeSchedulingPersonRow`): replace `isPersonOnAnnualLeave` (exact ids, approved full days only) with the marks. The grid's people are still only those booked on the job in the week (`ScheduleWeekGrid.staffRows`); leave never adds a row. An unbooked leave day → the brown `.annualLeave` cell with the label ("AL", "AL AM", "AL PM", pending "AL?" paler); a booked day keeps its chip and gets a thin brown band across the top with the label. Day headcounts do not count leave.
4. **Legend** — `Views/ProjectSchedulingV2Support.swift` `SchedulingV2Legend`: the five items are `JOB_SCHEDULE_LEGEND` (already the iOS wording); add the pending swatch "AL? = leave requested" to match web.
5. **Chip colour** — `SchedulingV2CellKindBuilder.fromBooking` calls `scheduleCellKind` (no Swift thresholds); a 0h booking is a Standard 0h chip, never the empty dashed one. One `jobScheduleLeaveMarks` call per grid render for every person and day. Do not change chip hours or tap actions.

## New rulebook sections

- 1.37.0 — 2026-11-10

## Workflow for the iOS agent

1. Run `scripts/sync-rulebook-from-web.sh` (or copy the files above), then run the iOS tests.
2. Produce a numbered Gap Report (Finding / Evidence / Rule / Severity / Solution / Action) for the changes above and **stop**.
3. Implement only what the user approves, in the iOS repo only.
4. Report any web-side gap back to the web agent instead of diverging on iOS.
