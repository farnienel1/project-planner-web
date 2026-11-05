# Claude Code prompt: Home dashboard restyle (web, UI only)

You're working in the **Project Planner web app** repo (projectplanner.us). Your task is to restyle the **Home page, sidebar and top bar** to match an approved design.

**This is a purely visual change.** Buttons, links, flows, saving, data, calculations, permissions, routes and content must all behave exactly as they do now.

## Files

Before you start, put these in the repo at `docs/design/dashboard-ui/`:

1. **`dashboard-ui-spec.md`** is the source of truth. Read all of it. Section 1, "The UI-only rule", overrides everything else.
2. **`dashboard-ui-reference.html`** is the visual reference. Open it in a browser and match its layout, spacing, colours and typography.
   - Its numbers and task names are **sample figures for look only**. Never copy them into the app.
   - If the HTML and the spec differ, follow the spec.

## Non-negotiables (summary of spec §1)

- **Same behaviour.** Every clickable element calls the same handler, route or flow as before.
- **No data changes.** Do not change:
  - Firestore reads, writes, queries or rules
  - Cloud Functions
  - calculations or validation
  - routes
  - permissions
  - the iOS app
- **New panels reuse existing data only.** Labour Summary, Booked Hours, Who's on today and Today's Tasks may only use **existing, read-only** hooks, services or helpers that other pages already use. If something isn't available as-is:
  - show the panel's empty state ("Coming soon") or leave the panel out;
  - mark it **Decision needed** in your report;
  - do **not** write new queries or calculations.
- **No invented numbers or progress values.**
- **Keep every existing element.** Everything in spec §4 (parity map) must still be present and working.

## How to work

### Phase 1: Inspect and plan. Make no edits.

1. Identify:
   - the framework, the styling system (CSS modules, Tailwind, styled-components…) and the theme/token setup;
   - the files for the Home page, the sidebar, the top bar and the mobile nav.
2. For every row in spec §4, report the current component, the handler/route it uses, and its data source.
3. For each new panel, name the **existing** data source you'll reuse (file and function), or say it's unavailable and should get the fallback.
4. Check how nav **Customise** works. Confirm whether the grouped sidebar (Main menu / Team / Alerts) can respect it. If it can't, propose a single list and mark it **Decision needed**.
5. List the files you plan to change. **Only presentational files.**
6. **Stop and show me this report.** Wait for approval.

### Phase 2: Build. Only after I approve.

1. Add the tokens from spec §2, scoped as described there.
2. Build in this order, checking behaviour after each step:
   1. sidebar
   2. top bar
   3. page header
   4. stat strip
   5. Labour Summary (figures + team-today donut)
   6. Booked Hours
   7. Today's Tasks
   8. Who's on today
   9. Quick actions + Up next + Maintenance
   10. responsive behaviour
3. Wrap existing elements and handlers in new styling. Don't rewrite their logic. Keep existing component props, state and callbacks intact.
4. Make small, clear commits per step.

### Phase 3: Verify and report

1. Go through spec §5 (Acceptance checklist) item by item, giving evidence for each.
2. **Before/after click test.** Click every row in spec §4 and confirm it does the same thing as before. List the results.
3. **Diff check.** Confirm that no data, service, rules, function, route or schema files changed. Paste the list of changed files.
4. Provide screenshots at desktop (1440px), tablet (~900px) and phone (390px) widths.
5. Report:
   - any **Decision needed** items
   - any panel that fell back to its empty state, and what it would need
   - anything you couldn't match exactly

Do not say something works unless you've actually tested it.

Begin with Phase 1.
