# 03 — Design system

> Spec: rebuild Phase 1 `03-design-system.md` · Blueprint starting point: §3 (desktop-first) and §4 (feel).
>
> Tokens below are copied from the cited Swift token files via the blueprint. **Not** sampled from Assets.xcassets (catalog not on disk). Web `tailwind.config.js` today only defines a generic `primary` blue scale (`#3b82f6`) — it does **not** implement this system.

## 1. Feel

Light, calm, card-based: off-white canvas, white cards, hairline borders, 14–18pt corners, almost no shadow. Type is mostly medium-weight system at small sizes. Colour is used sparingly via **tinted icon chips** and **capsule status pills**. One strong element per screen: usually the **blue gradient hero**. Exceptions: dark navy login; H&S / Weekly report / Materials / Annual leave module palettes.

Appearance (`ThemePreference`): Light (default), Dark, Match system — **device / `localStorage` only**. Accent (`AppColorScheme`) tints selections: Blue `#0D67ED` (default), Green `#33B24C`, Yellow `#FFCC00`, Pink `#FF66B2`.

## 2. Colour tokens

Source: `Views/ProjectSmallWorksRevampTokens.swift` → `ProjectWorksRevampColors` unless noted.

| Token | Light | Dark | Use |
|---|---|---|---|
| `canvas` | `#F7F8FA` | `#0B1017` | App / page / nav background |
| `card` | `#FFFFFF` | `#151C26` | Cards |
| `ink` | `#0B1020` | `#F2F5F9` | Primary text |
| `muted` | `#6B7280` | `#9AA7B8` | Secondary text |
| `border` | `#EEF0F3` | `#252F3D` | Hairlines, dividers |
| `searchBorder` | `#E5E7EB` | `#2A3544` | Search, unselected chips |
| `blue` (primary) | `#185FA5` | `#6B95FF` | Actions, links, selected chip |
| `blueLight` | `#378ADD` | `#8BB4FF` | Gradient end |
| `activeGreen` | `#0F6E56` | `#2ED18D` | Active status |
| `upcomingAmber` | `#854F0B` | `#F2AE45` | Upcoming status |
| `jobTypePillBg` / `jobTypePillInk` | `#EEEDFE` / `#3C3489` | `#241F45` / `#C8C0FF` | Job type pill |
| `requiredPillBg` / `requiredPillFg` | `#FCEBEB` / `#A32D2D` | `#3A1E1B` / `#FF6F63` | REQUIRED / destructive |
| `placeholderInk` | `#C5C9D2` | `#6B7686` | Placeholders, version |
| `pinRoseBg` / `pinRoseFg` | `#FBEAF0` / `#993556` | `#3A1E28` / `#F0A0B8` | Map pin chips |
| `endDateBg` / `endDateFg` | `#FAECE7` / `#993C1D` | `#3A2418` / `#F0B090` | End-date chips |

Other shared:

| Colour | Value |
|---|---|
| Hero gradient | `#185FA5` → `#378ADD`, top-left → bottom-right |
| Chevrons / row icons | `#C4C9D1` / `#C5C9D2` |
| Circle-button border | `#E6E8ED` |
| Unread dot | `#E34A4A` |

Icon chip tints (light) + icon colour:

| Chip | Background | Icon |
|---|---|---|
| Blue | `#E6F1FB` | `#185FA5` |
| Green | `#E1F5EE` | `#0F6E56` |
| Amber | `#FAEEDA` | `#854F0B` |
| Purple | `#EEEDFE` | `#534AB7` |
| Rose | `#FBEAF0` | `#993556` |
| Coral | `#FAECE7` | `#993C1D` |
| Red | `#FCEBEB` | `#A32D2D` |
| Grey | `#F2F3F5` | `#6B7280` |
| H&S | `#E3FAF2` | `#129E78` |
| Deadlines | `#E6F2FA` | `#185FA5` |

Project status pills (`ProjectsView.swift` ~L427): Active `#E1F5EE`/`#0F6E56` + 5px dot; Upcoming `#FFF6E1`/`#854F0B`; Completed/Inactive `#F2F3F5`/`#6B7280` (Completed uses check icon). Capsules, 10pt medium.

### Module palettes (use only inside that module)

**Login** (`AuthenticationView.swift` `LoginBrand`): bg `#060E1A` → `#0B1828` → `#071422`; accent cyan `#22E5FF`; button `#1A6BF5` → `#0E4FD8` → `#0A3EC4`; field fill white 5% (8% focused); field border white 10%, focused cyan 50% + glow; 40px grid cyan 4%; glows cyan 12% and blue 15%.

**H&S** (`Views/HSTheme.swift`): bg `#F4F6FA`, card `#FFFFFF`, line `#E6EBF2`, ink `#0E1726`, slate `#667488`, blue `#2F6BFF`, blueDeep `#1E4FD8`, navy `#12233C`, teal `#0FAE9E`, green `#12A46A`, amber `#E08A1E`, red `#E2493F`, violet `#6D5AE6`. Dark values in the Swift file (❓). Hero `#3F86FF` → `#2F6BFF` → `#1E4FD8`. Radius 20, padding 16, screen padding 18. Two-layer shadows. Title 20 bold, hero 24 bold, stat 28 heavy.

**Materials** (`MaterialsOrderingTheme.swift`): primary `#1A6EC2` → `#2F90E6`; tint `#E3F2FE`; page `#F6F8FB`; border `#E2E8F0`; ink `#141C2F`; muted `#67758A`; success `#259252`; danger `#C13C3C`; warning `#BA7827`.

**Annual leave** (`HolidayChrome.swift`): accent `#185FA5`; taken `#228B51`; pending request `#E33838`; pending metric `#FA9E17`; approved half day `#F2851F`.

**Weekly report** (`WeeklyReportColors`): navy `#0B1220`; cyan `#0EA5E9`; blue `#2563EB`; orange `#F97317`; muted `#64748B`; light/mid `#F0F7FF`/`#E2EBF6`; red `#FEF2F2`/`#991B1B`; green `#F0FDF3`/`#166634`.

**User profile** (`ManageUserProfilePalette`): page `#F2F2F7`; header `#0B1020` → `#1A2447`; hero `#185FA5` → `#378ADD`; avatar `#7F77DD` → `#534AB7`; segmented/search `#E9E9EC`; list blue `#2563EB`.

**Site audit:** core palette + module pills (`SiteAuditDesignSystem.swift`).

## 3. Typography, shape, elevation

**Font:** `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, system-ui, sans-serif`. No custom fonts. Never embed SF Pro.

**Weights:** 500 medium default; 600 semibold titles; 900 black only for login wordmark “PROJECT” / “PLANNER”.

| iOS pt | Use | Desktop px (≥1024, Blueprint §3.2) |
|---|---|---|
| 9–10 | Pills, captions, stat labels | 12 |
| 11 | Uppercase section labels (tracking 0.3–0.4), meta | 13 |
| 12–13 | Secondary, row subtitles | 14–15 |
| 14–16 | Row titles, body | 16 |
| 17 | Section headings e.g. Up next | 18 |
| 18 | Metric values on phone | 28–32 stat numbers |
| 20–22 | Screen titles (tracking −0.3) | 28–32 page titles |
| 24–30 | Hero / login wordmark 30 | 36–40 |

Spacing 8/10/12/14/18 → 12/16/16–20/20/24–32. Card padding 14–18 → 20–24. Icons 15–20 → 18–24. Icon chips 30–40 → 40–48. Avatars 36–44 → 40–48.

**Radius:** chips 4–12; list cards 14–16; hero / bottom-bar 18; H&S 20; capsules full. Hairline 0.5pt → 1px. Min tap 44pt → 40px click + hover/focus.

**Elevation:** almost none. Shadows only on bottom bar (upward), toasts (20% black, 6px blur), login button glow, H&S cards.

## 4. Layout rules (desktop-first — required)

| Width | Shell |
|---|---|
| ≥1280px (`xl`) | Sidebar 272px + top bar 64px. Content max 1440px, 40px padding |
| 1024–1279 (`lg`) | Sidebar 248px, collapsible to 76px rail. 32px padding |
| 768–1023 (`md`) | Icon rail or drawer. 24px padding |
| &lt;768 | iOS: bottom bar (Home, 3 tabs, More), 18px padding, sheets as bottom sheets |

Sidebar **is** the Main Menu (same sections, order, chips, labels, badges, permissions). Home first. Active item: primary at 18% opacity. “Customise sidebar” replaces jiggle-edit; persist `bottomBarMovableTabOrder.{uid}`. Pin Sign out + version at bottom.

Top bar: iOS nav title + breadcrumb; right: **+ New** (Project, Small work, User, Task), refresh, bell (`#E34A4A` unread), avatar initials on primary circle.

Patterns (Blueprint §3.3): card grids 2@lg / 3@2xl; people = tables; list+detail split ≥1280 with 400px list; job hub = hero + 8/12 manage tiles + 4/12 sticky details; sheets = centred modal 640 / 760–880 with iOS header + sticky footer; 2-column short fields; timesheets/week views use full width; swipe → ⋯ + right-click; pull-to-refresh → header button.

Hover: border → `searchBorder` + light shadow + pointer. Focus: 2px primary ring. Esc closes, Enter submits. No jiggle/swipe hints on desktop.

**Optional extras (ask first):** ⌘K palette, projects table/grid toggle, keyboard shortcuts for New project.

Check every page at **1440, 1280, 1024, 390**.

## 5. Shared components (iOS → React)

Build once under `components/ios/` or `components/shared/`, same names:

| iOS | File | React |
|---|---|---|
| `WorksListStatsRow` | `ProjectSmallWorksRevampTokens.swift` | Active/Upcoming/Completed stats |
| `WorksListSearchRow` | same | Search 12pt + filter button |
| `WorksRevampFilterChip` | same | Capsule; selected = blue fill white text |
| `appChromeCardContainer` | same | White card r14 1px border |
| `ProjectDetailRowView` / `SmallWorksDetailRowView` | list views | Canonical work card (below) |
| `SettingsHubChrome` | `SettingsHubChrome.swift` | Settings card, footer, full-width blue save r14 15pt “Saving…” |
| `ManageUser*` | `ManageUserProfileChrome.swift` | Profile / permission / account rows |
| `PermissionToggle` | `AddUserView.swift` ~L1215 | Title + description + switch |
| `StaffTradeTypeFormSection` | same name | Preset + Other |
| `LineManagersMultiSelectSheet` | same | Multi-select people |
| `MapPinPickerView` | same | Set pin on map |
| Hours timeline bars | BookingHours / ScheduleHours / WorkingHours | Day timeline |
| Clash cards | clash views | Hatched overlay |
| Signature pads | Invoicing, H&S | Canvas, base64 PNG |
| `OfflineStatusBanner` | same | Connectivity banner (outbox: ask) |
| `InAppRemoteDocumentViewer` | same | PDF/image viewer |
| AL hero + day decorations | annual leave | |
| Warnings hero/chips/badge/remove | `WarningsRevampViews.swift` | |

Module sets: `HS*` (19), `SiteAudit*`, `DL*`, `Materials*`.

**Canonical work card:** white, r16, 1px `border`, pad 14. Top: job number 16pt medium tracking −0.2 + job-type pill (9pt, `customJobType` uppercased else `jobType` raw) + status pill. Site name 13pt medium. Four icon rows 13pt icon `#C5C9D2`, 11pt muted: client, address, manager, `d MMM yyyy – d MMM yyyy`. Progress 10pt/11pt, 5px track, blue→blueLight fill (or `#C5C9D2` if completed). Progress = elapsed time; 100% if completed or past end.

## 6. SF Symbol → web icon

Apple’s licence does not allow SF Symbols on the web. **Lucide is not installed.** `@heroicons/react` is installed but unused. Recommendation at Gate 1: add `lucide-react` (blueprint names) **or** actually use Heroicons. Until then, keep a mapping table.

| SF Symbol | Used for | Suggested Lucide |
|---|---|---|
| `house.fill` | Home | `House` |
| `folder.fill` | Projects, Job types | `Folder` |
| `hammer.fill` | Small works | `Hammer` |
| `person.3.fill` | Operatives, Active users | `UsersRound` |
| `person.badge.key.fill` / `person.badge.shield.checkmark.fill` | Managers | `UserCog` / `ShieldCheck` |
| `person.2.fill` | Manage users, Clients QA | `Users` |
| `person.badge.plus(.fill)` | Add user | `UserPlus` |
| `person.2.badge.gearshape.fill` | Sub contractors | `Handshake` |
| `briefcase.fill` | Clients menu | `Briefcase` |
| `sun.max.fill` | Annual leave | `Sun` |
| `map.fill` | Site map | `Map` |
| `doc.text.viewfinder` | Site audit | `ScanText` |
| `doc.text.fill` | Timesheets | `FileText` |
| `graduationcap.fill` | Qualifications | `GraduationCap` |
| `square.grid.2x2.fill` | Job types menu | `LayoutGrid` |
| `shippingbox(.fill)` | Catalogue, Materials | `Package` |
| `building.2(.fill)` | Wholesalers | `Building2` |
| `gearshape.fill` | Settings | `Settings` |
| `questionmark.circle.fill` | Help | `CircleHelp` |
| `key.fill` | Reset password | `KeyRound` |
| `rectangle.portrait.and.arrow.right` | Sign out | `LogOut` |
| `arrow.clockwise` | Refresh | `RotateCw` |
| `bell.fill` | Notifications | `Bell` |
| `exclamationmark.triangle.fill` | Warnings | `TriangleAlert` |
| `checklist` | Tasks | `ListChecks` |
| `plus.rectangle.on.rectangle` | Tasks QA | `CopyPlus` |
| `calendar` | My Schedule | `Calendar` |
| `calendar.badge.clock` | Daily overview, Deadlines | `CalendarClock` |
| `calendar.badge.plus` | Booking toast | `CalendarPlus` |
| `chart.bar.doc.horizontal` | Weekly report | `FileChartColumn` |
| `plus.square.fill` | Create project | `SquarePlus` |
| `folder.badge.plus` | Quick create Project | `FolderPlus` |
| `slider.horizontal.3` | General app | `SlidersHorizontal` |
| `sparkles` | Quick create card | `Sparkles` |
| `wrench.and.screwdriver.fill` | Maintenance | `Wrench` |
| `eye` / `eye.slash` | Visibility / password | `Eye` / `EyeOff` |
| `cross.case.fill` | H&S | `BriefcaseMedical` |
| `clipboard.fill` | Site audit tile | `Clipboard` |
| `mappin.and.ellipse` | Location | `MapPin` |
| `magnifyingglass` | Search | `Search` |
| `line.3.horizontal.decrease.circle` | Filter | `ListFilter` |
| `globe` | Setup on the web | `Globe` |
| `ellipsis` / `chevron.left` / `chevron.right` | menus | `Ellipsis` / `ChevronLeft` / `ChevronRight` |
| `theatermasks.fill` | Role preview | `Drama` |
| `clock.fill` | My Timesheets | `Clock` |
| `bolt.fill` | Price work | `Zap` |
| `sterlingsign.circle.fill` | Expenses | `PoundSterling` |
| `flag.fill` | End date | `Flag` |
| `person` | Manager row on work card | `User` |
| `building.2` | Client row on work card | `Building2` |

Add a row whenever a new symbol is met in 3A. Confirm each Lucide name exists in the chosen version.

## 7. iOS-only look-and-feel (do not fake)

Haptics, Face ID, widgets, jiggle-drag on desktop, SF Symbols, bundled SF Pro.

## Blueprint corrections

None vs Swift (not opened). Vs **web today**: Tailwind `primary-600` is `#2563eb`, not `#185FA5`. Login is a light split marketing card, not the iOS dark navy screen, despite `AuthenticationView.swift` header comment that iOS was built to match the web login — **those two have already drifted**. Phase 2 should restyle **both** to the LoginBrand tokens so they match again.
