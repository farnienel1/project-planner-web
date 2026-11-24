# UI spec

Visual reference: `mockups/web.html` and `mockups/ios.html`. Both have an **Appearance** switch (Match device / Light / Dark). Use the codebase's existing components where they exist.

**Light and dark mode:** every colour on these screens comes from `rules/theme.tokens.json` (see `THEME.md`). Web light and iOS dark match today's apps; web dark and iOS light are new. No hex values in screen code. Navy brand elements (web sidebar, iOS header band, project header card) stay navy in both modes.

## 1. Web

The current web app: navy sidebar, light grey page, white cards. Keep that. The upgrade is about size, consistency and one popup.

### Colour tokens used on these screens

Values for both modes are in `rules/theme.tokens.json`; the full table is in `THEME.md`.

| Role | Token |
|---|---|
| Sidebar (navy in both modes) | `brand.navy`, selected item `brand.navyRaised`, text `brand.navyFg` / `brand.navyFgMuted` |
| Page background | `bg.page` |
| Cards, rows, popup | `bg.surface`, border `border.default`, inner dividers `border.subtle` |
| Hover, popup footer, drop zone | `bg.surfaceSubtle` |
| Inputs | `bg.input`, border `border.strong`; locked fields `bg.inputMuted` |
| Text | `text.primary`, `text.secondary`, `text.tertiary` (min 13 px), links `text.link` |
| **Primary buttons (everywhere in tasks)** | `primary.bg` / `primary.fg`. Light is `#3D4FD8`, the app-wide "New" button colour. Stop using `#1D5AA8` |
| Selected tab / option | `primary.soft` / `primary.softFg` |
| Secondary buttons | `secondary.bg` / `secondary.fg` + `border.default` |
| Status and priority chips | `tone.{red,amber,green,blue,grey}.fg` on `.bg` |
| Overdue / due-soon row edge | `tone.red.rail` / `tone.amber.rail` |
| Ticked checkbox | `tone.green.solid` with `tone.green.solidFg` tick |
| Popup dimming, shadow | `overlay.scrim`, `shadow.popup` |
| Focus ring | `focus.ring`, 3 px |

### Type scale (the main complaint: everything was 11–13 px)

| Use | Size / weight |
|---|---|
| Page title | 28 px / 700 |
| Popup title | 22 px / 700 |
| Group header (project name) | 17 px / 600 |
| Task title in list | 15.5 px / 600 |
| Body, inputs, buttons | 15 px (inputs) / 14.5 px 600 (buttons) |
| Field labels | 14.5 px / 600, sentence case (no tiny uppercase labels) |
| Meta, chips, helper text | 13–13.5 px. **Nothing below 13 px.** |

### Sizes

- Buttons 40 px high (34 px "small" in rows). Icon buttons 36 px.
- **Popup close button 40 × 40 px with a 20 px icon** on a grey square, top right. (Today it's a tiny ×.)
- Inputs 44 px; task name input 50 px.
- Row height around 64 px; whole row clickable, with keyboard focus and Enter to open.

### Components

- **TaskTabs** — tabs with counts from `views.tabs`; Overdue count red when above 0; Approvals hidden at 0.
- **ScopeSwitch** — segmented My tasks / Everyone (`views.scopes`); hidden for operatives.
- **TaskToolbar** — search + filter dropdowns. Project/small works filter only on the main page.
- **TaskRow** — columns: status circle · title + meta (location on main page, checklist x/y, file count, status word) · assignee avatars · due (words, then date) · priority chip · main action button · ⋯. Left edge 4 px red for overdue, amber for due today/soon.
- **TaskGroup** — main page only: type badge (Project / Small works), code, name, "n active", "Open project".
- **TaskPopup** — one component with four modes: view, new, edit, complete.
  - Width 760 px, max height viewport − 88 px, sticky header and footer, body scrolls.
  - Under 640 px wide: full screen.
  - Focus trapped inside; Esc closes (asks to discard if there are changes); focus returns to what opened it.
  - URL: `?task={id}` for view, `&mode=edit` / `&mode=complete`; `?task=new` for new. Browser Back closes it. Opening a link straight to `?task={id}` opens the page with the popup on top.
  - Used on the main Tasks page, the project Tasks tab and the small works Tasks tab. **No full-height window anywhere.**
- **TaskForm** — fields in `formOrder`; Due date and Priority share a row; people chips + Me + Add people popover (search, Managers/Operatives, trade filter); checklist with drag handles; drop zone + Upload files + Site audit (no camera).
- **UploadList** — per-file row: thumbnail, name, status ("Uploaded · 1.8 MB (from 6.4 MB)", progress bar, or error with Retry / Remove). Save button shows overall progress.
- **AttachmentViewer** — lightbox; ⋯ holds Download and Report a problem with this file.
- **ConfirmDialog** — delete and discard.

### Pages

- **Main Tasks page** — header, TaskTabs, ScopeSwitch + TaskToolbar, TaskGroups of TaskRows.
- **Project › Tasks** and **Small works › Tasks** — **only the Tasks tab content changes.** Everything above it stays exactly as today:
  - the back link and the navy header card (code, type badge, status, name, client and manager, Edit, Book labour)
  - the progress bar and header stats (Variations, Tasks, Active users)
  - the grid of tab buttons
  - every other tab

  Inside the Tasks tab: section title "Tasks" with **New task** (not "+ Tasks"), then the same TaskTabs, ScopeSwitch, TaskToolbar and one flat list. Counts are for that location only, and the header "Tasks" stat shows the same Active count. Tasks open in the shared popup over the page. The mockup outlines the only area that changes.

## 2. iOS

Dark mode keeps today's look; light mode is new. Both come from the tokens: the navy grid header band (`brand.navyHeader`, same in both modes) with sheets on `bg.page`, groups on `bg.group`, cards on `bg.surface` with `border.default`, primary pills `primary.bg` / `primary.fg`. Controls sitting on the navy band (Done/Cancel pills, scope switch, tab pills, search) keep their on-navy styling in both modes. Use colour assets with Any/Dark appearances (or the generated theme object), never fixed colours. Check the status bar, keyboard, date picker, share sheet and Quick Look follow the chosen mode.

### Tasks list (iOS-01)

- Nav bar: Done · Tasks · + (new task).
- ScopeSwitch (My tasks / Everyone), then tab pills with counts, then search. The old stat row is removed (it repeated the tab counts under different names).
- Card: status circle, title (17.5 px semibold), location line, meta (checklist, files, status word), priority chip top right; bottom row: avatars, due in words (red/amber), main action pill.

### Task (iOS-02)

Same section order as web. Checklist tickable. Attachments open in Quick Look. Edit and Complete fixed at the bottom. ⋯ in the nav bar: Copy link, Open project, Delete task.

### Edit task (iOS-03, iOS-04) — the main iOS change

- Sheet styled like **Company details**: navy header with **Cancel** pill, centred title "Edit task" with the location under it, and a single full-width **Save changes** at the bottom (rides above the keyboard). No second Save at the top.
- Sentence-case section labels at 15 px semibold (Task, Project or small works, Assign to, Due date, Priority, Checklist, Attachments, Status).
- Task: name 19 px semibold, details below in the same group.
- Project or small works: locked row with a lock icon.
- Assign to: person chips with remove ×, **+ Me**, **Add people** (opens iOS-05).
- Due date: one row with the weekday and a date pill. Label is **Due date**, not "Schedule".
- Priority: 4 equal buttons with coloured dots, matching web.
- Checklist: tick state shown and kept; drag handle to reorder; swipe left to delete; **Add item**. Notes per item appear only once you add one (no empty "Note (optional)" under every item).
- Attachments: thumbnails with remove badge + add tile (opens iOS-06).
- Status: To do / In progress, Completed shown disabled with the hint.
- **Delete task** as its own red row at the very bottom.
- Keyboard: dismiss on scroll; Return moves to the next field; Save stays reachable.
- Cancel with changes asks "Discard changes?".

### Add people (iOS-05)

Sheet: Done, search, Managers / Operatives switch, trade chips, list with tick circles, "2 selected".

### Add attachment (iOS-06)

Take photo, Photo library, Files, Site audit (from `attachments.sources.ios`), with the limits line from the rulebook.

### Complete task (iOS-07)

Checklist with progress; Proof of work tiles (Take photo, Photo library, Files); Notes; footer **Save progress** and **Complete task** with the hint underneath.

### Saving with files (iOS-08)

Per-file rows and progress inside the Save button, Retry on a stalled file, as web.

## 3. Wording

All text is in `copy.*` of the rulebook: sentence case, British spelling, dates `d MMM yyyy` (short `d MMM`), actions named the same everywhere (Complete → "Task completed", Start → "Task started").

## 4. Accessibility (both)

- Every icon-only button has a label ("More actions for Walk test emergency lighting", "Close").
- Status and priority never shown by colour alone.
- iOS Dynamic Type: cards and forms grow; nothing truncates that matters.
- Web: keyboard reachable rows, visible focus ring, Esc, focus return, `role="dialog"` / `alertdialog`.
- Minimum text 13 px on web; contrast at least 4.5:1 for every pair in `contrastPairs`, in both modes (CI checks this).
- Every screen checked in Light, Dark and Match device (THEME.md section 6).
