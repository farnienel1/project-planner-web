# Projects & Small works workspace: UI spec (navy band), web only

**Version 1.0, 17 Nov 2026.** This is the source of truth for the restyle. The reference is `projects-overview-ui-reference.html`. Where the two differ, this spec wins.

---

## 0. Read first

- **This is a UI upgrade to the WEB APP ONLY.** It changes how the pages **look**, not what they **do**.
- Platform guardrail 7 applies ("UI-only means UI-only", `docs/agent-rules/platform-guardrails.md`):
  - no change to any model, store, write payload, calculation, permission, route or navigation destination;
  - proven by a test, not by eye.
- **The iOS app is not touched.**
- **In scope:**
  1. The **workspace header**, `ProjectWorkspaceChrome` in `components/projects/ProjectWorkspaceChrome.tsx`. This covers the back link, the hero, and the `ptabs` section navigation. It appears on **every** project and small works page: Overview and every section page (Scheduling, Variations, View access, Tasks, Materials, H&S, Deadlines, Site Audit, Location, Active users).
  2. The **Overview body**, `ProjectHub` in `components/projects/ProjectHub.tsx`, and `ProjectDetailsCard`.
  3. The **loading and not-found states** of `app/dashboard/projects/[id]/page.tsx` and `app/dashboard/small-works/[id]/page.tsx`. These are restyled only.
- **Out of scope (do not touch):**
  - the **inside** of `ProjectScheduleSection` (week navigation, grid, booking cells, colours, legend), which stays exactly as it is, the booking colours included;
  - the contents of every section page;
  - the Projects and Small works **list** pages;
  - New / Edit project forms;
  - the global sidebar and top bar;
  - anything in `lib/canonical`, `lib/stores`, `lib/permissions`, `lib/projects/*` (logic), `firestore.rules`.

## 1. The UI-only rule

**MAY:**
- Change markup, classNames, CSS and layout order on the page.
- Reuse the shared page kit from the web pages pack: `components/ui/page` (`PageBand`, `StatRow`, `Card`, `Chip`) and the `--pu-*` tokens in `app/pages-ui.css`, extending them where needed with **light and dark** values.
- Swap icon wrappers. The heroicons stay the same icons.
- Add `aria-current`, `aria-label` and `role="img"` (accessibility only).

**MUST NOT:**
- Change any condition that decides what shows. These stay exactly as they are:
  - `canEdit` (`userCanEditJob`)
  - `showBook` and `showScheduling` (`canOpenJobScheduling`)
  - `showViewTile`, `showVariations`, `showActiveUsers`, `isOperative`
  - `hideWorkspaceTabs`
  - the `jobHubTiles` list and order, and the badge rules
- Change any `href`.
- Change any text (see §3; exceptions are listed there and nowhere else).
- Add new data reads, listeners, stores or calculations. Every figure shown must be a value the component **already** has.
- Add click targets. Band figures are display-only.
- Hard-code hex colours in components. Use tokens.

If a visual change would need any of these, don't make it. Report it as **Decision needed**.

## 2. Look and tokens

Reuse the existing tokens. Add any missing ones to `app/pages-ui.css` with light **and** dark values (`prefers-color-scheme` and `[data-theme='dark']`), as the file already does.

| Element | Light | Dark |
|---|---|---|
| Page | `--pu-bg` | dark value of `--pu-bg` |
| Band | `--pu-band` navy + 28px grid at `--pu-band-grid`, 16px radius | same navy, 1px `--pu-band-line` border |
| Band text | white; secondary `--pu-band-soft`; labels `--pu-band-muted` | same |
| Band figure tiles | white 6% fill, `--pu-band-line` border, 12px radius | same |
| Cards / section tiles | `--pu-card`, 1px `--pu-line`, 14px / 12px radius | dark card and line values |
| Icon tile | neutral (`--card`/`--soft` + hairline) with the icon in `--pu-blue` (no pastel tiles, `ui-touch-up.md` rule 5) | same, dark values |
| Active section tile | `--pu-blue` border, `--pu-c-blue-bg` fill, `--pu-c-blue-ink` text | dark values |
| Count pill | `--pu-c-blue-bg` / `--pu-c-blue-ink` | dark values |
| Job kind marker (the dot by the job number) and progress bar | Projects green (`--pu-c-green-*` family, e.g. #34C38F on navy); Small works amber (`--pu-amber`). Replaces `data-hue` `proj` / `sw` | same |
| Status pill | neutral on navy; green tint when the status is Active. Tone is chosen from the **existing** `workStatusLabel(status)` value only (presentational mapping) | same |
| Address warning text | existing `var(--warn)` | dark value |
| Primary button (Edit project details) | `--pu-primary` | same |
| Other buttons (Tasks, Order materials, Open scheduling) | secondary: card fill, `--pu-line` border | dark values |

**Contrast:** text at least 4.5:1 in both modes, including the muted detail text and the band labels.

**Nothing may overflow** at 1440, 1280, 1024, 820 or 390px:
- long site names, client and manager lists wrap (`overflow-wrap: anywhere` for names; section tile labels `break-word` so a word is never split);
- section tiles: auto-fill grid, minimum 172px, 2 columns on phones;
- band figure tiles: auto-fit, minimum 130px, with the progress tile spanning 2;
- band actions go full width on phones;
- the schedule keeps scrolling inside its own box;
- no horizontal page scroll.

## 3. Parity map (Before → After): nothing dropped

### 3.1 Workspace header (`ProjectWorkspaceChrome`, every page)

| Before | After | Condition / source (unchanged) |
|---|---|---|
| `← Projects` / `← Small works` ghost link above the hero | Same link, same text and href, restyled as a quiet link above the band | `catalogue`, `catalogueLabel` |
| Hero coloured by `data-hue` (green projects / amber small works) | Navy grid band (both); job kind shown by the small coloured marker and the progress bar colour | `isSmallWork` |
| Job number | Same, with the kind marker before it | `project.jobNumber` |
| Job type tag (upper case) | Same text, chip on navy | only when `typeLabel` |
| Status pill | Same text, chip on navy, toned by status | `workStatusLabel(status)` |
| Site name (`.big`) | Band title (h1), wraps | `project.siteName` |
| "Client · managers" line | Same line, band secondary text | `project.client?.name \|\| 'No client'`, `managers` |
| Edit button | Same text and href, ghost button on navy | only when `canEdit` |
| Book labour button | Same text and href (`/schedule/operatives`), white solid button | only when `showBook` |
| "{progress}% complete" + "{remaining} · {start} – {end}" + progress bar | Same two texts and bar inside the band's first figure tile (spans 2 columns) | `progress`, `remaining`, `formatLondonDay` (unchanged) |
| *(no figures in the hero)* | **Band figure tiles, display only**, labelled with the **existing tab labels**: "Variations" = `openVariations` (only when `showVariations`, 0 shown); "Tasks" = `taskCount` (only when it is not `undefined`); "Active users" = `activeUserCount` (only when `showActiveUsers` and it has a value). No new reads: the component already holds all three | display only, not links |
| `ptabs` row of section tabs (icon chip + label + count) | **Section tiles**: an even grid of the same entries in the same order, same labels ("View access", "H&S"), same hrefs, same count pills | `tabs` array unchanged |
| Active tab (`.on`) | Active tile: blue border and tint, plus `aria-current="page"` | `tabFromPath` unchanged |
| Tabs hidden on `/schedule/operatives`, `/schedule/subcontractors`, `/edit` | Tiles hidden on the same pages | `hideWorkspaceTabs` unchanged |
| Tab icons (`TAB_META`) | Same heroicons on neutral tiles; `hue` no longer colours them | `TAB_META` |

### 3.2 Overview body (`ProjectHub`)

New layout order: schedule card full width → a row of three cards (Tasks, Materials, Health & safety) → Details full width with a 2-column field grid. This is markup order only.

| Before | After | Condition / source (unchanged) |
|---|---|---|
| "This week on site" card + "Open scheduling" button | Same title and button text and href, restyled card; **inside unchanged** (`ProjectScheduleSection variant="hub"`) | only when `showScheduling` (operatives never see it) |
| Tasks card: "All" link, text, "Tasks" button | Same link, both texts (with tasks / "No open tasks. Create snags, variations and to-dos for this job."), same "Tasks" button label (secondary style) | `taskCount` |
| Materials card: "All" link, "Order materials for delivery to site.", "Order materials" button | Same texts and hrefs, secondary button (no orange) | unchanged |
| Health & safety card: "Open" link, description | Same | unchanged |
| Details card: "Edit" link | Same | only when `canEdit` |
| Details rows: Client, Manager / Managers, Timeline, Address, Description (icon + label + value) | Same rows, labels, values and fallbacks ("—", "No address yet. Add one so the team can find site." in warn colour, "No description added" muted); laid out as a 2-column grid on wide screens | `ProjectDetailsCard` |
| Notes row | Same | only when `project.notes` |
| "Edit project details" primary button | Same text and href, full-width primary | only when `canEdit` |

### 3.3 States and variants (all shown in the reference)

| Variant | What must be true |
|---|---|
| Project, admin | Everything in §3.1 and §3.2 |
| Small works | Same page; amber marker and bar; "← Small works"; its own tiles (Active users per `showActiveUsers`) |
| Operative | No Edit, no Book labour, no Scheduling tile, no "This week on site", no View access / Active users tiles, no Details Edit or button (exactly the current conditions) |
| Section page (e.g. Tasks) | Band and tiles as above with that tile active; the page body is unchanged |
| Missing data | "No client", no type tag, "—" managers, warn-colour address text, muted description; very long site name wraps |
| Loading | Existing `LoadingSpinner`, unchanged |
| Not found | Same back link text and colour per kind, same "Project not found." / "Small work not found." text, restyled only |
| Dark mode | Every variant in `[data-theme='dark']` and system dark |

**Text changes:** none, apart from the band figure labels, which reuse the existing tab labels ("Variations", "Tasks", "Active users").

## 4. Acceptance checklist

1. **Zero behaviour change.**
   - Every link and button goes to the same href.
   - Every condition shows and hides the same things for admin, manager (assigned and not assigned), operative and operative mode, on a project and on a small works.
2. **No new reads.** No new Firestore reads, listeners or store calls. Prove it with a before/after count of listeners opened on the Overview page.
3. **Nothing dropped.** Every Before row in §3 is present.
4. **Same figures.** The same project shows the same progress %, days left, dates, counts and schedule figures before and after.
5. **No overflow and no clipping** at 1440, 1280, 1024, 820 and 390px, in light and dark mode.
6. **Contrast** at least 4.5:1 for all text, in both modes.
7. **Keyboard.** You can Tab through the back link, Edit, Book labour, every section tile (focus ring visible), the cards' links and buttons, and the schedule controls.
8. **Booking colours untouched.** The schedule grid looks the same as before: Standard, Std + OT, OT only, Ann. leave, Half day, AL?.
