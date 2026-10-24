# Cursor prompt: UI touch-up

Paste everything below the line into Cursor (Agent mode) from the `project-planner-web` root.

---

Apply a **UI-only touch-up** to this Next.js app. Read `docs/ui-touch-up/README.md` first, then `touch-up.css` and `COMPONENT_EDITS.md`. The `screenshots/` folder shows the target result on the real app.

## Rules

1. **UI only.** Don't add, remove or change features, handlers, props, state, effects, data fetching, Firebase calls, API routes, auth, permissions, routing, nav order or business logic. Don't touch `lib/canonical/**`, `lib/stores/**`, `app/api/**`, `firestore.rules`, `middleware.ts` or `lib/ui/theme.ts`.
2. **Keep the current design.** Same palette, same fonts, same layout (sizes, spacing, columns, order). This is a polish, not a redesign.
3. **No wording changes.**
4. **Only these edits are allowed:** appending `touch-up.css` to `app/globals.css`, and the `className` changes in `COMPONENT_EDITS.md`. If something else seems necessary, don't do it. List it in your report.
5. **Light and dark.** Check every change in light mode and dark mode (Account menu → Dark mode / Light mode).

## Steps

1. Append the full contents of `docs/ui-touch-up/touch-up.css` to the **end** of `app/globals.css`. Don't edit the rules above it.
2. Make the edits in sections 1–4 and 6 of `COMPONENT_EDITS.md` (sidebar, `IconChip`, page-header icon, banner, `DashboardHero`).
3. Work through the file list in section 5 of `COMPONENT_EDITS.md` and swap leftover violet/purple/indigo/pink/sky classes to tokens. Leave `blue-*`, and leave red/amber/green that mean error/warning/success.
4. Run `npm run lint`, `npm test` and `npm run build`. All must pass with no new warnings.
5. `git diff --stat` should only list `app/globals.css` and `.tsx` files with `className` changes. Revert any other kind of change.

## Check every page, in light and dark

- [ ] Login, MFA and setup screens (hero art panel is navy, nothing else changed)
- [ ] Home: neutral icon tiles with blue icons (hover fills blue), navy hero without the dashed circle, status chips keep amber/blue icons
- [ ] Sidebar: plain grey icons, active item blue icon on a grey row
- [ ] Daily overview, Warnings, Timesheets, Weekly report, Settings, Project workspace, User profile: same navy hero with a small coloured square on the label
- [ ] Projects, Small works, Operatives, Managers, Sub contractors, Manage users, Annual leave, Tasks, Site audit, Site map, Materials, Qualifications, Job types
- [ ] Schedule week/grid and booking slots
- [ ] Setup wizard and onboarding (the leftover-pastel files)
- [ ] Modals, sheets, popovers, toasts, command palette (⌘K), notifications, account menu, empty states
- [ ] Nothing moved: element positions match before and after at the same window width

Report back with the files changed, anything skipped, and screenshots of Home, Warnings and one setup screen in both themes.
