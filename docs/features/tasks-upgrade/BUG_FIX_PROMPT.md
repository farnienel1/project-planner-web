# Bug-fix prompt: Tasks on iOS and web (all in one)

Paste everything below the line into Claude Code at the repo root. It's self-contained. It uses the same rulebook, fixtures and colour tokens as the Tasks upgrade, so the redesign builds on top of it.

---

PROJECT PLANNER — TASK BUG FIXES ON iOS AND WEB (shared platform feature)

CONTEXT
- Project Planner has an iOS app and a web app (plus Android if it shares the iOS code). Tasks are a shared feature: both apps must read and write the same task documents and files through the same server rules.
- The backend appears to be Firebase (tapping a task attachment on iOS opens a firebasestorage.googleapis.com link). Confirm this first.
- If docs/features/tasks-upgrade/ exists in the repo, also read FIXES.md, THEME.md, rules/tasks.rules.json and rules/theme.tokens.json there. They match this prompt.
- This is the BUG-FIX PASS ONLY. No redesign: don't change layouts or behaviour beyond what each fix needs.
- Light and dark mode: anything you add or change must use the shared colour tokens (see "LIGHT AND DARK MODE" below) so it works in both modes. Converting the rest of the app is not part of this pass.

WORK WITH WHAT'S ALREADY THERE (read before anything else)
This pass fixes the current system; it doesn't rebuild it. Before planning, read and take into account:
- iOS and web code:
  - every task screen, component, service and model on both platforms, plus any shared code
  - how tasks are read and written (Firestore SDK, service layer, Cloud Functions)
  - existing tests
- Current task flows on both platforms:
  - web: main Tasks page, Project › Tasks and Small works › Tasks tabs, task popup (Carry out / Complete / Edit / Delete / Reopen), complete step, new/edit modal, Approvals
  - iOS: Tasks sheet, complete sheet, task screen, Edit Task sheet, attachment viewing
  - other places showing task data: Home "Tasks pending" card and "Tasks Due Today", notifications, Daily overview, Weekly report, Warnings, My Schedule. Keep them all working.
- Rulebooks and shared config:
  - any existing platformRulebooks/*, rules/*.json, Remote Config or constants
  - extend and version what exists; never create a parallel mechanism or overwrite a live rulebook
- Firebase (use the Emulator Suite for anything that writes):
  - Firestore task collections, real field names and value formats, indexes
  - security rules and how roles are checked
  - Storage buckets, existing attachment paths, metadata, Storage rules, CORS, download URLs
  - Cloud Functions triggered by tasks (notifications, counters, activity)
  - App Check, Auth, environments and deploy steps
Rules:
- Produce a current → target map (keep / change / add) before changing anything.
- Change only what's listed in this prompt.
- Existing data stays readable. Existing attachments keep their Storage paths. No format changes without an approved migration with a dry run.
- The current App Store iOS build must keep working against the updated backend until a minimum version is enforced.
- Every rule change gets emulator tests (allowed and denied); every new query gets its index; task-triggered functions are checked.
- Nothing goes to production (rules, indexes, functions, migrations, CORS) without my approval.
- Projects and Small works pages: this pass changes nothing on them beyond the bug fixes themselves.

GROUND RULES
1. Create branch fix/tasks-upload-and-data. Small commits with clear messages. Don't push or merge without asking me.
2. Phase 1 is read-only. NO code changes until I approve your findings and plan. Ask again before running any data migration against production.
3. Fix every bug on BOTH platforms. Where a bug was only seen on one, check the other and tell me what you found.
4. Reuse existing components, services and error handling. Don't touch unrelated features; list anything you notice in the report.
5. Never store file contents in Firestore documents. Attachments are metadata only.
6. No colour values in code you add or change: use theme tokens. The only exceptions are the fixedColours listed in the tokens file.
7. If anything here conflicts with how the codebase works, stop and ask.

PHASE 1 — INVESTIGATE (read only)
1. Confirm the stack:
   - Firestore, Firebase Storage, Cloud Functions, App Check, Auth
   - the web framework and the iOS framework
   - whether iOS and web share code
2. Map every task code path on both platforms:
   - web: main Tasks page, project Tasks tab, small works Tasks tab, task popup, new task form, edit form, complete step
   - iOS: list, task screen, edit, complete sheet, new task
3. Document the task data shape as stored today: field names, status and priority values, checklist shape, attachment shape. COUNT the legacy values in the data, e.g. how many tasks have priority "medium", status "done", or no due date.
4. Diagnose bug 1 with evidence (method under bug 1). Report the real cause or causes before fixing anything.
4b. Deliver:
    - the confirmed current-flows list
    - the current → target map for everything these fixes touch
    - the Firebase findings
    - how the old App Store build will keep working
5. Theme check: does either platform already have colour tokens, light/dark support or an Appearance setting? Does rules/theme.tokens.json exist? Count hard-coded colours in the task screens you'll touch.
6. Write a plan per bug, covering:
   - files to change on web, iOS and backend
   - any security rule or Cloud Function changes
   - the migration (dry run first)
   - how you'll handle colours (reuse existing tokens, or add rules/theme.tokens.json and a minimal theme provider)
   - anything I must do by hand (CORS, App Check, deploys)
   - your assumptions
7. STOP and wait for my go-ahead.

PHASE 2 — FIX
Implement every bug below on both platforms. Create rules/tasks.rules.json with the values in "SHARED VALUES" and read those values from it in both apps instead of hard-coding them. If rules/theme.tokens.json doesn't exist, create it exactly as in "LIGHT AND DARK MODE", with a minimal theme provider on each platform. Use those tokens for every element you add or change. Write the migration script with a --dry-run mode; show me the counts; only run it for real when I say.

PHASE 3 — TEST
Run every check in "TESTS". Automate what you can; give me a short tap-through list for the rest.

PHASE 4 — REPORT
See "REPORT" at the end.

===========================================================
THE BUGS
===========================================================

BUG 1 — Web: saving a task with a file attached takes ages, then never saves. Check iOS at the same time.
Seen:
- On web, New task with one photo attached sits on "Saving…" and never finishes.
- On iOS, completing a task with a photo did upload ("Uploading…", then done).
- iOS create-with-attachment and edit-with-attachment have NOT been checked yet. Check them.

Likely causes, most likely first. Verify each one; don't assume.
 a) The Firebase Storage SDK is retrying a failing upload. The default maxUploadRetryTime is 10 minutes, which looks exactly like this.
 b) Storage security rules reject the web upload, and the error is swallowed. Look for differences from iOS in:
    - the path
    - contentType: missing, image/heic, application/pdf or application/octet-stream
    - size rules
    - metadata iOS sends and web doesn't
 c) App Check is enforced on Storage/Firestore but isn't initialised (or is failing) on web.
 d) Bucket CORS doesn't include the web app's domain. Check with: gsutil cors get gs://<bucket>
 e) The file (base64 or data URL) is written into the Firestore document and hits the 1 MiB limit.
 f) Slow by design: full-size images uploaded one at a time, or HEIC decoded on the browser's main thread.
 g) A promise in the save flow never settles, or there's no finally block, so the "saving" state never resets.

How to diagnose:
- Reproduce on web with DevTools (Network + Console) open, using a JPG, a HEIC and a PDF.
- Log timestamps for: validate → prepare → each upload start/progress/end → Firestore write → close.
- Read the Storage and Firestore rules and test the web path in the Rules Playground.
- Check App Check enforcement and the web App Check setup.
- Check the bucket CORS.
- Diff the web and iOS upload code: storage path, metadata, content type, size handling, the order of "write task" vs "upload files", and what gets stored on the task document.
- Do the same for iOS create and edit with attachments.

Required behaviour after the fix. Both platforms use ONE pipeline, with values from rules/tasks.rules.json → attachments:
 1. Check type, size and count first, using the rulebook's error messages.
 2. Prepare files:
    - Resize images to 2560 px on the long edge, JPEG quality 0.82.
    - HEIC becomes JPEG: natively on iOS; on web in a lazy-loaded Web Worker. If the browser can't decode it, show the wrongType message.
    - PDFs are left unchanged.
 3. Create the task ID BEFORE uploading, so paths are final: organisations/{orgId}/tasks/{taskId}/attachments/{attachmentId}.{ext}
 4. Upload 3 files in parallel, resumable, with contentType set and per-file progress. Show overall progress on the Save button, e.g. "Uploading 1 of 3 · 57%".
 5. Fail fast, never hang:
    - Set the SDK's max upload retry to 60 s.
    - Add a stall watchdog: no progress for 45 s cancels that file and shows "{name} stopped uploading. Check your connection and retry." with Retry and Remove.
 6. When every file is up, write the task (or the edit) in ONE Firestore write or batch. Store attachment metadata only: {id, path, name, contentType, size, width, height, uploadedBy, uploadedAt, source}.
 7. Every path ends in success or a clear error. A finally block always resets the state. Map Storage, Firestore and App Check error codes to the rulebook's error messages.
 8. Cancel cleans up:
    - Cancel during upload stops the uploads and deletes any files already uploaded.
    - Add a scheduled function that deletes orphaned files under a task path with no task document after 24 hours.
 9. iOS uses identical paths, metadata and sizes. A photo taken on iOS must open on web (JPEG, not HEIC), and a file added on web must open on iOS.
10. Targets:
    - A task with no files closes in under 1.5 s.
    - A task with three phone photos saves in under 10 s on office broadband or 4G, with progress visible throughout.
Measure and report before and after timings.
11. The new upload UI (file rows, progress bar, error row, Retry, progress inside Save) uses theme tokens: primary.bg / primary.fg / primary.soft for progress, tone.red.fg on tone.red.bg for errors, tone.green.fg for "Uploaded". It must read clearly in light and dark.

BUG 2 — Camera button on web
Seen: web New task → Attachments shows Photos / Camera / File / Site audit.
Fix:
- Attachment sources come from the rulebook, per platform:
  - iOS and Android: camera, library, files, site_audit
  - web: files, site_audit, shown as "Upload files" and "Site audit"
- Remove the Camera option everywhere on web: new task, edit task, and the complete step / proof of work.
- Remove any "capture" attribute from web file inputs. On a phone browser, the system picker already offers "Take photo".
- Keep Take photo on iOS.

BUG 3 — Web Edit task shows a "Create a new task" banner
Fix: remove the banner in both new and edit modes. The modal title says "New task" or "Edit task".

BUG 4 — Web Edit task shows ticked checklist items as unticked (DATA RISK)
Seen: the task view shows the checklist 5 of 5 ticked, but Edit on the same task shows all 5 unticked. Saving may wipe the progress.
Fix:
- Load and save each item's done, doneBy and doneAt.
- Never reset ticks on save.
- Check iOS Edit for the same problem and fix it there too.

BUG 5 — Priority labels don't match
Seen: the web list says "Normal", the web task popup and form say "Medium", and iOS says "Normal".
Fix:
- One set everywhere: Low / Normal / High / Urgent.
- Read stored "medium" (any case) as "normal" through legacyPriorityMap.
- Migrate the stored values (dry run first).
- Chip colours come from the tone names (grey/blue/amber/red) mapped to tone tokens, so they read in both modes.

BUG 6 — "Done" and "Completed" both used for the same status
Fix:
- Statuses are To do / In progress / Completed everywhere.
- Read legacy values through legacyStatusMap and migrate them (dry run first).

BUG 7 — iOS Edit can set Status = Completed directly
Seen: the iOS Edit Task status picker offers Completed, which skips the checklist rule and proof of work.
Fix:
- Edit offers To do / In progress only. Completed is shown disabled with the hint: "To complete a task, use Complete so the checklist and proof of work are captured."
- Completing only happens through the complete step.
- Enforce this on the server too: a security rule or Cloud Function rejects a direct status change to completed outside the complete action.
- Check web Edit for the same problem.

BUG 8 — iOS opens attachments in Safari at a raw Storage URL
Fix:
- Open attachments in an in-app viewer: Quick Look for images and PDFs. It must follow the app's light/dark mode.
- On web, check attachments open in an in-app viewer or lightbox rather than a raw URL in a new tab.
- Photos and PDFs are never tinted or inverted in dark mode.

BUG 9 — iOS complete step invents a checklist
Seen: completing a task with no checklist shows a one-item checklist made from the task's own title.
Fix:
- If the task has no checklist, hide the checklist section and allow Complete straight away.
- Check web for the same behaviour.

BUG 10 — Managers land on an empty "Assigned to me"
Seen: iOS and the web project tab default to "Assigned to me", which shows "Nothing assigned to you" for managers while tasks exist.
Fix:
- Default view by role: operatives see their own tasks; managers and admins see everyone's active tasks.
- Keep the existing filter controls; only the default changes.
- Remember the user's last choice on that device.

BUG 11 — Due date rule differs
Seen: web says every task must have a due date; iOS shows tasks with "No date".
Fix:
- A due date is required for new tasks on both platforms.
- Existing tasks without one show "No due date" and sort last.
- Editing one asks for a due date before it can save.

BUG 12 — "Deleted user" shown as an assignee with no way forward
Fix:
- Show "Removed user".
- Show managers a prompt to reassign the task.

BUG 13 — Two different primary blues in web task screens
Seen: the app-wide primary is #3D4FD8 (the top "New" button); task buttons use #1D5AA8.
Fix: task screens use the primary.bg / primary.fg tokens (#3D4FD8 in light mode). Remove #1D5AA8 from task screens.

SECURITY NOTE — for the report only, don't change it now
Firebase download URLs carry a token and work for anyone with the link, forever. Tell me whether task attachments should move to short-lived links.

===========================================================
LIGHT AND DARK MODE (for everything this pass adds or changes)
===========================================================
- Today web is light only and iOS is dark only. The long-term setting is Settings › Appearance: Match device (default) / Light / Dark, stored per device. It stays behind feature flag appearanceSettingEnabled (default OFF) until every screen supports both modes, so users see no change from this pass.
- What this pass must do:
  - Every element you add or change takes its colours from rules/theme.tokens.json. No hex values. Exceptions: the fixedColours list (avatars, gradient icon tiles, photo/PDF previews, navy brand elements).
  - Navy brand elements (web sidebar, iOS header band) keep white text in both modes.
  - Overlays use overlay.scrim; focus rings use focus.ring.
  - If the tokens file doesn't exist, create it exactly as below, plus rules/theme.tokens.schema.json (both modes required for every token).
  - Generate colours from it at build time: web CSS custom properties (with [data-theme] and prefers-color-scheme); iOS colour assets with Any/Dark appearances, or a theme object.
  - Add a CI check: schema valid, every contrastPairs entry meets its minimum in both modes (all 46 pass today), and generated files match the JSON.
- Check every screen you touched in light AND dark, temporarily forcing each mode in development, and attach screenshots of both to the report.

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

===========================================================
SHARED VALUES — create rules/tasks.rules.json with this
(both apps read these instead of hard-coding them; the later UI upgrade extends this same file)
===========================================================
```json
{
  "rulebookKey": "tasks",
  "rulebookVersion": 1,
  "statuses": [
    {
      "key": "to_do",
      "label": "To do",
      "tone": "grey"
    },
    {
      "key": "in_progress",
      "label": "In progress",
      "tone": "blue"
    },
    {
      "key": "completed",
      "label": "Completed",
      "tone": "green"
    }
  ],
  "legacyStatusMap": {
    "todo": "to_do",
    "inprogress": "in_progress",
    "done": "completed"
  },
  "editFormStatuses": [
    "to_do",
    "in_progress"
  ],
  "priorities": [
    {
      "key": "low",
      "label": "Low",
      "tone": "grey",
      "rank": 1
    },
    {
      "key": "normal",
      "label": "Normal",
      "tone": "blue",
      "rank": 2,
      "default": true
    },
    {
      "key": "high",
      "label": "High",
      "tone": "amber",
      "rank": 3
    },
    {
      "key": "urgent",
      "label": "Urgent",
      "tone": "red",
      "rank": 4
    }
  ],
  "legacyPriorityMap": {
    "medium": "normal"
  },
  "due": {
    "requiredForNewTasks": true,
    "timezone": "organisation",
    "labels": {
      "none": "No due date"
    }
  },
  "attachments": {
    "maxFiles": 10,
    "maxSizeMb": 10,
    "accepted": [
      {
        "mime": "image/jpeg",
        "extensions": [
          "jpg",
          "jpeg"
        ],
        "label": "JPG"
      },
      {
        "mime": "image/png",
        "extensions": [
          "png"
        ],
        "label": "PNG"
      },
      {
        "mime": "image/webp",
        "extensions": [
          "webp"
        ],
        "label": "WebP"
      },
      {
        "mime": "image/heic",
        "extensions": [
          "heic",
          "heif"
        ],
        "label": "HEIC",
        "storeAs": "image/jpeg"
      },
      {
        "mime": "application/pdf",
        "extensions": [
          "pdf"
        ],
        "label": "PDF"
      }
    ],
    "image": {
      "maxLongEdgePx": 2560,
      "jpegQuality": 0.82
    },
    "upload": {
      "parallel": 3,
      "stallTimeoutSeconds": 45,
      "maxRetries": 2,
      "sdkMaxUploadRetrySeconds": 60
    },
    "storagePath": "organisations/{orgId}/tasks/{taskId}/attachments/{attachmentId}.{ext}",
    "sources": {
      "ios": [
        "camera",
        "library",
        "files",
        "site_audit"
      ],
      "android": [
        "camera",
        "library",
        "files",
        "site_audit"
      ],
      "web": [
        "files",
        "site_audit"
      ]
    },
    "sourceLabels": {
      "camera": "Take photo",
      "library": "Photo library",
      "files": "Files",
      "files_web": "Upload files",
      "site_audit": "Site audit"
    }
  },
  "views": {
    "defaultScope": {
      "operative": "mine",
      "manager": "everyone",
      "admin": "everyone"
    }
  },
  "copy": {
    "form": {
      "titleNew": "New task",
      "titleEdit": "Edit task",
      "statusCompletedHint": "To complete a task, use Complete so the checklist and proof of work are captured."
    },
    "attachments": {
      "help": "Photos ({imageTypes}) or PDF, up to {maxSizeMb} MB each, {maxFiles} files max",
      "uploading": "Uploading {done} of {total} · {percent}%",
      "failed": "{name} didn’t upload",
      "retry": "Retry",
      "remove": "Remove"
    },
    "errors": {
      "dueRequired": "Pick a due date.",
      "tooBig": "{name} is {size}. The limit is {maxSizeMb} MB.",
      "wrongType": "{name} can’t be attached. Use a photo or PDF.",
      "tooMany": "You can attach up to {maxFiles} files.",
      "uploadStalled": "{name} stopped uploading. Check your connection and retry.",
      "saveFailed": "The task wasn’t saved. Check your connection and try again."
    }
  }
}
```
Also:
- Add a JSON Schema for this file and validate it in CI. The schema must REJECT "camera" in attachments.sources.web.
- Ship the file to both apps from one source; never hand-copy it. If there's already a shared config mechanism, use it. Otherwise:
  - a deploy step writes it to Firestore at platformRulebooks/tasks (readable by signed-in users, writable only by the deploy account)
  - both apps read and cache it, with a copy bundled at build time as the offline fallback

===========================================================
SHARED TEST CASES — create rules/tasks.fixtures.json
iOS unit tests AND web unit tests both load this file and must pass every case.
===========================================================
```json
{
  "rulebookVersion": 1,
  "legacyValues": [
    {
      "field": "priority",
      "stored": "medium",
      "expect": "normal"
    },
    {
      "field": "priority",
      "stored": "Normal",
      "expect": "normal"
    },
    {
      "field": "priority",
      "stored": "URGENT",
      "expect": "urgent"
    },
    {
      "field": "status",
      "stored": "done",
      "expect": "completed"
    },
    {
      "field": "status",
      "stored": "todo",
      "expect": "to_do"
    },
    {
      "field": "status",
      "stored": "inprogress",
      "expect": "in_progress"
    }
  ],
  "editForm": {
    "expectStatusOptions": [
      "to_do",
      "in_progress"
    ],
    "expectCompletedSelectable": false
  },
  "attachmentSources": {
    "ios": [
      "camera",
      "library",
      "files",
      "site_audit"
    ],
    "web": [
      "files",
      "site_audit"
    ]
  },
  "attachmentValidation": [
    {
      "name": "photo ok",
      "mime": "image/jpeg",
      "sizeMb": 4.2,
      "expect": "ok"
    },
    {
      "name": "heic converted",
      "mime": "image/heic",
      "sizeMb": 3.1,
      "expect": "ok",
      "expectStoredMime": "image/jpeg"
    },
    {
      "name": "pdf ok",
      "mime": "application/pdf",
      "sizeMb": 2,
      "expect": "ok"
    },
    {
      "name": "too big after resize",
      "mime": "application/pdf",
      "sizeMb": 14,
      "expect": "tooBig"
    },
    {
      "name": "wrong type",
      "mime": "application/zip",
      "sizeMb": 1,
      "expect": "wrongType"
    },
    {
      "name": "eleventh file",
      "mime": "image/jpeg",
      "sizeMb": 1,
      "existingFiles": 10,
      "expect": "tooMany"
    }
  ],
  "defaultScope": [
    {
      "role": "operative",
      "expect": "mine"
    },
    {
      "role": "manager",
      "expect": "everyone"
    },
    {
      "role": "admin",
      "expect": "everyone"
    }
  ],
  "completeStep": [
    {
      "checklist": [],
      "expect": {
        "showChecklist": false,
        "completeEnabled": true
      }
    },
    {
      "checklist": [
        true,
        false
      ],
      "expect": {
        "showChecklist": true,
        "completeEnabled": false
      }
    },
    {
      "checklist": [
        true,
        true
      ],
      "expect": {
        "showChecklist": true,
        "completeEnabled": true
      }
    }
  ]
}
```

===========================================================
TESTS
===========================================================
Upload (bug 1):
[ ] Web: create a task with 1 JPG, then 3 JPGs, then a HEIC, then a PDF. Each saves with progress on the button; the modal closes; the task shows its files. Record the time for each.
[ ] Web: a task with no files closes in under 1.5 s.
[ ] Web: three phone photos save in under 10 s on office broadband. Record the time.
[ ] Web: throttle to Slow 3G, then go offline mid-upload. Within 45 s the file shows "stopped uploading" with Retry. Retry works once back online. The button never sits on "Saving…" indefinitely.
[ ] Web: Cancel mid-upload creates no task and leaves no orphan files in Storage.
[ ] iOS: create with a camera photo and a library photo; edit to add a file; complete with a proof photo. All save with progress.
[ ] A HEIC taken on iOS opens on web in Chrome on Windows (stored as JPEG).
[ ] A PDF uploaded on web opens on iOS in the in-app viewer.
[ ] No task document contains file contents (check the stored data).

Camera (bug 2):
[ ] No Camera option anywhere on web (new, edit, complete). No "capture" attribute on web file inputs.
[ ] iOS still has Take photo.
[ ] CI fails if "camera" is added to attachments.sources.web.

Bugs 3–13:
[ ] Web Edit has no "Create a new task" banner.
[ ] Open Edit on a task with ticked items (web and iOS): ticks show. Save without changes and every tick is still stored, with doneBy and doneAt intact.
[ ] Priorities show Low/Normal/High/Urgent everywhere; a task stored as "medium" shows Normal.
[ ] "Done" appears nowhere as a status label; "Completed" is used everywhere.
[ ] iOS and web Edit can't set Completed. A direct write of status=completed outside the complete action is rejected by the server.
[ ] iOS attachments open in-app, not Safari. Web attachments open in-app.
[ ] Completing a task with no checklist shows no checklist section and completes straight away (iOS and web).
[ ] A manager opening Tasks sees everyone's active tasks; an operative sees their own. The last choice is remembered.
[ ] A new task can't be saved without a due date (both platforms). Old tasks without one show "No due date", sort last, and Edit asks for one.
[ ] Removed assignees show "Removed user" with a reassign prompt for managers.
[ ] Web task screens use the primary.bg token; #1D5AA8 is gone from them.

Light and dark (everything this pass touched):
[ ] Each changed screen and state checked with light forced and dark forced, on both platforms. Screenshots of both are in the report.
[ ] Upload rows, progress, error rows, chips, disabled states and helper text are readable in both modes.
[ ] No new hex colours in the diff apart from the fixedColours list (search the diff).
[ ] The tokens contrast check passes in CI in both modes, and the generated colour files match the JSON.
[ ] Quick Look / the web viewer follow the mode; photos and PDFs are not tinted.
[ ] With appearanceSettingEnabled off, users still see web in light and iOS in dark (no visible change).

Existing flows (regression):
[ ] Every current flow listed under "WORK WITH WHAT'S ALREADY THERE" still works on both platforms, apart from the intended fixes.
[ ] Home task card, Tasks Due Today, notifications, Daily overview, Weekly report, Warnings and My Schedule still show task data correctly.
[ ] Tasks created before the fix (old values, no due date, old Storage paths) open, edit, complete and display correctly.
[ ] The current App Store iOS build still lists, creates, edits and completes tasks against the updated backend.
[ ] Rule changes have emulator tests; new queries have indexes; task-triggered Cloud Functions still fire.
[ ] Projects and Small works pages unchanged apart from the fixes.

Migration and shared values:
[ ] The migration dry run reports counts for each legacy value. Run it for real only after my approval; re-run the dry run afterwards and it reports zero.
[ ] rules/tasks.rules.json validates against its schema in CI.
[ ] iOS unit tests load rules/tasks.fixtures.json and pass every case.
[ ] Web unit tests load the same file and pass every case.
[ ] No hard-coded priority/status labels, attachment limits, sources or these error messages remain in either app (search both codebases).

===========================================================
REPORT
===========================================================
When finished, give me:
- the current → target map for what you changed, and the Firebase changes (rules, indexes, functions, Storage) with emulator test results
- the actual cause(s) of bug 1, with evidence, and before/after save timings on web and iOS
- what you changed per bug, per platform, plus backend and security rules
- files changed
- migration counts, and whether it has run
- test results, with anything not tested clearly marked, plus a short tap-through checklist for me
- light and dark screenshots of every screen you changed
- theme: what already existed, what you added, and how many hard-coded colours remain in the task screens
- manual steps I still need to do (CORS, App Check, deploys, scheduled function), in order
- whether an App Store release is needed for the iOS fixes
- your view on the download-URL security note
- assumptions, open questions, and anything you noticed elsewhere

Start with Phase 1 now. No code changes until I approve your findings and plan.
