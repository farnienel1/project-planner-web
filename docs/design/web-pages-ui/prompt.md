# Claude Code prompt: web restyle of Daily overview, Timesheets and Manage users (UI only)

You're working in the **Project Planner web app** repo (projectplanner.us). Restyle these pages to match the approved design:

- **Daily overview**
- **every Timesheets page and modal**
- **Manage users**

The direction is to bring the web app in line with the iOS app: a navy grid header band with big figures, clean white cards and tables, and meaningful colour.

> **READ FIRST: this is a UI upgrade to the WEB APP ONLY.**
> It changes how the pages **look**, not what they **do**. It is **not** a function, feature or flow change for any feature in the web app.
> - Every button, link, tab, filter, form, modal, signature, save, approval, export and navigation must behave **exactly** as it does today, with the same result, same data and same next screen.
> - If a visual change would need a behaviour change, don't make it. Keep the current behaviour and report it as **Decision needed**.
> - The iOS app is **not** touched.

**This is purely visual.** Do not change the behaviour of any of the following:
- buttons
- flows
- routes
- saving
- signing
- exporting
- calculations
- validation
- permissions
- content

## Files

Put these in the repo at `docs/design/web-pages-ui/` before you start:

1. **`web-pages-ui-spec.md`** is the source of truth.
   - §1, "The UI-only rule", overrides everything.
   - §4 is the page-by-page parity map.
2. **`web-pages-ui-reference.html`** is the visual reference. Open it in a browser and use the pill tabs at the top to see every screen, including the empty day, unbooked day, timesheet, modals and sign page.
   - The data in it is for look only.
   - The **dashed "PREVIEW ONLY" strip of pill buttons** at the top is just a screen switcher for viewing the mock-up. **Do not build it.**
   - If the HTML and the spec differ, the spec wins.

## Non-negotiables

- **Same handlers.** Every button, link, tab, filter, date control, row click, modal and signature control calls the same handler or route as now.
- **Keep every step and URL.** That includes the Overtime, Expenses & Price Work hub and person sub-pages, the Book labour flow (out of scope, don't touch), and the `?period`, `?tab`, `?scope` and `?user` params.
- **No data or logic changes.** No changes to:
  - Firestore reads or writes
  - £, hours or overtime calculations
  - totals
  - timesheet states
  - sign-off, export or invoice rules
  - validation
  - warnings
  - counts
  - permissions
- **Keep meaningful text word for word.** This covers status names, warnings, notes, the signing declaration, empty states and payment-run text. The only exceptions are the tidy-ups listed in §4.
- **No new click targets or features.** Things that aren't clickable today (band figures, chips, bars) stay non-clickable. No new filters, sorting, shortcuts, settings or calculations.
- **Sign page summary.** The timesheet summary on the Sign page is a **read-only re-display** of the lines the user has just reviewed. Use the existing line component and existing data. If that needs new data fetching, stop and report it.
- **Nothing dropped.** Every "Before" item in §4 must still be there. If you find something in code that §4 doesn't list, **stop and report it**. Don't drop it or guess where it goes.
- **Out of scope:** the global sidebar and top bar (another pack covers them), the Book labour flow, and the iOS app.

## How to work

### Phase 1: Inspect, then stop. No edits.

1. Identify the framework, the styling system, the theme/tokens, and the files for each page, tab, modal and the signature component.
2. For every row in spec §4, report the current component, its handler or route, and its data source.
3. List anything in code that §4 doesn't cover. Include role-specific variants, error states and loading states.
4. List the files you'll change. They must be presentational only.
5. **Stop and wait for my approval.**

### Phase 2: Build

1. Add the tokens (spec §2) and shared components:
   - `PageBand`
   - `StatRow`
   - `Card`
   - `DataTable`
   - `SegmentedTabs`
   - `Chip`
   - `IconTile`
   - `ActionCard`
   - `EmptyState`
   - `Note`
   - `Modal`
2. Restyle the pages in this order, committing after each:
   1. Daily overview
   2. Timesheets hub
   3. My Timesheets
   4. Timesheet detail (including the exported/read-only view)
   5. Price Work / Expense modals
   6. Sign Timesheet
   7. User Timesheets (all three tabs)
   8. Overtime, Expenses & Price Work (hub, people, person, sub-pages)
   9. Manage users
3. Wrap the existing logic and handlers in the new components. Don't rewrite logic.

### Phase 3: Verify and report

1. Work through the spec §5 checklist item by item, giving evidence for each. **Zero behaviour change** is the first item; any difference counts as a failure.
2. **Click test.** For each page, click every control before and after the change and list the results.
3. **Number test.** For the same period and day, confirm that the timesheet lines, totals, Daily overview figures and User Timesheets values are identical before and after.
4. **Role test.** Log in as admin, manager and operative.
5. Provide screenshots of every page at 1440px, about 900px and 390px.
6. Report:
   - the files changed;
   - anything you couldn't match;
   - any **Decision needed** items.

Do not claim anything works unless you've tested it.

Begin with Phase 1.
