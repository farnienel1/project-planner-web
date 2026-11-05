# Project Planner Web: Home Dashboard UI Spec

**Scope:** web app Home page, sidebar and top bar · **Type:** UI only · **Visual reference:** `dashboard-ui-reference.html`

The aim is to change how the Home page **looks**, not what it **does**. The new layout follows the approved design in `dashboard-ui-reference.html`, which is itself modelled on the "Vintanzo" screenshot. Every button, link, flow, save, permission and piece of content stays exactly as it is today.

---

## 1. The UI-only rule

This is the most important section. If anything else in this spec conflicts with it, this section wins.

### You MAY change
- Layout, grouping and order of elements on the Home page, the sidebar and the top bar.
- Colours, typography, spacing, borders, radii, shadows and icons.
- Visual containers: cards, tiles, tables, lists, progress bars, charts.
- Responsive behaviour: how things stack or collapse on smaller screens.
- Purely presentational components (new styled wrappers around existing elements).

### You MUST NOT change
- **Behaviour.** What any button, link, menu item or control does when clicked. The same handler, route, modal or flow must run.
- **Flows.** The steps, screens or order of any flow started from Home, such as Book labour, New, Customise, notifications or sign out.
- **Saving.** Any create, update or delete. No new writes, and no changes to existing writes, payloads, validation or timing.
- **Content and data.**
  - Do not change Firestore collections, fields, queries' results, security rules or Cloud Functions.
  - Do not change the calculations behind any number (hours, overtime, warnings, counts).
  - Do not change any wording that carries meaning (status names, warning text, labels used elsewhere).
- **Permissions.** Who can see or do what. If a role can't see something today, it can't see it after.
- **Routes and URLs.**
- **Other pages.** Daily overview, Weekly report, Warnings, Timesheets, Tasks and every other page are out of scope, apart from shared sidebar/top-bar styling.
- **The iOS app.** Don't touch it.

### How new panels get their data
Some panels in the design summarise data that already exists elsewhere in the app: Labour Summary, Booked Hours, Who's on today and Today's Tasks.

- They may **only reuse existing read-only data sources**: the same hooks, selectors, services, listeners or helper functions the relevant page already uses. No new Firestore queries and no new calculations.
- If a panel can't be powered by an existing source, **do not build a new one**. Show the panel's empty state with the line "Coming soon", or leave the panel out. Then list it in your report as **Decision needed**, and say what would be required.
- Never show hard-coded or sample figures. The reference HTML uses sample figures only to show the look.

---

## 2. Design tokens

Add these as design tokens (CSS variables / theme config, whichever the app uses). Scope them so they **only affect the Home page, sidebar and top bar** unless they already match existing global tokens.

| Token | Value | Use |
|---|---|---|
| `side-bg` | `#0A1530` | Sidebar and app background behind the main panel |
| `side-active` | `rgba(255,255,255,.07)` + 1px `rgba(255,255,255,.08)` border | Active nav item |
| `side-text` / `side-muted` | `#D9DFEA` / `#6E7A94` | Nav text / group labels, counts |
| `panel` | `#FFFFFF` | Main panel (rounded 14px, inset 10px from the window edge) |
| `page` | `#F7F8FA` | Area behind cards |
| `card` / `line` | `#FFFFFF` / `#ECEEF2` | Cards and 1px borders |
| `ink` / `ink-2` / `muted` | `#101828` / `#344054` / `#8B93A1` | Text |
| `blue` | `#3E4FD8` | Primary accent: chart line, New button, links |
| `navy` | `#1D2B7A` | Booked bars, banner text |
| `teal` | `#2EC4C0` | Secondary accent: unbooked bars, progress gradient start |
| `soft` | `#EEF2FF` | Banner and "day" chip backgrounds |
| `danger` | `#E5484D` | Warnings, unbooked, notification badge |
| `amber` | `#F5A524` | Tasks dot, overtime, "Soon" |
| Primary (black) button | `#101828` | **Book labour** only |

**Type and shape**
- Inter (or the app's existing sans-serif): body 13px, card titles 13.5–14px semibold, figures 18–22px medium, labels 10.5–11.5px muted. Use tabular numbers for all figures.
- Radius: cards 12px, buttons/inputs 8px, icon squares 7px.
- Shadows: none on cards (borders only).
- No gradients except the chart's area fill and the progress bars (teal → blue → navy).

---

## 3. Layout, element by element

Read alongside `dashboard-ui-reference.html`. The **Source** column says where each element's behaviour and data must come from. In every row it is something that already exists.

### 3.1 Sidebar (dark navy)

| Element | Design | Source (unchanged) |
|---|---|---|
| Logo + "Project Planner" | Top-left, with a collapse control (≪) | Existing logo asset. Collapse only if the app already supports it; otherwise omit the control. |
| Nav groups | **Main menu:** Home, Daily overview, Projects, Small works, Weekly report, My Schedule, Timesheets. **Team:** Operatives, Managers, Sub contractors, Manage users, Annual leave. **Alerts:** Warnings, Tasks, Site audit. Each group has a small uppercase label. Alerts items use coloured dots (red, amber, teal) instead of icons. | Existing nav items, routes and permission filtering. Do not add, remove or rename items. |
| Nav counts | Warnings and Tasks show counts on the right | The **same counts already shown on Home** (active warnings, pending tasks) |
| Nav **Customise** | Small gear/link on the group label row | Existing Customise behaviour. **If users can reorder or hide nav items, that must keep working.** If grouping can't respect a user's custom order, keep a single ungrouped list in the new style and flag it as **Decision needed**. |
| "+" on Team label | Optional | Only if it opens an existing flow (e.g. invite user). Otherwise omit. |
| Settings, Data health | Bottom of sidebar | Existing links |
| Account card | Avatar, name, organisation/email, **sign-out icon button** | Existing user data and the existing sign-out handler |
| Version line | "v1.0.0 · Project Planner" under the account card | Existing |

### 3.2 Top bar

| Element | Design | Source |
|---|---|---|
| Breadcrumb | "Raccord MEP / Home" | Existing |
| Search | Field with ⌘K hint | Existing search component and shortcut |
| **New** | Blue button | Existing New menu/flow |
| Notifications | Round icon button with red count badge | Existing notifications panel and count |
| Refresh | Round icon button | Existing refresh action |
| Avatar | Round avatar | Existing account menu (if the avatar opens one today) |

Do not add back/forward or help buttons unless they already exist.

### 3.3 Page header

| Element | Design | Source |
|---|---|---|
| "Hi, [first name]" | 22px semibold | Existing greeting |
| Date + "N active projects" + one-line subtitle | Muted 11.5px | Existing date and count. The subtitle wording is decorative and may be kept or dropped. |
| **Customise** | Outline button | The existing Home customise / gear action from the current hero |
| **Daily overview**, **Weekly report** | Outline buttons | Existing hero shortcuts, same routes |
| **Book labour** | Black primary button | Existing Book labour flow |

### 3.4 Main grid: row 1

**Left: Labour Summary card**
- Header: title, period selector, "···".
  - The period selector (default **This week**) only appears if the existing Weekly report source supports a date range; otherwise fix it to this week and remove the selector.
  - "···" only appears if it opens something that already exists; otherwise remove it.
- A bordered box of 3 figures for the selected period:
  - **Active projects:** the existing count.
  - **Hours booked:** total hours booked across all users and projects in the period, i.e. hours on site, the same figure the Weekly report shows as its hours total.
  - **Overtime hours:** the Weekly report's overtime total.
  - Use the Weekly report's own definitions. If it reports paid hours (with the OT multiplier) rather than hours on site, label the figure **Paid hours** instead. Never mix the two.
- **Team today donut** (replaces the old barcode bars):
  - A ring chart with three segments: **Booked** (`blue`), **Unbooked** (`danger`), **On annual leave** (`amber`).
  - The centre shows the total and "team today".
  - Beside it is a legend with the count and % for each segment.
  - Counts come from **Daily overview's** existing booked / unbooked / on-leave logic for today. Excluded and inactive users are treated exactly as Daily overview treats them.
  - Show the leave segment only if Daily overview already provides that count.
- A soft blue banner shows the key fact ("N people have nothing booked today. Book labour") and links to the existing Book labour flow. Hide the banner when N = 0.
- **Data:** reuse Daily overview's logic (donut) and the Weekly report's logic (hours, overtime) as-is. Otherwise apply the fallback in §1.

**Right top: stat strip.** One card with 3 tiles: **Tasks due today**, **Due this week**, **Active warnings**. The figures come from the existing Home hero values, and each tile links where the old one linked.
- The two task tiles use a small outline icon in a grey square.
- The **Active warnings** tile must stand out:
  - a **solid red filled warning triangle** (`danger`, white "!");
  - a light red tile background (`#FFF4F4`);
  - a bold red figure (`#D92D35`) and a red label.
  - It links to the existing Warnings page.
  - When the count is 0, it uses the same neutral style as the other tiles.

**Right bottom: Booked Hours chart**
- A line chart with dots, a light area fill, dashed horizontal grid, and a hover tooltip.
- A period selector only if the data source supports it.
- **Data:** reuse the Weekly report's existing calculation for paid hours per day or week. If there's no existing source for a time series, apply the fallback in §1.

### 3.5 Main grid: row 2

**Left: Today's Tasks**
- Header shows "N pending" and a **View all** link to the existing Tasks page.
- Each row: an icon, the task title and, under it, a progress bar with a % on the right.
- **Data:** the existing tasks source.
  - If tasks have no progress value, show the existing status as a small pill instead of the bar. Never invent a percentage.
  - Clicking a row does what it does on the Tasks page (or nothing, if not clickable today).

**Right: Who's on today**
This is a read-only list of **everyone on today's Daily overview and where they are**:
- booked people, with their project and hours;
- subcontractors booked today;
- unbooked people (what they're missing);
- people on annual leave.

It's a compact version of Daily overview for today, not a new data set.
- A table with columns User · Booking · Type · Time, plus **Filter** / **Sort** controls.
- A **View all** link opens the existing Daily overview for today.
- Type pills: Std / Std + OT / OT only (blue), Subcontractor (teal), Unbooked (red), Leave (amber).
- **Data:** reuse Daily overview's existing per-person data for today. Filter and sort run in memory on that data only. If they can't, omit the controls.

### 3.6 Bottom row

**Quick actions**
- A compact grid of small outline buttons (icon + label).
- **All 14** existing actions in their existing order: Weekly report, Daily overview, Tasks, Projects, Small works, Annual leave, My Schedule, Site audit, Managers, Operatives, Sub contractors, Site map, Settings, Timesheets.
- Keep the existing **Customise** for quick actions.
- Same destinations.

**Up next**
- Day chip (MON/TUE…), site and time/project, plus **See all**.
- Uses the existing Up next data and link.
- The **Maintenance "Soon"** card sits at the bottom of this card, unchanged in meaning.

### 3.7 Responsive
- **≥1100px:** as the reference.
- **<1100px:** single column.
- **<820px:**
  - The sidebar becomes the app's existing mobile drawer (or the current mobile nav, restyled).
  - The search field hides behind its icon.
  - The stat strip stacks.
  - Tables scroll inside their card.
  - No horizontal page scroll.

---

## 4. Old → new parity map

Every row must be ticked before the work is done.

| Current Home element | New location | Behaviour |
|---|---|---|
| Logo, "Project Planner", "Raccord MEP" | Sidebar brand / breadcrumb | Same |
| All 14 nav items | Sidebar groups | Same routes and permissions |
| Nav Customise | Gear on group label | Same |
| Test Admin card | Sidebar account card | Same |
| Sign out button | Sign-out icon on account card | Same handler |
| v1.0.0 · Project Planner | Under account card | Same |
| Data health | Sidebar bottom link | Same |
| Breadcrumb | Top bar | Same |
| Search + ⌘K | Top bar search | Same |
| New | Top bar blue button | Same |
| Refresh | Top bar icon | Same |
| Notifications (count) | Top bar bell + badge | Same |
| Avatar | Top bar avatar | Same |
| Date, "Hi, Test", "3 active projects" | Page header | Same values |
| Tasks Due Today | Stat strip tile 1 | Same value/link |
| Tasks Due This Week | Stat strip tile 2 | Same value/link |
| Warnings (hero) | Stat strip tile 3 | Same value/link |
| Hero gear | **Customise** button | Same action. Phase 1 must report what it opens. If it only customises quick actions (which already have their own Customise link), remove the header button and keep the quick-actions one. Flag as Decision needed. |
| Book labour | Black header button | Same flow |
| Daily overview (hero) | Header outline button | Same route |
| Weekly report (hero) | Header outline button | Same route |
| "23 active Warnings" card | Stat tile 3 + sidebar Warnings count | Same value; link to Warnings kept |
| "5 pending Tasks" card | Today's Tasks header + sidebar Tasks count | Same value; link to Tasks kept |
| 14 Quick actions + Customise | Quick actions card | Same destinations and Customise |
| Up next + See all | Up next card | Same |
| Maintenance "Soon" | Bottom of Up next card | Same |
| *(new)* Labour Summary (figures + team-today donut), Booked Hours, Who's on today, Today's Tasks list | Main grid | Read-only reuse of existing sources, or fallback |

---

## 5. Acceptance checklist

- [ ] The diff touches only presentational files: components/markup, styles, tokens, icons, and Home layout. No data-layer, service, rules, function or schema files.
- [ ] Every row in §4 is present and behaves identically. Click every button and link before and after, and confirm the same result.
- [ ] Book labour, New, Customise (both), search, notifications, refresh, sign out and nav Customise all run exactly the same flow as before.
- [ ] No new network or Firestore reads beyond those the app already performs for the reused sources. No new writes at all.
- [ ] Figures on Home match the source pages (Daily overview, Weekly report, Warnings, Tasks) for the same day or range.
- [ ] No hard-coded or sample numbers.
- [ ] Permissions: log in as each role and confirm Home shows only what that role saw before.
- [ ] Desktop, tablet and phone widths: no horizontal scroll, nothing cut off.
- [ ] No console errors or warnings introduced.
- [ ] Keyboard focus visible. Icon-only buttons have labels. Text contrast is AA.
