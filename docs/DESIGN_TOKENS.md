# Design tokens — sidebar, top bar and Home

Visual design only. This is not part of the rulebook (`docs/RULEBOOK.md`): no business rule, data, route or permission depends on it. iOS can match it later screen by screen.

Owner decision 11 (5 Nov 2026, `docs/OWNER_DECISIONS.md` "Web Home dashboard restyle"): the designer palette from the Home dashboard design pack replaces the earlier brand-blue sidebar and hero, as scoped `--dash-*` tokens with dark-mode values, and with the four AA contrast failures in the design fixed.

Source of truth on web: `app/brand-shell.css` (CSS variables, light, system dark under `prefers-color-scheme: dark` guarded by `:root:not([data-theme='light'])`, and `[data-theme='dark']`). Components use the variables or the classes in `brand-shell.css` (`.sb-*`, `.tb*`, `.app-frame`, `.app-panel`, `.home .dash-*`), never a hex value. The older `--brand-*`, `--danger-*`, `--page-bg`, `--card-*` tokens stay defined for the Tailwind aliases in `tailwind.config.js`.

## Tokens

| Token | Light | Dark | Use |
|---|---|---|---|
| `dash-side` | `#0A1530` | `#060C1E` | Sidebar and the frame around the main panel |
| `dash-side-hi` | `rgba(255,255,255,.07)` | same | Active nav item fill (with a `dash-side-line` border) |
| `dash-side-line` | `rgba(255,255,255,.08)` | same | Sidebar dividers, active item border |
| `dash-side-ink` | `#D9DFEA` | same | Nav text |
| `dash-side-muted` | `#8D98B0` | same | Section labels, organisation name, version line, Customise link |
| `dash-panel` | `#FFFFFF` | `#0F1729` | Top bar |
| `dash-page` | `#F7F8FA` | `#0B1220` | Area behind the cards (main panel) |
| `dash-card` / `dash-line` | `#FFFFFF` / `#ECEEF2` | `#131C2E` / `#24314B` | Cards and 1px borders |
| `dash-ink` / `dash-ink-2` / `dash-muted` | `#101828` / `#344054` / `#667085` | `#EAF0F8` / `#C5CFDE` / `#9AA6BA` | Text |
| `dash-blue` | `#3E4FD8` | `#8C9BFF` | Links, icons, day chips |
| `dash-blue-solid` | `#3E4FD8` | `#4A5BE0` | Fill behind white text: New button, booked ring segment, avatar |
| `dash-navy` | `#1D2B7A` | `#C9D2FF` | Banner text |
| `dash-teal` | `#2EC4C0` | `#3AD0CC` | Secondary accent |
| `dash-soft` | `#EEF2FF` | `#1B2550` | Banner and day-chip backgrounds |
| `dash-danger` | `#E5484D` | same | Warnings triangle, unbooked ring segment (fills, no text) |
| `dash-danger-solid` | `#D92D35` | same | Notification badge fill (white text) |
| `dash-amber` | `#F5A524` | `#F5B544` | On-leave ring segment, "Soon" |
| `dash-warn-bg` / `dash-warn-ink` / `dash-warn-label` | `#FFF4F4` / `#C4242C` / `#B42318` | `#2B1416` / `#FF8F92` / `#FFB1B3` | Active-warnings tile, task-limit alert |
| `dash-primary-bg` / `dash-primary-ink` | `#101828` / `#FFFFFF` | `#EAF0F8` / `#0B1220` | Book labour (the one black button) |
| `dash-track`, `dash-icon-bg`, `dash-control-bg`, `dash-hover-*` | `#EEF0F4`, `#F2F4F7`, `#FAFBFC`, `#FAFBFF` / `#CDD5F5` | `#24314B`, `#1A2438`, `#131C2E`, `#18223A` / `#3A4A7A` | Ring track, icon squares, search field, hover |
| `dash-tag-{blue,teal,red,amber,grey}-{bg,ink}` | see `brand-shell.css` | see `brand-shell.css` | Type pills (Booked, Subcontractor, Unbooked, Leave, Office) |
| `dash-focus` | `#3E4FD8` | `#8C9BFF` | Keyboard focus ring (2px, offset 2px); white in the sidebar |

**Contrast fixes (AA, measured):** design `muted #8B93A1` was 3.09:1 on white → `#667085` 4.97:1 (4.68:1 on `#F7F8FA`); `side-muted #6E7A94` was 4.19:1 on `#0A1530` → `#8D98B0` 6.24:1; white on the badge `#E5484D` was 3.91:1 → fill `#D92D35` 4.80:1; the warnings figure `#D92D35` on `#FFF4F4` was 4.45:1 → `#C4242C` 5.36:1. The teal pill text is `#0E7C78` (4.52:1) and the grey pill text `#5D6679` (5.19:1). Every dark value above passes AA on its background.

**Tokens with one value in both modes (deliberate):** `--dash-side-hi`, `--dash-side-hover`, `--dash-side-line`, `--dash-side-ink`, `--dash-side-muted` (the sidebar is dark in both modes), `--dash-danger`, `--dash-danger-solid` (graphic and badge fills: badge 4.80:1, danger graphic 4.35:1 on the dark card). The ring's On leave (`#F5A524`, 2.04:1) and teal (2.15:1) segments are below the 3:1 non-text guide on white; every segment's count is also shown as text in the legend and the ring has an `aria-label`, so no information depends on the colour alone.

Type: Inter (the app body font). Body 13px, card titles 13.5px semibold, figures 18–22px medium, labels 10.5–11.5px; tabular numbers on Home. Radii: cards 12px, buttons and inputs 8px, icon squares 7px, main panel 14px. Cards have borders, no shadows. No gradients except the avatar.

## Frame and sidebar

- Desktop (1024px and up): the page sits in a rounded `dash-page` panel inset 10px from the window on a `dash-side` frame; the sidebar is 244px. Below 1024px the sidebar is the existing drawer (unchanged behaviour) and the panel fills the window.
- Sections are the existing ones — Home, Navigate (with **Customise**, a small gear link on its label row, which opens the existing Customise sheet: reorder, hide, add), Tools, Team, App & account — so a user's customised Navigate list is kept. No counts.
- Items: 34px, radius 7px, 16px outline icon, 13px label in `dash-side-ink`; hover a faint fill; the active page (`aria-current="page"`) uses `dash-side-hi` with a border and white text.
- Foot: Data health link (same gate as before: admins, or not production), the account card (avatar, name, organisation) with a **Sign out** icon button (`aria-label="Sign out"`, same confirm dialog), and "v1.0.0 · Project Planner".

## Top bar

54px, `dash-panel` with a bottom `dash-line` border. Breadcrumb 12.5px (organisation muted / page). Search field 280px with ⌘K (icon only below 821px). New is `dash-blue-solid`. Refresh and the bell are 30px bordered icon buttons; the bell's label includes the unread count, and its badge is `dash-danger-solid`. The avatar opens the existing account menu.

## Home

- Header: "Hi, name", date · active projects; buttons Customise (admins, opens Dashboard metrics), Daily overview, Weekly report (admins), Book labour (black).
- Stat strip: the viewer's metric tiles; a warnings tile above 0 gets the solid red triangle on `dash-warn-bg`.
- Cards: Labour Summary with the ring (admins), Who's on today (admins), unbooked banner (`dash-soft`), Tasks to do, Waiting for you, Quick actions (34px outline buttons, `dash-blue` icons), Up next with day chips.
- Below 1100px one column; below 820px the stat strip stacks, quick actions are two columns, tables scroll inside their card; no horizontal page scroll at 390px.

Other screens keep the `docs/agent-rules/ui-touch-up.md` rules.
