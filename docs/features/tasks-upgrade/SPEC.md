# Tasks upgrade — flows and function changes

**Platforms:** iOS app and web app (and Android if it shares the iOS code)
**Type:** shared platform feature. One data model, one rulebook (`rules/tasks.rules.json`), one set of fixtures (`rules/tasks.fixtures.json`) that both platforms must pass.
**Mockups:** `mockups/web.html` (11 states, switch with the buttons at the top), `mockups/ios.html` (iOS-01 to iOS-08)
**Fix first:** everything in `FIXES.md` ships before this.
**Read first:** `WORK_WITH_EXISTING.md`. This spec is the target; Claude Code builds it from the current iOS and web code, flows, rulebooks and Firebase setup, keeping existing data and older app versions working.

## 0. Scope boundaries

- **Changes:**
  - the main Tasks page (web)
  - the Tasks tab content on Projects and Small works (web, and iOS if those screens show tasks)
  - the task popup and sheets
  - the iOS Tasks list, task screen, Edit, Complete and New task
  - the bugs in FIXES.md
  - light and dark mode on these screens
- **Doesn't change:**
  - the rest of the Projects and Small works pages: header card, Edit, Book labour, progress, header stats, tab buttons, all other tabs, routing
  - Home dashboard task cards, notifications, Daily overview, Weekly report, Warnings and My Schedule, apart from using the same count definitions so numbers agree
  - existing Firestore field names and Storage paths, unless a listed change needs it and a migration is approved

---

## 1. Function changes (before → after)

Every behaviour change in this upgrade. Claude Code must implement each one on **both** platforms unless a row says otherwise, and must not change anything that isn't listed here without asking.

| # | Area | Before | After | Rulebook |
|---|---|---|---|---|
| F1 | Task actions | "Carry out" (unclear: iOS opens the complete sheet; web shows it beside Complete) | **Start** moves To do → In progress, one tap, no form. **Complete** opens the complete step. Check what Carry out does today and map it to one of these | `actions` |
| F2 | Complete step buttons | iOS: disabled "Save" then "Save & mark complete". Web: "Complete task" | **Save progress** (always on: keeps ticks, photos, notes, status stays) + **Complete task** (on when every checklist item is ticked). Hint "Tick 2 more to complete" | `completeStep`, `copy.complete` |
| F3 | Status in Edit | iOS Edit could set Completed directly, skipping the checklist and proof | Edit switches **To do / In progress** only. Completed is shown disabled with a hint. Completed tasks show **Reopen** (→ In progress) | `editFormStatuses`, `actions.reopen` |
| F4 | Default view | Everyone lands on "Assigned to me" | Scope by role: operatives **My tasks**, managers and admins **Everyone**. Remember each user's last choice per device | `views.defaultScope` |
| F5 | Filters and counts | Web main page: 5 stat cards that filter and overlap. Project tab and iOS: 4 stat cards plus chips with different names | **Tabs with counts**: Active, Overdue, Completed, Approvals (only if it has items). Plus a **My tasks / Everyone** switch. Same on every page and both platforms | `views.tabs`, `views.scopes` |
| F6 | Overdue | Worked out separately per screen | Due date earlier than today in the **organisation's** time zone, and not completed. Tasks with no due date are never overdue | `due`, fixtures `dueLabels`, `tabs` |
| F7 | Priority | Low/Medium/High/Urgent on web form, Normal in lists and on iOS | **Low / Normal / High / Urgent** everywhere. Stored `medium` read as `normal`, then migrated | `priorities`, `legacyPriorityMap` |
| F8 | Status names | "Done" and "Completed" both used | **To do / In progress / Completed** | `statuses`, `legacyStatusMap` |
| F9 | Assigning people | Web: Myself / Manager / Operatives tiles + a separate "Managers & operatives" picker row. iOS: Trade filter row, Managers row, Operatives row | One **Assign to** field: person chips, a **Me** shortcut, and **Add people** opening one picker with search, Managers / Operatives switch and trade filter. Managers and operatives can be mixed | `fields.assignees` |
| F10 | Upload | See FIXES.md issue 1 | One shared pipeline on both platforms | `attachments` |
| F11 | Where tasks open (web) | Popup on some pages, full-height window for new/edit | **One popup** for view, new, edit and complete, on the main Tasks page, Projects and Small works. Never navigates away. Adds `?task={id}` (and `&mode=edit`/`complete`) to the URL so links work and browser Back closes it. Full screen under 640 px | — |
| F12 | Choosing project / small works | Not on the main page's form; implied by where you clicked | Required field **Project or small works**. Filled in and locked when opened from a project or small works page | `fields.location` |
| F13 | Attachments in Edit (iOS) | Couldn't add or remove | Add and remove in Edit, same as web | `fields.attachments` |
| F14 | Ticking checklist | Only inside the complete step | Assignees (and managers) can tick items straight from the task view on both platforms. Each tick saves immediately with who and when | `permissions.tickChecklist` |
| F15 | Delete | Red button beside Complete/Edit (web); not in iOS Edit | Web: **Delete task** on the left of the Edit footer, and in the row ⋯ menu. iOS: at the bottom of Edit, and in the task ⋯ menu. Always with a confirmation | `copy.delete` |
| F16 | Camera on web | Camera button shown | Removed. Sources per platform | `attachments.sources` |
| F17 | Viewing files | iOS opens Safari at a raw Storage URL; web shows "Report a problem with this file" under every thumbnail | In-app viewer on both (Quick Look on iOS, lightbox on web). "Report a problem with this file" moves into the viewer's ⋯ menu | `copy.attachments.reportProblem` |
| F18 | Sorting | Varies | Active tabs: overdue first, then due date, then priority (high first), then title; no due date last. Completed: newest completion first | `views.sortActive`, fixtures `sortActive` |
| F19 | Grouping | Main page grouped by project; tabs inside projects not grouped | Main page grouped by project / small works (with type badge and code). Project and Small works tabs: flat list. | `views.groupBy` |
| F20 | Due date shown as | "Due 27 Jun 2026" chips / "70 days ago" | Words first, date second: "70 days overdue / 15 Sep 2026", "Due today", "Due Thu", "Due 2 Dec / in 8 days" | `due.labels` |
| F21 | Due date required | Web says required; iOS has tasks with no date | Required for new tasks. Old tasks without one show "No due date", sort last, and Edit asks for one before saving | `due.requiredForNewTasks` |
| F22 | Removed users | "Deleted user" shown, nothing else | "Removed user", and a manager sees a prompt to reassign | — |
| F23 | Edit form banner | "Create a new task" banner in both new and edit | Gone. The popup/sheet title says New task or Edit task | `copy.form` |
| F24 | Unsaved changes | Cancel discards silently | Cancel with changes asks "Discard changes?" | `copy.form.unsaved*` |
| F26 | Colours | Hard-coded per platform; web light only, iOS dark only | Every task screen uses the shared tokens in `rules/theme.tokens.json` and works in Light, Dark and Match device. See THEME.md (rollout behind `appearanceSettingEnabled`) | `theme.tokens.json` |
| F25 | Complete step with no checklist (iOS) | Turns the task's own title into a one-item checklist | No checklist section when the task has none; Complete task is available straight away | `completeStep`, fixtures `completeStep` |

**Approvals.** The main page currently shows an Approvals count. Find out in Phase 1 what it covers and keep its behaviour exactly. It becomes a tab that only shows when it has items (`hideWhenZero`).

**Permissions.** `permissions` in the rulebook is a proposal. Claude Code must compare it with how the app behaves today and report any difference before applying it.

---

## 2. Flows, in order

### 2.1 Tasks list (main page, project tab, small works tab; web and iOS)

1. Header: **Tasks** + **New task** (web button top right; iOS + in the nav bar).
2. Tabs with counts: Active · Overdue (red count when above 0) · Completed · Approvals (if any).
3. Scope switch **My tasks / Everyone**, search, filters (Assignee, Priority, Due, and Project or small works on the main page only).
4. List, sorted per F18. Main page grouped by location (F19).
5. Each task shows: status circle (tap = main action), title, checklist progress and file count, assignees, due in words, priority, one main button (Start / Complete / Reopen), ⋯ menu.
6. Tap a task: web popup / iOS task screen.

The count on a project's header ("Tasks") uses the same Active count (`views.locationHeaderCount`).

### 2.2 New task

Opened from: **New task** on any tasks list, the global **+ New** menu on web, the iOS + button.

Field order (`formOrder`): **Task** (name + details) → **Project or small works** (locked if opened from one) → **Assign to** → **Due date** and **Priority** (side by side on web) → **Checklist** (optional) → **Attachments** (optional).

Footer: Cancel · **Create task**. Missing required fields show their message under the field when Create is pressed; the button isn't greyed out with a vague "Add a title and assignee to continue".

On Create: uploads run per FIXES.md; the popup/sheet closes when the task is saved; toast **Task created**; the new task appears in the list on every signed-in device.

### 2.3 View a task

Order on both platforms: title → project/small works link → chips (status, priority, due) → **Assigned to** → **Details** → **Checklist** (tickable) → **Attachments** (open in viewer) → **Completion** (if completed: who, when, notes, proof) → **Activity**.

Actions: **Complete** (or Start / Reopen) as the main button, **Edit**, ⋯ (Copy link, Open project / small works, Delete task).

### 2.4 Edit a task

Same form and order as New, plus **Status** (To do / In progress) at the end. Location locked. Checklist shows each item's tick state and keeps it on save; items can be added, reordered, removed, and unticked by a manager if work needs redoing. Attachments can be added and removed. Footer: **Delete task** (left, away from Save) · Cancel · **Save changes**. If another device changed the task since it opened, saving shows the conflict message and reloads.

### 2.5 Complete a task

From Complete (list button, status circle, or task view). Opens in the same popup (web) / a sheet (iOS):

1. **Checklist**, with progress. Must all be ticked to complete (`completeStep.checklistMustBeComplete`). If the task has no checklist, this section is hidden; don't invent a single item from the task title (iOS does this today).
2. **Proof of work** (optional): iOS Take photo / Photo library / Files; web Upload files (no camera).
3. **Notes for the manager** (optional).
4. Footer: hint ("Tick 2 more to complete") · **Save progress** · **Complete task**.

On Complete task: status → Completed, completed by and at recorded, toast **Task completed**, task moves to the Completed tab everywhere.

### 2.6 Start, reopen, delete

- **Start**: one tap; toast "Task started".
- **Reopen**: Completed → In progress; completion record kept in Activity.
- **Delete**: confirmation "Delete {title}? This removes the task, its checklist and attachments for everyone on iOS and web." Deletes storage files too.

---

## 3. Data contract (both platforms)

One task document shape, read and written identically by iOS and web. Claude Code confirms the current field names in Phase 1 and keeps them where they exist; this is the target meaning, not necessarily the field names.

| Field | Notes |
|---|---|
| id | Created before uploads (F10) |
| organisationId | Set from the signed-in user |
| location `{type: project \| small_works, id, code, name}` | Required |
| title, description | Lengths from rulebook |
| status | `to_do` / `in_progress` / `completed` only (legacy values mapped) |
| priority | `low` / `normal` / `high` / `urgent` only (legacy mapped) |
| dueDate | Date only (no time), interpreted in the organisation's time zone |
| assignees | Array of user IDs; display names looked up, not stored as the source of truth |
| checklist | Array of `{id, text, note, done, doneBy, doneAt, order}` |
| attachments | Array of metadata only: `{id, path, name, contentType, size, width, height, uploadedBy, uploadedAt, source}` |
| completion | `{by, at, notes, proofAttachmentIds}` |
| createdBy, createdAt, updatedBy, updatedAt | Server timestamps; `updatedAt` is the edit-conflict check |
| rulebookVersion | Version of the rulebook the writing client used (for debugging) |

Writes from both platforms go through the same validation (security rules and/or one Cloud Function per action). See `SHARED_RULEBOOK.md`.
