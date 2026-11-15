# Claude Code prompt: web restyle of User profile and Edit user (UI only)

> **READ FIRST: this is a UI upgrade to the WEB APP ONLY.**
> It changes how the pages **look**, not what they **do**. It is **not** a function, feature or flow change.
> - Every field, select, toggle, permission, upload, qualification action, account action, Save, Back and Edit profile must behave **exactly** as today: same handler, same validation, same data saved, same next screen.
> - If a visual change would need a behaviour change, don't make it. Keep the current behaviour and report it as **Decision needed**.
> - The iOS app is **not** touched.

You're working in the **Project Planner web app** repo. Restyle these two pages to match the approved design:

- the **User profile** page: `/dashboard/users/{id}`
- the **Edit user / Edit operative** page: `/dashboard/users/{id}/edit`

Cover them for every user type.

## Files

Put these in the repo at `docs/design/user-profile-ui/` first:

1. **`user-profile-ui-spec.md`** is the source of truth.
   - §0 and §1 (the UI-only rules) override everything.
   - §3 is the section-by-section parity map, and §3.3 lists the variants.
2. **`user-profile-ui-reference.html`** is the visual reference. Open it in a browser.
   - The dashed **"PREVIEW ONLY"** strip of pill buttons at the top is just a screen switcher. **Do not build it.**
   - The data in it is for look only.
   - If the HTML and the spec differ, the spec wins.

It follows the same design system as `docs/design/web-pages-ui/`. Reuse those tokens and components if they're already built.

## Non-negotiables

- **Same sections, fields, text and order.** Same conditional visibility per role, employment type and allowance state.
- **No changes to logic.** Leave all of these exactly as they are:
  - pay (day ↔ hourly, removing the other rate, units, employment date);
  - line manager rules;
  - qualifications (upload limits, view, remove, Saved state);
  - annual leave figures and links;
  - permission sets and locked states;
  - account actions and their confirmations;
  - the save model ("No changes" or unsaved state, the Save control, success and offline banners).
- **Employment type select → segmented control** only if the options, values and `onChange` stay identical. Otherwise keep the select and restyle it.
- **Nothing new is clickable.** No new sections, summaries, anchors, shortcuts or calculations. Band figures are display-only.
- **Nothing may overflow.** No text cut off and no button, chip or field going past its card or the screen at 1440, 1280, 1024, 820 or 390px. Follow the patterns in spec §4 "Nothing may overflow" (e.g. stacked table rows on narrow screens, the breadcrumb prefix hidden on phones), and prove it with the automated check described there.
- **Nothing dropped.** If you find something in code that spec §3 doesn't list, **stop and report it**.

## How to work

### Phase 1: Inspect, then stop. No edits.

1. Find the components for both pages, every section, the qualification and upload components, the permissions list, the account actions, the save bar or indicator, and the loading state.
2. List what each variant renders today: Operative, Manager, Administrator, Super Admin, inactive, allowance off, and unsaved.
3. Map each item to spec §3. List anything §3 doesn't cover.
4. List the files you'll change. They must be presentational only.
5. **Stop and wait for my approval.**

### Phase 2: Build

1. Add the components `FormSection`, `Field`, `MoneyInput`, `ToggleRow`, `PermissionRow`, `QualificationCard`, `ActionRow` and `SaveState`, reusing the existing tokens.
2. Restyle in this order, committing after each:
   1. Profile view
   2. Edit page band and banners
   3. User details
   4. Role setup and pay
   5. Qualifications
   6. Annual leave
   7. Employment & timesheets
   8. Account status
   9. Permissions
   10. Account actions (including the Change user type chooser)
   11. Loading skeletons
3. Wrap the existing inputs and handlers. Don't rewrite logic or state.

### Phase 3: Verify and report

1. Work through the spec §5 checklist item by item, giving evidence for each. **Zero behaviour change** comes first; any difference is a failure.
2. **Save test.** For an Operative, a Manager and the Super Admin, make the same edit before and after the change, save, and compare the Firestore user documents field by field.
3. Provide screenshots of every variant at 1440px and 390px.
4. Report:
   - the files changed;
   - anything you couldn't match;
   - any **Decision needed** items.

Don't claim anything works unless you've tested it.

Begin with Phase 1.
