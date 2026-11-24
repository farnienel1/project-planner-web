# Tasks: fixes + UI and flow upgrade (iOS and web)

A shared platform feature pack for Project Planner. It does three things:

1. **Fixes** the two reported issues (web save hangs with a file attached; camera button on web) plus ten more found in the screenshots and screen recording, some of which can lose data.
2. **Upgrades the flow and UI**:
   - web: main Tasks page, the Tasks tab in Projects and Small works, and one popup for everything
   - iOS: Edit task redesign, plus the list, task screen and complete sheet brought in line
3. **Locks iOS and web together**: one rulebook, one set of test fixtures both platforms must pass, and one data shape.
4. **Light and dark mode**: every screen in this pack works in Light, Dark and Match device, from one shared colour tokens file used by both platforms.

## What's in the pack

```
tasks-upgrade/
├── README.md                     this file
├── MASTER_PROMPT.md              paste into Claude Code (self-contained: rulebook, fixtures and colour tokens included)
├── BUG_FIX_PROMPT.md             the bug-fix pass on its own, all in one (run this first if you want fixes out fast)
├── WORK_WITH_EXISTING.md         read first: current flows, iOS/web code, rulebooks, Firebase, and what must not change
├── THEME.md                      light and dark mode: decisions, rollout plan, token table, checks, whole-app rollout prompt
├── FIXES.md                      issue 1, issue 2, bugs B3–B13, with evidence and required behaviour
├── SPEC.md                       every function change (F1–F25, before → after), flows in order, data contract
├── UI_SPEC.md                    web type scale and sizes, components, popup behaviour, iOS screens
├── SHARED_RULEBOOK.md            how rulebooks keep iOS and web identical on Firebase + a parity-check prompt
├── TEST_PLAN.md                  fixes, views, popup, forms, permissions, parity, accessibility
├── rules/
│   ├── tasks.rules.json          THE shared rulebook
│   ├── tasks.rules.schema.json   CI validation (rejects a camera source on web)
│   ├── tasks.fixtures.json       worked examples iOS and web tests must both pass
│   ├── theme.tokens.json         colour tokens for light and dark (shared by every feature)
│   └── theme.tokens.schema.json  CI validation (both modes required for every token)
└── mockups/
    ├── web.html                  11 states: page, row menu, popup, complete, new, add people,
    │                             saving with files, project tab, edit, delete, small works tab
    └── ios.html                  iOS-01 to iOS-08: list, task, edit (top + scrolled), add people,
                                  add attachment, complete, saving with files
```

The mockups are generated from the rulebook and the colour tokens, so every label, priority, form order, upload source and colour on them is what those files say. Both mockups use the same six tasks and have an **Appearance** switch (Match device / Light / Dark) at the top.

## Built on what you already have

This pack describes the target, not a rebuild. Before planning, Claude Code reads the current iOS and web code, every existing task flow, any existing rulebooks and the Firebase setup (Firestore, security rules, Storage, Cloud Functions, App Check, indexes). It maps current to target, keeps what works, changes only what's listed, and protects existing data and older app versions. `WORK_WITH_EXISTING.md` spells this out and lists every current flow seen in your screenshots and recording.

**Projects and Small works pages barely change.** The header card, Edit and Book labour, progress, header stats, tab buttons and every other tab stay exactly as they are. Only the content of the **Tasks** tab changes, and tasks open in the shared popup over the page.

## How to use it

1. Put the folder in the repo at `docs/features/tasks-upgrade/` and commit it.
2. Paste `MASTER_PROMPT.md` into Claude Code at the repo root. It works even without the folder. To get the bug fixes out on their own first, paste `BUG_FIX_PROMPT.md` instead, then the master prompt afterwards.
3. Claude Code investigates first, including reproducing the upload bug with timings, and comes back with the real cause and a plan. Nothing changes until you approve.
4. Fixes ship first on their own branch. The redesign follows.
5. Any time after, run the **parity prompt** in `SHARED_RULEBOOK.md` to check iOS and web still match.

## Answers to your questions

- **Popup or window on Projects and Small works?** Popup, everywhere. One component handles view, new, edit and complete on the main Tasks page, Projects and Small works. It never takes you away from the page. The URL updates so links and the Back button work. On narrow screens it goes full screen.
- **Small text and the tiny ×:**
  - nothing under 13 px
  - task titles 15.5 px, body 15 px, labels 14.5 px in sentence case
  - the close button becomes a 40 px square
- **Flow re-ordering:**
  - Form order: Task → Project or small works → Assign to → Due date + Priority → Checklist → Attachments (→ Status in edit).
  - The view popup follows the same order.
  - "Carry out" becomes Start or Complete.
  - Every function change is listed in SPEC.md and in the master prompt as a guide.
- **iOS Edit task:**
  - styled like your Company details screen
  - people as chips with a single Add people sheet
  - "Due date" instead of "Schedule"
  - ticks kept on save, and attachments editable
  - Status can't jump to Completed
  - Delete moved to the bottom

## Light and dark mode

- **Default:** follow the device. Settings › Appearance offers Match device / Light / Dark, stored per device and applied instantly.
- **Navy stays navy** (web sidebar, iOS header band, project header card); photos and PDFs are never tinted.
- **One colour file for both platforms:** `rules/theme.tokens.json`. CI checks every text/background pair for contrast in both modes; all 46 pass.
- **No half-and-half app:** web is light-only and iOS dark-only today. The Appearance setting stays behind a feature flag until every screen on a platform is converted, so users see no change in the meantime. Everything in this pack is built mode-ready.
- **The rest of the app:** `THEME.md` has a separate rollout prompt for converting the remaining screens.

## Decisions you may want to change

| Decision | Where |
|---|---|
| Stat cards replaced by tabs with counts (they double-counted overdue tasks) | `views.tabs` |
| Managers default to Everyone, operatives to My tasks | `views.defaultScope` |
| "Due soon" (amber, weekday shown) = within 3 days | `due.dueSoonDays` |
| Priorities Low / Normal / High / Urgent; stored "medium" becomes Normal | `priorities`, `legacyPriorityMap` |
| Edit can't mark Completed; completing always goes through the checklist | `editFormStatuses` |
| Save progress always available in the complete step | `completeStep.allowSaveProgress` |
| 10 files, 10 MB each, photos shrunk to 2560 px | `attachments` |
| Permissions are a proposal: Claude Code compares with today's behaviour and asks first | `permissions` |
| Appearance follows the device by default, choice stored per device, behind a flag until the whole app is converted | `theme.tokens.json` → `appearance` |

## Also relevant

- **Your web app is light-themed and runs on Firebase.** The Insurance & accreditations pack assumed a dark web look and Postgres for its reference SQL. That pack tells Claude Code to use your real components and stack, and `SHARED_RULEBOOK.md` section 7 explains how its rulebook should run on Firebase the same way as tasks.
- **One security note to review later (not part of this change):** Firebase download links for attachments work for anyone who has them, forever.
