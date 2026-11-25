# iOS follow-on — rulebook 1.91.0

Generated 2026-11-25 by `npm run rulebook:handoff` in project-planner-web. Paste this whole file into the iOS agent.
The web repo copy of `docs/RULEBOOK.md` is canonical. iOS mirrors it exactly; never edit the iOS mirror by hand.

```
╔══════════════════════════════════════════════════════════════════╗
║ FOLLOW-ON — paste into the iOS agent                             ║
╚══════════════════════════════════════════════════════════════════╝
Started on: web
Rulebook version: 1.89.0 → 1.91.0
Packed hash: e3d6f40207d4434ff919e5386f7a6241d7f9350c763b7915a0ccf404b02e4e97
Rulebook sha256: 55f6e559c59fdcf98034ff2e989ac4ddec71937691b66cb47525e8f5340443c2
Copy (do not edit by hand) — run scripts/sync-rulebook-from-web.sh in the iOS repo, which copies:
  web lib/canonical/dist/canonical-business.js      → iOS Project Planner/Canonical/canonical-business.js
  web lib/canonical/dist/canonical-business.sha256  → iOS Project Planner/Canonical/canonical-business.js.sha256
  web lib/canonical/dist/canonical-manifest.json    → iOS Project Planner/Canonical/canonical-manifest.json
  web docs/RULEBOOK.md                              → iOS docs/RULEBOOK.md
  web lib/canonical/parity-fixture.json             → iOS ProjectPlannerTests/CanonicalParityFixture.json
  web lib/canonical/cross-platform-contract.json    → iOS ProjectPlannerTests/CrossPlatformContract.json
  web lib/canonical/data-parity-fixture.json        → iOS ProjectPlannerTests/DataParityFixture.json
Contract sha256: d2d465abcf0ab7c7747385346b87d2b47226412b1014602c5a26bff8e951c0ca
Data-parity fixture sha256: c2db4a64c22f36ddda48453c0d26da28fc802df9c8c93c0d876e8097a9eb176f
Call: CanonicalBusinessEngine — no second calculator in Swift.
Exports added: TASK_DEFAULT_SORT, TASK_DUE_FILTERS, TASK_NO_FILTERS, TASK_SORTS, filterTasks, parseTaskFilters, parseTaskSort, sortTasks, taskActiveFilterCount, taskAssigneeCandidates, taskCreatorKey, taskFilterOptions, taskViewerIdKeys, taskVisibility, visibleTasksForViewer
Exports removed: none
Web files that changed the rules: docs/RULEBOOK.md, lib/canonical/bundleEntry.ts, lib/canonical/canonical.test.ts, lib/canonical/homeOverview.ts, lib/canonical/index.ts, lib/canonical/parity-fixture.json, lib/canonical/taskViewing.ts
Done when:
- [ ] Packed hash in iOS equals e3d6f40207d4434ff919e5386f7a6241d7f9350c763b7915a0ccf404b02e4e97
- [ ] iOS docs/RULEBOOK.md is byte-identical (sha256 55f6e559c59fdcf98034ff2e989ac4ddec71937691b66cb47525e8f5340443c2)
- [ ] RulebookParityTests pass (CanonicalBusinessEngine.rulebookVersion() == 1.91.0)
- [ ] Every Swift caller of a changed rule calls CanonicalBusinessEngine
- [ ] Same Firebase fields read and written as web
- [ ] Any disagreement traced to its first divergence — no copied screen number
```

## What changed in 1.91.0

- **Who sees which task** (§34, owner decision 25 Nov, A): new `visibleTasksForViewer`, `taskVisibility` (`lib/canonical/taskViewing.ts`) and `taskViewerIdKeys` (homeOverview): admins every task; managers (a no-flag user included) the tasks on jobs they manage plus tasks assigned to or created by them; operatives their own. Web: Tasks page, a job's Tasks tab, `?task=` links, Home figures and "Tasks to do", the job's Tasks figure. Display only; rules unchanged.
- **Filters and sorts** (§34, decision B): new `filterTasks`, `taskFilterOptions`, `taskCreatorKey`, `taskActiveFilterCount`, `parseTaskFilters`, `parseTaskSort`, `sortTasks`, `TASK_SORTS`, `TASK_DEFAULT_SORT`, `TASK_DUE_FILTERS`, `TASK_NO_FILTERS`. Web Tasks page: a Filters panel (project, small works, assigned by, assigned to, priority, due) with counts, chips with ✕, Clear all and a Sort menu, remembered on the device.
- **A new task's due date still starts as today** (decision C, confirmed; no change).
- **Assignee pickers offer current people only** (§34, owner report 25 Nov): new `taskAssigneeCandidates` (`managerIds`, `operativeIds`, `goneIds`, `leftovers`); a leftover managers row of a deleted person is never offered and an existing assignment to it reads "Removed user". Web: the New task / Edit people field; Settings → Data health "Managers and Operatives list rows with no person" (read only). Web's dead `assignableProjectManagers` and `activePeopleForAssignment` removed.
- Parity fixture: `Tasks 1.91.0:` cases.

## iOS work for 1.91.0

Rulebook 1.91.0 (Tasks follow-ups, §34; owner decisions 25 Nov). New module `lib/canonical/taskViewing.ts`. Every rule below is called through `CanonicalBusinessEngine` (add wrappers in `Project Planner/Core/Rulebook+Tasks.swift`); no Swift copy of any of them. Sync the packed rulebook first with `scripts/sync-rulebook-from-web.sh` (packed sha256 in `docs/ios-handoff/LATEST.md`).

1. **Who sees which task (decision A)** — `visibleTasksForViewer({ viewer, tasks, jobs, roster, operatives, managers })` (and `taskVisibility` for the reason). Pass the signed-in person's users document (its level flags: `permissionLevelOf` decides — a no-flag user is a manager), every task, every project and small works job with its stored manager fields (`managerIds`, `managerId`, `managerUserIds`, `assignedManagerUserIds`), the organisation's users documents (unfolded, with `formerUserIds` / `sameEmailUserIds`), and the `operatives` and `managers` rows. Use the returned list for: the Tasks list and its tabs and counts (`TaskStore` / the Tasks screen), a job's Tasks tab (`ProjectDetailView` / small works detail), the Home task figures and "Tasks to do" (`HomeView` → pass it as `tasks` to `homeOverviewMetrics`), the job's Tasks badge (`jobTileBadges`), and a task deep link (a task not in the list shows `TASK_COPY.errors.noAccess`). Managers lose tasks on jobs they do not manage unless assigned to or created by them. Display only (no rules change).
2. **Filters and sort (decision B)** — Tasks screen: a filter sheet with Project, Small works, Assigned by (creator), Assigned to, Priority and Due, each from `taskFilterOptions({ tasks, locations, personKeys, roster })` (counts over the scoped list; `personKeys` = `taskPersonKeys(...).keys`; `locations` = `{ id, kind: 'project' | 'smallWorks', code, name }`), filtered with `filterTasks(tasks, filters, { locations, personKeys, nowMs, timeZone })`; a Sort menu from `TASK_SORTS` (Overdue first / Due date, earliest first / Due date, latest first) applied with `sortTasks(tasks, sort, tab, nowMs, timeZone)` (replaces the direct `sortTasksForTab` call; `overdue_first` is the same order). Show active filters as chips with ✕ and Clear all; `taskActiveFilterCount` for the "Filters (2)" badge. Remember filters and sort in `UserDefaults` per organisation, separately for the main Tasks screen and a job's Tasks tab, read back through `parseTaskFilters` / `parseTaskSort`. A job's tab has no project / small works filter. Organisation time zone only.
3. **Assignee pickers (owner report 25 Nov: Edit task's Managers picker listed a deleted user)** — the New task and Edit task people sheet (`TaskPeoplePickerSheet` and the Managers / Operatives lists behind it) must offer exactly `taskAssigneeCandidates({ managers, operatives, roster }).managerIds` / `.operativeIds` (managers rows and operatives rows by id, without case), never its own active-row filter. An existing assignee whose row id is in `.goneIds` reads "Removed user" (`TASK_REMOVED_USER_LABEL`) with remove and the 1.89 reassign banner; an inactive / pending assignee keeps their name, is not offered, and stays removable. Treat `goneIds` as empty until the users roster has loaded (never a false "Removed user"). iOS has no Data health screen; the leftover rows are listed on web.
4. **iPhone-only (decision D, no rulebook change):**
   - Task attachment uploads like web: 3 at a time (`TASK_ATTACHMENT_RULES`), progress per file, an upload with no progress for 45 s is cancelled and shown as failed (retry offered), and the task document is written once, after every file has uploaded (never a partial task, never one write per file).
   - Convert HEIC / HEIF photos to JPEG before upload for task photos; check the other photo uploads (site audits, claims evidence, qualification certificates, profile photo) and convert where they still send HEIC to a path that expects JPEG.
   - Tasks list: one tap anywhere on a task card opens it (owner: it used to take several taps). In `TasksDetailView.swift` the card's tap area competes with the checklist row button (`checklistRow`) and nested buttons; give the card one `contentShape(Rectangle())` + `onTapGesture` (or a single `Button` wrapping the card) and keep only the Start / Complete button as its own action (`.buttonStyle(.borderless)` / `highPriorityGesture` so it does not also open the card).
5. Tests: add the `Tasks 1.91.0:` cases of `parity-fixture.json` to `CanonicalParityFixtureTests` (they run automatically if the fixture loop covers every case), and a UI test that a task card opens on one tap.

Not changed: task document shape, security rules, `taskAccess`.

## New rulebook sections

- 34. Tasks: words, tabs, actions, the popup and uploads (1.89.0, 1.91.0)
- 1.91.0 — 2026-11-25

## Workflow for the iOS agent

1. Run `scripts/sync-rulebook-from-web.sh` (or copy the files above), then run the iOS tests.
2. Produce a numbered Gap Report (Finding / Evidence / Rule / Severity / Solution / Action) for the changes above and **stop**.
3. Implement only what the user approves, in the iOS repo only.
4. Report any web-side gap back to the web agent instead of diverging on iOS.
