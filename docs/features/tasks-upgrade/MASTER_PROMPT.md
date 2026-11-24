# Master prompt: Tasks fixes + UI and flow upgrade (shared iOS + web feature)

You are working on **Project Planner**, a construction management platform with an **iOS app** and a **web app** (plus Android if it shares the iOS code). The backend appears to be **Firebase** (task attachments are served from `firebasestorage.googleapis.com`); confirm this first.

This prompt is the complete brief. Section 0 comes first: everything here is built from your current code, flows, rulebooks and Firebase setup. If `docs/features/tasks-upgrade/` exists in the repo, it holds the same material plus HTML mockups (`mockups/web.html` with 11 switchable states, `mockups/ios.html` with 8 screens, both with a Light/Dark/Match device switch) and longer reference docs (FIXES.md, SPEC.md, UI_SPEC.md, SHARED_RULEBOOK.md, TEST_PLAN.md). Open the mockups for visual intent. If the folder isn't there, everything you need is below.

---

## 0. Work with what's already there (read before anything else)

This brief is the **target**. Tasks already work on iOS and web, with real data in Firebase and people on older app versions. Build from the current code, flows, rulebooks and Firebase setup; don't build alongside them or replace them. If `docs/features/tasks-upgrade/WORK_WITH_EXISTING.md` exists, follow it.

**Read before planning:**
- **iOS and web code:**
  - every task screen, component, hook, service and model on both platforms, plus any shared code
  - how tasks are read and written (Firestore SDK, service layer, Cloud Functions)
  - reusable components (sheets/modals, chips, pickers, the Company details form style, toasts, empty states, any colour constants)
  - existing tests
- **Current flows to confirm in code:**
  - *Web main Tasks page:* stat cards that filter (To do / In progress / Overdue / Completed / Approvals), search, grouped by project.
  - *Web Project › Tasks tab:* stat cards (To do / In progress / Overdue / Done), search + filter icon, chips (Assigned to me / Active / Overdue / Completed), task cards with priority badge, a gear icon and status, "+ Tasks".
  - *Web Small works › Tasks tab:* assumed the same.
  - *Web task popup:* Carry out / Complete / Edit task / Delete; Reopen when completed; "Report a problem with this file".
  - *Web Complete step:* Photos / Files / Notes.
  - *Web New/Edit modal:* Myself / Manager / Operatives, Priority, Schedule, Attachments with Camera.
  - *Web Approvals.*
  - *iOS Tasks sheet:* stat row, chips, cards with Carry out.
  - *iOS Complete sheet:* Take photo / From library / Add file, Save / Save & mark complete.
  - *iOS task screen:* Due, Assigned, Checklist, Completion, Activity.
  - *iOS Edit Task sheet:* Trade filter / Managers / Operatives, Schedule, Status.
  - *iOS attachments:* open in Safari.
- **Other places showing task data:**
  - Home "Tasks · n pending" card and "Tasks Due Today"
  - the project header "Tasks" stat
  - notifications, Daily overview, Weekly report, Warnings, My Schedule

  Keep them working and don't redesign them. Make their counts use the same definitions as the new tabs.
- **Rulebooks:** any existing `platformRulebooks/*`, `rules/*.json`, Remote Config or constants. Extend and version what exists; never create a parallel mechanism or overwrite a live rulebook.
- **Firebase (use the Emulator Suite for anything that writes):**
  - Firestore task collections, real field names and value formats, how checklist and attachments are stored, `firestore.indexes.json`
  - security rules and how roles are checked
  - Storage buckets, existing attachment paths, metadata, Storage rules, CORS, download URLs
  - Cloud Functions triggered by tasks (notifications, counters, activity), callable functions, scheduled jobs
  - App Check and Auth
  - firebase.json, environments and deploy steps

**Rules:**
1. Produce a **current → target map** (keep / change / add) for every flow, field, collection, Storage path, rule and component. Keep existing names where they work and map this brief's names onto them.
2. Change only what this brief lists: section 4 bugs and section 5 function changes. Ask before anything else.
3. Existing data stays readable. No renamed fields, moved files or changed formats without a migration with a dry run, counts, my approval and a way back. Existing attachments keep their Storage paths.
4. Older app versions keep working. The current App Store build must still work against the updated backend until a minimum version is enforced. Say how in the plan.
5. Every security rule change gets emulator tests (allowed and denied). Every new query gets its index. Every task-triggered Cloud Function is checked.
6. Nothing goes to production without asking: rules, indexes, functions, migrations, CORS.

**Projects and Small works pages: only the Tasks tab content changes.**
- **Stays exactly as today:**
  - back link, header card (code, type, status, name, client and manager, Edit, Book labour), progress bar, header stats, tab buttons
  - every other tab, plus routing and permissions
- **Changes, inside the Tasks tab only:**
  - the heading with **New task**, the tabs with counts, the toolbar and the list
  - tasks open in the shared popup over the page
  - the header "Tasks" stat uses the same Active count
- **The gear icon** on today's project task cards keeps its action (find out what it is).
- **On iOS:** if project or small works screens show tasks, the same rule applies.

---

## 1. The non-negotiables

1. **Tasks is a shared platform feature.** iOS and web read and write the same task documents and the same files through the same server rules. Nothing about tasks is decided separately per platform.
2. **One rulebook.** `rules/tasks.rules.json` (section 9) defines statuses, actions, priorities, due-date wording, field order, limits, upload sources per platform, tabs, sorting and every message. Both apps render from it; the server enforces it. Nothing in it may be hard-coded in either app.
3. **One set of fixtures.** `rules/tasks.fixtures.json` (section 10) contains worked examples. **iOS unit tests and web unit tests both load that file and must pass every case.** This is how we prove the two platforms behave identically.
4. **Fixes ship first**, separately from the redesign.
5. **Light and dark mode.** Every task screen on both platforms works in Light, Dark and Match device, using the shared colour tokens in `rules/theme.tokens.json` (section 11b). No hex colours in screen code.

## 2. Ground rules

- Create branches `fix/tasks-upload-and-data` (Phase 2) and `feature/tasks-ui-upgrade` (Phases 3–5). Small commits, clear messages. Don't push or merge without asking.
- **No code changes until I approve your Phase 1 plan.** Ask again before running any data migration against production.
- Reuse existing components, styles, navigation, data access and error handling on each platform. The mockups show intent; where the app already has a component for the job, use it.
- **Only change behaviour listed in section 5 (function changes).** If something else needs changing, ask.
- Server checks are the real checks: Firestore security rules and/or Cloud Functions must enforce the rulebook on writes from both apps.
- Never store file contents in Firestore documents. Attachments are metadata only.
- Never put colour values in screen code. Use the theme tokens (section 11b), except the items listed in `fixedColours`.
- Don't touch unrelated features. List anything you notice elsewhere in the final report.
- If anything here conflicts with how the codebase works, stop and ask.

---

## 3. Phases

### Phase 1: Investigate and plan (read only)

Everything in section 0 first. Deliver:
- the confirmed current-flows list for iOS and web
- the current → target map
- the Firebase findings
- the other screens showing task data and how they count
- existing rulebooks and theme setup
- the old-app-version plan
- what the gear icon and Approvals do

Then:

1. Confirm the stack: Firestore, Firebase Storage, Cloud Functions, App Check, Auth; web framework; iOS framework (Swift/SwiftUI, React Native/Expo…); whether web and iOS share code; how config is shipped.
2. Map every tasks code path on both platforms:
   - web: main Tasks page, project Tasks tab, small works Tasks tab, task popup, new task form, edit form, complete step
   - iOS: list, task screen, edit, complete sheet, new task
3. Document the current task data shape (field names, status and priority values actually stored, checklist shape, attachment shape) and **count the legacy values in the data** (e.g. how many tasks have `medium`, `done`, no due date).
4. Find what "Approvals" on the main Tasks page covers and how it works. It must keep working.
5. Find what "Carry out" does today on each platform.
6. Write down current permissions (who can create, edit, delete, start, tick, complete, reopen) and compare with `permissions` in the rulebook. Report every difference. Don't apply the proposal without my approval.
7. **Diagnose Issue 1** (section 4) with evidence: reproduce on web with JPG, HEIC and PDF, with timings for each step; read Storage and Firestore rules; check App Check and bucket CORS; diff the web and iOS upload code (paths, metadata, content types, order of writes). Check iOS create and edit with attachments too. Report the real cause(s).
8. Propose how the rulebook gets to each platform (default in section 11) and how the server will enforce it (security rules vs Cloud Functions per action).
8b. Theme: check whether a theme system already exists on each platform (tokens, light/dark support, an Appearance setting). If `rules/theme.tokens.json` and its generator already exist (e.g. from the Insurance & accreditations work), reuse them. Otherwise plan the theme foundation in section 11b. Count hard-coded colours in the task screens.
9. Write the plan, per phase: files to add or change on web, iOS and backend; the migration (dry run first); the shared components on web (TaskTabs, ScopeSwitch, TaskToolbar, TaskRow, TaskGroup, TaskPopup with view/new/edit/complete modes, TaskForm, UploadList, AttachmentViewer); the iOS screens; how fixtures will be run in both test suites; anything I must do by hand (CORS, App Check, indexes, deploy steps); and every assumption.
10. **Stop and wait for my go-ahead.**

### Phase 2: Fixes (both platforms, own branch, ship before the redesign)

Implement section 4: the shared upload pipeline, camera removal on web, and bugs B3–B12. Any UI you add or change uses theme tokens (create `rules/theme.tokens.json` from section 11b if it doesn't exist yet) so it already works in both modes. Add the minimum of the rulebook needed (attachments, priorities, statuses, legacy maps). Write the migration script with a dry-run mode; show me the counts; run only when I say. Test with TEST_PLAN section A (summary in section 12). Commit, summarise, wait for me to confirm before Phase 3.

### Phase 3: Rulebook and fixtures everywhere

Add the full rulebook, schema, fixtures; deploy mechanism to `platformRulebooks/tasks`; loading, caching and bundled fallback in both apps; CI schema check, bundled-copy-matches check, and fixture tests in **both** test suites; server enforcement.

Theme foundation (skip what already exists): `rules/theme.tokens.json` + schema exactly as in section 11b; a generator that builds web CSS variables and iOS colour assets (Any/Dark) or a theme object from it; theme providers on both platforms; Settings › Appearance (Match device / Light / Dark, stored per device) behind feature flag `appearanceSettingEnabled` (default off); CI checks for schema, contrast pairs in both modes and generated files in sync. Convert the app shell (web sidebar, top bar, settings layout; iOS tab bar, nav bars, sheets) to tokens. Commit, summarise.

### Phase 4: Web UI upgrade

Build the web side of sections 5–8 using the shared components, on the main Tasks page, the project Tasks tab and the small works Tasks tab. One popup everywhere. On Projects and Small works, change only the Tasks tab content (section 0); attach before/after screenshots of the whole page to prove nothing else moved. Commit, summarise.

### Phase 5: iOS UI upgrade

Build the iOS side of sections 5–8, with **Edit task** as the main redesign, plus the list card, task screen, add people sheet, add attachment sheet, complete sheet. If Android shares the code, check it and note differences. Commit, summarise.

### Phase 6: Prove parity and report

Run the fixture tests on both platforms, TEST_PLAN sections B–I, the light/dark checks in section 11b, and the parity audit in section 11. Then the final report (section 13).

---

## 4. Fixes

### Issue 1: Web takes ages to save a task with a file attached, then doesn't save. Check iOS at the same time.

Seen: web New task with one photo stuck on "Saving…". iOS completing a task with a photo worked. iOS create and edit with attachments not yet checked.

Likely causes, most likely first (verify, don't assume):
1. Firebase Storage SDK retrying a failed upload (default `maxUploadRetryTime` is 10 minutes), which looks exactly like this.
2. Storage security rules rejecting the web upload (path, `contentType` missing or different, size rule, metadata iOS sends and web doesn't), with the error swallowed.
3. App Check enforced but not initialised or failing on web.
4. Bucket CORS missing the web app's domain.
5. File contents written into the Firestore document (1 MiB limit).
6. Full-size images uploaded one at a time; HEIC decoded on the main thread.
7. A promise in the save flow that never settles; no `finally` resetting state.

Required behaviour (both platforms, one pipeline; values from `attachments` in the rulebook):
1. Check type, size and count first, with rulebook messages.
2. Resize images to 2560 px long edge, JPEG quality 0.82. HEIC → JPEG (iOS natively; web in a lazy-loaded Web Worker, `wrongType` if it can't decode). PDFs unchanged.
3. Create the task ID before uploading; path `organisations/{orgId}/tasks/{taskId}/attachments/{attachmentId}.{ext}`.
4. Upload 3 in parallel, resumable, `contentType` set, per-file progress, overall progress on the Save button ("Uploading 1 of 3 · 57%").
5. SDK max upload retry 60 s; stall watchdog 45 s with no progress → cancel that file, show `uploadStalled` with Retry and Remove.
6. When all files are up, one Firestore write/batch for the task with attachment metadata only.
7. Every path settles: success or a clear rulebook error; `finally` resets state; map Storage/Firestore/App Check error codes to `copy.errors`.
8. Cancel during upload stops uploads and deletes uploaded objects. Scheduled function deletes orphan objects under task paths with no task document after 24 h.
9. iOS uses identical paths, metadata and sizes; files from either platform open on the other.
10. Targets: no files < 1.5 s to close; three phone photos < 10 s on office broadband/4G.

### Issue 2: No camera button on web

Attachment sources come from `attachments.sources`: iOS/Android camera, library, files, site_audit; web files, site_audit ("Upload files", "Site audit"). Remove the web Camera button from new, edit and complete/proof of work, and remove any `capture` attribute from web file inputs. (Phone browsers already offer "Take photo" in the system picker.)

### Other bugs (found in screenshots and the recording)

| # | Bug | Fix |
|---|---|---|
| B3 | Web Edit task shows the "Create a new task" banner | Remove it in both modes |
| B4 | Web Edit task shows ticked checklist items as unticked; saving may wipe progress | Load and keep each item's done/doneBy/doneAt on both platforms |
| B5 | Priority Normal vs Medium across screens | Low/Normal/High/Urgent; map and migrate `medium` → `normal` |
| B6 | Done vs Completed | Completed; map `done` |
| B7 | iOS Edit can set Completed directly | Edit offers To do / In progress only |
| B8 | iOS opens attachments in Safari at a raw Storage URL | In-app viewer |
| B9 | Managers land on an empty "Assigned to me" | Default scope by role |
| B10 | Web requires due date, iOS has tasks with none | Required for new; old ones show "No due date", sort last, Edit asks for one |
| B11 | "Deleted user" assignee, no way forward | "Removed user" + reassign prompt for managers |
| B12 | Two primary blues on web (`#3D4FD8` vs `#1D5AA8`) | `primary.bg` token in all task screens (`#3D4FD8` in light mode) |

Security note for the report only (don't change now): Firebase download URLs are permanent bearer links; review whether task attachments should use short-lived links.

---

## 5. Function changes (implement on both platforms; nothing else changes without asking)

| # | Before | After |
|---|---|---|
| F1 | "Carry out" | **Start** (To do → In progress, one tap) and **Complete** (opens the complete step). Map whatever Carry out does today onto one of these |
| F2 | Complete step: disabled "Save" / "Save & mark complete" | **Save progress** (always on; keeps ticks, photos, notes) + **Complete task** (on when every checklist item is ticked), hint "Tick 2 more to complete" |
| F3 | Edit can set Completed | Edit: To do / In progress only; Completed shown disabled with hint. Completed tasks get **Reopen** (→ In progress) |
| F4 | Everyone starts on "Assigned to me" | Default scope by role (operative: My tasks; manager/admin: Everyone); remember last choice per device |
| F5 | Stat cards that also filter and overlap; different names per screen | **Tabs with counts**: Active, Overdue, Completed, Approvals (hidden at 0), plus **My tasks / Everyone**. Same everywhere |
| F6 | Overdue worked out per screen | Due date before today **in the organisation's time zone**, not completed; no due date = never overdue |
| F7 | Medium/Normal | Low / Normal / High / Urgent |
| F8 | Done/Completed | To do / In progress / Completed |
| F9 | Myself/Manager/Operatives tiles + separate picker (web); three rows (iOS) | **Assign to**: person chips, **Me**, **Add people** picker (search, Managers/Operatives, trade filter, mixing allowed) |
| F10 | Separate upload code | Shared pipeline (section 4) |
| F11 | Popup on some web pages, full-height window for new/edit | **One web popup** (view/new/edit/complete) on the main page, Projects and Small works. Never navigates away. URL `?task={id}` (+ `&mode=edit`/`complete`, `?task=new`); Back closes; full screen under 640 px |
| F12 | Location implied | **Project or small works** required on the main page; filled and locked from a project/small works page |
| F13 | iOS Edit can't change attachments | Add/remove in Edit |
| F14 | Ticking only in the complete step | Tick from the task view too; saves immediately with who/when |
| F15 | Delete beside Complete/Edit | Web: left of the Edit footer + row ⋯ menu. iOS: bottom of Edit + ⋯ menu. Always confirmed |
| F16 | Camera on web | Removed |
| F17 | iOS opens Safari; "Report a problem with this file" under every web thumbnail | In-app viewer both platforms; Report a problem in the viewer's ⋯ |
| F18 | Varies | Active: overdue first, due date ascending, priority high first, title; no due date last. Completed: newest completion first |
| F19 | Varies | Main page grouped by project/small works (type badge, code, name, count, Open link); location tabs flat |
| F20 | "Due 27 Jun 2026" / "70 days ago" | Words first, date second: "70 days overdue / 15 Sep 2026", "Due today", "Due Thu", "Due 2 Dec / in 8 days" |
| F21 | Due date required on web only | Required for new tasks on both |
| F22 | "Deleted user" | "Removed user" + reassign prompt |
| F23 | Banner in form | Removed; title says New task / Edit task |
| F24 | Cancel discards silently | "Discard changes?" when there are changes |
| F25 | iOS complete step turns a task with no checklist into a one-item checklist made from its title | No checklist section when the task has none |

---

## 6. Flows

**Tasks list** (main page, project tab, small works tab; web and iOS): header + New task → tabs with counts → My tasks/Everyone + search + filters (location filter on main page only) → list sorted per F18, grouped per F19. Each task: status circle (tap = main action), title, checklist x/y, file count, status word, assignees, due in words, priority, one main button, ⋯. Project header "Tasks" count = that project's Active count.

**New task** field order (`formOrder`): Task (name + details) → Project or small works → Assign to → Due date + Priority (side by side on web) → Checklist → Attachments. Footer: Cancel · Create task. Missing fields show their own message on Create. Closes when saved; toast "Task created".

**View** order: title → location link → chips (status, priority, due) → Assigned to → Details → Checklist (tickable) → Attachments (viewer) → Completion (if completed) → Activity. Actions: main action, Edit, ⋯ (Copy link, Open project/small works, Delete task).

**Edit**: same form and order + Status (To do / In progress). Location locked. Ticks kept; items add/reorder/remove; manager can untick. Attachments add/remove. Footer: Delete task (left) · Cancel · Save changes. Conflict check on save.

**Complete**: Checklist (must all be ticked; hidden if none) → Proof of work (optional; iOS camera/library/files, web upload files) → Notes for the manager (optional) → hint · Save progress · Complete task.

**Start / Reopen / Delete**: one tap / one tap / confirmation that says it's removed for everyone on iOS and web (files deleted too).

---

## 7. Web UI requirements

Light mode keeps today's look (navy sidebar, light grey page, white cards); dark mode is new. All colours from tokens (section 11b): sidebar `brand.navy` (navy in both modes), page `bg.page`, cards/rows/popup `bg.surface` + `border.default`, dividers `border.subtle`, hover/footers `bg.surfaceSubtle`, inputs `bg.input` + `border.strong`, text `text.primary/secondary/tertiary`, links `text.link`, primary buttons `primary.bg`/`primary.fg` (the only primary in task screens; `#3D4FD8` in light), selected tabs `primary.soft`/`primary.softFg`, chips `tone.*.fg` on `tone.*.bg`, row edges `tone.red.rail`/`tone.amber.rail`, ticks `tone.green.solid`, dimming `overlay.scrim`, focus `focus.ring`.

**Bigger text (the main complaint):** page title 28/700, popup title 22/700, group header 17/600, task title 15.5/600, inputs 15, buttons 14.5/600, labels 14.5/600 in sentence case (no tiny uppercase labels), meta and chips 13–13.5. **Nothing below 13 px.**

**Sizes:** buttons 40 px (34 px in rows), icon buttons 36 px, **popup close button 40 × 40 with a 20 px icon**, inputs 44 px (task name 50 px), rows ~64 px, whole row clickable with keyboard focus.

**Components (build once, use on all three pages):** TaskTabs, ScopeSwitch, TaskToolbar, TaskGroup, TaskRow (status circle · title + meta · avatars · due words/date · priority chip · main button · ⋯; 4 px red left edge for overdue, amber for due today/soon), TaskPopup (760 px, sticky header/footer, body scrolls, focus trap, Esc, URL param, full screen < 640 px), TaskForm, People picker popover, UploadList, AttachmentViewer, ConfirmDialog.

**Project › Tasks and Small works › Tasks:** only the Tasks tab content changes. Header card, Edit, Book labour, progress, header stats, tab buttons and every other tab stay exactly as today. Inside the Tasks tab: "Tasks" heading with **New task** (not "+ Tasks"), then the same tabs, toolbar and a flat list. Counts are for that location; the header "Tasks" stat shows the same Active count.

## 8. iOS UI requirements

Dark mode keeps today's look; light mode is new. All colours from tokens (section 11b): navy grid header band `brand.navyHeader` (navy in both modes, with on-navy controls), sheets `bg.page`, groups `bg.group`, cards `bg.surface` + `border.default`, primary pills `primary.bg`/`primary.fg`, chips `tone.*`. Use colour assets with Any/Dark appearances (or the generated theme object). Status bar, keyboard, date picker, share sheet and Quick Look must follow the chosen mode.

- **List:** nav bar Done · Tasks · +; My tasks/Everyone switch; tab pills with counts; search. Remove the stat row. Card: status circle, title 17.5 semibold, location, meta (checklist, files, status word), priority chip top right, bottom row avatars · due words · main action pill.
- **Task screen:** same order as web; tickable checklist; Quick Look for files; Edit and Complete fixed at the bottom; ⋯ for Copy link, Open project, Delete task.
- **Edit task (main redesign):** sheet styled like Company details; navy header with Cancel pill and centred "Edit task" + location; **one** full-width "Save changes" at the bottom (above the keyboard), no second Save at the top; sentence-case 15 px section labels; task name 19 px semibold with details in the same group; locked location row with lock icon; people chips + Me + Add people; "Due date" (not "Schedule") row with weekday and date pill; 4 priority buttons with coloured dots; checklist with ticks kept, drag to reorder, swipe to delete, Add item, item notes only when added; attachments thumbnails with remove + add tile; Status To do / In progress with Completed disabled + hint; Delete task as a red row at the very bottom; keyboard dismiss on scroll, Return to next field; Discard changes? on Cancel.
- **Add people sheet:** Done, search, Managers/Operatives, trade chips, tick circles, "n selected".
- **Add attachment sheet:** Take photo, Photo library, Files, Site audit + limits line.
- **Complete sheet:** checklist with progress, proof tiles (Take photo, Photo library, Files), notes, Save progress + Complete task with hint.
- **Saving:** per-file rows, progress in the Save button, Retry on a stalled file.

---

## 9. The rulebook — create `rules/tasks.rules.json` exactly

Also create a JSON Schema for it (CI). The schema must reject `camera` in `attachments.sources.web`. Every label, option, limit and message below is read from this file by both apps; `permissions` is a proposal to confirm in Phase 1.

```json
{
  "rulebookKey": "tasks",
  "rulebookVersion": 1,
  "updatedAt": "2026-11-24",

  "statuses": [
    { "key": "to_do", "label": "To do", "tone": "grey" },
    { "key": "in_progress", "label": "In progress", "tone": "blue" },
    { "key": "completed", "label": "Completed", "tone": "green" }
  ],
  "legacyStatusMap": { "todo": "to_do", "inprogress": "in_progress", "done": "completed" },

  "actions": {
    "start": { "label": "Start", "from": ["to_do"], "to": "in_progress", "opensCompleteStep": false },
    "complete": { "label": "Complete", "from": ["to_do", "in_progress"], "to": "completed", "opensCompleteStep": true },
    "reopen": { "label": "Reopen", "from": ["completed"], "to": "in_progress", "opensCompleteStep": false }
  },
  "editFormStatuses": ["to_do", "in_progress"],

  "priorities": [
    { "key": "low", "label": "Low", "tone": "grey", "rank": 1 },
    { "key": "normal", "label": "Normal", "tone": "blue", "rank": 2, "default": true },
    { "key": "high", "label": "High", "tone": "amber", "rank": 3 },
    { "key": "urgent", "label": "Urgent", "tone": "red", "rank": 4 }
  ],
  "legacyPriorityMap": { "medium": "normal" },

  "due": {
    "requiredForNewTasks": true,
    "dueSoonDays": 3,
    "timezone": "organisation",
    "dateFormat": "d MMM yyyy",
    "shortDateFormat": "d MMM",
    "labels": {
      "overdue": "{days} days overdue",
      "overdueOne": "1 day overdue",
      "today": "Due today",
      "tomorrow": "Due tomorrow",
      "soon": "Due {weekday}",
      "later": "Due {shortDate}",
      "completed": "Completed {shortDate}",
      "none": "No due date"
    }
  },

  "fields": {
    "title": { "kind": "text", "label": "Task", "required": true, "maxLength": 120, "placeholder": "What needs doing? e.g. Replace fuse board" },
    "description": { "kind": "longtext", "label": "Details", "required": false, "maxLength": 2000, "placeholder": "Anything the team needs to know first" },
    "location": { "kind": "location", "label": "Project or small works", "required": true, "lockedWhenOpenedFromLocation": true },
    "assignees": { "kind": "people", "label": "Assign to", "required": true, "min": 1, "max": 20, "quickPickMe": true, "groups": ["managers", "operatives"], "tradeFilter": true },
    "due_date": { "kind": "date", "label": "Due date", "required": true },
    "priority": { "kind": "priority", "label": "Priority", "required": true },
    "checklist": { "kind": "checklist", "label": "Checklist", "required": false, "maxItems": 30, "itemMaxLength": 120, "noteMaxLength": 300, "helper": "Assignees tick every item before they can complete the task." },
    "attachments": { "kind": "attachments", "label": "Attachments", "required": false },
    "status": { "kind": "status", "label": "Status", "required": true, "editOnly": true }
  },
  "formOrder": ["title", "description", "location", "assignees", "due_date", "priority", "checklist", "attachments", "status"],

  "attachments": {
    "maxFiles": 10,
    "maxSizeMb": 10,
    "accepted": [
      { "mime": "image/jpeg", "extensions": ["jpg", "jpeg"], "label": "JPG" },
      { "mime": "image/png", "extensions": ["png"], "label": "PNG" },
      { "mime": "image/webp", "extensions": ["webp"], "label": "WebP" },
      { "mime": "image/heic", "extensions": ["heic", "heif"], "label": "HEIC", "storeAs": "image/jpeg" },
      { "mime": "application/pdf", "extensions": ["pdf"], "label": "PDF" }
    ],
    "image": { "maxLongEdgePx": 2560, "jpegQuality": 0.82, "stripLocation": false },
    "upload": { "parallel": 3, "stallTimeoutSeconds": 45, "maxRetries": 2, "sdkMaxUploadRetrySeconds": 60 },
    "storagePath": "organisations/{orgId}/tasks/{taskId}/attachments/{attachmentId}.{ext}",
    "sources": {
      "ios": ["camera", "library", "files", "site_audit"],
      "android": ["camera", "library", "files", "site_audit"],
      "web": ["files", "site_audit"]
    },
    "sourceLabels": {
      "camera": "Take photo",
      "library": "Photo library",
      "files": "Files",
      "files_web": "Upload files",
      "site_audit": "Site audit"
    }
  },

  "completeStep": {
    "checklistMustBeComplete": true,
    "proofOfWork": { "required": false, "label": "Proof of work" },
    "notes": { "required": false, "label": "Notes for the manager", "maxLength": 2000, "placeholder": "Anything the manager should know about how the job went" },
    "allowSaveProgress": true
  },

  "views": {
    "scopes": [
      { "key": "mine", "label": "My tasks" },
      { "key": "everyone", "label": "Everyone", "managersOnly": true }
    ],
    "defaultScope": { "operative": "mine", "manager": "everyone", "admin": "everyone" },
    "tabs": [
      { "key": "active", "label": "Active", "statuses": ["to_do", "in_progress"] },
      { "key": "overdue", "label": "Overdue", "statuses": ["to_do", "in_progress"], "overdueOnly": true },
      { "key": "completed", "label": "Completed", "statuses": ["completed"] },
      { "key": "approvals", "label": "Approvals", "source": "existing-approvals", "hideWhenZero": true }
    ],
    "defaultTab": "active",
    "groupBy": { "main": "location", "project": "none", "small_works": "none" },
    "sortActive": ["overdue_first", "due_date_asc", "priority_desc", "title_asc"],
    "sortCompleted": ["completed_at_desc"],
    "pageSize": 50,
    "locationHeaderCount": "active"
  },

  "copy": {
    "page": {
      "title": "Tasks",
      "subtitle": "Work across your projects and small works",
      "newTask": "New task",
      "searchPlaceholder": "Search tasks, projects or people"
    },
    "list": {
      "checklistProgress": "{done}/{total}",
      "noChecklist": "No checklist",
      "attachmentsCount": "{count}",
      "overdueBanner": "{count} overdue",
      "showOverdue": "Show overdue"
    },
    "empty": {
      "active_mine": { "title": "Nothing assigned to you", "body": "Tasks assigned to you will show here." },
      "active_everyone": { "title": "No active tasks", "body": "Create a task to get work moving." },
      "overdue": { "title": "Nothing overdue", "body": "Every active task is on time." },
      "completed": { "title": "No completed tasks yet", "body": "Completed tasks show here with who finished them." },
      "search": { "title": "No tasks match \"{query}\"", "body": "Try a different word or clear the filters." }
    },
    "form": {
      "titleNew": "New task",
      "titleEdit": "Edit task",
      "create": "Create task",
      "save": "Save changes",
      "cancel": "Cancel",
      "me": "Me",
      "addPeople": "Add people",
      "addChecklistItem": "Add item",
      "addNote": "Add note",
      "statusCompletedHint": "To complete a task, use Complete so the checklist and proof of work are captured.",
      "unsavedTitle": "Discard changes?",
      "unsavedBody": "Your changes to this task haven’t been saved.",
      "discard": "Discard"
    },
    "attachments": {
      "help": "Photos ({imageTypes}) or PDF, up to {maxSizeMb} MB each, {maxFiles} files max",
      "dropHint": "Drag photos or PDFs here",
      "preparing": "Preparing {name}",
      "uploading": "Uploading {done} of {total} · {percent}%",
      "failed": "{name} didn’t upload",
      "retry": "Retry",
      "remove": "Remove",
      "reportProblem": "Report a problem with this file"
    },
    "detail": {
      "assigned": "Assigned to",
      "createdBy": "Created by {name} · {date}",
      "completedBy": "Completed by {name} · {date}",
      "activity": "Activity",
      "edit": "Edit",
      "delete": "Delete task",
      "copyLink": "Copy link",
      "openLocation": "Open {locationType}"
    },
    "complete": {
      "title": "Complete task",
      "checklistRemaining": "Tick {count} more to complete",
      "checklistRemainingOne": "Tick 1 more to complete",
      "saveProgress": "Save progress",
      "confirm": "Complete task",
      "back": "Back"
    },
    "delete": {
      "title": "Delete {title}?",
      "body": "This removes the task, its checklist and attachments for everyone on iOS and web.",
      "confirm": "Delete"
    },
    "toasts": {
      "created": "Task created",
      "saved": "Changes saved",
      "started": "Task started",
      "completed": "Task completed",
      "reopened": "Task reopened",
      "deleted": "Task deleted",
      "progressSaved": "Progress saved",
      "linkCopied": "Link copied"
    },
    "errors": {
      "titleRequired": "Add a task name.",
      "locationRequired": "Choose a project or small works.",
      "assigneeRequired": "Assign at least one person.",
      "dueRequired": "Pick a due date.",
      "tooBig": "{name} is {size}. The limit is {maxSizeMb} MB.",
      "wrongType": "{name} can’t be attached. Use a photo or PDF.",
      "tooMany": "You can attach up to {maxFiles} files.",
      "uploadStalled": "{name} stopped uploading. Check your connection and retry.",
      "saveFailed": "The task wasn’t saved. Check your connection and try again.",
      "conflict": "{name} changed this task on another device. Reload to see the latest.",
      "noAccess": "You don’t have access to this task."
    }
  },

  "permissions": {
    "_status": "PROPOSAL: Claude Code must compare with current behaviour in Phase 1 and report differences before applying",
    "view": ["admin", "manager", "assignee"],
    "create": ["admin", "manager"],
    "edit": ["admin", "manager", "creator"],
    "delete": ["admin", "manager", "creator"],
    "start": ["admin", "manager", "assignee"],
    "tickChecklist": ["admin", "manager", "assignee"],
    "complete": ["admin", "manager", "assignee"],
    "reopen": ["admin", "manager", "creator"]
  }
}
```

## 10. The fixtures — create `rules/tasks.fixtures.json` exactly

Both iOS and web unit tests load this file and must pass every case. "Today" is fixed at 2026-11-24 in the organisation time zone Europe/London; inject the clock and time zone in tests.

```json
{
  "_about": "Shared test cases for the tasks rulebook. iOS and web unit tests both load this file and must produce exactly these results. If either platform disagrees, it's a bug in that platform, not in this file.",
  "rulebookVersion": 1,
  "today": "2026-11-24",
  "timezone": "Europe/London",

  "dueLabels": [
    { "name": "70 days overdue", "status": "to_do", "due": "2026-09-15", "expect": { "label": "70 days overdue", "tone": "red", "overdue": true } },
    { "name": "1 day overdue", "status": "in_progress", "due": "2026-11-23", "expect": { "label": "1 day overdue", "tone": "red", "overdue": true } },
    { "name": "due today", "status": "to_do", "due": "2026-11-24", "expect": { "label": "Due today", "tone": "amber", "overdue": false } },
    { "name": "due tomorrow", "status": "to_do", "due": "2026-11-25", "expect": { "label": "Due tomorrow", "tone": "amber", "overdue": false } },
    { "name": "due in 2 days shows weekday", "status": "to_do", "due": "2026-11-26", "expect": { "label": "Due Thu", "tone": "amber", "overdue": false } },
    { "name": "due in 3 days shows weekday", "status": "to_do", "due": "2026-11-27", "expect": { "label": "Due Fri", "tone": "amber", "overdue": false } },
    { "name": "due in 4 days shows date", "status": "to_do", "due": "2026-11-28", "expect": { "label": "Due 28 Nov", "tone": "grey", "overdue": false } },
    { "name": "no due date", "status": "to_do", "due": null, "expect": { "label": "No due date", "tone": "grey", "overdue": false } },
    { "name": "completed ignores due date", "status": "completed", "due": "2026-09-15", "completedAt": "2026-11-20T15:04:00Z", "expect": { "label": "Completed 20 Nov", "tone": "grey", "overdue": false } },
    { "name": "device in another time zone still uses the UK date", "status": "to_do", "due": "2026-11-24", "now": "2026-11-24T23:30:00-08:00", "expect": { "label": "1 day overdue", "tone": "red", "overdue": true } }
  ],

  "tabs": [
    { "name": "to do and overdue", "status": "to_do", "due": "2026-09-15", "expect": ["active", "overdue"] },
    { "name": "in progress not overdue", "status": "in_progress", "due": "2026-12-02", "expect": ["active"] },
    { "name": "completed", "status": "completed", "due": "2026-09-15", "expect": ["completed"] },
    { "name": "no due date never overdue", "status": "to_do", "due": null, "expect": ["active"] }
  ],

  "legacyValues": [
    { "field": "priority", "stored": "medium", "expect": "normal" },
    { "field": "priority", "stored": "Normal", "expect": "normal" },
    { "field": "priority", "stored": "URGENT", "expect": "urgent" },
    { "field": "status", "stored": "done", "expect": "completed" },
    { "field": "status", "stored": "todo", "expect": "to_do" },
    { "field": "status", "stored": "inprogress", "expect": "in_progress" }
  ],

  "actions": [
    { "status": "to_do", "expectPrimary": "start", "expectAvailable": ["start", "complete"] },
    { "status": "in_progress", "expectPrimary": "complete", "expectAvailable": ["complete"] },
    { "status": "completed", "expectPrimary": "reopen", "expectAvailable": ["reopen"] }
  ],

  "editForm": {
    "expectStatusOptions": ["to_do", "in_progress"],
    "expectCompletedSelectable": false
  },

  "completeStep": [
    { "checklist": [true, true, false], "expect": { "completeEnabled": false, "saveProgressEnabled": true, "hint": "Tick 1 more to complete" } },
    { "checklist": [true, false, false], "expect": { "completeEnabled": false, "saveProgressEnabled": true, "hint": "Tick 2 more to complete" } },
    { "checklist": [true, true], "expect": { "completeEnabled": true, "saveProgressEnabled": true, "hint": null } },
    { "checklist": [], "expect": { "completeEnabled": true, "saveProgressEnabled": true, "hint": null } }
  ],

  "attachmentSources": {
    "ios": ["camera", "library", "files", "site_audit"],
    "web": ["files", "site_audit"]
  },

  "attachmentValidation": [
    { "name": "photo ok", "mime": "image/jpeg", "sizeMb": 4.2, "expect": "ok" },
    { "name": "heic converted", "mime": "image/heic", "sizeMb": 3.1, "expect": "ok", "expectStoredMime": "image/jpeg" },
    { "name": "pdf ok", "mime": "application/pdf", "sizeMb": 2, "expect": "ok" },
    { "name": "too big after resize", "mime": "application/pdf", "sizeMb": 14, "expect": "tooBig" },
    { "name": "wrong type", "mime": "application/zip", "sizeMb": 1, "expect": "wrongType" },
    { "name": "eleventh file", "mime": "image/jpeg", "sizeMb": 1, "existingFiles": 10, "expect": "tooMany" }
  ],

  "sortActive": {
    "input": [
      { "id": "a", "status": "to_do", "due": "2026-12-02", "priority": "high", "title": "Commission BMS points" },
      { "id": "b", "status": "in_progress", "due": "2026-09-15", "priority": "urgent", "title": "Replace distribution board DB-2" },
      { "id": "c", "status": "to_do", "due": null, "priority": "urgent", "title": "Check riser labels" },
      { "id": "d", "status": "to_do", "due": "2026-06-27", "priority": "high", "title": "Install 12 m gutter at rear" },
      { "id": "e", "status": "to_do", "due": "2026-12-02", "priority": "low", "title": "Bag up offcuts" },
      { "id": "f", "status": "in_progress", "due": "2026-11-24", "priority": "normal", "title": "Lighting adaptations, level 2" }
    ],
    "expectOrder": ["d", "b", "f", "a", "e", "c"],
    "_why": "Overdue first (oldest due date first), then due date ascending, then higher priority first, then title. No due date goes last."
  },

  "defaultScope": [
    { "role": "operative", "expect": "mine" },
    { "role": "manager", "expect": "everyone" },
    { "role": "admin", "expect": "everyone" }
  ]
}
```

## 11. Shared rulebook mechanism (Firebase)

- Edit only `rules/tasks.rules.json` in git. CI: schema validation, fixtures on both platforms, bundled copies match the git file.
- Deploy script writes `platformRulebooks/tasks` in Firestore `{version, body, updatedAt}` only when `rulebookVersion` is higher. Readable by signed-in users, writable only by the deploy service account.
- Both apps read it on launch/page open, cache it, fall back to a bundled copy (copied in by a build script, never by hand).
- Server enforcement: Firestore security rules check allowed status/priority keys, required fields, lengths, server-only fields untouched and organisation match; Cloud Functions (or rules comparing `request.resource` to `resource`) enforce transitions (Edit can't set Completed; Completed only via completeTask with the checklist complete), attachment counts and permissions.
- Legacy values: both apps read through `legacyPriorityMap` / `legacyStatusMap`; one-off migration (dry run, counts, approval, run).
- Clients write `rulebookVersion` on documents they change.
- **Change rules:** labels, wording, limits, reordering, new options of existing kinds → no app release. New field kinds or behaviours → app release on both, app support first. Never delete a key stored data uses.
- **Parity audit (Phase 6):** validate rulebook; compare Firestore copy with git; search both codebases for hard-coded task labels, limits, sources and messages; run fixtures on both; compare data each platform writes (fields, formats, storage paths, metadata); list what the server enforces vs only the apps; check platform differences are declared in the rulebook only. Report as a table: area, iOS, web, server, match/mismatch/missing, fix.

## 11b. Light and dark mode — create `rules/theme.tokens.json` exactly (if it doesn't already exist)

Decisions: default **Match device**; Settings › Appearance offers Match device / Light / Dark, **stored per device**, applied instantly (web: set `data-theme` on `<html>` in an inline `<head>` script so there's no white flash; iOS: interface style override). Navy brand elements (web sidebar, iOS header band, project header card, public pages) stay navy in both modes. Photos, previews and PDFs are never tinted. Avatar colours and gradient icon tiles are fixed.

Rollout without a half-light, half-dark app: today web is light-only and iOS dark-only. Keep the Appearance setting behind `appearanceSettingEnabled` (default off) until every screen on that platform uses tokens; until then web stays light and iOS stays dark for users. Everything in this work must already be mode-ready. Report the remaining unconverted screens per platform (a separate rollout will convert them).

Tokens are **built in at build time** (generated web CSS variables; iOS colour assets with Any/Dark, or a theme object), not fetched at runtime. CI: schema valid, every token has both modes, every `contrastPairs` entry reaches its minimum in both modes (all 46 currently pass), generated files match the JSON.

Create `rules/theme.tokens.schema.json` too (both modes required for every token).

```json
{
  "tokensKey": "theme",
  "version": 1,
  "updatedAt": "2026-11-24",

  "appearance": {
    "options": ["system", "light", "dark"],
    "labels": { "system": "Match device", "light": "Light", "dark": "Dark" },
    "default": "system",
    "scope": "device",
    "settingLocation": "Settings › Appearance",
    "note": "Stored on the device, not the account, so a phone can be dark while the office PC is light. Applies instantly, no restart."
  },

  "color": {
    "bg.page":            { "light": "#F7F8FA", "dark": "#000000", "use": "Page / sheet background behind cards" },
    "bg.surface":         { "light": "#FFFFFF", "dark": "#141B29", "use": "Cards, popups, panels, table rows" },
    "bg.surfaceSubtle":   { "light": "#F4F6FA", "dark": "#1A2233", "use": "Row hover, popup footer, drop zones" },
    "bg.group":           { "light": "#FFFFFF", "dark": "#1C1C1E", "use": "iOS grouped lists and form groups" },
    "bg.input":           { "light": "#FFFFFF", "dark": "#2C2C2E", "use": "Text inputs, selects, segmented controls (iOS dark uses the system grey)" },
    "bg.inputMuted":      { "light": "#EEF0F4", "dark": "#1F2635", "use": "Locked/read-only fields, segmented control track" },

    "border.default":     { "light": "#E3E7EE", "dark": "#283247", "use": "Card and panel borders" },
    "border.subtle":      { "light": "#EEF1F5", "dark": "#1F2839", "use": "Dividers inside cards and lists" },
    "border.strong":      { "light": "#C9D0DB", "dark": "#3A4560", "use": "Input borders, dashed drop zones, unticked checkboxes" },

    "text.primary":       { "light": "#101828", "dark": "#FFFFFF", "use": "Titles, body" },
    "text.secondary":     { "light": "#475467", "dark": "#B4BCC9", "use": "Descriptions, labels" },
    "text.tertiary":      { "light": "#5F6B7C", "dark": "#98A2B3", "use": "Meta, helper text, placeholders (min 13 px)" },
    "text.link":          { "light": "#3D4FD8", "dark": "#7FA2FF", "use": "Links, text buttons" },

    "primary.bg":         { "light": "#3D4FD8", "dark": "#6B93FF", "use": "Primary buttons" },
    "primary.bgHover":    { "light": "#3443C2", "dark": "#85A6FF", "use": "Primary hover/pressed" },
    "primary.fg":         { "light": "#FFFFFF", "dark": "#0B1530", "use": "Text/icons on primary buttons" },
    "primary.soft":       { "light": "#ECEEFD", "dark": "#1F2E5C", "use": "Selected tab/option background" },
    "primary.softFg":     { "light": "#3443C2", "dark": "#CFDCFF", "use": "Text on primary.soft" },

    "secondary.bg":       { "light": "#FFFFFF", "dark": "#222A39", "use": "Secondary buttons" },
    "secondary.fg":       { "light": "#101828", "dark": "#DCE1EA", "use": "Text on secondary buttons" },

    "brand.navy":         { "light": "#0A1530", "dark": "#0A1530", "use": "Web sidebar, project header card. Same in both modes" },
    "brand.navyHeader":   { "light": "#101A2B", "dark": "#101A2B", "use": "iOS navy grid header band. Same in both modes" },
    "brand.navyRaised":   { "light": "#1B263F", "dark": "#1B263F", "use": "Selected item on navy" },
    "brand.navyFg":       { "light": "#FFFFFF", "dark": "#FFFFFF", "use": "Text on navy" },
    "brand.navyFgMuted":  { "light": "#C6CFDF", "dark": "#C6CFDF", "use": "Secondary text on navy" },
    "brand.navyGrid":     { "light": "rgba(255,255,255,0.035)", "dark": "rgba(255,255,255,0.035)", "use": "Grid lines on navy" },

    "tone.red.fg":        { "light": "#B42318", "dark": "#FF7A7A" },
    "tone.red.bg":        { "light": "#FDECEC", "dark": "#3B1518" },
    "tone.amber.fg":      { "light": "#8A4B05", "dark": "#F5B83D" },
    "tone.amber.bg":      { "light": "#FFF2D9", "dark": "#3A2A0C" },
    "tone.green.fg":      { "light": "#0F6B4A", "dark": "#34D27B" },
    "tone.green.bg":      { "light": "#E1F3EA", "dark": "#11301E" },
    "tone.blue.fg":       { "light": "#2C50CC", "dark": "#8FB0FF" },
    "tone.blue.bg":       { "light": "#E8EDFD", "dark": "#18284F" },
    "tone.grey.fg":       { "light": "#475467", "dark": "#AEB5C1" },
    "tone.grey.bg":       { "light": "#EEF0F4", "dark": "#222A38" },
    "tone.teal.fg":       { "light": "#0E6B63", "dark": "#35D5C1" },
    "tone.teal.bg":       { "light": "#DDF4F1", "dark": "#113634" },
    "tone.purple.fg":     { "light": "#5B45C8", "dark": "#A690FF" },
    "tone.purple.bg":     { "light": "#EEEAFE", "dark": "#272150" },

    "tone.red.solid":     { "light": "#D92D20", "dark": "#E5484D", "use": "Destructive buttons (white text)" },
    "tone.red.rail":      { "light": "#E06363", "dark": "#E06363", "use": "Overdue left edge" },
    "tone.amber.rail":    { "light": "#E7A93A", "dark": "#E7A93A", "use": "Due-soon left edge" },
    "tone.green.solid":   { "light": "#12805C", "dark": "#34D27B", "use": "Ticked checkbox fill" },
    "tone.green.solidFg": { "light": "#FFFFFF", "dark": "#06210F", "use": "Tick on green.solid" },

    "overlay.scrim":      { "light": "rgba(10,18,36,0.48)", "dark": "rgba(0,0,0,0.62)", "use": "Behind popups and sheets" },
    "focus.ring":         { "light": "#7C8AF0", "dark": "#9DB6FF", "use": "Keyboard focus outline (3 px)" },
    "shadow.popup":       { "light": "0 30px 80px rgba(10,18,36,0.35)", "dark": "0 30px 80px rgba(0,0,0,0.7)" }
  },

  "fixedColours": {
    "note": "These do NOT change with mode, on purpose.",
    "items": [
      "Avatar colours (white initials on a per-person colour)",
      "Gradient icon tiles in settings and quick actions",
      "Photos, certificate and document previews (paper stays white)",
      "brand.* navy elements (web sidebar, iOS header band, project header card)",
      "Priority and status dots inside chips (they use the tone fg colour of the current mode)"
    ]
  },

  "contrastPairs": [
    { "fg": "text.primary", "bg": "bg.surface", "min": 4.5 },
    { "fg": "text.primary", "bg": "bg.page", "min": 4.5 },
    { "fg": "text.secondary", "bg": "bg.surface", "min": 4.5 },
    { "fg": "text.tertiary", "bg": "bg.surface", "min": 4.5 },
    { "fg": "text.tertiary", "bg": "bg.page", "min": 4.5 },
    { "fg": "text.secondary", "bg": "bg.group", "min": 4.5 },
    { "fg": "text.link", "bg": "bg.surface", "min": 4.5 },
    { "fg": "primary.fg", "bg": "primary.bg", "min": 4.5 },
    { "fg": "primary.softFg", "bg": "primary.soft", "min": 4.5 },
    { "fg": "secondary.fg", "bg": "secondary.bg", "min": 4.5 },
    { "fg": "brand.navyFg", "bg": "brand.navy", "min": 4.5 },
    { "fg": "brand.navyFgMuted", "bg": "brand.navy", "min": 4.5 },
    { "fg": "tone.red.fg", "bg": "tone.red.bg", "min": 4.5 },
    { "fg": "tone.amber.fg", "bg": "tone.amber.bg", "min": 4.5 },
    { "fg": "tone.green.fg", "bg": "tone.green.bg", "min": 4.5 },
    { "fg": "tone.blue.fg", "bg": "tone.blue.bg", "min": 4.5 },
    { "fg": "tone.grey.fg", "bg": "tone.grey.bg", "min": 4.5 },
    { "fg": "tone.teal.fg", "bg": "tone.teal.bg", "min": 4.5 },
    { "fg": "tone.purple.fg", "bg": "tone.purple.bg", "min": 4.5 },
    { "fg": "tone.red.fg", "bg": "bg.surface", "min": 4.5 },
    { "fg": "tone.amber.fg", "bg": "bg.surface", "min": 4.5 },
    { "fg": "tone.green.fg", "bg": "bg.surface", "min": 4.5 },
    { "fg": "tone.green.solidFg", "bg": "tone.green.solid", "min": 4.5 }
  ]
}
```

Light/dark checks for every task screen: looks right in Light, Dark and Match device on both platforms (screenshots in each phase summary); switching mode with a popup/sheet open updates everything; no hex colours in task screen code except `fixedColours`; chips and helper text readable; row edges visible; navy elements keep white text; previews not tinted; no white flash on web; iOS system UI follows the mode; choice per device and survives restart.

**Data contract (both platforms read/write the same shape; keep existing field names where they exist):** id (created before uploads), organisationId, location `{type, id, code, name}`, title, description, status, priority, dueDate (date only, org time zone), assignees (user IDs), checklist `[{id, text, note, done, doneBy, doneAt, order}]`, attachments `[{id, path, name, contentType, size, width, height, uploadedBy, uploadedAt, source}]` (metadata only), completion `{by, at, notes, proofAttachmentIds}`, createdBy/At, updatedBy/At (server timestamps; updatedAt is the conflict check), rulebookVersion.

---

## 12. Tests (minimum; full list in TEST_PLAN.md if present)

- **Fixes:** JPG/3 JPGs/HEIC/PDF save on web with progress; no-file save < 1.5 s; 3 photos < 10 s (record times); offline mid-upload fails within 45 s with Retry; Cancel leaves no task and no orphan files; iOS create/edit/complete with files; iOS HEIC opens on web; web PDF opens in iOS viewer; no camera or `capture` on web; no banner in Edit; ticks survive Edit on both; priorities and "Completed" consistent; migration dry run counts; iOS Edit can't complete; iOS opens files in-app.
- **Views:** default scope by role; counts identical across pages and platforms; overdue in Active and Overdue; Approvals unchanged; sort matches fixture; grouping; project header count.
- **Popup:** same popup on all three web pages; `?task=ID` deep link, reload, Back; 40 px close; Esc + focus return; new/edit/complete never a full window; full screen < 640 px.
- **Forms/actions:** field order; location required/locked; people picker; per-field errors; checklist edit + ticks kept; attachments add/remove (files deleted from Storage); status options; old no-due-date tasks; discard prompt; edit conflict; Start; Complete disabled until ticked + Save progress; no-checklist complete; Reopen; Delete removes files; ticking from view syncs.
- **Permissions:** Phase 1 comparison approved; operative limits; outsider blocked everywhere including direct database calls; server rejects bad status/priority, Completed via edit, client-set createdBy/organisationId, >10 files, oversized files.
- **Parity:** schema CI; Firestore copy = git; **fixtures pass on iOS and on web**; change a label and `dueSoonDays` in the rulebook → both apps change with no release (then revert); no hard-coded task strings left; side-by-side check of counts, order and labels for the same user.
- **Accessibility:** VoiceOver card reading; largest Dynamic Type; web keyboard-only flow; no web text under 13 px.
- **Existing flows (regression):**
  - Projects and Small works pages identical apart from the Tasks tab content (before/after screenshots).
  - The header "Tasks" stat equals the Active count.
  - The gear icon's action is kept, and Approvals is unchanged.
  - Home task card, Tasks Due Today, notifications, Daily overview, Weekly report, Warnings and My Schedule are still correct, with counts matching.
  - Pre-existing tasks (old values, no due date, old Storage paths) work on both platforms.
  - The current App Store iOS build still works against the updated backend.
  - Rule changes have emulator tests; new queries have indexes; task-triggered functions still fire.
  - Nothing deployed to production without approval.
- **Light and dark:** every task screen in Light, Dark and Match device on both platforms (screenshots); live switching; no hex colours in task screens; contrast CI passes in both modes; no white flash on web; iOS system UI follows the mode; flag behaviour as in section 11b.

## 13. Final report

The current → target map as finally built; what was built per platform and backend; Firebase changes (rules, indexes, functions, Storage) with their emulator test results; the real cause(s) of Issue 1 with evidence and before/after timings; files changed; migration counts and whether it ran; test results with anything untested marked, plus a tap-through checklist for me; manual steps I still need to do, in order; whether an App Store release is needed and what ships without one; permission differences found and what we agreed; assumptions and open questions; theme: what existed, what you built, screens converted, the list of remaining unconverted screens per platform, and whether `appearanceSettingEnabled` can be turned on; anything elsewhere worth a look (including the download-URL security note).

**Start with Phase 1 now. No code changes until I approve the plan.**
