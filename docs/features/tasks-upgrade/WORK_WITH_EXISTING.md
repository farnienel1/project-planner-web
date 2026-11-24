# Work with what's already there

This pack describes a **target**. Project Planner already has working tasks on iOS and web, real data in Firebase, people using older app versions, and other screens that show task data. Claude Code must build from the current code, flows, rulebooks and Firebase setup, not alongside them or on top of them.

The rule: **understand first, keep what works, change only what this pack lists, and never break existing data or older app versions.**

---

## 1. What Claude Code must read before planning

### iOS and web code

- Every task-related screen, component, hook, service and model on **both** platforms, plus any code they share.
- How the apps read and write tasks today: direct Firestore SDK calls, a service layer, Cloud Functions or an API.
- Existing components to reuse: modals/sheets, buttons, chips, avatars, date pickers, file pickers, the Company details form style, toasts, empty states, theme or colour constants.
- Existing tests, and how they run.

### Current flows (from the screenshots and screen recording — confirm each in code)

| Platform | Flow | What it does today |
|---|---|---|
| Web | Main **Tasks** page (sidebar › Tasks) | Stat cards that also filter (To do, In progress, Overdue, Completed, Approvals); search; tasks grouped by project with "Open project" |
| Web | **Project › Tasks** tab | Stat cards (To do, In progress, Overdue, Done); search + filter icon; "Showing all tasks"; chips (Assigned to me, Active, Overdue, Completed); task cards with priority badge, a **gear icon** and status; "+ Tasks" button |
| Web | **Small works › Tasks** tab | Assumed same as Project › Tasks. Confirm |
| Web | Task popup | Chips, created by, assigned to, checklist, attachments with "Report a problem with this file", **Carry out / Complete / Edit task / Delete**; completed tasks show completion and **Reopen** |
| Web | Complete step | Checklist status, Proof of work (Photos, Files), Notes, Back / Complete task |
| Web | New task / Edit task | Tall modal: header card, Task, Checklist, Assign to (Myself / Manager / Operatives + picker), Priority, Schedule (date), Attachments (Photos, Camera, File, Site audit) |
| Web | Approvals | Count on the main Tasks page. **Not yet understood**: find out exactly what it is |
| iOS | Tasks sheet (from Home quick actions) | Done, stat row, search, chips, cards with **Carry out** |
| iOS | Complete task sheet | Checklist, Proof of work (Take photo, From library, Add file), Notes, Save / Save & mark complete, "Uploading…" |
| iOS | Task screen | Due, Assigned to, Checklist, Completion, Activity; ⋯ → Edit task |
| iOS | Edit Task sheet | Task, Priority, Checklist with notes, Assignments (Trade filter, Managers, Operatives), Schedule, Status |
| iOS | Attachments | Open in Safari at a Storage URL |
| iOS | Photo picker | System picker, limited library access, up to 10 photos |

### Other places that show task data (keep working; don't redesign)

- Home dashboard: **"Tasks · 2 pending"** card and **"Tasks Due Today"** figure (iOS and web).
- Project header stat **"Tasks"**.
- Notifications (the bell), Daily overview, Weekly report, Warnings, My Schedule — wherever tasks appear.

These must keep working, and their counts must use the **same definitions** as the new tabs (active, overdue, due today, from the rulebook), so numbers agree everywhere. Don't change how those screens look.

### Rulebooks

- Search the code and Firestore for existing rulebooks or shared config (`platformRulebooks/*`, `rules/*.json`, Remote Config, constants files).
- If a tasks rulebook or the `org-compliance` / `theme` files already exist (e.g. from the Insurance & accreditations work), **extend and version them**; never overwrite or fork them.

### Firebase (use the Emulator Suite for anything that writes)

| Area | Check |
|---|---|
| Firestore | Task collection(s) and subcollections, real field names and value formats, how checklist and attachments are stored, composite indexes (`firestore.indexes.json`), document sizes |
| Firestore security rules | Who can read and write tasks today; which fields are validated; how roles are checked (custom claims, user docs) |
| Storage | Bucket(s), existing attachment paths, metadata, Storage rules, CORS config, how files are served (download URLs) |
| Cloud Functions | Triggers on tasks (notifications, counters, activity log), callable functions, scheduled jobs |
| App Check / Auth | Enforcement per product, web setup, roles and claims |
| Deploy | firebase.json, CI deploy steps, environments (dev/staging/prod), who deploys rules and functions |

---

## 2. Rules for changing things

1. **Current vs target map first.** In Phase 1, produce a table for every flow, field, collection, Storage path, rule and component: *exists today → what this pack wants → keep / change / add*. Keep existing names where they already work. Map this pack's names onto them rather than renaming.
2. **Change only what's listed.** Behaviour changes are exactly F1–F26 in SPEC.md and the bugs in FIXES.md. Anything else (including "while I'm here" refactors) needs asking first.
3. **Existing data stays readable.** No renamed fields, moved files or changed value formats without a migration that has a dry run, counts, my approval, and a way back.
4. **Existing files stay where they are.** Attachments already in Storage keep their paths. New uploads may use the new path pattern only if both apps can read both.
5. **Older app versions keep working.** People will still have the current App Store build after the web and the next iOS release ship. Until a minimum version is enforced:
   - security rules and functions must accept that build's writes;
   - data it reads must still make sense to it (e.g. legacy priority/status values stay readable).

   Say in the plan how long the old build is supported, and whether a forced-update prompt is needed.
6. **Security rules and indexes change with tests.** Every rule change is tested in the emulator (allowed and denied cases). Every new query has its index added to `firestore.indexes.json`.
7. **Cloud Functions that react to tasks** (notifications, counters, activity) must keep firing correctly with the new fields and statuses. Check each one.
8. **Nothing goes to production without asking:** rules, indexes, functions, migrations, Storage CORS.

---

## 3. Projects and Small works pages: only the Tasks area changes

The Projects and Small works pages stay as they are today. Specifically:

**Unchanged:**
- Back link, the navy header card (code, type badge, status, name, client and manager, Edit, Book labour), progress bar, header stats (Variations, Tasks, Active users), and the grid of tab buttons.
- Every other tab: Overview, Variations, Scheduling, View access, Materials, H&S, Deadlines, Site Audit, Location, Active users.
- Page routing, permissions and data loading.

**Changes, inside the Tasks tab only:**
- The content under the tab buttons:
  - the heading with **New task** (was "+ Tasks")
  - tabs with counts (Active / Overdue / Completed)
  - My tasks / Everyone, search and filters
  - the task list, with the new row design
- Clicking a task, New task, Edit and Complete open the **shared task popup** over the page. The page underneath doesn't change.
- The header "Tasks" stat keeps its place and look, but uses the same Active count as the Tasks tab.

**On iOS:** if project or small works screens show tasks, the same rule applies. Only the task list area and what opens from it change.

**The gear icon** on today's project task cards: find out what it does and keep that action. It moves into the row's ⋯ menu unless it's something else; ask if unclear.

The mockup (`mockups/web.html`, states "Project › Tasks" and "Small works › Tasks") outlines the only area that changes.

---

## 4. Phase 1 deliverables Claude Code must hand over

1. The current flows table above, confirmed or corrected from the code, for iOS and web.
2. The current vs target map (section 2.1).
3. The Firebase findings from the table in section 1, plus the real cause of the upload bug.
4. The list of other screens that show task data and how they calculate their numbers.
5. Existing rulebooks and theme/colour setup found, and how they'll be extended.
6. Old-app-version compatibility plan.
7. Confirmation of what the gear icon and Approvals do.
8. The plan, assumptions and anything needing my decision. Then stop.
