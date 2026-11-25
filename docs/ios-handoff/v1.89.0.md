# iOS follow-on — rulebook 1.89.0

Generated 2026-11-25 by `npm run rulebook:handoff` in project-planner-web. Paste this whole file into the iOS agent.
The web repo copy of `docs/RULEBOOK.md` is canonical. iOS mirrors it exactly; never edit the iOS mirror by hand.

```
╔══════════════════════════════════════════════════════════════════╗
║ FOLLOW-ON — paste into the iOS agent                             ║
╚══════════════════════════════════════════════════════════════════╝
Started on: web
Rulebook version: 1.88.0 → 1.89.0
Packed hash: d2cfe920122f49a5e9bbbb0edb41e28e89209b75333ac47ee4402e283e3dc005
Rulebook sha256: d582c10f644888b8f757c202f2cd84cd2daa7c27b2ef50e624e7331581c27ab8
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
Exports added: TASK_ACTION_LABELS, TASK_ATTACHMENT_HELP, TASK_ATTACHMENT_RULES, TASK_ATTACHMENT_SOURCES, TASK_ATTACHMENT_SOURCE_LABELS, TASK_COPY, TASK_DEFAULT_PRIORITY, TASK_DEFAULT_TAB, TASK_DUE_SOON_DAYS, TASK_EDIT_STATUS_OPTIONS, TASK_FIELD_LIMITS, TASK_FORM_ORDER, TASK_LEGACY_PRIMARY_ITEM_ID, TASK_PRIORITY_OPTIONS, TASK_REMOVED_USER_LABEL, TASK_RULES_PACK_VERSION, TASK_SCOPES, TASK_STATUS_OPTIONS, TASK_TABS, isTaskActive, sortTasksForTab, taskAccess, taskActionStatus, taskActions, taskAssigneeDisplay, taskAttachmentCheck, taskAttachmentSources, taskChecklistAfterEdit, taskCompleteStep, taskCopyText, taskDateText, taskDefaultScope, taskDueLabel, taskEditStatus, taskFormErrors, taskInTab, taskItemTicked, taskPriorityKey, taskPriorityLabel, taskPriorityRank, taskPriorityTone, taskScopeFor, taskShortDateText, taskStatusChangeFields, taskStatusKey, taskStatusLabel, taskStatusTone, taskTabCounts, taskTabKeys, taskToggleChecklistItem, taskUploadProgressText, taskViewerRole
Exports removed: none
Web files that changed the rules: docs/RULEBOOK.md, lib/canonical/bundleEntry.ts, lib/canonical/canonical.test.ts, lib/canonical/index.ts, lib/canonical/parity-fixture.json, lib/canonical/taskRules.test.ts, lib/canonical/taskRules.ts
Done when:
- [ ] Packed hash in iOS equals d2cfe920122f49a5e9bbbb0edb41e28e89209b75333ac47ee4402e283e3dc005
- [ ] iOS docs/RULEBOOK.md is byte-identical (sha256 d582c10f644888b8f757c202f2cd84cd2daa7c27b2ef50e624e7331581c27ab8)
- [ ] RulebookParityTests pass (CanonicalBusinessEngine.rulebookVersion() == 1.89.0)
- [ ] Every Swift caller of a changed rule calls CanonicalBusinessEngine
- [ ] Same Firebase fields read and written as web
- [ ] Any disagreement traced to its first divergence — no copied screen number
```

## What changed in 1.89.0

- **Tasks upgrade** (new §34, owner pack 24 Nov `docs/features/tasks-upgrade/`): new `lib/canonical/taskRules.ts` — `TASK_STATUS_OPTIONS`, `taskStatusLabel`, `taskStatusKey`, `taskStatusTone`, `TASK_PRIORITY_OPTIONS`, `TASK_DEFAULT_PRIORITY`, `taskPriorityLabel`, `taskPriorityKey`, `taskPriorityTone`, `taskPriorityRank`, `TASK_DUE_SOON_DAYS`, `taskDateText`, `taskShortDateText`, `taskDueLabel`, `TASK_TABS`, `TASK_DEFAULT_TAB`, `isTaskActive`, `taskTabKeys`, `taskInTab`, `taskTabCounts`, `sortTasksForTab`, `TASK_ACTION_LABELS`, `taskActions`, `taskActionStatus`, `taskStatusChangeFields`, `TASK_EDIT_STATUS_OPTIONS`, `taskEditStatus`, `TASK_LEGACY_PRIMARY_ITEM_ID`, `taskItemTicked`, `taskToggleChecklistItem`, `taskChecklistAfterEdit`, `taskCompleteStep`, `taskAccess`, `TASK_SCOPES`, `taskDefaultScope`, `taskScopeFor`, `TASK_REMOVED_USER_LABEL`, `taskAssigneeDisplay`, `TASK_ATTACHMENT_SOURCES`, `TASK_ATTACHMENT_SOURCE_LABELS`, `taskAttachmentSources`, `TASK_ATTACHMENT_RULES`, `taskAttachmentCheck`, `TASK_ATTACHMENT_HELP`, `taskUploadProgressText`, `TASK_FORM_ORDER`, `TASK_FIELD_LIMITS`, `taskFormErrors`, `TASK_COPY`, `taskCopyText`, `TASK_RULES_PACK_VERSION`. The pack's fixtures as parity cases.
- Bugs fixed (FIXES.md): web — a task with a file now uploads 3 at a time with progress, stops a stalled file after 45 s with Retry / Remove and never hangs (the old 45 s race did not stop the upload, and the error showed at the top of a sheet scrolled to the bottom); no Camera on web; no "Create a new task" banner in Edit; Edit shows and keeps ticks; Normal not Medium; Completed not Done; managers no longer offered Delete (the rules refused it); Reopen goes to In progress; Removed user with a reassign prompt. iOS — the same words, Edit cannot complete, Save progress keeps the status, no checklist made from the title (iOS hand-off).
- Web UI: one task list (tabs with counts, My tasks / Everyone, search and filters) on the main Tasks page and the Tasks tab of Projects and Small works, one popup for view / new / edit / complete with the URL `?task=` (`&mode=edit|complete`); the old sheets (`AddProjectTaskSheet`, `ProjectTaskDetailSheet`, `ProjectTaskRow`, `ProjectTaskFilterSheet`) and the old job-tab counters (`taskStatCounts`, `filterTasksForScope`, `applyJobTaskFilter`, …) are removed. `lib/firebase/storageUtils.ts` `startTrackedUpload` / `deleteJustUploadedFile`.
- Review of #452 / #299 (same version): `taskViewerRole` (a legacy user with no level flag keeps seeing every task); Cancel during a save never writes the task or keeps a file; the short upload retry is set for one task upload only; names wait for the rosters and read placeholder managers; the reassign note only for editors; a deep link checks the person may see the task; a task whose job was deleted can still be edited; iOS uses the same upload limits (`taskAttachmentCheck`) and a stall cancel and retry; `TASK_COPY.delete.body` says the files are kept for recovery (§24).

## New rulebook sections

- 34. Tasks: words, tabs, actions, the popup and uploads (1.89.0)
- 1.89.0 — 2026-11-24

## Workflow for the iOS agent

1. Run `scripts/sync-rulebook-from-web.sh` (or copy the files above), then run the iOS tests.
2. Produce a numbered Gap Report (Finding / Evidence / Rule / Severity / Solution / Action) for the changes above and **stop**.
3. Implement only what the user approves, in the iOS repo only.
4. Report any web-side gap back to the web agent instead of diverging on iOS.
