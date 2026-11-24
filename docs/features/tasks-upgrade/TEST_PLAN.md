# Test plan

Run on **iOS and web** unless a line says otherwise. Accounts: **Admin** (owner), **Manager M**, **Operative O1** and **O2** (same organisation, different trades), **Outsider X** (another organisation).

## A. Fixes (ship first)

- [ ] A1. Web: create a task with 1 JPG, then 3 JPGs, then a HEIC, then a PDF. Each saves; progress shows on the button; popup closes; task appears with its files. Record the time for each.
- [ ] A2. Web: task with no files closes in under 1.5 s.
- [ ] A3. Web: three phone photos save in under 10 s on office broadband (record the number).
- [ ] A4. Web: throttle to "Slow 3G" in DevTools, then go offline mid-upload. Within 45 s the file shows "stopped uploading" with Retry; Retry works when back online; button never sits on "Saving…" indefinitely.
- [ ] A5. Web: Cancel mid-upload: no task created; no orphan files left in Storage.
- [ ] A6. iOS: create with photos (camera and library), edit to add a file, complete with proof photo. All save with progress.
- [ ] A7. A HEIC taken on iOS opens on web in Chrome on Windows (stored as JPEG).
- [ ] A8. A PDF uploaded on web opens on iOS in the in-app viewer.
- [ ] A9. No Camera option anywhere on web (new, edit, complete). No `capture` attribute on web file inputs. iOS still has Take photo.
- [ ] A10. Web Edit task has no "Create a new task" banner.
- [ ] A11. Open Edit on a task with ticked items: ticks shown; Save without changes keeps every tick (check the stored data) on web and iOS.
- [ ] A12. Priority shows Low/Normal/High/Urgent everywhere; a task stored as `medium` shows Normal; migration dry run reports counts before running.
- [ ] A13. "Done" appears nowhere; "Completed" everywhere.
- [ ] A14. iOS Edit can't set Completed.
- [ ] A15. iOS attachment opens in-app, not Safari.

## B. List and views

- [ ] B1. Manager opens Tasks: Everyone, Active tab. Operative: My tasks, Active.
- [ ] B2. Switch scope, leave, come back: last choice remembered on that device.
- [ ] B3. Tab counts match the list on main page, project tab, small works tab, on both platforms, for the same user.
- [ ] B4. Overdue tasks appear in Active and Overdue; Overdue count red.
- [ ] B5. Approvals tab hidden at 0; shows and works when there's one (existing behaviour unchanged).
- [ ] B6. Sort order matches the fixture `sortActive`.
- [ ] B7. Main page grouped by project / small works with type badge, code, name, count, Open link.
- [ ] B8. Project header "Tasks" count equals that project's Active count.
- [ ] B9. Search finds by task name, project name and person; empty state uses rulebook text.
- [ ] B10. Filters (assignee, priority, due, location) combine correctly.

## C. Popup (web)

- [ ] C1. Clicking a task on main page, project tab and small works tab opens the same popup; page underneath doesn't change.
- [ ] C2. URL shows `?task=ID`; reload keeps it open; Back closes it; a copied link opens it for another permitted user.
- [ ] C3. Close button is 40 px; Esc closes; focus returns to the row.
- [ ] C4. New, Edit and Complete open in the popup, never a full-height window.
- [ ] C5. Under 640 px wide the popup is full screen and usable.

## D. Create and edit

- [ ] D1. Field order matches `formOrder` on both platforms.
- [ ] D2. From the main page, Project or small works is required; from a project page it's filled and locked.
- [ ] D3. Me adds the current user; Add people picker searches, switches Managers/Operatives, filters by trade, allows mixing.
- [ ] D4. Missing fields show their own message under the field on Create.
- [ ] D5. Checklist: add, reorder, remove; ticks preserved on edit; manager can untick.
- [ ] D6. Attachments add/remove in edit on both platforms; removed files are deleted from Storage after save.
- [ ] D7. Edit status: To do / In progress only.
- [ ] D8. Old task with no due date: Edit asks for one before saving.
- [ ] D9. Cancel with changes asks to discard.
- [ ] D10. Two devices edit the same task: the second save shows the conflict message naming the first editor and reloads.

## E. Actions

- [ ] E1. Start: To do → In progress, toast, everywhere.
- [ ] E2. Complete with unticked items: Complete task disabled, hint shows count; Save progress keeps ticks, photos and notes.
- [ ] E3. Complete with all ticked: Completed, completed by/at recorded, moves to Completed tab on both platforms.
- [ ] E4. Task with no checklist: complete step has no checklist section and can complete straight away.
- [ ] E5. Reopen: Completed → In progress; Activity shows both events.
- [ ] E6. Delete: confirmation, task and its files gone on both platforms.
- [ ] E7. Ticking a checklist item from the task view saves immediately with who/when and shows on the other platform.

## F. Permissions

- [ ] F1. Report from Phase 1: current behaviour vs the rulebook proposal, approved before applying.
- [ ] F2. Operative can't create, edit or delete (unless current behaviour allows and you chose to keep it); can start, tick and complete their own tasks.
- [ ] F3. Outsider X gets no access to any task by ID or link, on either platform or via direct database/API calls.
- [ ] F4. Server rejects: unknown status or priority, Completed via edit, client-set createdBy/organisationId, more than 10 files, oversized files.

## G. Cross-platform parity (the "100%" check)

- [ ] G1. `rules/tasks.rules.json` validates against the schema in CI.
- [ ] G2. Firestore `platformRulebooks/tasks` matches the git file (version and body).
- [ ] G3. **iOS unit tests load `rules/tasks.fixtures.json` and all cases pass.**
- [ ] G4. **Web unit tests load the same file and all cases pass.**
- [ ] G5. Change a label in the rulebook (e.g. "Start" → "Begin"), deploy: both apps show it without a release. Revert.
- [ ] G6. Change `dueSoonDays` to 5: both platforms' due wording changes identically. Revert.
- [ ] G7. Search both codebases: no hard-coded task status/priority labels, limits, sources or messages remain.
- [ ] G8. Side by side, same user, same moment: main page counts, list order and every visible label match on iOS and web.
- [ ] G9. Run the parity prompt from `SHARED_RULEBOOK.md`; everything reports "match".

## H. Accessibility

- [ ] H1. VoiceOver reads task cards as title, location, due, priority, status.
- [ ] H2. Largest Dynamic Type: Edit task usable, nothing clipped.
- [ ] H3. Web keyboard-only: open, edit, complete and close a task.
- [ ] H4. No web text under 13 px in task screens.

## I. Light and dark mode

Run on every task screen (main page, project tab, small works tab, popup in all four modes, people picker, upload states, iOS list, task, edit, add people, add attachment, complete, saving).

- [ ] I1. Each screen looks right in Light, Dark and Match device on both platforms; screenshots of each attached to the PR.
- [ ] I2. Switching Appearance with a popup or sheet open updates everything instantly (popup, menus, toasts, picker, dialogs).
- [ ] I3. No hex colours in task screen code apart from the fixed items in `theme.tokens.json` → `fixedColours` (search the diff).
- [ ] I4. Status, priority and due chips readable in both modes; CI contrast check passes for every pair in both modes.
- [ ] I5. Overdue red and due-soon amber row edges visible in both modes.
- [ ] I6. Web sidebar and project header stay navy with white text in both modes.
- [ ] I7. Photo thumbnails and PDF previews aren't tinted or inverted in dark mode.
- [ ] I8. Web: reload in dark mode with no white flash. iOS: status bar, keyboard, date picker, share sheet and Quick Look follow the mode.
- [ ] I9. Appearance choice is per device and survives a restart. If `appearanceSettingEnabled` is still off, web stays light and iOS stays dark for users, and task screens are ready for both.

## J. Existing flows and pages (regression)

- [ ] J1. Phase 1 current-flows table and current-vs-target map delivered and approved (WORK_WITH_EXISTING.md).
- [ ] J2. Projects page: header card, Edit, Book labour, progress, header stats, tab buttons and every tab other than Tasks look and behave exactly as before (compare screenshots before and after).
- [ ] J3. Small works page: same check; only the Tasks tab content differs.
- [ ] J4. The header "Tasks" stat equals the Tasks tab's Active count on every project and small works.
- [ ] J5. The gear icon's old action still exists (in the ⋯ menu or wherever agreed).
- [ ] J6. Approvals works exactly as before.
- [ ] J7. Home "Tasks pending" card and "Tasks Due Today", notifications, Daily overview, Weekly report, Warnings and My Schedule still show task data correctly, and their counts match the Tasks tabs for the same user.
- [ ] J8. Tasks created before the change (old field values, no due date, old Storage paths) open, edit, complete and display correctly on both platforms.
- [ ] J9. The current App Store iOS build, running against the updated backend, can still list, create, edit and complete tasks (or the agreed minimum-version prompt appears).
- [ ] J10. Every Firestore/Storage rule change has emulator tests for allowed and denied cases; every new query has its index; Cloud Functions triggered by tasks (notifications, counters, activity) still fire correctly.
- [ ] J11. Nothing was deployed to production (rules, indexes, functions, migrations, CORS) without approval.
