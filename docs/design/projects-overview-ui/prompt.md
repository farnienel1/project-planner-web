# Claude Code prompt: Projects & Small works restyle, navy band (WEB APP ONLY, UI ONLY)

> ## THIS IS PURELY A UI CHANGE. NOT A FUNCTION, BUTTON OR FORM CHANGE.
>
> **What you may change:** how things **look**. That means colours, spacing, layout, card and tile styling, fonts, icons' surroundings, and light / dark mode.
>
> **What you must not change, at all:**
> - **Functions.** Don't change any function, hook, effect, store, data read, listener, calculation or permission check. Wrap them in new markup; never edit or move their logic.
> - **Buttons and links.** Every button and link keeps:
>   - its text;
>   - its `href` or `onClick`;
>   - its condition for showing;
>   - its order relative to the others.
>
>   Don't add, remove, rename, merge or split any button or link. Restyling it is fine. Changing what it does is not.
> - **Forms.** Don't change any form, field, input, select, validation, default value or save. This pack covers the project page header and the Overview, so no form should be touched. The New / Edit project forms are out of scope.
> - **Navigation.** Every tab and tile goes to the same page as today.
> - **Text.** Use the same words everywhere. The only exception is the three band figure labels, which reuse existing tab names.
> - **Data.** Show the same figures from the same sources, with no new loading.
>
> **If you're unsure whether something counts as UI, assume it doesn't.** Leave it exactly as it is and list it as **Decision needed**.

> **READ FIRST: this is a UI upgrade to the WEB APP ONLY.**
> - It changes how the project and small works pages **look**, not what they **do**.
> - It is **not** a function, feature, flow or permission change.
> - Every link, button, tab, condition and figure must behave **exactly** as today: same href, same who-sees-what, same values.
> - If a visual change would need a behaviour change, **don't make it**. Keep today's behaviour and report it as **Decision needed**.
> - The **iOS app is not touched.**
> - Platform guardrail 7 ("UI-only means UI-only") applies and must be **proven by tests**.

You're working in the **`project-planner-web`** repo. Follow `CLAUDE.md` and everything it loads, especially:
- `docs/agent-rules/owner-working-style.md`: plain English, status line, own branch and PR, independent review before merge;
- `docs/agent-rules/ui-touch-up.md`: tokens only, light and dark, no pastel icon tiles.

## Files

Put these in the repo at `docs/design/projects-overview-ui/` before you start:

1. **`projects-overview-ui-spec.md`** is the source of truth.
   - §0 and §1 (the UI-only rules) override everything.
   - §3 is the parity map: nothing in the "Before" column may be dropped.
2. **`projects-overview-ui-reference.html`** is the visual reference. Open it in Chrome.
   - The dashed **"PREVIEW ONLY"** bar at the top switches between screens (project, small works, operative, a section page, edge cases) and Light / Dark. **Do not build it.**
   - The data in it is for look only.
   - If the HTML and the spec differ, the spec wins.

**What changes:**
1. The navy-band workspace header (`ProjectWorkspaceChrome`). It appears on **every** project and small works page, and its section tabs become an even grid of tiles.
2. The Overview body (`ProjectHub`, `ProjectDetailsCard`).
3. The look of the loading and not-found states.

**What doesn't change:**
- The **inside of `ProjectScheduleSection`** (week grid, booking colours, legend).
- The contents of each section page.
- The list pages and the edit forms.
- The sidebar and top bar.
- Anything in `lib/`, `firestore.rules` or iOS.

Reuse the shared page kit from the earlier web pages pack: `components/ui/page` (`PageBand`, `StatRow`, `Card`, `Chip`) and the `--pu-*` tokens in `app/pages-ui.css`. Add any missing token there with **light and dark** values. Don't hard-code hex colours in components.

## Non-negotiables

- **Same conditions.** Keep every one of these exactly as it is:
  - `canEdit`, `showBook`, `showScheduling`, `showViewTile`, `showVariations`, `showActiveUsers`, `isOperative`
  - `hideWorkspaceTabs`
  - the `jobHubTiles` list and order
  - the tab badge rules
  - "operatives never see scheduling" (owner decision 17 Nov)
- **Same hrefs and the same text.** The only new visible words are the band figure labels, and they reuse the existing tab labels ("Variations", "Tasks", "Active users").
- **No new data.** Band figures use only values the component already has: `openVariations`, `taskCount`, `activeUserCount`, `progress`, `remaining`, the dates. **No new reads, listeners or calculations.** "Booked this week" is **not** shown in the band, because it lives in `ProjectScheduleSection` and stays there.
- **Band figures are display-only.** They are not links.
- **Booking colours untouched.** The schedule grid keeps Standard / Std + OT / OT only / Ann. leave / Half day / AL? exactly as today.
- **Light and dark mode, both required.**
  - Check every variant in `[data-theme='dark']` and in system dark.
  - Text contrast must be at least 4.5:1, including band labels and muted text.
- **Nothing may overflow** at 1440, 1280, 1024, 820 or 390px (spec §2):
  - long names wrap;
  - tile labels never split mid-word;
  - the schedule scrolls inside its own box;
  - there is no horizontal page scroll.
- **Nothing dropped.** If you find something in code that spec §3 doesn't list, **stop and report it**.

## How to work

### Phase 1: Inspect, then stop. No edits.

1. Confirm the files:
   - `components/projects/ProjectWorkspaceChrome.tsx`
   - `components/projects/ProjectHub.tsx`
   - `ProjectDetailsCard`
   - `components/projects/ProjectFeaturePageShell.tsx`
   - the two `[id]/page.tsx` pages
   - where `.hero`, `.ptabs`, `.card`, `.ico-chip` and `data-hue` are styled
   - which other screens share those classes (so the restyle can't leak into them)
2. For every row in spec §3, give the current element, its condition and its href.
3. List every variant the code renders:
   - admin;
   - manager, assigned and not assigned;
   - operative and operative mode;
   - project vs small works;
   - section pages;
   - hidden-tab pages;
   - loading;
   - not found.

   Also list anything §3 doesn't cover.
4. List the files you'll change. They must be presentational only. Say how you'll keep the new styles scoped to these pages.
5. **Stop and wait for my approval.**

### Phase 2: Build (commit after each step)

1. Tokens and any small shared pieces in `app/pages-ui.css` / `components/ui/page`, light and dark.
2. Workspace header: the back link, the navy band, and the band figures.
3. Section tiles: replace the `ptabs` look and keep the same `tabs` array, hrefs, badges, active state, plus `aria-current="page"`.
4. Overview body: card wrapper for the schedule (inside untouched), then the Tasks / Materials / H&S row, then Details.
5. Loading and not-found looks.

Wrap the existing logic. **Don't rewrite or move it**: no change to hooks, effects, stores or permission calls.

### Phase 3: Verify and report

1. Work through spec §4 item by item, with evidence for each. **Zero behaviour change** comes first; any difference is a failure.
   - Include a line confirming: "No function, button behaviour or form was changed."
   - Back it with the list of files changed, showing that only markup, classNames and CSS moved.
2. **Link and visibility test** (automated where the repo's test setup allows, otherwise a scripted manual run). For admin, an assigned manager, a non-assigned manager and an operative, on a project and on a small works:
   - list every link and button shown and its href, before and after;
   - the lists must be identical.
3. **Same figures.** For the same job, before and after:
   - progress %, days left, dates, counts;
   - the schedule week (cells and totals) must be identical.
4. **No new reads.** Show that the number of Firestore listeners and reads on Overview and on one section page is the same before and after.
5. **Full suite:** `npm run lint`, `npm test`, `npm run build`, `npm run check:calculators`. All must pass at least as before, with no tests skipped or weakened.
6. **Screenshots** of every variant from spec §3.3:
   - widths: 1440, 1024 and 390px;
   - **light mode and dark mode**;
   - plus a keyboard-focus screenshot of the section tiles.
7. **PR** from `.github/pull_request_template.md`:
   - 3-factor table (Web: this restyle; iOS: none; Shared rule: none);
   - Screen map rows updated;
   - "Deploy needed: nothing";
   - Not done / follow-ups;
   - What I did NOT check.

   Then the independent review before merge.

Don't claim anything works unless you've tested it.

Begin with Phase 1.
