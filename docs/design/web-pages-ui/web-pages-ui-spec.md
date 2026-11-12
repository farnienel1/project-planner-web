# Project Planner Web: Daily Overview, Timesheets & Manage Users UI Spec

**Scope (web app only):**
- **Daily overview**
- **Timesheets:**
  - hub
  - My Timesheets
  - timesheet detail
  - Add Price Work and Add Expense modals
  - Sign Timesheet
  - User Timesheets (Awaiting sign-off, Signed off, Exported, and exported detail)
  - Overtime, Expenses & Price Work (hub, people list, person page, and the Overtime, Expenses and Price work pages)
- **Manage users**

**Type:** UI only. **Web app only.** This is a visual upgrade, not a feature, function or flow change.

**Visual reference:** `web-pages-ui-reference.html`.
- The **dashed "PREVIEW ONLY" strip of pill buttons** at the top is just a screen switcher for viewing the mock-up. **It is not part of the design. Do not build it.**
- The data in the reference comes from the user's screenshots and recording and is for look only.

**Direction:** bring the web app in line with the iOS app's newer look:
- a **navy grid header band** with big "at a glance" figures;
- clean white cards and **tables** instead of stacked pastel boxes;
- **gradient icon tiles**;
- one blue accent;
- colour used only where it means something: **amber** for overtime and pending, **red** for unbooked and warnings, **green** for signed and verified, **slate** for exported.

The current purple and blue gradient heroes and pastel stat boxes are replaced.

---

## 0. Read this first

> **This job changes how these pages LOOK. It must not change what anything DOES.**
>
> - It is a **UI upgrade to the web app only**. It is not a function, feature or flow change for any feature in the web app.
> - Every button, link, tab, filter, form, modal, signature, save, export, approval and navigation must work **exactly** as it does today, with the same result, the same data written and the same next screen.
> - If a visual change would require changing behaviour, **don't make it**. Keep the current behaviour and report it as **Decision needed**.
> - If in doubt, leave the behaviour alone and ask.

---

## 1. The UI-only rule

This section overrides everything else in this spec.

### You MAY change
- Layout, grouping and visual order within a page.
- Colours, type, spacing, borders, icons, chips and buttons.
- Card lists may become tables, and pastel stat boxes may become header figures.
- Purely presentational wrappers and components.
- Light copy tidy-ups listed in §4, such as "Tap to change booking" being covered by the **Change** button.

### You MUST NOT change
- **What anything does.** Every button, link, tab, filter, date control, row click, modal, signature control and form submit must call the same handler or route.
- **Flows and routes.** Keep every page and step that exists today, including:
  - the Overtime, Expenses & Price Work hub page;
  - the person page and its three sub-pages;
  - the Book labour flow;
  - the Sign page;
  - all URLs and query parameters (`?period=`, `?tab=`, `?scope=users&user=`).
- **Data and calculations.** Do not change any of the following:
  - Firestore reads or writes;
  - hours, overtime, day-rate and £ calculations;
  - totals;
  - timesheet states (Saved draft, Signed off, Exported);
  - sign-off and export logic;
  - invoice generation rules;
  - validation (e.g. job number required, receipt required);
  - warnings such as "Overlaps another booking";
  - counts.
- **Permissions and roles.** Who sees which page, tab, button or person.
- **Meaningful wording.** Status names, warning and instruction text, the 0 GBP note, the signing declaration, empty-state messages and payment-run text stay as they are.
- **Other pages**, the global sidebar and top bar (covered by the dashboard pack), and the **iOS app**.
- **Clickability.** Do not add new click targets or shortcuts.
  - Anything that isn't clickable today stays non-clickable. This includes header-band figures, chips, bars and table cells.
  - Anything that is clickable today stays clickable and goes to the same place.
  - A restyled button or row must keep its current handler, route, disabled state and loading state.
- **New features.** No new features, settings, filters, sorting, keyboard shortcuts, saved state or calculations.

### Header figures
The band shows **only figures already shown on that page today** (§4), moved into the band. Do not add new figures, counts or totals.

The one exception is the Sign page's timesheet summary (§4.6). It re-displays, read-only, the same timesheet lines and totals the user has just seen on the timesheet. It must use the existing data and the existing line rendering, with no new calculation.

---

## 2. Design tokens

Share these with the dashboard pack. If both packs are built, use one set.

| Token | Value | Use |
|---|---|---|
| `band` | `#0E1B36` + 28px grid at white 4.5%, radius 18 | Page header band |
| `band-muted` / `band-soft` | `#93A1BC` / `#C7D0E1` | Band labels / secondary text |
| `bg` | `#F2F4F8` | Page background |
| `card` | `#FFFFFF`, 1px `#E3E8F0`, radius 16 | Cards |
| `line-2` | `#EEF1F6` | Table row dividers |
| `field` | `#F6F8FC` | Inputs, search, selects |
| `ink` / `ink-2` / `muted` | `#0F1B33` / `#334155` / `#64748B` | Text |
| `primary` | gradient `#3B7BF0 → #2559D6` | Primary buttons |
| `blue` / `blue-soft` | `#2F6FE0` / `#E6EEFC` | Links, standard hours, "Std" chips |
| `amber` / `amber-soft` | `#F5A524` / `#FDF1DC` (text `#8A5300`) | Overtime, Saved draft, Awaiting sign-off, info notes |
| `red` / `red-soft` | `#E5484D` / `#FDECEC` (text `#B42318`) | Unbooked, Off, required, warnings |
| `green-soft` | `#EAF7F1` (text `#0B6B47`) | Signed off, Verified, Operative |
| `slate-soft` | `#EEF1F6` (text `#475569`) | Exported, PAYE, trade |
| `seg-on` | `#0E1B36` | Selected segment or tab |
| Tile gradients | blue `#5B8CF0→#2F5FD0`, purple `#8B7CF6→#5B46D6`, green `#34C38F→#12936A`, amber `#FBBF4A→#E08A0B` | Icon tiles, avatars |
| Overtime stripe | `repeating-linear-gradient(-45deg, #F5A524 0 3px, #E39412 3px 6px)` | Overtime in bars |

**Type:** Inter (or the app's sans-serif).
- Band title 26px bold, band figures 28px bold.
- Card titles 15px bold.
- Table header 11px uppercase.
- Body 13.5–14px.
- Use tabular figures.

**Shared components to build once:**
- `PageBand` (eyebrow, title, subtitle, actions, `StatRow`, optional glass panel)
- `Card` with header
- `DataTable`
- `SegmentedTabs` (with counts)
- `Chip`
- `IconTile`
- `ActionCard` (tile, title, description, "Open →")
- `EmptyState`
- `Note` (info, amber, red)
- `Modal`

---

## 3. Responsive

- **≥1100px:** as in the reference.
- **<1100px:** two-column grids stack.
- **<820px:**
  - The band's figures wrap.
  - Tables scroll inside their card.
  - The toolbar wraps.
  - No horizontal page scroll.
  - Modals stay within 92vw.

---

## 4. Page-by-page parity

Every "Before" item must be present and behave the same.

### 4.1 Daily overview (`/dashboard/daily-overview`)

| Before | After |
|---|---|
| Title "Daily overview", subtitle "Who is where, and who still needs booking", calendar icon | Band eyebrow "Daily overview · [full date]"; subtitle kept |
| Prev / **Today** / next, date picker. Shows **Back to today** when not on today. | Same controls in a dark pill group on the band. Same behaviour, including the Back to today state. |
| Date + "60.5h booked · 3 people" | Band title "60.5h booked · 3 people" |
| Stat boxes: Standard hrs, Overtime N× (label follows the multiplier), Job(s) active (singular/plural), Unbooked | Band figures. Overtime is amber. Unbooked turns red when > 0. Labels are unchanged, including the multiplier and plural. |
| "Where the team is" bar, "N booked · N unbooked", legend Office / WFH / On site | Glass panel with a segmented bar: on site, office and WFH in their own colours, and unbooked in red stripes. Legend with counts. The figures are the same. |
| **By project** card: project row (green icon, code chip, name, "N people · Nh booked", **Open project**) | Project header row, same contents and link |
| Person rows: initials, name, "Full day · Custom 07:00–22:00 · Tap to change booking", hours pill (incl. breakdown like "13.5h (8.5h + 2.5h × 2)"), **Change** | Table: Person · Booking (shift on line 1, times on line 2) · Type chip (Standard / Std + OT / OT only, from existing booking data) · Hours (mini std/OT bar + total, with the breakdown text underneath when present) · **Change**. Row click and Change do exactly what they do now. "Tap to change booking" is covered by the Change button. |
| Empty day: "Nothing booked yet" / "No one is booked onto a job for this day." + **Book labour** | `EmptyState` with the same text and button |
| **Annual leave** card: name, "Annual leave · Full day", **Off** chip | Same card in the right column, with an amber leave tile |
| **Unbooked labour** card (red icon, count badge, rows "Name (missing…)" + Unbooked chip, **Book labour**) | Red-bordered card, filled red triangle, count chip. Rows show the name and the existing "missing" text. Unbooked chip. Primary Book labour button. Shown under the same conditions as today. |
| Book labour flow (person → book to Other / Projects / Small works → project → slot) | **Out of scope:** don't change it |

### 4.2 Timesheets hub (`/dashboard/timesheets`)

| Before | After |
|---|---|
| Title "Timesheets", "Sign your hours and sign off your team" | Band eyebrow + subtitle |
| Hero: "Current payment run", "1 – 15 November 2026", "Paid on 20 November 2026", 0 GBP note | Band title = the run. Subtitle has the paid date. The 0 GBP note sits in a dark info note, with the text unchanged. |
| **My timesheets** card (+ chips "Current pay run", period) | `ActionCard` (blue clock tile), same chips, same link |
| **Overtime, Expenses & Price Work** card | `ActionCard` (amber tile), same link |
| **User timesheets** card with Awaiting sign-off / Signed off / Exported counts | `ActionCard` (purple tile) with a 3-figure mini row. The same counts are repeated as **display-only** band figures (not clickable). |
| Cards hidden for roles that can't see them | Same |

### 4.3 My Timesheets (`/dashboard/timesheets/mine`)

| Before | After |
|---|---|
| "My Timesheets" | Band with a back link to Timesheets |
| Current pay run period card: period + "Review bookings, add extras, and sign your timesheet." | Band title = period, subtitle kept. **Open current timesheet** button = the same link as the old card. |
| Past timesheets list: period, status (Signed off / Saved draft / Exported), "View breakdown, signatures, and generate invoice again." | Table: Pay run period · Status chip (green / amber / slate) · **View breakdown** button. The helper sentence moves to the card header. Row click = same link. |

### 4.4 Timesheet detail (`/dashboard/timesheets/mine?period=…&periodEnd=…`, also used for exported and team views)

| Before | After |
|---|---|
| "My Timesheets › Timesheet", period, "This period" | Band: back link, eyebrow "Timesheet · This period", period, **Total** large on the right |
| Day lines: date, project, times, "1.06 days × £250.00/day = £265.63", amount. Overtime lines "(Overtime)". Annual leave lines "Annual leave (full day) · 07:00–16:00 · No hours or pay". Overlap warning "Overlaps another booking — check with your manager". | Table: Day · Booking (+ times; **Overtime** amber chip; **Leave** chip with light blue row) · Calculation (same string) · Amount. The overlap warning appears as an amber inline note under the booking, **same condition, same text**. |
| Hours subtotal, Overtime, Total. Exported/team views also show "Hours · N shifts (Nh)", Price work · N, Expenses · N. | Band figures (Hours subtotal, Overtime amber, Price work, Expenses) **and** the totals block at the foot of the table. Every line shown today, in the same view, with the same numbers. |
| Payment runs & timesheets (Run 1–15 · Payout day 20; Run 16–31 · Payout day 5) + Note (0 GBP) | Side card: runs as a mini grid; the note is kept |
| Add to this timesheet: **Price Work** (Agreed extras), **Expenses** (+ receipts) | Side card with two tile buttons that open the same modals |
| Red notice "If you don't agree with the hours shown, amend your booking schedule before signing. Agreed changes appear on a new timesheet." | Red note with filled triangle, same text |
| **Continue to sign** | Primary button, same action |
| **Generate invoice** (disabled until approved) + "Add any expenses or price work, then confirm and approve your timesheet to unlock Generate invoice." | Secondary button with the same enable rule. Helper kept. |
| Exported/signed view: Signatures box ("Operative: name · date"), **Signed off** state, "To edit this timesheet, please go to the signed off timesheets page, export it and then edit within the exported timesheets tab." | Same layout as above in read-only mode. Signatures card, green Signed off chip/banner, and the instruction text kept. |

### 4.5 Add Price Work / Add Expense modals

| Before | After |
|---|---|
| Add Price Work: Cancel, Price work name, Description, Job number (required) + "Add the job number for this price work.", Amount (£0.00), Start date, Add end date, Manager who agreed this, Add price work | `Modal` with purple tile header and Cancel. The same fields in the same order (job number and amount side by side; start date and Add end date side by side). Required styling and error text unchanged. Submit = same action. |
| Add Expense: Cancel, Expense name, Description, Job number, Amount, Date, Upload receipt (Required), Add expense | `Modal` with green tile header. Same fields. Upload receipt is a dashed button with a red "Required" chip. Same validation and submit. |

### 4.6 Sign Timesheet

| Before | After |
|---|---|
| Back, "Sign Timesheet" | Band: back link, eyebrow "Sign timesheet · You're approving", period |
| You're approving: Period, Hours (£), Price work, Expenses, Timesheet total | Band figures plus **Timesheet total** large on the right. Same values and labels. |
| *(Timesheet detail lines, which the user has just reviewed on the previous screen)* | **Timesheet summary** card on the left, read-only. It shows the same day lines (Day · Booking · Calculation · Amount, including Overtime/Leave chips and overlap warnings), the subtotals (Hours, Overtime, Price work, Expenses) and the Timesheet total. The signature card sits on the right. **Render it with the existing timesheet line component in read-only mode, using the data the sign flow already has.** No new queries or calculations. If the sign route doesn't have the lines available without new data fetching, keep the existing "You're approving" summary only and report it as **Decision needed**. |
| Your signature, "Signing as [name]", **Clear**, "Type your name" field + autofill, signature/draw box, "Type your name to fill the box in handwriting, or draw. You can do both." | Card with the same controls. The signature canvas keeps typing **and** drawing. |
| Red "By signing you confirm these hours match the work you carried out." | Red note, same text |
| **Confirm Signature and Approve** (green; disabled until signed) | Green button, same enable rule and action |

### 4.7 User Timesheets (`/dashboard/timesheets/team?tab=…`)

| Before | After |
|---|---|
| "User Timesheets", "Current pay run period · 1 – 15 November 2026" | Band with back link; eyebrow and period |
| Tabs Awaiting sign-off / Signed off / Exported (`?tab=`) | `SegmentedTabs` with counts in the card, driving the **same tab state and URL**. The band repeats the 3 counts as **display-only** figures. |
| Awaiting note: "Operative signed — yellow pending clock until you counter-sign." | Amber note, same text |
| Empty: "No timesheets awaiting sign-off" + explanation | `EmptyState`, same text |
| Signed off tab | Same patterns (rows / empty state), same text |
| Exported note "Exported timesheets stay here for years and remain openable." | Info note, same text |
| Search (Name or payment run), Filter (First name / Last name / Date newest / Date oldest), Payment run select | One toolbar: search field, segmented sort, select. Same behaviour. |
| Row: initials, name, period link, "Exported [date, time]", "Hrs · OT · PW £ · Exp £ · Role", "Line manager: …", Exported chip | **Table:** Person · Pay run · Exported · Hrs · OT · PW · Exp · Role · Line manager · Status. The same values, split into columns. Row click = same detail page (`&user=`). |

### 4.8 Overtime, Expenses & Price Work

| Before | After |
|---|---|
| Hub "Overtime, Expenses & Price Work" with card "Users' Overtime, Expenses & Price Work · Everyone you can see. Read-only except approvals." (where it appears today) | Band + `ActionCard`, same text and link. Keep this step wherever it exists today. |
| People list (`?scope=users`): Search people, Everyone / PAYE / Self-employed, rows name + employment type | Band (subtitle kept, no figures). Toolbar: search + segmented filter. Table: avatar, name, employment chip (Self-employed amber, PAYE slate), chevron. Same row link. |
| Person page: name, Overtime / Expenses / Price work cards | Band with avatar, name and employment chip. Three `ActionCard`s (amber, green, purple) with the same links. |
| Overtime: "[Name] is self-employed: their overtime is on their timesheet. **Open User Timesheets**" | Info note, same text and link |
| Expenses: "[Name] is self-employed: these are the entries on their timesheets, read-only.", "PAYE payrun: 26 Oct – 25 Nov · paid 25 Nov", cards Current PAYE payrun / Past PAYE payruns / Custom date range | Band subtitle + dark note for the payrun line. Three `ActionCard`s with the same links. |
| Price work: "Price work · 26 Oct – 25 Nov", "No price work in this range." | Card header + `EmptyState`, same text. Lists use `DataTable` when there are entries. |

### 4.9 Manage users (`/dashboard/settings/users`)

| Before | After |
|---|---|
| "Manage users", "Roles, access and invitations for your organisation.", **Add user** | Band with eyebrow "Team". White **Add user** button runs the same action. |
| Role tabs Admins / Managers / Operatives | Segmented control on the band, same state |
| Status tabs Active N / Inactive N / Pending N | `SegmentedTabs` with counts, same filter |
| Search "Search [role] by name" | Toolbar search, same behaviour and placeholder |
| Section label (ADMINISTRATORS / …) + "N people" | Card header row, same |
| User card: avatar/photo, name, email, chips (Super Admin, Administrator, Operative, trade, Verified), **key** button, chevron | Table row: User (avatar/photo + name + email) · Role chip · Trade chip · Status chip (Verified, and any other existing status) · Actions (the **same key button**, icon-only with an aria-label naming its existing purpose, plus open). Row click = same as the card click today. |
| Empty and pending states | Same text in `EmptyState` |

---

## 5. Acceptance checklist

- [ ] **Zero behaviour change.** For every page in §4, the same click produces the same result, data and next screen as before. List any exception as a failure, not a note.
- [ ] No new click targets, features, filters, sorting, settings or calculations were added.
- [ ] The preview-only screen switcher from the reference HTML was **not** built.
- [ ] The diff touches only presentational files: components, markup, styles, tokens and icons. No changes to data, service, rules, function, route or calculation code.
- [ ] Every "Before" row in §4 is present and behaves identically. Click through every button, tab, filter, row, modal and date control before and after.
- [ ] Timesheet amounts, totals, states and the Generate invoice / Confirm signature enable rules are identical for the same period.
- [ ] Price work and expense validation works the same: job number required, receipt required.
- [ ] Daily overview figures match before and after for Today, a past day, an empty day and a day with unbooked labour.
- [ ] URLs and query params (`?period`, `?tab`, `?scope`, `?user`) are unchanged. Browser back and forward behave the same.
- [ ] Permissions: test as admin, manager and operative. Each sees the same pages, tabs and people as before.
- [ ] Desktop, tablet and phone widths: no horizontal scroll, and tables scroll within their card.
- [ ] No new console errors. Keyboard focus is visible. Icon-only buttons are labelled. Contrast is AA.
